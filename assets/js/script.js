// Sample data for Portal items
const portalItems = [
    {
        id: 1,
        title: "Downloadable Forms",
        description: "Official HR forms for leave, reimbursements, gate-pass and more.",
        category: "Forms",
        icon: "file-text",
        link: "pages/downloadable-forms.html",
        color: "bg-blue-100 text-blue-600"
    },
    {
        id: 2,
        title: "Apps & Tools",
        description: "Access internal apps, tools, and web apps / systems.",
        category: "Tools",
        icon: "monitor",
        link: "pages/apps-tools.html",
        color: "bg-purple-100 text-purple-600"
    },
    {
        id: 8,
        title: "Directory",
        description: "Find contact information for your colleagues.",
        category: "People",
        icon: "users",
        link: "pages/directory.html",
        color: "bg-orange-100 text-orange-600"
    },
    {
        id: 9,
        title: "Cloud Storage & Apps",
        description: "Access Synology Drive for internal file sharing and backup sync.",
        category: "Storage",
        icon: "cloud",
        link: "pages/cloud-storage.html",
        color: "bg-blue-50 text-blue-500"
    },
    {
        id: 5,
        title: "Fleet Portal",
        description: "Vehicle Repair Request (VRR) App, track maintenance history and view next PMS",
        category: "Finance",
        icon: "car",
        link: "pages/fleet-portal.html",
        color: "bg-emerald-100 text-emerald-600"
    },
    {
        id: 7,
        title: "IT Support",
        description: "Submit tickets for hardware, software, or access issues.",
        category: "IT",
        icon: "life-buoy",
        link: "pages/it-support.html",
        color: "bg-cyan-100 text-cyan-600"
    },
    {
        id: 3,
        title: "Employee Guidelines",
        description: "Browse the employee guidelines documents and official policy visuals.",
        category: "Docs",
        icon: "book-open",
        link: "pages/employee-handbook.html",
        color: "bg-amber-100 text-amber-600"
    },
    {
        id: 6,
        title: "Training Hub",
        description: "Explore learning modules and professional development.",
        category: "L&D",
        icon: "graduation-cap",
        link: "pages/training-hub.html",
        color: "bg-slate-200 text-slate-500",
        disabled: true
    }
];

// Elements
const cardsContainer = document.getElementById('cards-container');
const searchInput = document.getElementById('search-input');
const noResults = document.getElementById('no-results');
const privacyModal = document.getElementById('privacy-consent-modal');
const privacyAcceptButton = document.getElementById('privacy-consent-accept');
const privacyStatus = document.getElementById('privacy-consent-status');

const CONSENT_STORAGE_KEY = 'innogen_portal_privacy_consent';
const POLICY_VERSION = '2026-04-08';
const CONSENT_API_URL = '/api/privacy-consent';

// Function to render cards
function renderCards(items) {
    cardsContainer.innerHTML = '';
    
    if (items.length === 0) {
        noResults.classList.remove('hidden');
        return;
    } else {
        noResults.classList.add('hidden');
    }

    items.forEach(item => {
        const card = document.createElement('div');
        const isDisabled = Boolean(item.disabled);
        card.className = [
            'portal-card bg-white p-6 rounded-2xl border group h-full flex flex-col',
            isDisabled
                ? 'border-slate-200 opacity-70 cursor-not-allowed'
                : 'border-slate-200 hover:border-indigo-300 cursor-pointer'
        ].join(' ');
        card.innerHTML = `
            <div class="mb-4">
                <div class="${item.color} w-12 h-12 rounded-xl flex items-center justify-center ${isDisabled ? '' : 'transition-transform group-hover:scale-110'}">
                    <i data-lucide="${item.icon}" class="w-6 h-6"></i>
                </div>
            </div>
            <div class="flex-grow">
                <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">${item.category}</div>
                <h3 class="text-lg font-bold text-slate-800 mb-2 ${isDisabled ? '' : 'group-hover:text-indigo-600 transition-colors'}">${item.title}</h3>
                <p class="text-slate-500 text-sm leading-relaxed">${item.description}</p>
            </div>
            <div class="mt-6 flex items-center ${isDisabled ? 'text-slate-400 opacity-100' : 'text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity'} text-sm font-semibold">
                <span>${isDisabled ? 'Coming Soon' : 'Access Now'}</span>
                <i data-lucide="arrow-right" class="ml-1 w-4 h-4"></i>
            </div>
        `;
        
        card.onclick = () => {
            if (isDisabled) {
                return;
            }
            if (item.link && item.link !== "#") {
                window.location.assign(item.link);
                return;
            }
            console.log(`Navigating to ${item.title}`);
        };

        cardsContainer.appendChild(card);
    });

    // Initialize Lucide icons for new cards
    lucide.createIcons();
}

// Function to handle search
function handleSearch(query) {
    const searchTerm = query.toLowerCase().trim();
    const filteredItems = portalItems.filter(item => 
        item.title.toLowerCase().includes(searchTerm) || 
        item.description.toLowerCase().includes(searchTerm) ||
        item.category.toLowerCase().includes(searchTerm)
    );

    renderCards(filteredItems);
}

