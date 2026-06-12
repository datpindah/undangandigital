// ============================================================
// admin.js — Admin dashboard
// Uses Supabase Auth + Edge Functions
// ============================================================

// Import Supabase client from CDN (loaded in admin.html)
let supabaseClient = null;
let currentUser = null;
let myInvitations = [];

// DOM refs
const loginSection = document.getElementById('loginSection');
const dashboard = document.getElementById('dashboard');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');

const refreshInvitationsBtn = document.getElementById('refreshInvitations');
const invitationList = document.getElementById('invitationList');
const createInvitationForm = document.getElementById('createInvitationForm');
const editInvitationForm = document.getElementById('editInvitationForm');
const editInvitationSelect = document.getElementById('editInvitationSelect');
const galleryInvitationSelect = document.getElementById('galleryInvitationSelect');
const rsvpInvitationSelect = document.getElementById('rsvpInvitationSelect');
const uploadForm = document.getElementById('uploadForm');
const imageInput = document.getElementById('imageInput');
const galleryList = document.getElementById('galleryList');
const loadRsvpBtn = document.getElementById('loadRsvpBtn');
const rsvpTableBody = document.getElementById('rsvpTableBody');
const guestInvitationSelect = document.getElementById('guestInvitationSelect');
const guestNameInput = document.getElementById('guestNameInput');
const addGuestBtn = document.getElementById('addGuestBtn');
const guestList = document.getElementById('guestList');
const uploadBulkGuestBtn = document.getElementById('uploadBulkGuestBtn');
const bulkGuestInput = document.getElementById('bulkGuestInput');
const uploadGroomPhotoBtn = document.getElementById('uploadGroomPhotoBtn');
const groomPhotoInput = document.getElementById('groomPhotoInput');
const uploadBridePhotoBtn = document.getElementById('uploadBridePhotoBtn');
const bridePhotoInput = document.getElementById('bridePhotoInput');
const uploadMusicBtn = document.getElementById('uploadMusicBtn');
const musicInput = document.getElementById('musicInput');

// ============================================================
// Init
// ============================================================
async function init() {
    // Initialize Supabase
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Check existing session
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        showDashboard();
    }

    // Listen for auth state changes
    supabaseClient.auth.onAuthStateChange((_event, session) => {
        if (session) {
            currentUser = session.user;
            showDashboard();
        } else {
            currentUser = null;
            showLogin();
        }
    });
}

function showDashboard() {
    loginSection.classList.add('hidden');
    dashboard.classList.remove('hidden');
    loadMyInvitations();
}

function showLogin() {
    loginSection.classList.remove('hidden');
    dashboard.classList.add('hidden');
}

// ============================================================
// Auth
// ============================================================
loginBtn.addEventListener('click', async () => {
    loginError.classList.add('hidden');
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    if (!email || !password) return;

    loginBtn.textContent = 'Masuk...';
    loginBtn.disabled = true;

    try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            loginError.textContent = 'Login gagal: ' + error.message;
            loginError.classList.remove('hidden');
        }
    } catch {
        loginError.classList.remove('hidden');
    } finally {
        loginBtn.textContent = 'Masuk';
        loginBtn.disabled = false;
    }
});

logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
});

// Allow Enter key to submit login
[emailInput, passwordInput].forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') loginBtn.click(); });
});

