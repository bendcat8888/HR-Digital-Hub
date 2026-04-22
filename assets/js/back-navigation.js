(() => {
    function goBack(fallbackUrl) {
        if (window.history.length > 1) {
            window.history.back();
            return;
        }
        window.location.assign(fallbackUrl);
    }

    document.addEventListener("DOMContentLoaded", () => {
        document.querySelectorAll("[data-back]").forEach((button) => {
            button.addEventListener("click", () => {
                goBack(button.getAttribute("data-back-fallback") || "../index.html");
            });
        });
    });
})();
