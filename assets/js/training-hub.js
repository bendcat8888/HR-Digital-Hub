const documents = [
    {
        id: "training-calendar",
        title: "Training Calendar",
        description: "Planned sessions, schedules, and upcoming programs.",
        category: "Schedule",
        icon: "calendar",
        url: "#",
        popularity: 95
    },
    {
        id: "training-mandatory",
        title: "Mandatory Trainings",
        description: "Required trainings and completion requirements.",
        category: "Compliance",
        icon: "check-circle",
        url: "#",
        popularity: 90
    },
    {
        id: "training-catalog",
        title: "Training Catalog",
        description: "Available modules and learning paths.",
        category: "Catalog",
        icon: "layout-grid",
        url: "#",
        popularity: 85
    },
    {
        id: "training-request",
        title: "Training Request Form",
        description: "Request a course or propose a training session.",
        category: "Requests",
        icon: "file-plus",
        url: "#",
        popularity: 75
    },
    {
        id: "training-certificates",
        title: "Certificates & Records",
        description: "Track certificates, attendance, and records.",
        category: "Records",
        icon: "badge-check",
        url: "#",
        popularity: 70
    }
];

const state = {
    query: "",
    category: "All",
    sortBy: "popular"
};

const dom = {
    search: document.getElementById("training-search"),
    chips: document.getElementById("training-category-chips"),
    grid: document.getElementById("training-grid"),
    empty: document.getElementById("training-empty"),
    count: document.getElementById("training-count"),
    clear: document.getElementById("training-clear-filters"),
    sort: document.getElementById("training-sort-by"),
    toast: document.getElementById("training-toast"),
    toastText: document.getElementById("training-toast-text")
};

let toastTimer = null;

function showToast(message) {
    dom.toastText.textContent = message;
    dom.toast.classList.remove("hidden");
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => dom.toast.classList.add("hidden"), 2400);
}

function getCategories(items) {
    const categories = new Set(items.map((item) => item.category));
    return ["All", ...Array.from(categories).sort((a, b) => a.localeCompare(b))];
}

function renderChips() {
    const categories = getCategories(documents);
    dom.chips.innerHTML = "";

    categories.forEach((cat) => {
        const btn = document.createElement("button");
        btn.type = "button";
        const active = state.category === cat;
        btn.className = active
            ? "px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-sm"
            : "px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors";
        btn.textContent = cat;
        btn.addEventListener("click", () => {
            state.category = cat;
            render();
        });
        dom.chips.appendChild(btn);
    });
}

function matchesQuery(item, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
}

function applyFilters(items) {
    return items.filter((item) => {
        const categoryOk = state.category === "All" ? true : item.category === state.category;
        const queryOk = matchesQuery(item, state.query);
        return categoryOk && queryOk;
    });
}

function applySort(items) {
    const copy = [...items];
    if (state.sortBy === "az") {
        copy.sort((a, b) => a.title.localeCompare(b.title));
        return copy;
    }
    copy.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    return copy;
}

function openDocument(item) {
    if (!item.url || item.url === "#") {
        showToast("Link not set yet. Add the file URL when ready.");
        return;
    }
    window.open(item.url, "_blank", "noopener");
}

function renderGrid(items) {
    dom.grid.innerHTML = "";
    dom.count.textContent = String(items.length);

    if (items.length === 0) {
        dom.empty.classList.remove("hidden");
        return;
    }

    dom.empty.classList.add("hidden");

    items.forEach((item) => {
        const card = document.createElement("div");
        card.className = "portal-card bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-300 group cursor-pointer h-full flex flex-col";
        card.innerHTML = `
            <div class="mb-4">
                <div class="bg-indigo-100 text-indigo-700 w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110">
                    <i data-lucide="${item.icon}" class="w-6 h-6"></i>
                </div>
            </div>
            <div class="flex-grow">
                <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">${item.category}</div>
                <h3 class="text-lg font-bold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">${item.title}</h3>
                <p class="text-slate-500 text-sm leading-relaxed">${item.description}</p>
            </div>
            <div class="mt-6 flex items-center text-indigo-600 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                <span>Open</span>
                <i data-lucide="arrow-right" class="ml-1 w-4 h-4"></i>
            </div>
        `;

        card.addEventListener("click", () => openDocument(item));
        dom.grid.appendChild(card);
    });

    lucide.createIcons();
}

function render() {
    renderChips();
    const filtered = applyFilters(documents);
    const sorted = applySort(filtered);
    renderGrid(sorted);
}

document.addEventListener("DOMContentLoaded", () => {
    lucide.createIcons();

    dom.search.addEventListener("input", (e) => {
        state.query = String(e.target.value || "").trim();
        render();
    });

    dom.sort.addEventListener("change", (e) => {
        state.sortBy = String(e.target.value || "popular");
        render();
    });

    dom.clear.addEventListener("click", () => {
        state.query = "";
        state.category = "All";
        state.sortBy = "popular";
        dom.search.value = "";
        dom.sort.value = "popular";
        render();
        showToast("Filters cleared.");
    });

    render();
});