// ============================================================
// API helper — calls Edge Functions with Supabase JWT
// ============================================================
async function apiFetch(path, options = {}) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const token = session?.access_token;

    const headers = {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    // Don't set Content-Type for FormData (browser sets it with boundary)
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_URL}${path}`, { ...options, headers });
    return res;
}

// ============================================================
// Invitations
// ============================================================
refreshInvitationsBtn.addEventListener('click', loadMyInvitations);

async function loadMyInvitations() {
    try {
        const res = await apiFetch('/invitations/my');
        if (!res.ok) throw new Error('Failed to load');
        myInvitations = await res.json();
        renderInvitationList();
        populateInvitationSelects();
    } catch (e) {
        console.error(e);
    }
}

function renderInvitationList() {
    if (myInvitations.length === 0) {
        invitationList.innerHTML = '<li class="text-sm text-gray-400 italic">Belum ada undangan.</li>';
        return;
    }

    invitationList.innerHTML = myInvitations.map(inv => `
        <li class="flex items-center justify-between gap-2 text-sm">
            <span class="truncate">${inv.groom_name} & ${inv.bride_name} —
                <a class="text-primary underline" href="/${inv.slug}" target="_blank">Buka</a>
            </span>
            <div class="flex items-center gap-1 flex-shrink-0">
                <button data-id="${inv.id}" class="btn-edit px-2 py-1 text-xs bg-soft rounded hover:bg-accent hover:text-white transition">Edit</button>
                <button data-id="${inv.id}" class="btn-del px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200">Hapus</button>
            </div>
        </li>
    `).join('');

    invitationList.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const inv = myInvitations.find(i => String(i.id) === btn.dataset.id);
            if (inv) fillEditForm(inv);
        });
    });

    invitationList.querySelectorAll('.btn-del').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Hapus undangan ini beserta semua data tamu dan RSVP?')) return;
            const res = await apiFetch(`/invitations/${btn.dataset.id}`, { method: 'DELETE' });
            if (res.ok) {
                loadMyInvitations();
                showNotif('Undangan dihapus');
            } else {
                showNotif('Gagal menghapus undangan', 'error');
            }
        });
    });
}

function populateInvitationSelects() {
    const opts = myInvitations.map(inv =>
        `<option value="${inv.id}">${inv.slug} — ${inv.groom_name} & ${inv.bride_name}</option>`
    ).join('');
    editInvitationSelect.innerHTML = '<option value="">Pilih undangan...</option>' + opts;
    galleryInvitationSelect.innerHTML = '<option value="">Pilih undangan...</option>' + opts;
    rsvpInvitationSelect.innerHTML = '<option value="">Pilih undangan...</option>' + opts;
    guestInvitationSelect.innerHTML = '<option value="">Pilih undangan...</option>' + opts;
}

createInvitationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = formToObject(createInvitationForm);
    const btn = createInvitationForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Membuat...';

    const res = await apiFetch('/invitations', {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    btn.disabled = false;
    btn.textContent = 'Buat Undangan';

    if (res.ok) {
        createInvitationForm.reset();
        loadMyInvitations();
        showNotif('Undangan berhasil dibuat');
    } else {
        const err = await res.json().catch(() => ({}));
        showNotif(err.message || 'Gagal membuat undangan', 'error');
    }
});

editInvitationSelect.addEventListener('change', () => {
    const inv = myInvitations.find(i => String(i.id) === editInvitationSelect.value);
    if (inv) fillEditForm(inv);
});

function fillEditForm(inv) {
    editInvitationSelect.value = inv.id;
    const f = editInvitationForm;
    const setVal = (name, val) => {
        const el = f.querySelector(`[name="${name}"]`);
        if (el) el.value = val || '';
    };

    setVal('groom_name', inv.groom_name);
    setVal('bride_name', inv.bride_name);
    setVal('groom_parents_text', inv.groom_parents_text || 'Putra dari Bpk. Fulan & Ibu Fulanah');
    setVal('bride_parents_text', inv.bride_parents_text || 'Putri dari Bpk. Fulan & Ibu Fulanah');
    setVal('wedding_date', inv.wedding_date);
    setVal('akad_time', inv.akad_time);
    setVal('resepsi_time', inv.resepsi_time);
    setVal('venue_name', inv.venue_name);
    setVal('venue_address', inv.venue_address);
    setVal('primary_color', inv.primary_color || '#4A6FA5');
    setVal('gift_bank', inv.gift_bank);
    setVal('gift_account_number', inv.gift_account_number);
    setVal('gift_account_name', inv.gift_account_name);
    setVal('maps_url', inv.maps_url);

    // Current files
    const showCurrent = (elId, url, label) => {
        const el = document.getElementById(elId);
        if (!el) return;
        if (url) {
            el.classList.remove('hidden');
            const a = el.querySelector('a');
            if (a) { a.href = url; a.textContent = label || 'Lihat'; }
        } else {
            el.classList.add('hidden');
        }
    };
    showCurrent('currentGroomPhoto', inv.groom_image, 'View');
    showCurrent('currentBridePhoto', inv.bride_image, 'View');
    showCurrent('currentMusic', inv.music_url, 'Play');

    // Scroll to edit form
    document.getElementById('editInvitationForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

editInvitationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = editInvitationSelect.value;
    if (!id) { showNotif('Pilih undangan terlebih dahulu', 'error'); return; }

    const payload = formToObject(editInvitationForm);
    const btn = editInvitationForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    const res = await apiFetch(`/invitations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });

    btn.disabled = false;
    btn.textContent = 'Simpan Perubahan';

    if (res.ok) {
        loadMyInvitations();
        showNotif('Undangan berhasil diperbarui');
    } else {
        const err = await res.json().catch(() => ({}));
        showNotif(err.message || 'Gagal memperbarui undangan', 'error');
    }
});

