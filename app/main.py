import json
import logging
import os
import secrets
import time
import ipaddress
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel
from redis.asyncio import Redis

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("portal")
access_logger = logging.getLogger("portal.access")
audit_logger = logging.getLogger("portal.audit")

BASE_DIR = Path(__file__).resolve().parent.parent
PAGES_DIR = BASE_DIR / "pages"
ASSETS_DIR = BASE_DIR / "assets"
RESOURCES_DIR = BASE_DIR / "resources"
EMAIL_ACCOUNTS_SOURCE = RESOURCES_DIR / "EmailAccounts2.csv"

SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "innogen_portal_session")
SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "28800"))
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "true").lower() == "true"
SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "lax")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
SSO_BASE_URL = os.getenv("SSO_BASE_URL", "https://sso.innogen-pharma.com")
ALLOWED_EMAIL_DOMAINS = {
    d.strip().lower()
    for d in os.getenv("ALLOWED_EMAIL_DOMAINS", "innogen-pharma.com,innogen-pharma.ph").split(",")
    if d.strip()
}
TRUST_PROXY_HEADERS = os.getenv("TRUST_PROXY_HEADERS", "true").lower() == "true"
TRUSTED_PROXY_IPS = {
    ip.strip()
    for ip in os.getenv("TRUSTED_PROXY_IPS", "127.0.0.1,::1,172.26.0.1").split(",")
    if ip.strip()
}

PUBLIC_PATHS = {
    "/login",
    "/sso-callback",
    "/api/auth/session",
    "/api/auth/logout",
    "/healthz",
    "/favicon.ico",
}


class SessionStore:
    def __init__(self) -> None:
        self.redis: Redis | None = None
        self._memory: dict[str, tuple[dict[str, Any], float]] = {}

    async def connect(self) -> None:
        try:
            self.redis = Redis.from_url(REDIS_URL, decode_responses=True)
            await self.redis.ping()
            logger.info("Connected to Redis session store")
        except Exception as error:
            self.redis = None
            logger.warning("Redis unavailable, using in-memory sessions: %s", error)

    async def close(self) -> None:
        if self.redis is not None:
            await self.redis.close()

    async def get(self, session_id: str) -> dict[str, Any] | None:
        if self.redis is not None:
            raw = await self.redis.get(f"session:{session_id}")
            return json.loads(raw) if raw else None

        now = time.time()
        payload = self._memory.get(session_id)
        if not payload:
            return None
        data, expires_at = payload
        if expires_at < now:
            self._memory.pop(session_id, None)
            return None
        return data

    async def set(self, session_id: str, data: dict[str, Any], ttl_seconds: int) -> None:
        if self.redis is not None:
            await self.redis.setex(f"session:{session_id}", ttl_seconds, json.dumps(data))
            return
        self._memory[session_id] = (data, time.time() + ttl_seconds)

    async def delete(self, session_id: str) -> None:
        if self.redis is not None:
            await self.redis.delete(f"session:{session_id}")
            return
        self._memory.pop(session_id, None)


class VerifySessionPayload(BaseModel):
    authenticated: bool
    user: dict[str, str]


class PrivacyConsentPayload(BaseModel):
    policy_version: str
    last_policy_consent_date: str


class LocalNumberRevealPayload(BaseModel):
    local: str


class ContactNumberRevealPayload(BaseModel):
    number: str


session_store = SessionStore()
app = FastAPI(title="InnoGen Portal Hub", docs_url=None, redoc_url=None, openapi_url=None)


@app.on_event("startup")
async def startup() -> None:
    await session_store.connect()


@app.on_event("shutdown")
async def shutdown() -> None:
    await session_store.close()


def extract_ip_info(request: Request) -> tuple[str, str]:
    source_ip = request.client.host if request.client else "unknown"
    trust_headers = TRUST_PROXY_HEADERS
    if TRUSTED_PROXY_IPS:
        trust_headers = trust_headers and source_ip in TRUSTED_PROXY_IPS

    if trust_headers:
        x_forwarded_for = request.headers.get("x-forwarded-for", "")
        if x_forwarded_for:
            client_ip = x_forwarded_for.split(",")[0].strip()
        else:
            client_ip = request.headers.get("x-real-ip", source_ip).strip() or source_ip
    else:
        client_ip = source_ip

    try:
        ipaddress.ip_address(client_ip)
    except ValueError:
        client_ip = source_ip
    return client_ip, source_ip


