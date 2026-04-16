const apps = [
    {
        id: "meeting-room-reservation",
        title: "Meeting Room Reservation App",
        description: "Book meeting rooms, check availability, and manage reservations with a simple workflow.",
        category: "Facilities",
        icon: "calendar-check",
        url: "https://www.appsheet.com/start/6004124f-93de-4f0b-a109-6d03bda05893",
        popularity: 95,
        badge: "AppSheet"
    },
    {
        id: "pdf-architect",
        title: "PDF Architect App",
        description: "Create, edit, split, merge, and insert images. Reduces file size upto 85%",
        category: "PDF Tools",
        icon: "file-text",
        url: "https://pdf.innogen.local/",
        popularity: 90,
        badge: "Internal"
    },
    {
        id: "qrstudio",
        title: "QRStudio App",
        description: "Generate QR codes for links, labels, and Digital Business Cards in seconds.",
        category: "Utilities",
        icon: "qr-code",
        url: "https://qr.innogen.local/",
        popularity: 88,
        badge: "Internal"
    },
    {
        id: "dynamic-hr-clearance",
        title: "Dynamic HR Clearance",
        description: "Submit and track HR clearance requests with a streamlined, digital workflow.",
        category: "HR",
        icon: "clipboard-check",
        url: "https://clearance.innogen.local/",
        popularity: 83,
        badge: "Internal"
    },
    {
        id: "pdf-to-word",
        title: "PDF Convert to Word",
        description: "Convert PDF files into simple Word documents with a drag-and-drop flow.",
        category: "PDF Tools",
        icon: "file-output",
        url: "https://pdf2word.innogen.local/",
        popularity: 86,
        badge: "Internal"
    },
    {
        id: "fleet-app",
        title: "Fleet App (VRR)",
        description: "Vehicle Repair Request app for submitting VRR, tracking maintenance history, and viewing next PMS.",
        category: "Finance",
        icon: "car",
        url: "https://www.appsheet.com/start/34431d83-b7ee-4ebe-8458-9ae7284d4453",
        popularity: 84,
        badge: "AppSheet"
    },
    {
        id: "ppe-savings",
        title: "PPE & Other Applications",
        description: "Access PPE and Savings Program and related finance applications.",
        category: "Finance",
        icon: "wallet",
        url: "https://ppe.innogen-pharma.com/",
        popularity: 82,
        badge: "Public"
    },
    {
        id: "igf-apps",
        title: "IGF & Other Applications",
        description: "Open IGF portal for finance workflows and internal applications.",
        category: "Finance",
        icon: "badge-dollar-sign",
        url: "https://workbench.corp.innogen.local/",
        popularity: 80,
        badge: "Internal"
    },
    {
        id: "python-reporting",
        title: "Python Reporting/Tool Scripts",
        description: "PW:innoG3n | Internal network folder for Python scripts and reporting tools (UNC path copy).",
        category: "Scripts",
        icon: "file-code-2",
        url: "https://gofile.me/5rZBN/ZvSZ9JRsn",
        popularity: 76,
        badge: "Internal"
    },
    {
        id: "sales-order-system",
        title: "Sales Order Management System",
        description: "Manage sales orders and related workflows through the SO management portal.",
        category: "Finance",
        icon: "clipboard-list",
        url: "https://so.solvang-pharma.com/",
        popularity: 78,
        badge: "Public"
    },
    {
        id: "arcr",
        title: "A/R with Collection Reporting System",
        description: "Accounts receivable and collection reporting for finance monitoring and tracking.",
        category: "Finance",
        icon: "chart-column",
        url: "https://arcr.innogen.local/",
        popularity: 77,
        badge: "Internal"
    },
    {
        id: "rx-tracking",
        title: "RX Tracking v2.0 (AI)",
        description: "RX tracking dashboard integrated with AI-assisted insights and reporting.",
        category: "Finance",
        icon: "sparkles",
        url: "https://rx.innogen.local/",
        popularity: 75,
        badge: "Internal"
    },
    {
        id: "sql-final-rx-upload",
        title: "SQL Server Final-RX Uploading",
        description: "Secure upload portal for Final-RX files to SQL Server.",
        category: "Finance",
        icon: "upload",
        url: "https://upload.innogen.local/",
        popularity: 74,
        badge: "Internal",
        requiresAccessKey: true
    },
    {
        id: "rx-data-analyst",
        title: "RX Data Analyst App",
        description: "RX analytics workspace for reports, data review, and insights.",
        category: "Finance",
        icon: "line-chart",
        url: "https://rxda.innogen.local/",
        popularity: 73,
        badge: "Internal"
    }
];