// ============================================================
// Couple Photos & Music Upload
// ============================================================
async function uploadCouplePhoto(role, inputEl) {
    const invId = editInvitationSelect.value;
    const file = inputEl.files[0];
    if (!invId) { showNotif('Pilih undangan untuk diedit', 'error'); return; }
    if (!file) { showNotif('Pilih foto terlebih dahulu', 'error'); return; }

    const fd = new FormData();
    fd.append('photo', file);
    fd.append('role', role);

    const res = await apiFetch(`/invitations/${invId}/couple-photo`, { method: 'POST', body: fd });
    if (res.ok) {
        inputEl.value = '';
        showNotif(`Foto ${role === 'groom' ? 'Pria' : 'Wanita'} berhasil diupload`);
        loadMyInvitations();
    } else {
        const err = await res.json().catch(() => ({}));
        showNotif(err.message || 'Gagal upload foto', 'error');
    }
}

uploadGroomPhotoBtn.addEventListener('click', () => uploadCouplePhoto('groom', groomPhotoInput));
uploadBridePhotoBtn.addEventListener('click', () => uploadCouplePhoto('bride', bridePhotoInput));

uploadMusicBtn.addEventListener('click', async () => {
    const invId = editInvitationSelect.value;
    const file = musicInput.files[0];
    if (!invId) { showNotif('Pilih undangan terlebih dahulu', 'error'); return; }
    if (!file) { showNotif('Pilih file musik terlebih dahulu', 'error'); return; }

    const fd = new FormData();
    fd.append('music', file);

    const res = await apiFetch(`/invitations/${invId}/music`, { method: 'POST', body: fd });
    if (res.ok) {
        musicInput.value = '';
        showNotif('Musik berhasil diupload');
        loadMyInvitations();
    } else {
        const err = await res.json().catch(() => ({}));
        showNotif(err.message || 'Gagal upload musik', 'error');
    }
});

// ============================================================
// Gallery
// ============================================================
galleryInvitationSelect.addEventListener('change', loadGallery);

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const invId = galleryInvitationSelect.value;
    const file = imageInput.files[0];
    if (!invId) { showNotif('Pilih undangan terlebih dahulu', 'error'); return; }
    if (!file) { showNotif('Pilih gambar terlebih dahulu', 'error'); return; }

    const fd = new FormData();
    fd.append('image', file);
    fd.append('invitation_id', invId);

    const res = await apiFetch('/gallery/upload', { method: 'POST', body: fd });
    if (res.ok) {
        imageInput.value = '';
        loadGallery();
        showNotif('Foto berhasil diunggah');
    } else {
        const err = await res.json().catch(() => ({}));
        showNotif(err.message || 'Gagal unggah foto', 'error');
    }
});

async function loadGallery() {
    const invId = galleryInvitationSelect.value;
    if (!invId) return;

    const res = await fetch(`${API_URL}/gallery/${invId}`);
    if (!res.ok) return;
    const images = await res.json();

    galleryList.innerHTML = images.length === 0
        ? '<li class="text-sm text-gray-400 italic">Belum ada foto.</li>'
        : images.map(img => `
            <li class="flex items-center justify-between text-xs gap-2">
                <a href="${img.image_path}" target="_blank" class="text-primary underline truncate max-w-[180px]">
                    ${img.image_path.split('/').pop()}
                </a>
                <button data-id="${img.id}" class="btn-del-img px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 flex-shrink-0">Hapus</button>
            </li>
        `).join('');

    galleryList.querySelectorAll('.btn-del-img').forEach(btn => {
        btn.addEventListener('click', async () => {
            const res = await apiFetch(`/gallery/${btn.dataset.id}`, { method: 'DELETE' });
            if (res.ok) { loadGallery(); showNotif('Foto dihapus'); }
        });
    });
}

