const PROFILE_AVATAR_STORAGE_PREFIX = 'innogen_portal_avatar:';
const SSO_CLEAR_SESSIONS_URL = 'https://sso.innogen-pharma.com/api/v1/auth/clear-sessions';

let currentUser = null;
let currentAvatarUrl = null;

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function getDisplayNameFromEmail(email) {
    const localPart = normalizeEmail(email).split('@')[0] || '';
    const segments = localPart.split(/[^a-z0-9]+/i).filter(Boolean);

    if (segments.length === 0) {
        return email || 'User';
    }

    return segments
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
        .join(' ');
}

function getInitialsFromEmail(email) {
    const localPart = normalizeEmail(email).split('@')[0] || '';
    const segments = localPart.split(/[^a-z0-9]+/i).filter(Boolean);

    if (segments.length >= 2) {
        return `${segments[0][0]}${segments[1][0]}`.toUpperCase();
    }

    if (segments.length === 1) {
        const compact = segments[0].replace(/[^a-z0-9]/gi, '');
        if (compact.length >= 2) {
            return compact.slice(0, 2).toUpperCase();
        }
        return compact.charAt(0).toUpperCase() || 'U';
    }

    return 'U';
}

function isPhAccount(email, domain) {
    return String(domain || email || '').toLowerCase().endsWith('.ph');
}

function avatarStorageKey(email) {
    return `${PROFILE_AVATAR_STORAGE_PREFIX}${normalizeEmail(email)}`;
}

function readAvatarFromStorage(email) {
    try {
        return localStorage.getItem(avatarStorageKey(email));
    } catch {
        return null;
    }
}

function saveAvatarToStorage(email, dataUrl) {
    try {
        if (dataUrl) {
            localStorage.setItem(avatarStorageKey(email), dataUrl);
        } else {
            localStorage.removeItem(avatarStorageKey(email));
        }
    } catch {
        // Ignore localStorage errors.
    }
}

function setAvatarNode(node, email, dataUrl) {
    if (!node) return;

    node.innerHTML = '';

    if (dataUrl) {
        const image = document.createElement('img');
        image.alt = `${email} profile image`;
        image.src = dataUrl;
        node.appendChild(image);
        return;
    }

    node.textContent = getInitialsFromEmail(email);
}

function profileShellHtml() {
    return `
        <div class="profile-shell">
            <button id="profile-button" type="button" class="profile-badge" aria-haspopup="menu" aria-expanded="false" aria-label="Open profile menu">
                <span id="profile-initials" class="profile-badge__text">BC</span>
            </button>
            <div id="profile-menu" class="profile-menu hidden" role="menu" aria-label="Profile menu">
                <div class="profile-menu__header">
                    <div id="profile-menu-avatar" class="profile-menu__avatar">BC</div>
                    <div class="min-w-0">
                        <div id="profile-menu-email" class="profile-menu__email">Loading...</div>
                        <div id="profile-menu-domain" class="profile-menu__domain">Managed by innogen-pharma.com</div>
                    </div>
                </div>
                <div class="profile-menu__divider"></div>
                <button id="manage-account-button" type="button" class="profile-menu__item" role="menuitem">
                    <i data-lucide="settings-2" class="profile-menu__icon"></i>
                    <span>Manage your Account</span>
                </button>
                <button id="signout-button" type="button" class="profile-menu__item profile-menu__item--danger" role="menuitem">
                    <i data-lucide="log-out" class="profile-menu__icon"></i>
                    <span>Sign Out</span>
                </button>
            </div>
        </div>
    `;
}