const dom = {
    search: document.getElementById("apps-search"),
    chips: document.getElementById("apps-category-chips"),
    grid: document.getElementById("apps-grid"),
    empty: document.getElementById("apps-empty"),
    count: document.getElementById("apps-count"),
    clear: document.getElementById("apps-clear-filters"),
    sort: document.getElementById("apps-sort-by"),
    toast: document.getElementById("apps-toast"),
    toastText: document.getElementById("apps-toast-text")
};

let selectedCategory = "All";
let toastTimer = null;

function showToast(message) {
    dom.toastText.textContent = message;
    dom.toast.classList.remove("hidden");
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => dom.toast.classList.add("hidden"), 2400);
}

function getCategories() {
    const categories = new Set(["All"]);
    for (const a of apps) categories.add(a.category);
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

function badgeClass(badge) {
    const b = (badge || "").toLowerCase();
    if (b === "internal") return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (b === "appsheet") return "bg-indigo-50 text-indigo-700 border-indigo-100";
    if (b === "public") return "bg-sky-50 text-sky-700 border-sky-100";
    return "bg-slate-50 text-slate-700 border-slate-200";
}

function getFilteredApps() {
    const q = (dom.search.value || "").trim().toLowerCase();
    let items = apps.slice();

    if (selectedCategory !== "All") items = items.filter(a => a.category === selectedCategory);

    if (q) {
        items = items.filter(a => {
            return (
                a.title.toLowerCase().includes(q) ||
                a.description.toLowerCase().includes(q) ||
                a.category.toLowerCase().includes(q) ||
                (a.badge || "").toLowerCase().includes(q)
            );
        });
    }

    const sort = dom.sort.value;
    if (sort === "az") items.sort((a, b) => a.title.localeCompare(b.title));
    else items.sort((a, b) => b.popularity - a.popularity);

    return items;
}

function getAccessKey() {
    return sessionStorage.getItem("innogen_portal_access_key") || "";
}

function setAccessKey(value) {
    sessionStorage.setItem("innogen_portal_access_key", value);
}

function requireAccessKey() {
    const existing = getAccessKey();
    if (!existing) {
        const first = window.prompt("Set an access key for protected apps:");
        if (!first) return false;
        setAccessKey(first);
        return true;
    }

    const input = window.prompt("Enter access key to continue:");
    if (!input) return false;
    return input === existing;
}

function openInNewTab(app) {
    const url = app?.url;
    if (app?.requiresAccessKey) {
        const ok = requireAccessKey();
        if (!ok) {
            showToast("Access not granted.");
            return;
        }
    }

    if (typeof url === "string" && url.startsWith("file:")) {
        const unc = "\\\\192.168.16.5\\Python Scripts\\";
        (navigator.clipboard?.writeText ? navigator.clipboard.writeText(unc) : Promise.reject())
            .then(() => showToast(`Browsers block file:// links.\nPath copied: ${unc}`))
            .catch(() => showToast(`Browsers block file:// links.\nCopy this path: ${unc}`));
        return;
    }
    if (typeof url === "string" && url.length) window.open(url, "_blank", "noopener,noreferrer");
}

function renderGrid() {
    const items = getFilteredApps();
    dom.count.textContent = String(items.length);
    dom.grid.innerHTML = "";
    dom.empty.classList.toggle("hidden", items.length !== 0);

    for (const a of items) {
        const card = document.createElement("div");
        card.className = "portal-card bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-300 h-full flex flex-col";

        card.innerHTML = `
            <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
                            <i data-lucide="${a.icon}" class="w-5 h-5"></i>
                        </div>
                        <div class="min-w-0">
                            <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider">${a.category}</div>
                            <h4 class="text-base font-bold text-slate-900 leading-tight truncate">${a.title}</h4>
                        </div>
                    </div>
                    <p class="text-slate-600 text-sm leading-relaxed">${a.description}</p>
                </div>
                <span class="shrink-0 text-xs font-bold border px-2 py-1 rounded-lg ${badgeClass(a.badge)}">${a.badge}</span>
            </div>

            <div class="mt-6 flex items-center gap-2">
                <button type="button" class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors" data-open="${a.id}">
                    <i data-lucide="external-link" class="w-4 h-4"></i>
                    Open
                </button>
                <button type="button" class="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors" aria-label="Copy link" data-copy="${a.id}">
                    <i data-lucide="link" class="w-4 h-4"></i>
                </button>
            </div>
        `;

        card.addEventListener("click", (e) => {
            const target = e.target;
            if (target instanceof HTMLElement && target.closest("button")) return;
            openInNewTab(a);
        });

        dom.grid.appendChild(card);
    }

    lucide.createIcons();

    dom.grid.querySelectorAll("[data-open]").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-open");
            const a = apps.find(x => x.id === id);
            if (!a) return;
            openInNewTab(a);
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
        const match = apps.find(a => a.id === id);
        if (match) showToast(`Showing: ${match.title}`);
    }
});
