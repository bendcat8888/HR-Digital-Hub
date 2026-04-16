const dom = {
    search: document.getElementById("contact-search"),
    sort: document.getElementById("contact-sort"),
    clear: document.getElementById("contact-clear"),
    count: document.getElementById("contact-count"),
    tbody: document.getElementById("contact-tbody"),
    empty: document.getElementById("contact-empty"),
    tableWrap: document.getElementById("contact-table-wrap"),
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

function normalize(text) {
    return String(text || "").toLowerCase().trim();
}

function cleanName(value) {
    const raw = String(value || "").trim();
    const unquoted = raw.replace(/^"(.*)"$/, "$1").trim();
    return unquoted || "—";
}

function parseTsv(text) {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!lines.length) return [];

    const dataRows = [];
    for (let i = 1; i < lines.length; i += 1) {
        const line = lines[i];
        const tabIndex = line.indexOf("\t");
        if (tabIndex < 0) continue;

        const number = line.slice(0, tabIndex).trim();
        const name = line.slice(tabIndex + 1).trim();
        if (!number) continue;

        dataRows.push({
            number,
            name: cleanName(name)
        });
    }

    return dataRows;
}

function sortRows(rows) {
    const mode = dom.sort.value;
    const out = rows.slice();

    if (mode === "name-za") {
        out.sort((a, b) => b.name.localeCompare(a.name) || a.number.localeCompare(b.number));
    } else if (mode === "number-asc") {
        out.sort((a, b) => a.number.localeCompare(b.number));
    } else if (mode === "number-desc") {
        out.sort((a, b) => b.number.localeCompare(a.number));
    } else {
        out.sort((a, b) => a.name.localeCompare(b.name) || a.number.localeCompare(b.number));
    }

    return out;
}

function getFilteredRows() {
    const q = normalize(dom.search.value);
    let rows = allRows;
    if (q) {
        rows = rows.filter(r => normalize(r.number).includes(q) || normalize(r.name).includes(q));
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
                    <i data-lucide="smartphone" class="w-3.5 h-3.5 mr-1.5 opacity-70"></i>
                    ${r.number}
                </div>
            </td>
            <td class="px-6 py-4 font-medium text-slate-800">
                ${r.name}
            </td>
            <td class="px-6 py-4">
                <button type="button" class="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors" aria-label="Copy number" data-copy="${encodeURIComponent(r.number)}">
                    <i data-lucide="clipboard-copy" class="w-4 h-4"></i>
                </button>
            </td>
        `;
        dom.tbody.appendChild(tr);
    }

    lucide.createIcons();

    dom.tbody.querySelectorAll("[data-copy]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const number = decodeURIComponent(btn.getAttribute("data-copy") || "");
            try {
                await navigator.clipboard.writeText(number);
                showToast(`Number ${number} copied to clipboard.`);
            } catch {
                showToast("Copy not available in this browser.");
            }
        });
    });
}

async function loadTsv() {
    const res = await fetch("../resources/company-mobile-numbers.txt", { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load TXT (${res.status})`);
    const text = await res.text();
    allRows = parseTsv(text);
}

function clearAll() {
    dom.search.value = "";
    dom.sort.value = "name-az";
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
        await loadTsv();
        render();
        showToast("Corporate contact numbers loaded.");
    } catch {
        allRows = [];
        render();
        showToast("Unable to load company-mobile-numbers.txt.");
    }

    setupPrivacyProtection();

    dom.search.addEventListener("input", () => render());
    dom.sort.addEventListener("change", () => render());
    dom.clear.addEventListener("click", () => clearAll());
});