def log_json(logger_obj: logging.Logger, event: str, payload: dict[str, Any]) -> None:
    logger_obj.info(json.dumps({"event": event, **payload}, separators=(",", ":"), ensure_ascii=True))


def is_public_path(path: str) -> bool:
    return path in PUBLIC_PATHS


def should_skip_auth(path: str) -> bool:
    if is_public_path(path):
        return True
    if path.startswith("/api/auth/session"):
        return True
    if path.startswith("/api/auth/logout"):
        return True
    return False


def validate_next_path(next_path: str | None) -> str:
    if not next_path:
        return "/"
    if not next_path.startswith("/") or next_path.startswith("//"):
        return "/"
    return next_path


def file_response(root_dir: Path, requested_path: str) -> FileResponse:
    normalized = (root_dir / requested_path).resolve()
    if not str(normalized).startswith(str(root_dir.resolve())):
        raise HTTPException(status_code=403, detail="Forbidden path")
    if not normalized.exists() or not normalized.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(normalized)


def normalize_search(text: str) -> str:
    return " ".join(str(text or "").lower().strip().split())


def parse_csv_rows(text: str) -> list[list[str]]:
    rows: list[list[str]] = []
    row: list[str] = []
    field = ""
    i = 0
    in_quotes = False

    while i < len(text):
        ch = text[i]

        if in_quotes:
            if ch == '"':
                next_ch = text[i + 1] if i + 1 < len(text) else ""
                if next_ch == '"':
                    field += '"'
                    i += 2
                    continue
                in_quotes = False
                i += 1
                continue
            field += ch
            i += 1
            continue

        if ch == '"':
            in_quotes = True
            i += 1
            continue

        if ch == ",":
            row.append(field)
            field = ""
            i += 1
            continue

        if ch == "\r":
            i += 1
            continue

        if ch == "\n":
            row.append(field)
            field = ""
            if len(row) > 1 or (row and row[0]):
                rows.append(row)
            row = []
            i += 1
            continue

        field += ch
        i += 1

    row.append(field)
    if len(row) > 1 or (row and row[0]):
        rows.append(row)
    return rows


_email_accounts_cache: dict[str, Any] = {"mtime_ns": None, "rows": []}


def load_email_accounts_rows() -> list[dict[str, str]]:
    try:
        stat = EMAIL_ACCOUNTS_SOURCE.stat()
    except FileNotFoundError:
        return []

    if _email_accounts_cache["mtime_ns"] != stat.st_mtime_ns:
        text = EMAIL_ACCOUNTS_SOURCE.read_text(encoding="utf-8-sig", errors="replace")
        csv_rows = parse_csv_rows(text)
        header = csv_rows[0] if csv_rows else []
        email_idx = next((i for i, value in enumerate(header) if normalize_search(value) == "email"), 0)
        restrictions_idx = next((i for i, value in enumerate(header) if normalize_search(value) == "restrictions"), 1)

        rows: list[dict[str, str]] = []
        for csv_row in csv_rows[1:]:
            email = str(csv_row[email_idx] if email_idx < len(csv_row) else "").strip()
            restrictions = str(csv_row[restrictions_idx] if restrictions_idx < len(csv_row) else "").strip()
            if email:
                rows.append({"email": email, "restrictions": restrictions})

        _email_accounts_cache["mtime_ns"] = stat.st_mtime_ns
        _email_accounts_cache["rows"] = rows

    return list(_email_accounts_cache["rows"])


_local_numbers_cache: dict[str, Any] = {"mtime_ns": None, "rows": []}


