const dom = {
    borrowAssetCard: document.getElementById("card-it-borrow-asset-tracker"),
    ticketingCard: document.getElementById("card-it-ticketing"),
    modal: document.getElementById("it-support-modal"),
    modalBackdrop: document.getElementById("it-support-modal-backdrop"),
    modalCancel: document.getElementById("it-support-modal-cancel"),
    modalSend: document.getElementById("it-support-modal-send"),
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

function openSupportModal(subject) {
    if (!dom.modal) return;
    const email = "ithelpdesk@innogen-pharma.com";
    const mailSubject = encodeURIComponent(subject || "IT Support Request");
    const mailBody = encodeURIComponent("Hi IT Team,\n\nThe app is temporarily unavailable. Please assist.\n\nThank you.");
    dom.modalSend.href = `mailto:${email}?subject=${mailSubject}&body=${mailBody}`;
    dom.modal.classList.remove("hidden");
    lucide.createIcons();
}

function closeSupportModal() {
    if (!dom.modal) return;
    dom.modal.classList.add("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
    lucide.createIcons();

    dom.borrowAssetCard.addEventListener("click", () => {
        openSupportModal("IT Borrow Asset Tracker - Unavailable");
    });

    dom.ticketingCard.addEventListener("click", () => {
        openSupportModal("IT Ticketing - Unavailable");
    });

    dom.modalCancel.addEventListener("click", closeSupportModal);
    dom.modalBackdrop.addEventListener("click", closeSupportModal);
});
