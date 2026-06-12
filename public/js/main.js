// ============================================================
// main.js — Guest-facing invitation page
// Connects to Supabase Edge Functions
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    const slug = getSlugFromUrl();
    fetchInvitationData(slug);
    setupEventListeners();
});

function getSlugFromUrl() {
    const path = window.location.pathname.substring(1);
    return path || null;
}

async function fetchInvitationData(slug) {
    if (!slug) {
        showError('Undangan tidak ditemukan.');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/invitations/${slug}`);
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || 'Invitation not found');
        }

        const data = await response.json();
        populateUI(data);
    } catch (error) {
        console.error('Error fetching invitation:', error);
        showError('Undangan tidak ditemukan atau terjadi kesalahan.');
    }
}

function showError(msg) {
    document.querySelector('#cover .space-y-6').innerHTML = `
        <p class="text-xl text-red-500 font-serif">${msg}</p>
    `;
}

function populateUI(data) {
    // Names & dates
    const coupleNames = `${data.groom_name} & ${data.bride_name}`;
    const formattedDate = formatDate(data.wedding_date);

    setEl('cover-names', coupleNames);
    setEl('footer-names', coupleNames);
    setEl('cover-date', formattedDate);
    setEl('groom-name-display', data.groom_name);
    setEl('bride-name-display', data.bride_name);
    setEl('akad-date-display', formattedDate);
    setEl('akad-time-display', data.akad_time);
    setEl('resepsi-date-display', formattedDate);
    setEl('resepsi-time-display', data.resepsi_time);
    setEl('venue-name-display', data.venue_name);
    setEl('venue-address-display', data.venue_address);

    // Couple photos
    if (data.groom_image) setImgSrc('groom-img', data.groom_image);
    if (data.bride_image) setImgSrc('bride-img', data.bride_image);

    // Parents text
    const groomParentsEl = document.querySelector('[data-groom-parents]');
    const brideParentsEl = document.querySelector('[data-bride-parents]');
    if (groomParentsEl) groomParentsEl.textContent = data.groom_parents_text || 'Putra dari Bpk. Fulan & Ibu Fulanah';
    if (brideParentsEl) brideParentsEl.textContent = data.bride_parents_text || 'Putri dari Bpk. Fulan & Ibu Fulanah';

    // Maps link
    const mapLink = document.getElementById('map-link');
    if (mapLink) {
        mapLink.href = data.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.venue_address || '')}`;
    }

    // Gift info
    setDataAttr('gift', 'data-gift-bank', data.gift_bank || 'BCA');
    setDataAttr('gift', 'data-gift-account-number', data.gift_account_number || '');
    setDataAttr('gift', 'data-gift-account-name', data.gift_account_name || '');

    // Copy rekening button
    const giftBtn = document.querySelector('#gift button');
    const giftNumberEl = document.querySelector('#gift [data-gift-account-number]');
    if (giftBtn && giftNumberEl) {
        giftBtn.onclick = () => copyToClipboard(giftNumberEl.textContent.replace(/\s+/g, ''));
    }

    // Gallery
    if (data.gallery && data.gallery.length > 0) {
        const galleryGrid = document.getElementById('gallery-grid');
        if (galleryGrid) {
            galleryGrid.innerHTML = data.gallery.map(img => `
                <div class="aspect-square bg-gray-200 rounded-2xl shadow-md overflow-hidden group cursor-pointer hover:shadow-xl transition-all duration-300">
                    <img src="${escapeHtml(img.image_path)}" alt="Gallery" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy">
                </div>
            `).join('');
        }
    }

    // Music
    const audio = document.getElementById('bg-music');
    if (audio && data.music_url) {
        audio.src = data.music_url;
        audio.load();
    }

    // Guest name from ?to= query param
    const urlParams = new URLSearchParams(window.location.search);
    const guestName = urlParams.get('to');
    const guestDisplay = document.getElementById('guest-display');
    if (guestName && guestDisplay) {
        guestDisplay.textContent = decodeURIComponent(guestName);
    }

    // Pre-fill RSVP guest name
    const rsvpForm = document.getElementById('rsvp-form');
    if (rsvpForm) {
        rsvpForm.dataset.invitationId = data.id;
        if (guestName) {
            const nameInput = rsvpForm.querySelector('input[name="guest_name"]');
            if (nameInput) nameInput.value = decodeURIComponent(guestName);
        }
    }

    // Apply primary color
    if (data.primary_color) {
        document.documentElement.style.setProperty('--color-primary', data.primary_color);
    }

    // Update page title
    document.title = `Undangan Pernikahan ${coupleNames}`;
}

