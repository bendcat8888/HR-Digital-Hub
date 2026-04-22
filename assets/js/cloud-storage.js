const cloudApps = [
    {
        id: "innogen-cloud-desktop",
        title: "InnoGen Cloud Desktop",
        description: "Sign in to DSM Innogen Cloud to manage settings and access the private cloud portal.",
        category: "DSM",
        icon: "cloud",
        url: "https://innogen-cloud.local/",
        popularity: 95,
        badge: "Internal"
    },
    {
        id: "innogen-synology-chat",
        title: "InnoGen Synology Chat",
        description: "Internal chat and team collaboration powered by Synology Chat.",
        category: "Collaboration",
        icon: "messages-square",
        url: "https://innogen-cloud.local:5000/?launchApp=SYNO.SDS.Chat.Application",
        popularity: 90,
        badge: "Internal"
    },
    {
        id: "innogen-synology-drive",
        title: "InnoGen Synology Drive",
        description: "Access Synology Drive for file sharing, sync, and team folders on the private cloud.",
        category: "Storage",
        icon: "folder-sync",
        url: "https://innogen-cloud.local:5000/?launchApp=SYNO.SDS.Drive.Application",
        popularity: 92,
        badge: "Internal"
    }
];

const dom = {
    search: document.getElementById("cloud-search"),
    chips: document.getElementById("cloud-category-chips"),
    grid: document.getElementById("cloud-grid"),
    empty: document.getElementById("cloud-empty"),
    count: document.getElementById("cloud-count"),
    clear: document.getElementById("cloud-clear-filters"),
    sort: document.getElementById("cloud-sort-by"),
    toast: document.getElementById("cloud-toast"),
    toastText: document.getElementById("cloud-toast-text"),
    modal: document.getElementById("cloud-internal-modal"),
    modalBackdrop: document.getElementById("cloud-internal-modal-backdrop"),
    modalCancel: document.getElementById("cloud-internal-cancel"),
    modalContinue: document.getElementById("cloud-internal-continue"),
    modalRetry: document.getElementById("cloud-internal-retry"),
    modalTitle: document.getElementById("cloud-internal-title"),
    modalBody: document.getElementById("cloud-internal-body"),
    modalHint: document.getElementById("cloud-internal-hint")
};

let selectedCategory = "All";
let toastTimer = null;
let pendingApp = null;
let trustedInnoGenIp = false;
let clientContextPromise = null;
const TRUSTED_INNOGEN_IP = "36.255.107.205";

function showToast(message) {
    dom.toastText.textContent = message;
    dom.toast.classList.remove("hidden");
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => dom.toast.classList.add("hidden"), 2400);
}

function getCategories() {
    const categories = new Set(["All"]);
    for (const a of cloudApps) categories.add(a.category);
    return Array.from(categories);
}

function badgeClass(badge) {
    const b = (badge || "").toLowerCase();
    if (b === "internal") return "bg-emerald-50 text-emerald-700 border-emerald-100";
    return "bg-slate-50 text-slate-700 border-slate-200";
}

function internalNetworkChip() {
    return `
        <span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <i data-lucide="wifi" class="w-3.5 h-3.5"></i>
            Internal Network
        </span>
    `;
}

async function loadClientContext() {
    if (clientContextPromise) return clientContextPromise;

    clientContextPromise = fetch("/api/me", { credentials: "include" })
        .then(async (response) => (response.ok ? response.json() : null))
        .then((data) => {
            const clientIp = String(data?.client_ip || "").trim();
            const sourceIp = String(data?.source_ip || "").trim();
            trustedInnoGenIp = clientIp === TRUSTED_INNOGEN_IP || sourceIp === TRUSTED_INNOGEN_IP;
            return data;
        })
        .catch(() => null);

    return clientContextPromise;
}

