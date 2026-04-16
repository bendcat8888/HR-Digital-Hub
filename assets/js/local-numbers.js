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
            const numA = parseInt(a.local) || 0;
            const numB = parseInt(b.local) || 0;
            return numB - numA;
        });
    } else if (mode === "dept") {
        out.sort((a, b) => a.dept.localeCompare(b.dept) || a.local.localeCompare(b.local));
    } else { // number-asc
        out.sort((a, b) => {
            const numA = parseInt(a.local) || 0;
            const numB = parseInt(b.local) || 0;
            return numA - numB;
        });
    }
    return out;
}

function getFilteredRows() {
    const q = normalize(dom.search.value);
    let rows = allRows;
    if (q) {
        rows = rows.filter(r => 
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
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50";
        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 inline-flex items-center px-2.5 py-1 rounded-lg">
                    <i data-lucide="phone" class="w-3.5 h-3.5 mr-1.5 opacity-70"></i>
                    ${r.local}
                </div>
            </td>
            <td class="px-6 py-4 font-medium text-slate-800">
                ${r.user || "—"}
            </td>
            <td class="px-6 py-4 text-slate-600">
                ${r.dept || "—"}
            </td>
            <td class="px-6 py-4">
                <button type="button" class="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors" aria-label="Copy local" data-copy="${encodeURIComponent(r.local)}">
                    <i data-lucide="clipboard-copy" class="w-4 h-4"></i>
                </button>
            </td>
        `;
        dom.tbody.appendChild(tr);
    }

    lucide.createIcons();

    dom.tbody.querySelectorAll("[data-copy]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const local = decodeURIComponent(btn.getAttribute("data-copy") || "");
            try {
                await navigator.clipboard.writeText(local);
                showToast("Local " + local + " copied to clipboard.");
            } catch {
                showToast("Copy not available in this browser.");
            }
        });
    });
}

async function loadCsv() {
    const res = await fetch("../resources/local_directory.csv", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load CSV (" + res.status + ")");
    const text = await res.text();
    const rows = parseCsv(text);
    
    // Header is usually: Local ,User,Area / Department
    const header = rows[0] || [];
    const localIdx = header.findIndex(h => normalize(h).includes("local"));
    const userIdx = header.findIndex(h => normalize(h).includes("user"));
    const deptIdx = header.findIndex(h => normalize(h).includes("area") || normalize(h).includes("department"));

    const data = rows.slice(1).map(r => ({
        local: String(r[localIdx >= 0 ? localIdx : 0] || "").trim(),
        user: String(r[userIdx >= 0 ? userIdx : 1] || "").trim(),
        dept: String(r[deptIdx >= 0 ? deptIdx : 2] || "").trim()
    })).filter(r => r.local.length);

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