function accountModalHtml() {
    return `
        <div id="account-modal" class="account-modal hidden" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
            <div class="account-modal__backdrop"></div>
            <div class="account-modal__panel">
                <button id="account-modal-close" type="button" class="account-modal__close" aria-label="Close account manager">
                    <i data-lucide="x" class="h-5 w-5"></i>
                </button>

                <div class="account-modal__hero">
                    <div class="account-modal__avatar-wrap">
                        <div id="account-avatar" class="account-modal__avatar">BC</div>
                        <button id="account-photo-button" type="button" class="account-modal__photo-button" aria-label="Upload profile photo">
                            <i data-lucide="camera" class="h-4 w-4"></i>
                        </button>
                        <input id="account-photo-input" type="file" accept="image/*" hidden>
                    </div>
                    <div>
                        <div class="account-modal__eyebrow">Manage your Account</div>
                        <h2 id="account-modal-title" class="account-modal__title">Profile settings</h2>
                        <p class="account-modal__subtitle">Update your picture and account details.</p>
                    </div>
                </div>

                <div class="account-modal__grid">
                    <section class="account-modal__card">
                        <label for="account-display-name" class="account-modal__label">Display name</label>
                        <input id="account-display-name" type="text" class="account-modal__input" readonly>

                        <label for="account-email" class="account-modal__label">Email address</label>
                        <input id="account-email" type="email" class="account-modal__input" readonly>

                        <label for="account-domain" class="account-modal__label">Account domain</label>
                        <input id="account-domain" type="text" class="account-modal__input" readonly>
                    </section>

                    <section id="account-password-section" class="account-modal__card account-modal__card--soft hidden">
                        <div class="account-modal__section-head">
                            <div>
                                <h3 class="account-modal__section-title">Change password</h3>
                                <p class="account-modal__section-copy">Available for .ph accounts.</p>
                            </div>
                        </div>

                        <label for="current-password" class="account-modal__label">Current password</label>
                        <input id="current-password" type="password" class="account-modal__input" placeholder="Current password">

                        <label for="new-password" class="account-modal__label">New password</label>
                        <input id="new-password" type="password" class="account-modal__input" placeholder="New password">

                        <label for="confirm-password" class="account-modal__label">Confirm password</label>
                        <input id="confirm-password" type="password" class="account-modal__input" placeholder="Confirm password">
                    </section>
                </div>

                <p id="account-modal-status" class="account-modal__status"></p>

                <div class="account-modal__actions">
                    <button id="account-modal-cancel" type="button" class="account-modal__button account-modal__button--ghost">Close</button>
                    <button id="account-modal-save" type="button" class="account-modal__button account-modal__button--primary">Save changes</button>
                </div>
            </div>
        </div>
    `;
}

