const dom = {
    emailCard: document.getElementById("card-email-accounts"),
    contactCard: document.getElementById("card-contact-numbers"),
    localNumbersCard: document.getElementById("card-local-numbers"),
    toast: document.getElementById("toast"),
    toastText: document.getElementById("toast-text")
};

let toastTimer = null;

function showToast(message) {
    dom.toastText.textContent = message;
    dom.toast.classList.remove("hidden");
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => dom.toast.classList.add("hidden"), 2400);
}

document.addEventListener("DOMContentLoaded", () => {
    lucide.createIcons();

    dom.emailCard.addEventListener("click", () => {
        window.location.assign("email-accounts.html");
    });

    dom.contactCard.addEventListener("click", () => {
        window.location.assign("contact-numbers.html");
    });

    dom.localNumbersCard.addEventListener("click", () => {
        window.location.assign("local-numbers.html");
    });
});