// ============================================================
// Guests
// ============================================================
guestInvitationSelect.addEventListener('change', loadGuestList);

addGuestBtn.addEventListener('click', async () => {
    const invId = guestInvitationSelect.value;
    const name = guestNameInput.value.trim();
    if (!invId) { showNotif('Pilih undangan terlebih dahulu', 'error'); return; }
    if (!name) { showNotif('Masukkan nama tamu', 'error'); return; }

    const res = await apiFetch('/guests', {
        method: 'POST',
        body: JSON.stringify({ invitation_id: invId, guest_name: name }),
    });

    if (res.ok) {
        guestNameInput.value = '';
        loadGuestList();
        showNotif('Tamu berhasil ditambahkan');
    } else {
        const err = await res.json().catch(() => ({}));
        showNotif(err.message || 'Gagal menambahkan tamu', 'error');
    }
});

uploadBulkGuestBtn.addEventListener('click', async () => {
    const invId = guestInvitationSelect.value;
    const file = bulkGuestInput.files[0];
    if (!invId) { showNotif('Pilih undangan terlebih dahulu', 'error'); return; }
    if (!file) { showNotif('Pilih file terlebih dahulu', 'error'); return; }

    const fd = new FormData();
    fd.append('invitation_id', invId);
    fd.append('file', file);

    const res = await apiFetch('/guests/bulk', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
        bulkGuestInput.value = '';
        loadGuestList();
        showNotif(data.message || 'Tamu berhasil diimport');
    } else {
        showNotif(data.message || 'Gagal upload', 'error');
    }
});

async function loadGuestList() {
    const invId = guestInvitationSelect.value;
    if (!invId) return;

    const res = await apiFetch(`/guests/${invId}`);
    if (!res.ok) return;
    const data = await res.json();

    guestList.innerHTML = data.guests.length === 0
        ? '<li class="text-sm text-gray-400 italic p-2">Belum ada tamu.</li>'
        : data.guests.map(g => {
            const invSlug = data.invitation_slug;
            const link = `/${invSlug}?to=${encodeURIComponent(g.guest_name)}`;
            return `
                <li class="flex items-center justify-between text-sm gap-2 py-1">
                    <span class="truncate">${g.guest_name} — 
                        <a class="text-primary underline text-xs" href="${link}" target="_blank">Link</a>
                        <button class="btn-copy-link text-xs text-gray-400 hover:text-primary ml-1" data-link="${link}">📋</button>
                    </span>
                    <button data-id="${g.id}" class="btn-del-guest px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 flex-shrink-0">Hapus</button>
                </li>
            `;
        }).join('');

    guestList.querySelectorAll('.btn-del-guest').forEach(btn => {
        btn.addEventListener('click', async () => {
            const res = await apiFetch(`/guests/${btn.dataset.id}`, { method: 'DELETE' });
            if (res.ok) { loadGuestList(); showNotif('Tamu dihapus'); }
        });
    });

    guestList.querySelectorAll('.btn-copy-link').forEach(btn => {
        btn.addEventListener('click', () => {
            const fullLink = window.location.origin + btn.dataset.link;
            navigator.clipboard.writeText(fullLink).then(() => showNotif('Link disalin'));
        });
    });
}

// ============================================================
// RSVP
// ============================================================
loadRsvpBtn.addEventListener('click', async () => {
    const invId = rsvpInvitationSelect.value;
    if (!invId) { showNotif('Pilih undangan terlebih dahulu', 'error'); return; }

    const res = await apiFetch(`/rsvp/${invId}`);
    if (!res.ok) return;
    const rsvps = await res.json();

    if (rsvps.length === 0) {
        rsvpTableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400 text-sm">Belum ada RSVP.</td></tr>';
        return;
    }

    rsvpTableBody.innerHTML = rsvps.map(r => `
        <tr class="border-b hover:bg-gray-50">
            <td class="py-2 px-2">${escapeHtml(r.guest_name)}</td>
            <td class="py-2 px-2 capitalize">
                <span class="px-2 py-0.5 rounded-full text-xs ${
                    r.attendance === 'hadir' ? 'bg-green-100 text-green-700' :
                    r.attendance === 'tidak' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                }">${r.attendance}</span>
            </td>
            <td class="py-2 px-2">${r.total_guest}</td>
            <td class="py-2 px-2 text-gray-500 text-xs">${escapeHtml(r.message || '')}</td>
        </tr>
    `).join('');
});