function ensureProfileUi() {
    if (!document.getElementById('profile-button')) {
        const badge = document.querySelector('header .bg-slate-200.flex.items-center.justify-center.text-slate-600.font-semibold.border.border-slate-300');
        if (badge) {
            const shell = document.createElement('div');
            shell.innerHTML = profileShellHtml().trim();
            badge.replaceWith(shell.firstElementChild);
        }
    }

    if (!document.getElementById('account-modal')) {
        document.body.insertAdjacentHTML('beforeend', accountModalHtml());
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function getEls() {
    return {
        profileButton: document.getElementById('profile-button'),
        profileMenu: document.getElementById('profile-menu'),
        profileInitials: document.getElementById('profile-initials'),
        profileMenuAvatar: document.getElementById('profile-menu-avatar'),
        profileMenuEmail: document.getElementById('profile-menu-email'),
        profileMenuDomain: document.getElementById('profile-menu-domain'),
        manageAccountButton: document.getElementById('manage-account-button'),
        signoutButton: document.getElementById('signout-button'),
        accountModal: document.getElementById('account-modal'),
        accountModalClose: document.getElementById('account-modal-close'),
        accountModalCancel: document.getElementById('account-modal-cancel'),
        accountModalSave: document.getElementById('account-modal-save'),
        accountModalStatus: document.getElementById('account-modal-status'),
        accountAvatar: document.getElementById('account-avatar'),
        accountPhotoButton: document.getElementById('account-photo-button'),
        accountPhotoInput: document.getElementById('account-photo-input'),
        accountDisplayName: document.getElementById('account-display-name'),
        accountEmail: document.getElementById('account-email'),
        accountDomain: document.getElementById('account-domain'),
        accountPasswordSection: document.getElementById('account-password-section'),
        currentPassword: document.getElementById('current-password'),
        newPassword: document.getElementById('new-password'),
        confirmPassword: document.getElementById('confirm-password'),
        profileShell: document.querySelector('.profile-shell'),
    };
}

function setAccountStatus(message, isError = false) {
    const { accountModalStatus } = getEls();
    if (!accountModalStatus) return;

    accountModalStatus.textContent = message;
    accountModalStatus.style.color = isError ? '#b91c1c' : '';
}

function closeProfileMenu() {
    const { profileMenu, profileButton } = getEls();
    if (!profileMenu || !profileButton) return;
    profileMenu.classList.add('hidden');
    profileButton.setAttribute('aria-expanded', 'false');
}

function openProfileMenu() {
    const { profileMenu, profileButton } = getEls();
    if (!profileMenu || !profileButton) return;
    profileMenu.classList.remove('hidden');
    profileButton.setAttribute('aria-expanded', 'true');
}

function toggleProfileMenu() {
    const { profileMenu } = getEls();
    if (!profileMenu) return;
    if (profileMenu.classList.contains('hidden')) openProfileMenu();
    else closeProfileMenu();
}

function closeAccountModal() {
    const { accountModal } = getEls();
    if (!accountModal) return;
    accountModal.classList.add('hidden');
    document.body.classList.remove('privacy-locked');
}

function openAccountModal() {
    const els = getEls();
    if (!els.accountModal || !currentUser) return;

    const email = normalizeEmail(currentUser.email);
    const domain = normalizeEmail(currentUser.domain || (email.includes('@') ? email.split('@')[1] : ''));
    const displayName = getDisplayNameFromEmail(email);
    const avatarUrl = readAvatarFromStorage(email) || currentAvatarUrl;

    if (els.accountDisplayName) els.accountDisplayName.value = displayName;
    if (els.accountEmail) els.accountEmail.value = email;
    if (els.accountDomain) els.accountDomain.value = domain;
    setAvatarNode(els.accountAvatar, email, avatarUrl);

    if (els.accountPasswordSection) {
        els.accountPasswordSection.classList.toggle('hidden', !isPhAccount(email, domain));
    }

    if (els.currentPassword) els.currentPassword.value = '';
    if (els.newPassword) els.newPassword.value = '';
    if (els.confirmPassword) els.confirmPassword.value = '';

    setAccountStatus('Update your photo and account details.');
    els.accountModal.classList.remove('hidden');
    document.body.classList.add('privacy-locked');
}

async function clearRelatedSessions() {
    return new Promise((resolve) => {
        const frameName = 'innogen-sso-clear-sessions-frame';
        let frame = document.querySelector(`iframe[name="${frameName}"]`);
        if (frame) frame.remove();

        frame = document.createElement('iframe');
        frame.name = frameName;
        frame.hidden = true;
        document.body.appendChild(frame);

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = SSO_CLEAR_SESSIONS_URL;
        form.target = frameName;
        form.hidden = true;
        document.body.appendChild(form);

        form.submit();
        window.setTimeout(() => {
            form.remove();
            frame.remove();
            resolve();
        }, 750);
    });
}

async function signOut() {
    closeProfileMenu();

    await Promise.allSettled([
        clearRelatedSessions(),
        fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
        }),
    ]);

    window.location.replace('/login');
}

function applyUserProfile(user) {
    currentUser = user;

    const els = getEls();
    const email = normalizeEmail(user.email);
    const domain = normalizeEmail(user.domain || (email.includes('@') ? email.split('@')[1] : ''));
    const avatarUrl = readAvatarFromStorage(email);
    const displayName = getDisplayNameFromEmail(email);

    currentAvatarUrl = avatarUrl;

    if (els.profileInitials) setAvatarNode(els.profileInitials, email, avatarUrl);
    if (els.profileMenuAvatar) setAvatarNode(els.profileMenuAvatar, email, avatarUrl);
    if (els.profileMenuEmail) els.profileMenuEmail.textContent = email || displayName;
    if (els.profileMenuDomain) els.profileMenuDomain.textContent = `Managed by ${domain || 'innogen-pharma.com'}`;
    if (els.accountAvatar) setAvatarNode(els.accountAvatar, email, avatarUrl);
    if (els.profileButton) els.profileButton.title = `${displayName} (${email})`;
    if (els.accountDisplayName) els.accountDisplayName.value = displayName;
    if (els.accountEmail) els.accountEmail.value = email;
    if (els.accountDomain) els.accountDomain.value = domain;
    if (els.accountPasswordSection) {
        els.accountPasswordSection.classList.toggle('hidden', !isPhAccount(email, domain));
    }
}