def load_local_numbers_rows() -> list[dict[str, str]]:
    source = RESOURCES_DIR / "local_directory.csv"
    try:
        stat = source.stat()
    except FileNotFoundError:
        return []

    if _local_numbers_cache["mtime_ns"] != stat.st_mtime_ns:
        text = source.read_text(encoding="utf-8-sig", errors="replace")
        csv_rows = parse_csv_rows(text)
        header = csv_rows[0] if csv_rows else []
        local_idx = next((i for i, value in enumerate(header) if "local" in normalize_search(value)), 0)
        user_idx = next((i for i, value in enumerate(header) if "user" in normalize_search(value)), 1)
        dept_idx = next((i for i, value in enumerate(header) if "area" in normalize_search(value) or "department" in normalize_search(value)), 2)

        rows: list[dict[str, str]] = []
        for csv_row in csv_rows[1:]:
            local = str(csv_row[local_idx] if local_idx < len(csv_row) else "").strip()
            user = str(csv_row[user_idx] if user_idx < len(csv_row) else "").strip()
            dept = str(csv_row[dept_idx] if dept_idx < len(csv_row) else "").strip()
            if local:
                rows.append({"local": local, "user": user, "dept": dept})

        _local_numbers_cache["mtime_ns"] = stat.st_mtime_ns
        _local_numbers_cache["rows"] = rows

    return list(_local_numbers_cache["rows"])


_contact_numbers_cache: dict[str, Any] = {"mtime_ns": None, "rows": []}


def load_contact_numbers_rows() -> list[dict[str, str]]:
    source = RESOURCES_DIR / "company-mobile-numbers.txt"
    try:
        stat = source.stat()
    except FileNotFoundError:
        return []

    if _contact_numbers_cache["mtime_ns"] != stat.st_mtime_ns:
        lines = source.read_text(encoding="utf-8-sig", errors="replace").splitlines()
        rows: list[dict[str, str]] = []
        for line in lines[1:]:
            if "\t" not in line:
                continue
            number, name = line.split("\t", 1)
            number = number.strip()
            name = name.strip().strip('"')
            if number:
                rows.append({"number": number, "name": name})

        _contact_numbers_cache["mtime_ns"] = stat.st_mtime_ns
        _contact_numbers_cache["rows"] = rows

    return list(_contact_numbers_cache["rows"])