// ============================================================
// Helpers
// ============================================================
function formToObject(form) {
    const fd = new FormData(form);
    const obj = {};
    fd.forEach((v, k) => { if (v !== '') obj[k] = v; });
    return obj;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function showNotif(message, type = 'success') {
    const el = document.getElementById('adminNotif');
    if (!el) return;
    el.textContent = message;
    el.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 ${
        type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
    }`;
    el.classList.remove('hidden');
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => el.classList.add('hidden'), 3000);
}

// ============================================================
// TAB SWITCHING
// ============================================================
function switchTab(tab) {
    const wedding = document.getElementById('tabContentWedding');
    const haflah = document.getElementById('tabContentHaflah');
    const btnW = document.getElementById('tabWedding');
    const btnH = document.getElementById('tabHaflah');

    if (tab === 'wedding') {
        wedding.classList.remove('hidden');
        haflah.classList.add('hidden');
        btnW.classList.add('border-primary', 'text-primary');
        btnW.classList.remove('border-transparent', 'text-gray-500');
        btnH.classList.remove('border-blue-700', 'text-blue-700');
        btnH.classList.add('border-transparent', 'text-gray-500');
    } else {
        haflah.classList.remove('hidden');
        wedding.classList.add('hidden');
        btnH.classList.add('border-blue-700', 'text-blue-700');
        btnH.classList.remove('border-transparent', 'text-gray-500');
        btnW.classList.remove('border-primary', 'text-primary');
        btnW.classList.add('border-transparent', 'text-gray-500');
        loadHaflahList();
    }
}

// Wire up tab buttons via event listeners (not inline onclick)
document.getElementById('tabWedding')?.addEventListener('click', () => switchTab('wedding'));
document.getElementById('tabHaflah')?.addEventListener('click', () => switchTab('haflah'));

// ============================================================
// HAFLAH — State
// ============================================================
let myHaflahs = [];
let haflahSchedule = [];

// ============================================================
// HAFLAH — Load List
// ============================================================
document.getElementById('refreshHaflah')?.addEventListener('click', loadHaflahList);

async function loadHaflahList() {
    try {
        const res = await apiFetch('/haflah/my');
        if (!res.ok) throw new Error('Failed');
        myHaflahs = await res.json();
        renderHaflahList();
        populateHaflahSelects();
    } catch (e) { console.error(e); }
}

function renderHaflahList() {
    const list = document.getElementById('haflahList');
    if (!list) return;
    if (!myHaflahs.length) {
        list.innerHTML = '<li class="text-sm text-gray-400 italic">Belum ada haflah.</li>';
        return;
    }
    list.innerHTML = myHaflahs.map(h => `
        <li class="flex items-center justify-between gap-2 text-sm">
            <span class="truncate">${h.event_name} — <a class="text-blue-600 underline" href="/haflah/${h.slug}" target="_blank">Buka</a></span>
            <div class="flex gap-1 flex-shrink-0">
                <button data-id="${h.id}" class="btn-haflah-edit px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Edit</button>
                <button data-id="${h.id}" class="btn-haflah-del px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200">Hapus</button>
            </div>
        </li>
    `).join('');

    list.querySelectorAll('.btn-haflah-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const h = myHaflahs.find(x => String(x.id) === btn.dataset.id);
            if (h) fillHaflahEditForm(h);
        });
    });
    list.querySelectorAll('.btn-haflah-del').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Hapus haflah ini?')) return;
            const res = await apiFetch(`/haflah/${btn.dataset.id}`, { method: 'DELETE' });
            if (res.ok) { loadHaflahList(); showNotif('Haflah dihapus'); }
            else showNotif('Gagal menghapus', 'error');
        });
    });
}

function populateHaflahSelects() {
    const opts = myHaflahs.map(h => `<option value="${h.id}">${h.slug} — ${h.event_name}</option>`).join('');
    ['editHaflahSelect','haflahGuestSelect','haflahGallerySelect','haflahRsvpSelect'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<option value="">Pilih haflah...</option>' + opts;
    });
}

// ============================================================
// HAFLAH — Create
// ============================================================
document.getElementById('createHaflahForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = formToObject(e.target);
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Membuat...';
    const res = await apiFetch('/haflah', { method: 'POST', body: JSON.stringify(payload) });
    btn.disabled = false; btn.textContent = '🎓 Buat Undangan Haflah';
    if (res.ok) { e.target.reset(); loadHaflahList(); showNotif('Haflah berhasil dibuat'); }
    else { const d = await res.json().catch(()=>({})); showNotif(d.message || 'Gagal', 'error'); }
});

// ============================================================
// HAFLAH — Fill Edit Form
// ============================================================
document.getElementById('editHaflahSelect')?.addEventListener('change', () => {
    const h = myHaflahs.find(x => String(x.id) === document.getElementById('editHaflahSelect').value);
    if (h) fillHaflahEditForm(h);
});

function fillHaflahEditForm(h) {
    document.getElementById('editHaflahSelect').value = h.id;
    const f = document.getElementById('editHaflahForm');
    const sv = (name, val) => { const el = f.querySelector(`[name="${name}"]`); if (el) el.value = val || ''; };
    sv('event_name', h.event_name);
    sv('institution_name', h.institution_name);
    sv('event_subtitle', h.event_subtitle);
    sv('event_date', h.event_date);
    sv('event_description', h.event_description);
    sv('venue_name', h.venue_name);
    sv('venue_address', h.venue_address);
    sv('maps_url', h.maps_url);
    sv('primary_color', h.primary_color || '#1E40AF');
    sv('secondary_color', h.secondary_color || '#F59E0B');
    sv('organizer_name', h.organizer_name);

    // Schedule
    haflahSchedule = Array.isArray(h.schedule) ? [...h.schedule] : [];
    renderScheduleBuilder();

    // Current files
    const showCurrent = (elId, url, label) => {
        const el = document.getElementById(elId);
        if (!el) return;
        if (url) { el.classList.remove('hidden'); const a = el.querySelector('a'); if (a) { a.href = url; a.textContent = label; } }
        else el.classList.add('hidden');
    };
    showCurrent('currentBanner', h.banner_image, 'View');
    showCurrent('currentHaflahMusic', h.music_url, 'Play');
}

// ============================================================
// HAFLAH — Schedule Builder
// ============================================================
document.getElementById('addScheduleBtn')?.addEventListener('click', () => {
    haflahSchedule.push({ time: '', title: '', description: '' });
    renderScheduleBuilder();
});

function renderScheduleBuilder() {
    const container = document.getElementById('scheduleBuilder');
    if (!container) return;
    if (!haflahSchedule.length) {
        container.innerHTML = '<p class="text-sm text-gray-400 italic">Belum ada jadwal. Klik "+ Tambah Item"</p>';
        return;
    }
    container.innerHTML = haflahSchedule.map((item, i) => `
        <div class="flex gap-2 items-start bg-blue-50 p-3 rounded-lg border border-blue-100">
            <div class="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                <input type="text" placeholder="Waktu (08.00 WIB)" value="${escHtml(item.time || '')}"
                    class="px-3 py-1.5 border rounded text-sm"
                    onchange="haflahSchedule[${i}].time = this.value">
                <input type="text" placeholder="Nama Kegiatan" value="${escHtml(item.title || '')}"
                    class="px-3 py-1.5 border rounded text-sm"
                    onchange="haflahSchedule[${i}].title = this.value">
                <input type="text" placeholder="Keterangan (opsional)" value="${escHtml(item.description || '')}"
                    class="px-3 py-1.5 border rounded text-sm"
                    onchange="haflahSchedule[${i}].description = this.value">
            </div>
            <button onclick="removeScheduleItem(${i})" class="text-red-400 hover:text-red-600 flex-shrink-0 mt-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>
    `).join('');
}

function removeScheduleItem(i) {
    haflahSchedule.splice(i, 1);
    renderScheduleBuilder();
}

// ============================================================
// HAFLAH — Save Edit
// ============================================================
document.getElementById('editHaflahForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editHaflahSelect').value;
    if (!id) { showNotif('Pilih haflah terlebih dahulu', 'error'); return; }
    const payload = formToObject(e.target);
    payload.schedule = haflahSchedule;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    const res = await apiFetch(`/haflah/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    btn.disabled = false; btn.textContent = 'Simpan Perubahan';
    if (res.ok) { loadHaflahList(); showNotif('Haflah berhasil diperbarui'); }
    else { const d = await res.json().catch(()=>({})); showNotif(d.message || 'Gagal', 'error'); }
});

