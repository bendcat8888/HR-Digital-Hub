const forms = [
    {
        id: "leave-application",
        title: "Leave Application Form",
        description: "Apply for vacation, sick leave, emergency leave, or special leave types.",
        category: "HR",
        format: "PDF",
        size: "220 KB",
        updated: "2026-02-10",
        popularity: 98,
        fileUrl: "../resources/Leave Form.pdf",
        icon: "calendar-check"
    },
    {
        id: "gate-pass",
        title: "Gate Pass Request",
        description: "Request a gate pass for items, equipment, and materials.",
        category: "Operations",
        format: "PDF",
        size: "145 KB",
        updated: "2026-01-22",
        popularity: 92,
        fileUrl: "../resources/GATE-PASS.pdf",
        icon: "ticket"
    },
    {
        id: "reimbursement",
        title: "Expense Reimbursement",
        description: "Submit reimbursable expenses with required details and attachments list.",
        category: "Finance",
        format: "XLSX",
        size: "80 KB",
        updated: "2026-02-28",
        popularity: 88,
        fileUrl: "../resources/REIMBURSEMENT FORM.xlsx",
        icon: "receipt"
    },
    {
        id: "check-payment-request",
        title: "Check & Payment Request Form",
        description: "Submit check and payment requests with supporting details and approvals.",
        category: "Finance",
        format: "XLSX",
        size: "28 KB",
        updated: "2026-04-08",
        popularity: 87,
        fileUrl: "../resources/CPRF.xlsx",
        icon: "table"
    },
    {
        id: "overtime",
        title: "Overtime Authorization",
        description: "Request overtime approval with justification and schedule details.",
        category: "HR",
        format: "PDF",
        size: "170 KB",
        updated: "2025-12-19",
        popularity: 75,
        fileUrl: "../resources/OT Form.pdf",
        icon: "clock-9"
    },

    {
        id: "medical-reimbursement",
        title: "Medical Reimbursement Claim",
        description: "Claim eligible medical reimbursements with required supporting documents.",
        category: "Benefits",
        format: "PDF",
        size: "210 KB",
        updated: "2026-02-18",
        popularity: 70,
        fileUrl: "#",
        icon: "heart-pulse"
    },
    {
        id: "travel-request",
        title: "Authority to Travel",
        description: "Request business travel approval including itinerary and budget.",
        category: "HR",
        format: "PDF",
        size: "155 KB",
        updated: "2026-01-30",
        popularity: 79,
        fileUrl: "../resources/ATT Form.pdf",
        icon: "plane"
    },

    {
        id: "it-access",
        title: "IT Request",
        description: "Request system access, email groups, folders, and application permissions.",
        category: "IT",
        format: "PDF",
        size: "190 KB",
        updated: "2026-03-01",
        popularity: 53,
        fileUrl: "#",
        icon: "key-round"
    }
];

const dom = {
    search: document.getElementById("forms-search"),
    chips: document.getElementById("category-chips"),
    grid: document.getElementById("forms-grid"),
    empty: document.getElementById("forms-empty"),
    count: document.getElementById("forms-count"),
    clear: document.getElementById("clear-filters"),
    sort: document.getElementById("sort-by"),
    toast: document.getElementById("toast"),
    toastText: document.getElementById("toast-text")
};

let selectedCategory = "All";
let toastTimer = null;

function showToast(message) {
    dom.toastText.textContent = message;
    dom.toast.classList.remove("hidden");
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => dom.toast.classList.add("hidden"), 2400);
}