function setupEventListeners() {
    // Music toggle
    const musicBtn = document.getElementById('musicBtn');
    const audio = document.getElementById('bg-music');
    const musicIcon = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg>`;
    const pauseIcon = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6"></path></svg>`;

    if (musicBtn && audio) {
        musicBtn.addEventListener('click', () => {
            if (audio.paused) {
                audio.play();
                musicBtn.classList.add('animate-spin-slow');
                musicBtn.innerHTML = pauseIcon;
            } else {
                audio.pause();
                musicBtn.classList.remove('animate-spin-slow');
                musicBtn.innerHTML = musicIcon;
            }
        });
    }

    // RSVP form
    const rsvpForm = document.getElementById('rsvp-form');
    if (rsvpForm) {
        rsvpForm.addEventListener('submit', handleRsvpSubmit);
    }
}

async function handleRsvpSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const invitationId = form.dataset.invitationId;
    if (!invitationId) return;

    const formData = new FormData(form);
    const payload = {
        invitation_id: invitationId,
        guest_name: formData.get('guest_name'),
        attendance: formData.get('attendance'),
        total_guest: parseInt(formData.get('total_guest')) || 1,
        message: formData.get('message') || '',
    };

    if (!payload.guest_name || !payload.attendance) {
        showToast('Nama dan kehadiran wajib diisi', 'error');
        return;
    }

    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Mengirim...';
    btn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/rsvp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (res.ok) {
            form.classList.add('hidden');
            document.getElementById('rsvp-success')?.classList.remove('hidden');
        } else {
            const err = await res.json().catch(() => ({}));
            showToast(err.message || 'Gagal mengirim RSVP', 'error');
            btn.textContent = originalText;
            btn.disabled = false;
        }
    } catch (err) {
        console.error(err);
        showToast('Terjadi kesalahan koneksi.', 'error');
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function openInvitation() {
    const cover = document.getElementById('cover');
    const main = document.getElementById('main-content');
    const audio = document.getElementById('bg-music');
    const audioControl = document.getElementById('audio-control');
    const musicBtn = document.getElementById('musicBtn');

    cover.style.transform = 'translateY(-100%)';

    setTimeout(() => {
        main.classList.remove('opacity-0');
        if (audio && audio.src && audio.src !== window.location.href) {
            audio.play().catch(() => {});
            if (audioControl) {
                audioControl.classList.remove('hidden');
                if (!audio.paused && musicBtn) {
                    musicBtn.classList.add('animate-spin-slow');
                    musicBtn.innerHTML = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6"></path></svg>`;
                }
            }
        }
    }, 500);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Nomor rekening disalin!');
    }).catch(() => {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Nomor rekening disalin!');
    });
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `fixed bottom-24 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg transition-opacity duration-300 pointer-events-none z-50 ${
        type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'
    }`;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

// ---- Helpers ----
function setEl(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setImgSrc(id, src) {
    const el = document.getElementById(id);
    if (el) el.src = src;
}

function setDataAttr(sectionId, attr, text) {
    const el = document.querySelector(`#${sectionId} [${attr}]`);
    if (el) el.textContent = text;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDate(dateString) {
    if (!dateString) return '';
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('id-ID', options);
}