// ============================================================
// HAFLAH — Banner & Music Upload
// ============================================================
document.getElementById('uploadHaflahBannerBtn')?.addEventListener('click', async () => {
    const id = document.getElementById('editHaflahSelect').value;
    const file = document.getElementById('haflahBannerInput').files[0];
    if (!id) { showNotif('Pilih haflah terlebih dahulu', 'error'); return; }
    if (!file) { showNotif('Pilih file banner', 'error'); return; }
    const fd = new FormData(); fd.append('banner', file);
    const res = await apiFetch(`/haflah/${id}/banner`, { method: 'POST', body: fd });
    if (res.ok) { document.getElementById('haflahBannerInput').value = ''; showNotif('Banner diupload'); loadHaflahList(); }
    else { const d = await res.json().catch(()=>({})); showNotif(d.message || 'Gagal', 'error'); }
});

document.getElementById('uploadHaflahMusicBtn')?.addEventListener('click', async () => {
    const id = document.getElementById('editHaflahSelect').value;
    const file = document.getElementById('haflahMusicInput').files[0];
    if (!id) { showNotif('Pilih haflah terlebih dahulu', 'error'); return; }
    if (!file) { showNotif('Pilih file musik', 'error'); return; }
    const fd = new FormData(); fd.append('music', file);
    const res = await apiFetch(`/haflah/${id}/music`, { method: 'POST', body: fd });
    if (res.ok) { document.getElementById('haflahMusicInput').value = ''; showNotif('Musik diupload'); loadHaflahList(); }
    else { const d = await res.json().catch(()=>({})); showNotif(d.message || 'Gagal', 'error'); }
});

