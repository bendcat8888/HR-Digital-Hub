const dom = {
    search: document.getElementById("local-search"),
    sort: document.getElementById("local-sort"),
    clear: document.getElementById("local-clear"),
    count: document.getElementById("local-count"),
    tbody: document.getElementById("local-tbody"),
    empty: document.getElementById("local-empty"),
    tableWrap: document.getElementById("local-table-wrap"),
    toast: document.getElementById("toast"),
    toastText: document.getElementById("toast-text")
};

let toastTimer = null;
let allRows = [];
const revealedLocals = new Set();

function showToast(message) {
    dom.toastText.textContent = message;
    dom.toast.classList.remove("hidden");
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => dom.toast.classList.add("hidden"), 2400);
}

function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let i = 0;
    let inQuotes = false;

    while (i < text.length) {
        const ch = text[i];

        if (inQuotes) {
            if (ch === '"') {
                const next = text[i + 1];
                if (next === '"') {
                    field += '"';
                    i += 2;
                    continue;
                }
                inQuotes = false;
                i += 1;
                continue;
            }
            field += ch;
            i += 1;
            continue;
        }

        if (ch === '"') {
            inQuotes = true;
            i += 1;
            continue;
        }

        if (ch === ",") {
            row.push(field);
            field = "";
            i += 1;
            continue;
        }

        if (ch === "\r") {
            i += 1;
            continue;
        }

        if (ch === "\n") {
            row.push(field);
            field = "";
            if (row.length > 1 || row[0]?.length) rows.push(row);
            row = [];
            i += 1;
            continue;
        }

        field += ch;
        i += 1;
    }

    row.push(field);
    if (row.length > 1 || row[0]?.length) rows.push(row);
    return rows;
}

function normalize(text) {
    return String(text || "").toLowerCase().trim();
}

function sortRows(rows) {
    const mode = dom.sort.value;
    const out = rows.slice();
    if (mode === "number-desc") {
        out.sort((a, b) => {
            const numA = parseInt(a.local, 10) || 0;
            const numB = parseInt(b.local, 10) || 0;
            return numB - numA;
        });
    } else if (mode === "dept") {
        out.sort((a, b) => a.dept.localeCompare(b.dept) || a.local.localeCompare(b.local));
    } else {
        out.sort((a, b) => {
            const numA = parseInt(a.local, 10) || 0;
            const numB = parseInt(b.local, 10) || 0;
            return numA - numB;
        });
    }
    return out;
}

function maskLocal(local) {
    const value = String(local || "");
    if (value.length <= 4) return "***";
    const head = value.slice(0, 2);
    const tail = value.slice(-2);
    return `${head}***${tail}`;
}

function maskUser(user) {
    const value = String(user || "").trim();
    if (!value) return "—";
    return value
        .split(/([\/&,+-]|\s+)/)
        .map((part) => {
            if (!part.trim() || /[\/&,+-]|\s+/.test(part)) return part;
            if (part.length <= 2) return `${part[0]}*`;
            return `${part[0]}${"*".repeat(Math.max(2, Math.min(4, part.length - 1)))}`;
        })
        .join("")
        .replace(/\s{2,}/g, " ")
        .trim();
}

function getFilteredRows() {
    const q = normalize(dom.search.value);
    let rows = allRows;
    if (q) {
        rows = rows.filter((r) =>
            normalize(r.local).includes(q) ||
            normalize(r.user).includes(q) ||
            normalize(r.dept).includes(q)
        );
    }
    return sortRows(rows);
}