function getStoredConsent() {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.policyVersion !== POLICY_VERSION) return null;
        return parsed;
    } catch {
        return null;
    }
}

function setConsentStatus(message, isError = false) {
    if (!privacyStatus) return;
    privacyStatus.textContent = message;
    privacyStatus.classList.toggle('text-rose-600', isError);
    privacyStatus.classList.toggle('text-slate-500', !isError);
}

function lockPortal() {
    if (!privacyModal) return;
    privacyModal.classList.remove('hidden');
    document.body.classList.add('privacy-locked');
}

function unlockPortal() {
    if (!privacyModal) return;
    privacyModal.classList.add('hidden');
    document.body.classList.remove('privacy-locked');
}

async function sendConsentAudit(consentRecord) {
    if (!window.fetch) return;

    try {
        const response = await fetch(CONSENT_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                policy_version: consentRecord.policyVersion,
                last_policy_consent_date: consentRecord.consentedAt
            })
        });

        if (!response.ok) {
            throw new Error(`Audit endpoint returned ${response.status}`);
        }
    } catch (error) {
        console.warn('Privacy consent audit logging is not configured yet.', error);
        setConsentStatus('Consent saved locally. Audit endpoint is not configured yet.', true);
    }
}

async function acceptPrivacyNotice() {
    if (!privacyAcceptButton) return;

    privacyAcceptButton.disabled = true;
    privacyAcceptButton.classList.add('opacity-60', 'cursor-not-allowed');

    const consentRecord = {
        policyVersion: POLICY_VERSION,
        consentedAt: new Date().toISOString()
    };

    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consentRecord));
    setConsentStatus(`Consent recorded on ${new Date(consentRecord.consentedAt).toLocaleString()}.`);

    await sendConsentAudit(consentRecord);
    unlockPortal();

    privacyAcceptButton.disabled = false;
    privacyAcceptButton.classList.remove('opacity-60', 'cursor-not-allowed');
}

// Event Listeners
searchInput.addEventListener('input', (e) => {
    handleSearch(e.target.value);
});

// Initial Render
document.addEventListener('DOMContentLoaded', () => {
    renderCards(portalItems);
    lucide.createIcons();

    if (privacyAcceptButton) {
        privacyAcceptButton.addEventListener('click', () => {
            acceptPrivacyNotice();
        });
    }

    if (!getStoredConsent()) {
        lockPortal();
    } else {
        unlockPortal();
    }
});

// Profile / account controls
const profileButton = document.getElementById('profile-button');
const profileMenu = document.getElementById('profile-menu');
const profileInitials = document.getElementById('profile-initials');
const profileMenuAvatar = document.getElementById('profile-menu-avatar');
const profileMenuEmail = document.getElementById('profile-menu-email');
const profileMenuDomain = document.getElementById('profile-menu-domain');
const manageAccountButton = document.getElementById('manage-account-button');
const signoutButton = document.getElementById('signout-button');
const accountModal = document.getElementById('account-modal');
const accountModalClose = document.getElementById('account-modal-close');
const accountModalCancel = document.getElementById('account-modal-cancel');
const accountModalSave = document.getElementById('account-modal-save');
const accountModalStatus = document.getElementById('account-modal-status');
const accountModalIp = document.getElementById('account-modal-ip');
const accountAvatar = document.getElementById('account-avatar');
const accountPhotoButton = document.getElementById('account-photo-button');
const accountPhotoInput = document.getElementById('account-photo-input');
const accountDisplayName = document.getElementById('account-display-name');
const accountEmail = document.getElementById('account-email');
const accountDomain = document.getElementById('account-domain');
const accountPasswordSection = document.getElementById('account-password-section');
const currentPassword = document.getElementById('current-password');
const newPassword = document.getElementById('new-password');
const confirmPassword = document.getElementById('confirm-password');
const profileShell = document.querySelector('.profile-shell');

const PROFILE_AVATAR_STORAGE_PREFIX = 'innogen_portal_avatar:';
const SSO_CLEAR_SESSIONS_URL = 'https://sso.innogen-pharma.com/api/v1/auth/clear-sessions';

let currentUser = null;
let currentAvatarUrl = null;
let currentClientIp = '';

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
        .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
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
        // Ignore storage errors.
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

    const initials = getInitialsFromEmail(email);
    node.textContent = initials;
}

function setAccountStatus(message, isError = false) {
    if (!accountModalStatus) return;

    accountModalStatus.textContent = message;
    accountModalStatus.style.color = isError ? '#b91c1c' : '';
}

function setAccountIpLabel(value) {
    if (!accountModalIp) return;

    const ip = String(value || '').trim();
    accountModalIp.textContent = ip ? `Client IP: ${ip}` : '';
}

function closeProfileMenu() {
    if (!profileMenu || !profileButton) return;
    profileMenu.classList.add('hidden');
    profileButton.setAttribute('aria-expanded', 'false');
}