// ============================================================
// HAFLAH — Gallery
// ============================================================
document.getElementById('haflahGallerySelect')?.addEventListener('change', loadHaflahGallery);

document.getElementById('haflahUploadForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('haflahGallerySelect').value;
    const file = document.getElementById('haflahImageInput').files[0];
    if (!id) { showNotif('Pilih haflah', 'error'); return; }
    if (!file) { showNotif('Pilih gambar', 'error'); return; }
    const fd = new FormData(); fd.append('image', file); fd.append('haflah_id', id);
    const res = await apiFetch('/haflah-gallery/upload', { method: 'POST', body: fd });
    if (res.ok) { document.getElementById('haflahImageInput').value = ''; loadHaflahGallery(); showNotif('Foto diupload'); }
    else { const d = await res.json().catch(()=>({})); showNotif(d.message || 'Gagal', 'error'); }
});

async function loadHaflahGallery() {
    const id = document.getElementById('haflahGallerySelect').value;
    if (!id) return;
    const res = await fetch(`${API_URL}/haflah-gallery/${id}`);
    if (!res.ok) return;
    const images = await res.json();
    const list = document.getElementById('haflahGalleryList');
    list.innerHTML = !images.length ? '<li class="text-sm text-gray-400 italic">Belum ada foto.</li>'
        : images.map(img => `
            <li class="flex items-center justify-between text-xs gap-2">
                <a href="${img.image_path}" target="_blank" class="text-blue-600 underline truncate max-w-[160px]">${img.image_path.split('/').pop()}</a>
                <button data-id="${img.id}" class="btn-del-haflah-img px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200">Hapus</button>
            </li>`).join('');
    list.querySelectorAll('.btn-del-haflah-img').forEach(btn => {
        btn.addEventListener('click', async () => {
            const res = await apiFetch(`/haflah-gallery/${btn.dataset.id}`, { method: 'DELETE' });
            if (res.ok) { loadHaflahGallery(); showNotif('Foto dihapus'); }
        });
    });
}

// ============================================================
// HAFLAH — Guests
// ============================================================
document.getElementById('haflahGuestSelect')?.addEventListener('change', loadHaflahGuestList);