function render() {
    const rows = getFilteredRows();
    dom.count.textContent = String(rows.length);
    dom.tbody.innerHTML = "";
    dom.empty.classList.toggle("hidden", rows.length !== 0);

    for (const r of rows) {
        const isRevealed = revealedLocals.has(r.local);
        const displayLocal = isRevealed ? r.local : maskLocal(r.local);
        const displayUser = isRevealed ? (r.user || "—") : maskUser(r.user);
        const actionLabel = isRevealed ? "Viewed" : "Reveal";
        const actionClass = isRevealed
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : "border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50";

        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50";
        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 inline-flex items-center px-2.5 py-1 rounded-lg">
                    <i data-lucide="phone" class="w-3.5 h-3.5 mr-1.5 opacity-70"></i>
                    ${displayLocal}
                </div>
            </td>
            <td class="px-6 py-4 font-medium text-slate-800">
                ${displayUser}
            </td>
            <td class="px-6 py-4 text-slate-600">
                ${r.dept || "—"}
            </td>
            <td class="px-6 py-4">
                <button type="button" class="inline-flex items-center justify-center px-3 h-9 rounded-xl border ${actionClass} transition-colors" aria-label="Reveal local and user" data-reveal="${encodeURIComponent(r.local)}">
                    <i data-lucide="eye" class="w-4 h-4 mr-2"></i>
                    ${actionLabel}
                </button>
            </td>
        `;
        dom.tbody.appendChild(tr);
    }

    lucide.createIcons();

    dom.tbody.querySelectorAll("[data-reveal]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const local = decodeURIComponent(btn.getAttribute("data-reveal") || "");
            try {
                await fetch("/api/local-numbers/reveal", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ local })
                });
                revealedLocals.add(local);
                render();
                showToast(`Local ${local} revealed.`);
            } catch {
                showToast("Unable to reveal number right now.");
            }
        });
    });
}

async function loadCsv() {
    const res = await fetch("../resources/local_directory.csv", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load CSV (" + res.status + ")");
    const text = await res.text();
    const rows = parseCsv(text);

    const header = rows[0] || [];
    const localIdx = header.findIndex((h) => normalize(h).includes("local"));
    const userIdx = header.findIndex((h) => normalize(h).includes("user"));
    const deptIdx = header.findIndex((h) => normalize(h).includes("area") || normalize(h).includes("department"));

    const data = rows.slice(1).map((r) => ({
        local: String(r[localIdx >= 0 ? localIdx : 0] || "").trim(),
        user: String(r[userIdx >= 0 ? userIdx : 1] || "").trim(),
        dept: String(r[deptIdx >= 0 ? deptIdx : 2] || "").trim()
    })).filter((r) => r.local.length);

    allRows = data;
}

function clearAll() {
    dom.search.value = "";
    dom.sort.value = "number-asc";
    render();
}

function setupPrivacyProtection() {
    const blockMessage = "Bulk copy/select is disabled by privacy policy.";

    dom.tableWrap.classList.add("privacy-protect");

    dom.tableWrap.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        showToast(blockMessage);
    });

    dom.tableWrap.addEventListener("selectstart", (event) => {
        event.preventDefault();
    });

    document.addEventListener("keydown", (event) => {
        const key = event.key.toLowerCase();
        const hasCtrlCmd = event.ctrlKey || event.metaKey;
        const isInput = event.target.closest("input, textarea");

        if (!isInput && hasCtrlCmd && (key === "a" || key === "c" || key === "x" || key === "v")) {
            event.preventDefault();
            showToast(blockMessage);
            return;
        }

        if (event.key === "PrintScreen") {
            dom.tableWrap.classList.add("privacy-blur");
            showToast("Screenshot capture is discouraged by privacy policy.");
            window.setTimeout(() => dom.tableWrap.classList.remove("privacy-blur"), 1800);
        }
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    lucide.createIcons();

    try {
        await loadCsv();
        render();
        showToast("Local numbers loaded.");
    } catch {
        allRows = [];
        render();
        showToast("Unable to load local_directory.csv.");
    }

    setupPrivacyProtection();

    dom.search.addEventListener("input", () => render());
    dom.sort.addEventListener("change", () => render());
    dom.clear.addEventListener("click", () => clearAll());
});