function formatDate(iso) {
    const d = new Date(iso + "T00:00:00");
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function getCategories() {
    const categories = new Set(["All"]);
    for (const f of forms) categories.add(f.category);
    return Array.from(categories);
}

function renderChips() {
    const categories = getCategories();
    dom.chips.innerHTML = "";

    for (const cat of categories) {
        const btn = document.createElement("button");
        const isActive = cat === selectedCategory;
        btn.type = "button";
        btn.className = [
            "px-3 py-2 rounded-xl text-sm font-semibold border transition-colors",
            isActive
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
        ].join(" ");
        btn.textContent = cat;
        btn.addEventListener("click", () => {
            selectedCategory = cat;
            renderChips();
            renderGrid();
        });
        dom.chips.appendChild(btn);
    }
}

function getFilteredForms() {
    const q = (dom.search.value || "").trim().toLowerCase();
    let items = forms.slice();

    if (selectedCategory !== "All") {
        items = items.filter(f => f.category === selectedCategory);
    }

    if (q) {
        items = items.filter(f => {
            return (
                f.title.toLowerCase().includes(q) ||
                f.description.toLowerCase().includes(q) ||
                f.category.toLowerCase().includes(q) ||
                f.format.toLowerCase().includes(q)
            );
        });
    }

    const sort = dom.sort.value;
    if (sort === "az") {
        items.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "recent") {
        items.sort((a, b) => new Date(b.updated) - new Date(a.updated));
    } else {
        items.sort((a, b) => b.popularity - a.popularity);
    }

    return items;
}

function badgeClass(format) {
    const f = (format || "").toUpperCase();
    if (f === "PDF") return "bg-rose-50 text-rose-700 border-rose-100";
    if (f === "XLSX") return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (f === "DOCX") return "bg-indigo-50 text-indigo-700 border-indigo-100";
    return "bg-slate-50 text-slate-700 border-slate-200";
}

function renderGrid() {
    const items = getFilteredForms();
    dom.count.textContent = String(items.length);

    dom.grid.innerHTML = "";
    dom.empty.classList.toggle("hidden", items.length !== 0);

    for (const f of items) {
        const card = document.createElement("div");
        card.className = "portal-card bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-300 h-full flex flex-col";
        card.innerHTML = `
            <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
                            <i data-lucide="${f.icon}" class="w-5 h-5"></i>
                        </div>
                        <div class="min-w-0">
                            <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider">${f.category}</div>
                            <h4 class="text-base font-bold text-slate-900 leading-tight truncate">${f.title}</h4>
                        </div>
                    </div>
                    <p class="text-slate-600 text-sm leading-relaxed">${f.description}</p>
                </div>
                <span class="shrink-0 text-xs font-bold border px-2 py-1 rounded-lg ${badgeClass(f.format)}">${f.format}</span>
            </div>

            <div class="mt-5 flex items-center justify-between gap-3 text-xs text-slate-500">
                <span class="inline-flex items-center gap-1">
                    <i data-lucide="history" class="w-4 h-4"></i>
                    Updated ${formatDate(f.updated)}
                </span>
                <span class="inline-flex items-center gap-1">
                    <i data-lucide="hard-drive" class="w-4 h-4"></i>
                    ${f.size}
                </span>
            </div>

            <div class="mt-6 flex items-center gap-2">
                <button type="button" class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors" data-download="${f.id}">
                    <i data-lucide="download" class="w-4 h-4"></i>
                    Download
                </button>
                <button type="button" class="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors" aria-label="Copy link" data-copy="${f.id}">
                    <i data-lucide="link" class="w-4 h-4"></i>
                </button>
            </div>
        `;

        dom.grid.appendChild(card);
    }

    lucide.createIcons();

    dom.grid.querySelectorAll("[data-download]").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-download");
            const f = forms.find(x => x.id === id);
            if (!f) return;
            if (f.fileUrl && f.fileUrl !== "#") {
                window.open(f.fileUrl, "_blank", "noopener,noreferrer");
                return;
            }
            showToast("This is a template card. Link the actual file URL when ready.");
        });
    });

    dom.grid.querySelectorAll("[data-copy]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-copy");
            const url = `${window.location.origin}${window.location.pathname}#${encodeURIComponent(id)}`;
            try {
                await navigator.clipboard.writeText(url);
                showToast("Link copied to clipboard.");
            } catch {
                showToast("Copy not available in this browser.");
            }
        });
    });
}

function clearFilters() {
    selectedCategory = "All";
    dom.search.value = "";
    dom.sort.value = "popular";
    renderChips();
    renderGrid();
}

document.addEventListener("DOMContentLoaded", () => {
    renderChips();
    renderGrid();
    lucide.createIcons();

    dom.search.addEventListener("input", () => renderGrid());
    dom.sort.addEventListener("change", () => renderGrid());
    dom.clear.addEventListener("click", () => clearFilters());

    const hash = (window.location.hash || "").slice(1);
    if (hash) {
        const id = decodeURIComponent(hash);
        const match = forms.find(f => f.id === id);
        if (match) showToast(`Showing: ${match.title}`);
    }
});