document.getElementById('addHaflahGuestBtn')?.addEventListener('click', async () => {
    const id = document.getElementById('haflahGuestSelect').value;
    const name = document.getElementById('haflahGuestNameInput').value.trim();
    if (!id) { showNotif('Pilih haflah', 'error'); return; }
    if (!name) { showNotif('Masukkan nama tamu', 'error'); return; }
    const res = await apiFetch('/haflah-guests', { method: 'POST', body: JSON.stringify({ haflah_id: id, guest_name: name }) });
    if (res.ok) { document.getElementById('haflahGuestNameInput').value = ''; loadHaflahGuestList(); showNotif('Tamu ditambahkan'); }
    else { const d = await res.json().catch(()=>({})); showNotif(d.message || 'Gagal', 'error'); }
});

document.getElementById('uploadHaflahBulkBtn')?.addEventListener('click', async () => {
    const id = document.getElementById('haflahGuestSelect').value;
    const file = document.getElementById('haflahBulkGuestInput').files[0];
    if (!id) { showNotif('Pilih haflah', 'error'); return; }
    if (!file) { showNotif('Pilih file', 'error'); return; }
    const fd = new FormData(); fd.append('haflah_id', id); fd.append('file', file);
    const res = await apiFetch('/haflah-guests/bulk', { method: 'POST', body: fd });
    const d = await res.json().catch(()=>({}));
    if (res.ok) { document.getElementById('haflahBulkGuestInput').value = ''; loadHaflahGuestList(); showNotif(d.message || 'Tamu diimport'); }
    else showNotif(d.message || 'Gagal', 'error');
});

async function loadHaflahGuestList() {
    const id = document.getElementById('haflahGuestSelect').value;
    if (!id) return;
    const res = await apiFetch(`/haflah-guests/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    const list = document.getElementById('haflahGuestList');
    list.innerHTML = !data.guests.length ? '<li class="text-sm text-gray-400 italic p-2">Belum ada tamu.</li>'
        : data.guests.map(g => {
            const link = `/haflah/${data.haflah_slug}?to=${encodeURIComponent(g.guest_name)}`;
            return `<li class="flex items-center justify-between text-sm gap-2 py-1">
                <span class="truncate">${g.guest_name} — <a class="text-blue-600 underline text-xs" href="${link}" target="_blank">Link</a>
                    <button class="btn-haflah-copy text-xs text-gray-400 hover:text-blue-600 ml-1" data-link="${link}">📋</button>
                </span>
                <button data-id="${g.id}" class="btn-del-haflah-guest px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 flex-shrink-0">Hapus</button>
            </li>`;
        }).join('');
    list.querySelectorAll('.btn-del-haflah-guest').forEach(btn => {
        btn.addEventListener('click', async () => {
            const res = await apiFetch(`/haflah-guests/${btn.dataset.id}`, { method: 'DELETE' });
            if (res.ok) { loadHaflahGuestList(); showNotif('Tamu dihapus'); }
        });
    });
    list.querySelectorAll('.btn-haflah-copy').forEach(btn => {
        btn.addEventListener('click', () => {
            navigator.clipboard.writeText(window.location.origin + btn.dataset.link).then(() => showNotif('Link disalin'));
        });
    });
}

// ============================================================
// HAFLAH — RSVP
// ============================================================
document.getElementById('loadHaflahRsvpBtn')?.addEventListener('click', async () => {
    const id = document.getElementById('haflahRsvpSelect').value;
    if (!id) { showNotif('Pilih haflah', 'error'); return; }
    const res = await apiFetch(`/haflah-rsvp/${id}`);
    if (!res.ok) return;
    const rsvps = await res.json();
    const tbody = document.getElementById('haflahRsvpBody');
    tbody.innerHTML = !rsvps.length
        ? '<tr><td colspan="4" class="text-center py-4 text-gray-400 text-sm">Belum ada RSVP.</td></tr>'
        : rsvps.map(r => `<tr class="border-b">
            <td class="py-2 px-2">${escHtml(r.guest_name)}</td>
            <td class="py-2 px-2 capitalize"><span class="px-2 py-0.5 rounded-full text-xs ${r.attendance==='hadir'?'bg-green-100 text-green-700':r.attendance==='tidak'?'bg-red-100 text-red-700':'bg-yellow-100 text-yellow-700'}">${r.attendance}</span></td>
            <td class="py-2 px-2">${r.total_guest}</td>
            <td class="py-2 px-2 text-gray-500 text-xs">${escHtml(r.message || '')}</td>
        </tr>`).join('');
});

// ============================================================
// Helpers (haflah-specific)
// ============================================================
function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Start app
init();