@app.get("/api/email-accounts")
async def email_accounts(request: Request, query: str = "", sort: str = "az") -> dict[str, Any]:
    if not request.state.user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    normalized_query = normalize_search(query)
    if len(normalized_query) < 2:
        return JSONResponse(
            {"items": [], "count": 0, "search_required": True},
            headers={"Cache-Control": "no-store"},
        )

    rows = load_email_accounts_rows()
    filtered = [
        row
        for row in rows
        if normalized_query in normalize_search(row["email"]) or normalized_query in normalize_search(row["restrictions"])
    ]

    if sort == "za":
        filtered.sort(key=lambda row: row["email"].lower(), reverse=True)
    elif sort == "restrictions":
        filtered.sort(key=lambda row: (row["restrictions"].lower(), row["email"].lower()))
    else:
        filtered.sort(key=lambda row: row["email"].lower())

    return JSONResponse(
        {"items": filtered, "count": len(filtered), "search_required": False},
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api/local-numbers")
async def local_numbers(request: Request, query: str = "", sort: str = "number-asc") -> dict[str, Any]:
    if not request.state.user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    normalized_query = normalize_search(query)
    if len(normalized_query) < 2:
        return JSONResponse(
            {"items": [], "count": 0, "search_required": True},
            headers={"Cache-Control": "no-store"},
        )

    rows = load_local_numbers_rows()
    filtered = [
        row
        for row in rows
        if normalized_query in normalize_search(row["local"])
        or normalized_query in normalize_search(row["user"])
        or normalized_query in normalize_search(row["dept"])
    ]

    if sort == "number-desc":
        filtered.sort(key=lambda row: int("".join(ch for ch in row["local"] if ch.isdigit()) or "0"), reverse=True)
    elif sort == "dept":
        filtered.sort(key=lambda row: (row["dept"].lower(), row["local"].lower()))
    else:
        filtered.sort(key=lambda row: int("".join(ch for ch in row["local"] if ch.isdigit()) or "0"))

    masked = [
        {
            "local": row["local"],
            "masked_local": row["local"][:4] + "***" if len(row["local"]) > 4 else "***",
            "user": row["user"],
            "dept": row["dept"],
        }
        for row in filtered
    ]

    return JSONResponse(
        {"items": masked, "count": len(masked), "search_required": False},
        headers={"Cache-Control": "no-store"},
    )


@app.post("/api/local-numbers/reveal")
async def reveal_local_number(request: Request, payload: LocalNumberRevealPayload) -> dict[str, Any]:
    if not request.state.user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    target = (payload.local or "").strip()
    if not target:
        raise HTTPException(status_code=400, detail="Missing local number")

    rows = load_local_numbers_rows()
    match = next((row for row in rows if row["local"] == target), None)
    if not match:
        raise HTTPException(status_code=404, detail="Local number not found")

    log_json(
        audit_logger,
        "local_number_revealed",
        {
            "request_id": getattr(request.state, "request_id", ""),
            "client_ip": getattr(request.state, "client_ip", ""),
            "source_ip": getattr(request.state, "source_ip", ""),
            "email": (request.state.user or {}).get("email"),
            "local": match["local"],
            "user": match["user"],
            "dept": match["dept"],
        },
    )

    return JSONResponse(
        {"local": match["local"]},
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api/contact-numbers")
async def contact_numbers(request: Request, query: str = "", sort: str = "name-az") -> dict[str, Any]:
    if not request.state.user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    normalized_query = normalize_search(query)
    if len(normalized_query) < 2:
        return JSONResponse(
            {"items": [], "count": 0, "search_required": True},
            headers={"Cache-Control": "no-store"},
        )

    rows = load_contact_numbers_rows()
    filtered = [
        row
        for row in rows
        if normalized_query in normalize_search(row["number"]) or normalized_query in normalize_search(row["name"])
    ]

    if sort == "name-za":
        filtered.sort(key=lambda row: (row["name"].lower(), row["number"].lower()), reverse=True)
    elif sort == "number-asc":
        filtered.sort(key=lambda row: row["number"])
    elif sort == "number-desc":
        filtered.sort(key=lambda row: row["number"], reverse=True)
    else:
        filtered.sort(key=lambda row: (row["name"].lower(), row["number"].lower()))

    masked = [
        {
            "number": row["number"],
            "masked_number": row["number"][:4] + "***" + row["number"][-4:] if len(row["number"]) > 8 else "***",
            "name": row["name"],
        }
        for row in filtered
    ]

    return JSONResponse(
        {"items": masked, "count": len(masked), "search_required": False},
        headers={"Cache-Control": "no-store"},
    )


@app.post("/api/contact-numbers/reveal")
async def reveal_contact_number(request: Request, payload: ContactNumberRevealPayload) -> dict[str, Any]:
    if not request.state.user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    target = (payload.number or "").strip()
    if not target:
        raise HTTPException(status_code=400, detail="Missing contact number")

    rows = load_contact_numbers_rows()
    match = next((row for row in rows if row["number"] == target), None)
    if not match:
        raise HTTPException(status_code=404, detail="Contact number not found")

    log_json(
        audit_logger,
        "contact_number_revealed",
        {
            "request_id": getattr(request.state, "request_id", ""),
            "client_ip": getattr(request.state, "client_ip", ""),
            "source_ip": getattr(request.state, "source_ip", ""),
            "email": (request.state.user or {}).get("email"),
            "number": match["number"],
            "name": match["name"],
        },
    )

    return JSONResponse(
        {"number": match["number"]},
        headers={"Cache-Control": "no-store"},
    )


def set_session_cookie(response: Response, session_id: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_id,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        secure=SESSION_COOKIE_SECURE,
        samesite=SESSION_COOKIE_SAMESITE,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")


@app.middleware("http")
async def security_and_access_log_middleware(request: Request, call_next):
    started_at = time.time()
    request_id = secrets.token_hex(12)
    request.state.request_id = request_id
    client_ip, source_ip = extract_ip_info(request)
    request.state.client_ip = client_ip
    request.state.source_ip = source_ip
    request.state.user = None

    if request.url.path == "/":
        session_id = request.cookies.get(SESSION_COOKIE_NAME)
        if session_id:
            request.state.user = await session_store.get(session_id)
        response = await call_next(request)
        duration_ms = int((time.time() - started_at) * 1000)
        log_json(
            access_logger,
            "request",
            {
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": duration_ms,
                "client_ip": client_ip,
                "source_ip": source_ip,
                "user_email": (request.state.user or {}).get("email"),
                "user_agent": request.headers.get("user-agent", ""),
            },
        )
        return response

    if not should_skip_auth(request.url.path):
        session_id = request.cookies.get(SESSION_COOKIE_NAME)
        if not session_id:
            if request.url.path.startswith("/api/"):
                response = JSONResponse({"detail": "Unauthorized"}, status_code=401)
            else:
                next_path = quote(request.url.path)
                response = RedirectResponse(url=f"/login?next={next_path}", status_code=302)
            duration_ms = int((time.time() - started_at) * 1000)
            log_json(
                access_logger,
                "request",
                {
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "duration_ms": duration_ms,
                    "client_ip": client_ip,
                    "source_ip": source_ip,
                    "user_email": None,
                    "user_agent": request.headers.get("user-agent", ""),
                },
            )
            return response

        user_session = await session_store.get(session_id)
        if not user_session:
            if request.url.path.startswith("/api/"):
                response = JSONResponse({"detail": "Unauthorized"}, status_code=401)
            else:
                next_path = quote(request.url.path)
                response = RedirectResponse(url=f"/login?next={next_path}", status_code=302)
            clear_session_cookie(response)
            duration_ms = int((time.time() - started_at) * 1000)
            log_json(
                access_logger,
                "request",
                {
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "duration_ms": duration_ms,
                    "client_ip": client_ip,
                    "source_ip": source_ip,
                    "user_email": None,
                    "user_agent": request.headers.get("user-agent", ""),
                },
            )
            return response

        request.state.user = user_session

    response = await call_next(request)
    duration_ms = int((time.time() - started_at) * 1000)
    log_json(
        access_logger,
        "request",
        {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": duration_ms,
            "client_ip": client_ip,
            "source_ip": source_ip,
            "user_email": (request.state.user or {}).get("email"),
            "user_agent": request.headers.get("user-agent", ""),
        },
    )
    return response


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request) -> HTMLResponse:
    next_path = validate_next_path(request.query_params.get("next"))
    callback_url = f"/sso-callback?next={quote(next_path)}"
    html = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Login • InnoGen Portal Hub</title>
  <link rel="icon" type="image/png" href="https://sso.innogen-pharma.com/static/favicon.png" />
  <link rel="apple-touch-icon" href="https://sso.innogen-pharma.com/static/favicon.png" />
  <script>document.title = "InnoGen One • Digital Hub";</script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .hero-title {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: baseline;
      gap: 0.34em;
      letter-spacing: -0.035em;
      line-height: 1.12;
      padding-bottom: 0.06em;
      overflow: visible;
    }

    .hero-one {
      position: relative;
      isolation: isolate;
      display: inline-grid;
      place-items: center;
      min-width: 3.15em;
      padding: 0.08em 0.44em;
      margin: 0 0.02em;
      border-radius: 999px;
      background:
        radial-gradient(120% 180% at 22% 18%, rgba(255, 255, 255, 0.12) 0 12%, transparent 13%),
        radial-gradient(120% 180% at 78% 82%, rgba(198, 190, 255, 0.16) 0 12%, transparent 13%),
        linear-gradient(90deg, #572B82 0%, #6F68EA 100%);
      background-size: 180% 180%, 180% 180%, 100% 100%;
      background-position: 0% 0%, 100% 100%, 0 0;
      color: rgba(255, 255, 255, 0.98);
      border: 1px solid rgba(255, 255, 255, 0.24);
      box-shadow: 0 14px 36px rgba(87, 43, 130, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.16);
      vertical-align: middle;
      transform: translateY(-0.02em);
      line-height: 1;
      font-weight: 800;
      letter-spacing: -0.04em;
      font-size: 0.97em;
      overflow: hidden;
      animation: hero-circuit-flow 6.8s ease-in-out infinite;
    }

    .hero-one::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background:
        repeating-linear-gradient(135deg,
          transparent 0 13px,
          rgba(244, 240, 255, 0.12) 13px 14px,
          transparent 14px 26px,
          rgba(241, 232, 255, 0.06) 26px 27px,
          transparent 27px 40px),
        repeating-linear-gradient(45deg,
          transparent 0 16px,
          rgba(232, 226, 255, 0.05) 16px 17px,
          transparent 17px 34px);
      background-size: 180px 100%, 120px 100%;
      background-position: 0 0, 0 0;
      opacity: 0.9;
      mix-blend-mode: screen;
      pointer-events: none;
      animation: hero-circuit-pan 10s linear infinite;
    }

    .hero-one::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background:
        radial-gradient(circle at 18% 50%, rgba(255, 255, 255, 0.28) 0 2px, transparent 3px),
        radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.16) 0 1.5px, transparent 2.5px),
        radial-gradient(circle at 82% 50%, rgba(255, 255, 255, 0.28) 0 2px, transparent 3px);
      opacity: 0.75;
      pointer-events: none;
      animation: hero-circuit-pulse 4.2s ease-in-out infinite;
    }

    @keyframes hero-circuit-flow {
      0%, 100% { background-position: 0% 0%, 100% 100%, 0 0; }
      50% { background-position: 100% 100%, 0% 0%, 0 0; }
    }

    @keyframes hero-circuit-pan {
      from { background-position: 0 0, 0 0; }
      to { background-position: 180px 0, -120px 0; }
    }

    @keyframes hero-circuit-pulse {
      0%, 100% { transform: scale(1); opacity: 0.68; }
      50% { transform: scale(1.02); opacity: 0.92; }
    }
  </style>