function openProfileMenu() {
    if (!profileMenu || !profileButton) return;
    profileMenu.classList.remove('hidden');
    profileButton.setAttribute('aria-expanded', 'true');
}

function toggleProfileMenu() {
    if (!profileMenu) return;
    if (profileMenu.classList.contains('hidden')) {
        openProfileMenu();
    } else {
        closeProfileMenu();
    }
}

function closeAccountModal() {
    if (!accountModal) return;
    accountModal.classList.add('hidden');
    document.body.classList.remove('privacy-locked');
}

function openAccountModal() {
    if (!accountModal || !currentUser) return;

    const email = normalizeEmail(currentUser.email);
    const domain = normalizeEmail(currentUser.domain || (email.includes('@') ? email.split('@')[1] : ''));
    const displayName = getDisplayNameFromEmail(email);
    const avatarUrl = readAvatarFromStorage(email) || currentAvatarUrl;

    if (accountDisplayName) accountDisplayName.value = displayName;
    if (accountEmail) accountEmail.value = email;
    if (accountDomain) accountDomain.value = domain;
    setAvatarNode(accountAvatar, email, avatarUrl);

    if (accountPasswordSection) {
        accountPasswordSection.classList.toggle('hidden', !isPhAccount(email, domain));
    }

    if (currentPassword) currentPassword.value = '';
    if (newPassword) newPassword.value = '';
    if (confirmPassword) confirmPassword.value = '';

    setAccountStatus('Update your photo and account details.');
    setAccountIpLabel(currentClientIp);
    accountModal.classList.remove('hidden');
    document.body.classList.add('privacy-locked');
}

async function clearRelatedSessions() {
    return new Promise((resolve) => {
        const frameName = 'innogen-sso-clear-sessions-frame';
        let frame = document.querySelector(`iframe[name="${frameName}"]`);
        if (frame) {
            frame.remove();
        }

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
            credentials: 'include'
        })
    ]);

    window.location.replace('/login');
}

function applyUserProfile(user) {
    currentUser = user;

    const email = normalizeEmail(user.email);
    const domain = normalizeEmail(user.domain || (email.includes('@') ? email.split('@')[1] : ''));
    const initials = getInitialsFromEmail(email);
    const avatarUrl = readAvatarFromStorage(email);
    const displayName = getDisplayNameFromEmail(email);

    currentAvatarUrl = avatarUrl;

    if (profileInitials) {
        setAvatarNode(profileInitials, email, avatarUrl);
    }

    if (profileMenuAvatar) {
        setAvatarNode(profileMenuAvatar, email, avatarUrl);
    }

    if (profileMenuEmail) {
        profileMenuEmail.textContent = email || displayName;
    }

    if (profileMenuDomain) {
        profileMenuDomain.textContent = `Managed by ${domain || 'innogen-pharma.com'}`;
    }

    if (accountAvatar) {
        setAvatarNode(accountAvatar, email, avatarUrl);
    }

    if (profileButton) {
        profileButton.title = `${displayName} (${email})`;
    }

    if (accountDisplayName) accountDisplayName.value = displayName;
    if (accountEmail) accountEmail.value = email;
    if (accountDomain) accountDomain.value = domain;

    if (accountPasswordSection) {
        accountPasswordSection.classList.toggle('hidden', !isPhAccount(email, domain));
    }
}

async function loadCurrentUser() {
    const response = await fetch('/api/me', { credentials: 'include' });
    if (!response.ok) {
        window.location.replace('/login');
        return;
    }

    const payload = await response.json();
    currentClientIp = String(payload.client_ip || payload.source_ip || '').trim();
    applyUserProfile(payload.user || {});
    setAccountIpLabel(currentClientIp);
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

    if (phAccount) {
        const currentValue = currentPassword ? currentPassword.value.trim() : '';
        const newValue = newPassword ? newPassword.value.trim() : '';
        const confirmValue = confirmPassword ? confirmPassword.value.trim() : '';

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

if (profileButton && profileMenu) {
    profileButton.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleProfileMenu();
    });
}

if (manageAccountButton) {
    manageAccountButton.addEventListener('click', () => {
        closeProfileMenu();
        openAccountModal();
    });
}

if (signoutButton) {
    signoutButton.addEventListener('click', () => {
        signOut();
    });
}

if (accountModalClose) {
    accountModalClose.addEventListener('click', closeAccountModal);
}

if (accountModalCancel) {
    accountModalCancel.addEventListener('click', closeAccountModal);
}

if (accountModal) {
    accountModal.addEventListener('click', (event) => {
        if (event.target === accountModal || event.target.classList.contains('account-modal__backdrop')) {
            closeAccountModal();
        }
    });
}

if (accountPhotoButton) {
    accountPhotoButton.addEventListener('click', () => {
        if (accountPhotoInput) {
            accountPhotoInput.click();
        }
    });
}

if (accountPhotoInput) {
    accountPhotoInput.addEventListener('change', handleAvatarUpload);
}

if (accountModalSave) {
    accountModalSave.addEventListener('click', handleAccountSave);
}

document.addEventListener('click', (event) => {
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