function showFailureModal(title, body, hint) {
    dom.modalTitle.textContent = title;
    dom.modalBody.textContent = body;
    dom.modalHint.textContent = hint;
    dom.modalContinue.textContent = trustedInnoGenIp ? "Close" : "Try Again";
    dom.modalRetry.classList.add("hidden");
    dom.modal.classList.remove("hidden");
    dom.modal.classList.add("flex");
    lucide.createIcons();
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

function getFilteredApps() {
    const q = (dom.search.value || "").trim().toLowerCase();
    let items = cloudApps.slice();

    if (selectedCategory !== "All") items = items.filter(a => a.category === selectedCategory);

    if (q) {
        items = items.filter(a => {
            return (
                a.title.toLowerCase().includes(q) ||
                a.description.toLowerCase().includes(q) ||
                a.category.toLowerCase().includes(q)
            );
        });
    }

    const sort = dom.sort.value;
    if (sort === "az") items.sort((a, b) => a.title.localeCompare(b.title));
    else items.sort((a, b) => b.popularity - a.popularity);

    return items;
}

function closeModal() {
    pendingApp = null;
    dom.modal.classList.add("hidden");
    dom.modal.classList.remove("flex");
}

function openModalFor(app, failureMode = false) {
    pendingApp = app;
    dom.modal.classList.remove("hidden");
    dom.modal.classList.add("flex");
    dom.modalTitle.textContent = failureMode ? "Unable to open the app" : `${app.title}`;
    dom.modalBody.textContent = failureMode
        ? (trustedInnoGenIp
            ? "The app did not open. Please try again from the portal or contact IT if the issue continues."
            : "The app did not open. Please confirm you are connected to the InnoGen Wi-Fi or corporate network, then retry.")
        : "This application is intended for use only when you are connected to the InnoGen Wi-Fi or corporate network. If you are outside the InnoGen network, the app may not load or function properly.";
    dom.modalHint.textContent = failureMode
        ? (trustedInnoGenIp
            ? "The browser may be blocking the popup or the app may be temporarily unavailable."
            : "Check Wi-Fi and retry.")
        : "Check Wi-Fi / corporate network before continuing.";
    dom.modalContinue.textContent = failureMode ? (trustedInnoGenIp ? "Close" : "Try Again") : "Continue to App";
    dom.modalRetry.classList.add("hidden");
    lucide.createIcons();
}

function openInNewTab(url) {
    window.open(url, "_blank", "noopener,noreferrer");
}

function openCloudApp(app) {
    if (trustedInnoGenIp && typeof app?.url === "string" && app.url.length) {
        window.open(app.url, "_blank", "noopener,noreferrer");
        return;
    }
    openModalFor(app);
}

function continueCloudApp() {
    const app = pendingApp;
    if (!app) {
        closeModal();
        return;
    }

    if (trustedInnoGenIp) {
        closeModal();
        if (typeof app.url === "string" && app.url.length) {
            const popup = window.open("about:blank", "_blank", "noopener,noreferrer");
            if (popup) {
                popup.location.href = app.url;
            }
        }
        return;
    }

    if (navigator.onLine === false) {
        openModalFor(app, true);
        showToast("Please connect to the InnoGen Wi-Fi or corporate network and retry.");
        return;
    }

    const opened = typeof app.url === "string" && app.url.length ? window.open(app.url, "_blank", "noopener,noreferrer") : null;
    if (!opened) {
        openModalFor(app, true);
        showToast("The app could not be opened. Please retry.");
        return;
    }

    closeModal();
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
                    <div class="mt-3">
                        ${internalNetworkChip()}
                    </div>
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
            void (async () => {
                await loadClientContext();
                openCloudApp(a);
            })();
        });

        dom.grid.appendChild(card);
    }

    lucide.createIcons();

    dom.grid.querySelectorAll("[data-open]").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-open");
            const a = cloudApps.find(x => x.id === id);
            if (!a) return;
            void (async () => {
                await loadClientContext();
                openCloudApp(a);
            })();
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
    void loadClientContext().finally(() => {
        renderChips();
        renderGrid();
        lucide.createIcons();

        dom.search.addEventListener("input", () => renderGrid());
        dom.sort.addEventListener("change", () => renderGrid());
        dom.clear.addEventListener("click", () => clearFilters());
        dom.modalBackdrop.addEventListener("click", closeModal);
        dom.modalCancel.addEventListener("click", closeModal);
        dom.modalContinue.addEventListener("click", continueCloudApp);
        dom.modalRetry.addEventListener("click", continueCloudApp);

        const hash = (window.location.hash || "").slice(1);
        if (hash) {
            const id = decodeURIComponent(hash);
            const match = cloudApps.find(a => a.id === id);
            if (match) showToast(`Showing: ${match.title}`);
        }
    });
});
