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
        title: "Employee Handbook",
        description: "Read the latest policies, procedures, and company values.",
        category: "Docs",
        icon: "book-open",
        link: "pages/employee-handbook.html",
        color: "bg-amber-100 text-amber-600"
    },
    {
        id: 4,
        title: "Benefits Enrollment",
        description: "Update your Maxicare beneficiaries, Philhealth, and perks.",
        category: "HR",
        icon: "heart",
        link: "pages/benefits-enrollment.html",
        color: "bg-rose-100 text-rose-600"
    },
    {
        id: 6,
        title: "Training Hub",
        description: "Explore learning modules and professional development.",
        category: "L&D",
        icon: "graduation-cap",
        link: "pages/training-hub.html",
        color: "bg-indigo-100 text-indigo-600"
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
        card.className = 'portal-card bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-300 group cursor-pointer h-full flex flex-col';
        card.innerHTML = `
            <div class="mb-4">
                <div class="${item.color} w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110">
                    <i data-lucide="${item.icon}" class="w-6 h-6"></i>
                </div>
            </div>
            <div class="flex-grow">
                <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">${item.category}</div>
                <h3 class="text-lg font-bold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">${item.title}</h3>
                <p class="text-slate-500 text-sm leading-relaxed">${item.description}</p>
            </div>
            <div class="mt-6 flex items-center text-indigo-600 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                <span>Access Now</span>
                <i data-lucide="arrow-right" class="ml-1 w-4 h-4"></i>
            </div>
        `;
        
        card.onclick = () => {
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
