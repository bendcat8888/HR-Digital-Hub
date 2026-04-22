const dom = {
    search: document.getElementById("contact-search"),
    sort: document.getElementById("contact-sort"),
    requestButton: document.getElementById("contact-request"),
    clear: document.getElementById("contact-clear"),
    count: document.getElementById("contact-count"),
    tbody: document.getElementById("contact-tbody"),
    empty: document.getElementById("contact-empty"),
    tableWrap: document.getElementById("contact-table-wrap"),
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
let searchTimer = null;
let requestSeq = 0;
const revealedNumbers = new Set();

function showToast(message) {
    dom.toastText.textContent = message;
    dom.toast.classList.remove("hidden");
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => dom.toast.classList.add("hidden"), 2400);
}

function normalize(text) {
    return String(text || "").toLowerCase().trim();
}

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function sortRows(rows) {
    const mode = dom.sort.value;
    const out = rows.slice();
    if (mode === "name-za") {
        out.sort((a, b) => b.name.localeCompare(a.name) || b.number.localeCompare(a.number));
    } else if (mode === "number-asc") {
        out.sort((a, b) => a.number.localeCompare(b.number));
    } else if (mode === "number-desc") {
        out.sort((a, b) => b.number.localeCompare(a.number));
    } else {
        out.sort((a, b) => a.name.localeCompare(b.name) || a.number.localeCompare(b.number));
    }
    return out;
}

function renderIdleState() {
    dom.count.textContent = "Search required";
    dom.tbody.innerHTML = "";
    dom.tableWrap.classList.add("hidden");
    dom.empty.classList.remove("hidden");
    dom.empty.innerHTML = `
        <div class="inline-flex items-center justify-center w-16 h-16 bg-indigo-50 rounded-full text-indigo-500 mb-4 border border-indigo-100">
            <i data-lucide="search" class="w-8 h-8"></i>
        </div>
        <h3 class="text-xl font-semibold text-slate-900">Start with a name</h3>
        <p class="mt-2 text-slate-600 max-w-xl mx-auto">Type at least two letters of a name to reveal matching contact numbers from the server.</p>
    `;
    lucide.createIcons();
}

function renderNoMatches() {
    dom.count.textContent = "0 matches";
    dom.tbody.innerHTML = "";
    dom.tableWrap.classList.add("hidden");
    dom.empty.classList.remove("hidden");
    dom.empty.innerHTML = `
        <div class="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full text-slate-400 mb-4">
            <i data-lucide="search-x" class="w-8 h-8"></i>
        </div>
        <h3 class="text-xl font-semibold text-slate-900">No matches found</h3>
        <p class="mt-2 text-slate-600">Try another keyword or clear the search.</p>
    `;
    lucide.createIcons();
}