async function loadCurrentUser() {
    const els = getEls();
    if (!els.profileButton && !document.querySelector('header .bg-slate-200.flex.items-center.justify-center.text-slate-600.font-semibold.border.border-slate-300')) {
        return;
    }

    const response = await fetch('/api/me', { credentials: 'include' });
    if (!response.ok) {
        window.location.replace('/login');
        return;
    }

    const payload = await response.json();
    applyUserProfile(payload.user || {});
}

function handleAvatarUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file || !currentUser) return;

    if (!file.type.startsWith('image/')) {
        setAccountStatus('Please choose an image file.', true);
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const email = normalizeEmail(currentUser.email);
        currentAvatarUrl = dataUrl;
        saveAvatarToStorage(email, dataUrl);
        applyUserProfile(currentUser);
        setAccountStatus('Profile photo updated locally.');
    };
    reader.readAsDataURL(file);
}

async function handleAccountSave() {
    if (!currentUser) return;

    const email = normalizeEmail(currentUser.email);
    const domain = normalizeEmail(currentUser.domain || (email.includes('@') ? email.split('@')[1] : ''));
    const phAccount = isPhAccount(email, domain);
    const els = getEls();

    if (phAccount) {
        const currentValue = els.currentPassword ? els.currentPassword.value.trim() : '';
        const newValue = els.newPassword ? els.newPassword.value.trim() : '';
        const confirmValue = els.confirmPassword ? els.confirmPassword.value.trim() : '';

        if (!currentValue || !newValue || !confirmValue) {
            setAccountStatus('Please complete all password fields.', true);
            return;
        }

        if (newValue !== confirmValue) {
            setAccountStatus('New password and confirmation do not match.', true);
            return;
        }

        setAccountStatus('Password form captured. Connect it to your SSO password endpoint to make it live.');
        return;
    }

    setAccountStatus('Profile photo updated locally.');
    closeAccountModal();
}

function bindProfileControls() {
    ensureProfileUi();
    const els = getEls();

    if (!els.profileButton || !els.profileMenu) {
        return;
    }

    els.profileButton.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleProfileMenu();
    });

    if (els.manageAccountButton) {
        els.manageAccountButton.addEventListener('click', () => {
            closeProfileMenu();
            openAccountModal();
        });
    }

    if (els.signoutButton) {
        els.signoutButton.addEventListener('click', () => {
            signOut();
        });
    }

    if (els.accountModalClose) els.accountModalClose.addEventListener('click', closeAccountModal);
    if (els.accountModalCancel) els.accountModalCancel.addEventListener('click', closeAccountModal);

    if (els.accountModal) {
        els.accountModal.addEventListener('click', (event) => {
            if (event.target === els.accountModal || event.target.classList.contains('account-modal__backdrop')) {
                closeAccountModal();
            }
        });
    }

    if (els.accountPhotoButton && els.accountPhotoInput) {
        els.accountPhotoButton.addEventListener('click', () => els.accountPhotoInput.click());
        els.accountPhotoInput.addEventListener('change', handleAvatarUpload);
    }

    if (els.accountModalSave) {
        els.accountModalSave.addEventListener('click', handleAccountSave);
    }

    document.addEventListener('click', (event) => {
        const { profileShell, profileMenu } = getEls();
        if (!profileShell || !profileMenu) return;
        if (!profileShell.contains(event.target)) {
            closeProfileMenu();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeProfileMenu();
            closeAccountModal();
        }
    });

    loadCurrentUser().catch((error) => {
        console.warn('Unable to load current user profile.', error);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindProfileControls);
} else {
    bindProfileControls();
}