</head>
<body class="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center px-6">
  <main class="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-sm p-8">
    <h1 class="hero-title text-2xl font-extrabold tracking-tight sm:text-[2rem]">
      <span>InnoGen</span>
      <span class="hero-one">One</span>
      <span>Digital Hub</span>
    </h1>
    <p class="mt-2 text-sm text-slate-600">Sign in with your InnoGen account to continue.</p>
    <label for="emailAddress" class="mt-6 block text-sm font-medium text-slate-700">Email address</label>
    <input
      id="emailAddress"
      name="emailAddress"
      type="email"
      autocomplete="email"
      placeholder="e.g. juan@innogen-pharma.com"
      class="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
    />
    <button id="continueWithInnogen" type="button" class="mt-5 w-full inline-flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#451c86] via-[#5b21b6] to-[#7c3aed] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 hover:from-[#3b1778] hover:via-[#4c1d95] hover:to-[#6d28d9]">
      <span class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white p-1 shadow-sm ring-1 ring-white/60">
        <img src="https://sso.innogen-pharma.com/static/favicon.png" alt="InnoGen" class="h-5 w-5 object-contain" />
      </span>
      <span>Continue with InnoGen</span>
    </button>
  </main>
  <script>
    const SSO_BASE = "{SSO_BASE_URL}".trim();
    const returnTo = window.location.origin + "{callback_url}";
    document.getElementById("continueWithInnogen").addEventListener("click", () => {
      const emailValue = document.getElementById("emailAddress").value.trim();
      const loginUrl = new URL("/login", SSO_BASE);
      loginUrl.searchParams.set("return_to", returnTo);
      if (emailValue) {
        loginUrl.searchParams.set("email", emailValue);
      }
      window.location.href = loginUrl.toString();
    });
  </script>
