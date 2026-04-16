const dom = {
    search: document.getElementById("email-search"),
    sort: document.getElementById("email-sort"),
    downloadContacts: document.getElementById("email-download-contacts"),
    clear: document.getElementById("email-clear"),
    count: document.getElementById("email-count"),
    tbody: document.getElementById("email-tbody"),
    empty: document.getElementById("email-empty"),
    tableWrap: document.getElementById("email-table-wrap"),
    toast: document.getElementById("toast"),
    toastText: document.getElementById("toast-text"),
    requestModal: document.getElementById("request-modal"),
    requestBackdrop: document.getElementById("request-modal-backdrop"),
    requestCancel: document.getElementById("request-cancel"),
    requestSubmit: document.getElementById("request-submit"),
    requestName: document.getElementById("request-name"),
    requestEmail: document.getElementById("request-email")
};

let toastTimer = null;
let allRows = [];

function showToast(message) {
    dom.toastText.textContent = message;
    dom.toast.classList.remove("hidden");
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => dom.toast.classList.add("hidden"), 2400);
}

function escapeCsvField(value) {
    const v = String(value ?? "");
    if (/[",\r\n]/.test(v)) {
        return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
}

function toTitleCase(text) {
    return String(text || "")
        .split(/\s+/g)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
}

function defaultContactNameFromEmail(email) {
    const local = String(email || "").split("@")[0] || "";
    const spaced = local.replace(/[._-]+/g, " ").trim();
    const named = toTitleCase(spaced);
    return named || String(email || "");
}

function buildGoogleContactsCsv(rows) {
    const header = [
        "Name",
        "Given Name",
        "Family Name",
        "E-mail 1 - Type",
        "E-mail 1 - Value",
        "Notes"
    ];

    const lines = [header.map(escapeCsvField).join(",")];

    rows.forEach((r) => {
        lines.push(
            [
                defaultContactNameFromEmail(r.email),
                "",
                "",
                "Work",
                r.email,
                r.restrictions || ""
            ]
                .map(escapeCsvField)
                .join(",")
        );
    });

    return lines.join("\r\n");
}

function downloadTextFile(filename, text, mimeType) {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
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
    if (mode === "za") {
        out.sort((a, b) => b.email.localeCompare(a.email));
    } else if (mode === "restrictions") {
        out.sort((a, b) => a.restrictions.localeCompare(b.restrictions) || a.email.localeCompare(b.email));
    } else {
        out.sort((a, b) => a.email.localeCompare(b.email));
    }
    return out;
}

function getFilteredRows() {
    const q = normalize(dom.search.value);
    let rows = allRows;
    if (q) {
        rows = rows.filter(r => normalize(r.email).includes(q) || normalize(r.restrictions).includes(q));
    }
    return sortRows(rows);
}

function rowBadgeClass(restrictions) {
    const r = normalize(restrictions);
    if (r.includes("unrestricted")) return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (r.includes("restricted")) return "bg-rose-50 text-rose-700 border-rose-100";
    return "bg-slate-50 text-slate-700 border-slate-200";
}

function render() {
    const rows = getFilteredRows();
    dom.count.textContent = String(rows.length);
    dom.tbody.innerHTML = "";
    dom.empty.classList.toggle("hidden", rows.length !== 0);

    for (const r of rows) {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50";
        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="font-semibold text-slate-900">${r.email}</div>
            </td>
            <td class="px-6 py-4">
                <span class="inline-flex items-center px-2 py-1 rounded-lg border text-xs font-bold ${rowBadgeClass(r.restrictions)}">${r.restrictions || "—"}</span>
            </td>
            <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                    <button type="button" class="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors" aria-label="Copy email" data-copy="${encodeURIComponent(r.email)}">
                        <i data-lucide="clipboard-copy" class="w-4 h-4"></i>
                    </button>
                    <a class="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors" aria-label="Email" href="mailto:${r.email}">
                        <i data-lucide="send" class="w-4 h-4"></i>
                    </a>
                </div>
            </td>
        `;
        dom.tbody.appendChild(tr);
    }

    lucide.createIcons();

    dom.tbody.querySelectorAll("[data-copy]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const email = decodeURIComponent(btn.getAttribute("data-copy") || "");
            try {
                await navigator.clipboard.writeText(email);
                showToast("Email copied to clipboard.");
            } catch {
                showToast("Copy not available in this browser.");
            }
        });
    });
}

async function loadCsv() {
    const res = await fetch("../resources/EmailAccounts2.csv", { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load CSV (${res.status})`);
    const text = await res.text();
    const rows = parseCsv(text);
    const header = rows[0] || [];
    const emailIdx = header.findIndex(h => normalize(h) === "email");
    const restrictionsIdx = header.findIndex(h => normalize(h) === "restrictions");

    const data = rows.slice(1).map(r => ({
        email: String(r[emailIdx >= 0 ? emailIdx : 0] || "").trim(),
        restrictions: String(r[restrictionsIdx >= 0 ? restrictionsIdx : 1] || "").trim()
    })).filter(r => r.email.length);

    allRows = data;
}

function clearAll() {
    dom.search.value = "";
    dom.sort.value = "az";
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

    dom.tableWrap.addEventListener("copy", (event) => {
        if (!event.target.closest("[data-copy]")) {
            event.preventDefault();
            showToast(blockMessage);
        }
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
        showToast("Email list loaded.");
    } catch {
        allRows = [];
        render();
        showToast("Unable to load EmailAccounts2.csv.");
    }

    setupPrivacyProtection();

    dom.search.addEventListener("input", () => render());
    dom.sort.addEventListener("change", () => render());
    dom.clear.addEventListener("click", () => clearAll());
    dom.downloadContacts.addEventListener("click", () => {
        if (!allRows.length) {
            showToast("No emails to export yet.");
            return;
        }
        dom.requestName.value = "";
        dom.requestEmail.value = "";
        dom.requestModal.classList.remove("hidden");
    });

    function closeRequestModal() {
        dom.requestModal.classList.add("hidden");
    }

    dom.requestCancel.addEventListener("click", closeRequestModal);
    dom.requestBackdrop.addEventListener("click", closeRequestModal);

    dom.requestSubmit.addEventListener("click", () => {
        const name = dom.requestName.value.trim();
        const email = dom.requestEmail.value.trim();
        if (!name || !email) {
            showToast("Please provide both name and email address.");
            return;
        }

        // Construct a mailto link to open the default email client
        const itEmail = "ithelpdesk@innogen-pharma.com";
        const subject = encodeURIComponent("Request for Corporate Email Contacts CSV");
        const body = encodeURIComponent(
            `Hi IT Team,\n\nI would like to request a copy of the Corporate Email Contacts CSV.\n\nDetails:\nName: ${name}\nEmail: ${email}\n\nThank you.`
        );

        window.location.href = `mailto:${itEmail}?subject=${subject}&body=${body}`;

        closeRequestModal();
        showToast("Opening your email client...");
    });
});
