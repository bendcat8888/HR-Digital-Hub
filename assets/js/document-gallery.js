(() => {
    const config = window.DOCUMENT_GALLERY_CONFIG;
    if (!config) return;

    const pageNumbers = Array.isArray(config.pageNumbers) ? config.pageNumbers : [];
    const extension = config.extension || "jpg";
    const folder = config.folder;
    const pages = pageNumbers.map((num) => ({
        num,
        src: encodeURI(`${folder}/${num}.${extension}`)
    }));

    const gallery = document.getElementById(config.galleryId || "gallery");
    const viewer = document.getElementById(config.viewerId || "viewer");
    const viewerImage = document.getElementById(config.viewerImageId || "viewer-image");
    const viewerTitle = document.getElementById(config.viewerTitleId || "viewer-title");
    const viewerClose = document.getElementById(config.viewerCloseId || "viewer-close");

    if (!gallery || !viewer || !viewerImage || !viewerTitle || !viewerClose) return;

    let navWrap = viewer.querySelector("[data-viewer-nav]");

    if (!navWrap) {
        navWrap = document.createElement("div");
        navWrap.setAttribute("data-viewer-nav", "true");
        navWrap.className = "flex items-center gap-2";
        const prevBtn = document.createElement("button");
        const nextBtn = document.createElement("button");
        const counter = document.createElement("div");
        prevBtn.type = "button";
        nextBtn.type = "button";
        prevBtn.id = "viewer-prev";
        nextBtn.id = "viewer-next";
        prevBtn.className = "inline-flex items-center justify-center rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition-colors disabled:cursor-not-allowed disabled:opacity-40";
        nextBtn.className = "inline-flex items-center justify-center rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition-colors disabled:cursor-not-allowed disabled:opacity-40";
        counter.id = "viewer-counter";
        counter.className = "rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400";
        prevBtn.innerHTML = '<i data-lucide="chevron-left" class="w-4 h-4"></i>';
        nextBtn.innerHTML = '<i data-lucide="chevron-right" class="w-4 h-4"></i>';
        navWrap.append(prevBtn, counter, nextBtn);
        viewerClose.parentElement?.insertBefore(navWrap, viewerClose);
    }

    const prevBtn = viewer.querySelector("#viewer-prev");
    const nextBtn = viewer.querySelector("#viewer-next");
    const counter = viewer.querySelector("#viewer-counter");
    let currentIndex = 0;

    function updateNav() {
        if (counter) {
            counter.textContent = `${currentIndex + 1}/${pages.length}`;
        }
        if (prevBtn) prevBtn.disabled = currentIndex <= 0;
        if (nextBtn) nextBtn.disabled = currentIndex >= pages.length - 1;
    }

    function preloadAround(index) {
        [index - 1, index + 1].forEach((idx) => {
            const page = pages[idx];
            if (!page) return;
            const img = new Image();
            img.src = page.src;
        });
    }

    function openViewer(index) {
        currentIndex = index;
        const page = pages[currentIndex];
        if (!page) return;
        viewerImage.src = page.src;
        viewerTitle.textContent = config.title;
        updateNav();
        viewer.classList.remove("hidden");
        viewer.classList.add("flex");
        document.body.classList.add("privacy-locked");
        preloadAround(currentIndex);
    }

    function closeViewer() {
        viewer.classList.add("hidden");
        viewer.classList.remove("flex");
        document.body.classList.remove("privacy-locked");
    }

    function move(delta) {
        const nextIndex = currentIndex + delta;
        if (nextIndex < 0 || nextIndex >= pages.length) return;
        openViewer(nextIndex);
    }

    gallery.innerHTML = pages.map((page, index) => `
        <button type="button" class="group text-left overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg" data-page-index="${index}">
            <div class="relative aspect-video bg-white">
                <img src="${page.src}" alt="${config.title} page ${page.num}" loading="lazy" decoding="async" class="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.01]">
            </div>
            <div class="px-4 py-3">
                <div class="text-sm font-semibold text-slate-900">Slide ${index + 1}</div>
                <div class="mt-1 text-xs text-slate-500">Tap to read in preview</div>
            </div>
        </button>
    `).join("");

    gallery.querySelectorAll("[data-page-index]").forEach((button) => {
        button.addEventListener("click", () => {
            const index = Number(button.getAttribute("data-page-index"));
            openViewer(index);
        });
    });

    gallery.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const index = Number(target.getAttribute("data-page-index"));
        if (Number.isFinite(index)) {
            event.preventDefault();
            openViewer(index);
        }
    });

    prevBtn?.addEventListener("click", () => move(-1));
    nextBtn?.addEventListener("click", () => move(1));
    viewerClose.addEventListener("click", closeViewer);
    viewerImage.addEventListener("click", () => move(1));
    viewer.addEventListener("click", (event) => {
        if (event.target === viewer || event.target === viewer.firstElementChild) {
            closeViewer();
        }
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeViewer();
        if (viewer.classList.contains("hidden")) return;
        if (event.key === "ArrowLeft") move(-1);
        if (event.key === "ArrowRight") move(1);
    });

    if (window.lucide) lucide.createIcons();
})();