</body>
</html>
""".replace("{SSO_BASE_URL}", SSO_BASE_URL).replace("{callback_url}", callback_url)
    return HTMLResponse(content=html)


@app.get("/sso-callback", response_class=HTMLResponse)
async def sso_callback_page(request: Request) -> HTMLResponse:
    next_path = validate_next_path(request.query_params.get("next"))
    html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Completing Sign-In • InnoGen Portal Hub</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center px-6">
  <main class="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-sm p-8">
    <h1 class="text-xl font-bold">Completing sign-in...</h1>
    <p id="status" class="mt-2 text-sm text-slate-600">Verifying your SSO session.</p>
  </main>
  <script>
    const statusNode = document.getElementById("status");
    const SSO_BASE = "{SSO_BASE_URL}";
    const nextPath = "{next_path}";

    async function completeSignIn() {{
      try {{
        const verifyResponse = await fetch(`${{SSO_BASE}}/api/v1/verify-session`, {{
          method: "GET",
          credentials: "include"
        }});
        const verifyData = await verifyResponse.json();

        if (!verifyData.authenticated) {{
          window.location.assign(`/login?next=${{encodeURIComponent(nextPath)}}`);
          return;
        }}

        const sessionResponse = await fetch("/api/auth/session", {{
          method: "POST",
          credentials: "include",
          headers: {{ "Content-Type": "application/json" }},
          body: JSON.stringify(verifyData)
        }});

        if (!sessionResponse.ok) {{
          throw new Error("Unable to create app session.");
        }}

        window.location.assign(nextPath);
      }} catch (error) {{
        statusNode.textContent = "Sign-in failed. Please try again.";
        console.error(error);
      }}
    }}

    completeSignIn();
  </script>
</body>
</html>
"""
    return HTMLResponse(content=html)