function maskNumber(number) {
    const value = String(number || "");
    if (value.length <= 8) return "***";
    return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function rowHtml(row) {
    const isRevealed = revealedNumbers.has(row.number);
    const displayNumber = isRevealed ? row.number : (row.masked_number || maskNumber(row.number));
    const revealLabel = isRevealed ? "Viewed" : "Show Number";
    const copyButton = isRevealed
        ? `<button type="button" class="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors" aria-label="Copy number" data-copy="${encodeURIComponent(row.number)}"><i data-lucide="clipboard-copy" class="w-4 h-4"></i></button>`
        : `<button type="button" class="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 transition-colors" aria-label="Copy number disabled" disabled><i data-lucide="clipboard-copy" class="w-4 h-4"></i></button>`;

    return `
        <td class="px-6 py-4 font-medium text-slate-800">
            ${escapeHtml(row.name || "—")}
        </td>
        <td class="px-6 py-4">
            <div class="flex items-center gap-2">
                <div class="font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 inline-flex items-center px-2.5 py-1 rounded-lg">
                    <i data-lucide="smartphone" class="w-3.5 h-3.5 mr-1.5 opacity-70"></i>
                    ${escapeHtml(displayNumber)}
                </div>
                <button type="button" class="inline-flex items-center justify-center px-3 h-9 rounded-xl border ${isRevealed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50"} transition-colors" data-reveal="${encodeURIComponent(row.number)}">
                    ${escapeHtml(revealLabel)}
                </button>
            </div>
        </td>
        <td class="px-6 py-4">
            <div class="flex items-center gap-2">
                ${copyButton}
            </div>
        </td>
    `;
}

function render(rows) {
    dom.count.textContent = `${rows.length} match${rows.length === 1 ? "" : "es"}`;
    dom.tbody.innerHTML = "";
    dom.empty.classList.add("hidden");
    dom.tableWrap.classList.remove("hidden");

    for (const row of rows) {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50";
        tr.innerHTML = rowHtml(row);
        dom.tbody.appendChild(tr);
    }

    lucide.createIcons();

    dom.tbody.querySelectorAll("[data-reveal]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const number = decodeURIComponent(btn.getAttribute("data-reveal") || "");
            if (!number) return;
            try {
                const response = await fetch("/api/contact-numbers/reveal", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ number })
                });
                if (!response.ok) throw new Error("Reveal failed");
                const data = await response.json();
                if (data.number) {
                    revealedNumbers.add(data.number);
                    showToast(`Number ${data.number} revealed and tracked.`);
                    updateResults();
                }
            } catch {
                showToast("Unable to reveal number right now.");
            }
        });
    });

    dom.tbody.querySelectorAll("[data-copy]").forEach((btn) => {
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

async function fetchMatches(query) {
    const sort = dom.sort.value || "name-az";
    const url = new URL("/api/contact-numbers", window.location.origin);
    url.searchParams.set("query", query);
    url.searchParams.set("sort", sort);

    const response = await fetch(url.toString(), {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" }
    });

    if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
    }

    return response.json();
}

async function updateResults() {
    const query = normalize(dom.search.value);
    if (query.length < 2) {
        renderIdleState();
        return;
    }

    const currentRequest = ++requestSeq;
    dom.count.textContent = "Searching...";
    dom.tableWrap.classList.add("hidden");
    dom.empty.classList.remove("hidden");
    dom.empty.innerHTML = `
        <div class="inline-flex items-center justify-center w-16 h-16 bg-indigo-50 rounded-full text-indigo-500 mb-4 border border-indigo-100 animate-pulse">
            <i data-lucide="loader-2" class="w-8 h-8"></i>
        </div>
        <h3 class="text-xl font-semibold text-slate-900">Searching securely</h3>
        <p class="mt-2 text-slate-600">Only matching rows are requested from the server.</p>
    `;
    lucide.createIcons();

    try {
        const data = await fetchMatches(query);
        if (currentRequest !== requestSeq) return;
        const rows = Array.isArray(data.items) ? data.items : [];
        if (!rows.length) {
            renderNoMatches();
            return;
        }
        render(rows);
    } catch {
        if (currentRequest !== requestSeq) return;
        dom.count.textContent = "Search unavailable";
        dom.tableWrap.classList.add("hidden");
        dom.empty.classList.remove("hidden");
        dom.empty.innerHTML = `
            <div class="inline-flex items-center justify-center w-16 h-16 bg-rose-50 rounded-full text-rose-500 mb-4 border border-rose-100">
                <i data-lucide="alert-triangle" class="w-8 h-8"></i>
            </div>
            <h3 class="text-xl font-semibold text-slate-900">Unable to load matches</h3>
            <p class="mt-2 text-slate-600">Please try again in a moment.</p>
        `;
        lucide.createIcons();
    }
}

function clearAll() {
    dom.search.value = "";
    dom.sort.value = "name-az";
    requestSeq += 1;
    renderIdleState();
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

document.addEventListener("DOMContentLoaded", () => {
    lucide.createIcons();
    setupPrivacyProtection();
    renderIdleState();

    dom.search.addEventListener("input", () => {
        if (searchTimer) window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(() => updateResults(), 220);
    });

    dom.sort.addEventListener("change", () => {
        if (normalize(dom.search.value).length >= 2) {
            updateResults();
        }
    });

    dom.clear.addEventListener("click", clearAll);

    dom.requestButton.addEventListener("click", () => {
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

        const itEmail = "ithelpdesk@innogen-pharma.com";
        const subject = encodeURIComponent("Request for Corporate Contact Numbers full list");
        const body = encodeURIComponent(
            `Hi IT Team,\n\nI would like to request access to the Corporate Contact Numbers full list.\n\nDetails:\nName: ${name}\nEmail: ${email}\n\nThank you.`
        );

        window.location.href = `mailto:${itEmail}?subject=${subject}&body=${body}`;
        closeRequestModal();
        showToast("Opening your email client...");
    });

    showToast("Type a name to reveal matching contact numbers.");
});