@app.post("/api/auth/session")
async def create_app_session(request: Request, payload: VerifySessionPayload) -> JSONResponse:
    if not payload.authenticated:
        raise HTTPException(status_code=401, detail="SSO verification failed")

    email = (payload.user.get("email") or "").strip().lower()
    domain = (payload.user.get("domain") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Missing user email")

    if not domain and "@" in email:
        domain = email.split("@", 1)[1]
    if domain not in ALLOWED_EMAIL_DOMAINS:
        raise HTTPException(status_code=403, detail="Email domain is not allowed")

    session_id = secrets.token_urlsafe(48)
    session_payload: dict[str, Any] = {
        "email": email,
        "domain": domain,
        "authenticated_at": datetime.now(timezone.utc).isoformat(),
    }
    await session_store.set(session_id, session_payload, SESSION_TTL_SECONDS)

    response = JSONResponse({"ok": True})
    set_session_cookie(response, session_id)
    log_json(
        audit_logger,
        "session_created",
        {
            "request_id": getattr(request.state, "request_id", ""),
            "client_ip": getattr(request.state, "client_ip", ""),
            "source_ip": getattr(request.state, "source_ip", ""),
            "email": email,
        },
    )
    return response


@app.post("/api/auth/logout")
async def logout(request: Request) -> JSONResponse:
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if session_id:
        await session_store.delete(session_id)

    response = JSONResponse({"ok": True})
    clear_session_cookie(response)
    log_json(
        audit_logger,
        "session_ended",
        {
            "request_id": getattr(request.state, "request_id", ""),
            "client_ip": getattr(request.state, "client_ip", ""),
            "source_ip": getattr(request.state, "source_ip", ""),
            "email": (request.state.user or {}).get("email") if hasattr(request.state, "user") else None,
        },
    )
    return response


@app.get("/api/me")
async def current_user(request: Request) -> dict[str, Any]:
    if not request.state.user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return {
        "authenticated": True,
        "user": request.state.user,
        "client_ip": getattr(request.state, "client_ip", ""),
        "source_ip": getattr(request.state, "source_ip", ""),
    }


@app.post("/api/privacy-consent")
async def privacy_consent(request: Request, payload: PrivacyConsentPayload) -> dict[str, bool]:
    if not request.state.user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    log_json(
        audit_logger,
        "privacy_consent",
        {
            "request_id": getattr(request.state, "request_id", ""),
            "client_ip": getattr(request.state, "client_ip", ""),
            "source_ip": getattr(request.state, "source_ip", ""),
            "email": (request.state.user or {}).get("email"),
            "policy_version": payload.policy_version,
            "consent_date": payload.last_policy_consent_date,
        },
    )
    return {"ok": True}


@app.get("/")
async def root_page(request: Request):
    if not request.state.user:
        return RedirectResponse(url="/login?next=/", status_code=302)
    return file_response(BASE_DIR, "index.html")


@app.get("/index.html", response_class=FileResponse)
async def index_alias() -> FileResponse:
    return file_response(BASE_DIR, "index.html")


@app.get("/pages/{path:path}", response_class=FileResponse)
async def pages(path: str) -> FileResponse:
    return file_response(PAGES_DIR, path)


@app.get("/assets/{path:path}", response_class=FileResponse)
async def assets(path: str) -> FileResponse:
    return file_response(ASSETS_DIR, path)


@app.get("/resources/{path:path}", response_class=FileResponse)
async def resources(path: str) -> FileResponse:
    blocked = {"emailaccounts2.csv", "company-mobile-numbers.txt"}
    if Path(path).name.lower() in blocked:
        raise HTTPException(status_code=404, detail="File not found")
    return file_response(RESOURCES_DIR, path)
