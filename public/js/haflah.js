// ============================================================
// haflah.js — Halaman undangan Haflah
// ============================================================

// ── Animated Stars Background ──────────────────────────────
function initStars(primaryColor) {
    const canvas = document.getElementById('stars-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W, H, stars = [], tick = 0;
    const shooting = [];

    // Parse hex to rgb
    function hex2rgb(hex) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const n = parseInt(hex, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    const [r, g, b] = hex2rgb(primaryColor || '#1E40AF');
    // Make slightly darker version for gradient bottom
    const [rd, gd, bd] = [Math.max(0, r - 30), Math.max(0, g - 30), Math.max(0, b - 30)];

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }

    function mkStars() {
        stars = [];
        const n = Math.floor(W * H / 2500);
        for (let i = 0; i < n; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H,
                r: Math.random() * 1.6 + 0.2,
                phase: Math.random() * Math.PI * 2,
                speed: Math.random() * 0.008 + 0.003,
            });
        }
    }

    function tryShoot() {
        if (Math.random() < 0.008) {
            shooting.push({
                x: Math.random() * W,
                y: Math.random() * H * 0.4,
                len: Math.random() * 120 + 60,
                spd: Math.random() * 10 + 5,
                a: 1,
            });
        }
    }

    function draw() {
        tick++;

        // Background gradient
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, `rgb(${rd},${gd},${bd})`);
        bg.addColorStop(1, `rgb(${r},${g},${b})`);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // Stars
        for (const s of stars) {
            const alpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(tick * s.speed + s.phase));
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            ctx.fill();
        }

        // Shooting stars
        tryShoot();
        for (let i = shooting.length - 1; i >= 0; i--) {
            const ss = shooting[i];
            const ang = Math.PI / 5;
            const grd = ctx.createLinearGradient(
                ss.x, ss.y,
                ss.x - ss.len * Math.cos(ang), ss.y + ss.len * Math.sin(ang)
            );
            grd.addColorStop(0, `rgba(255,255,200,${ss.a})`);
            grd.addColorStop(1, 'rgba(255,255,200,0)');
            ctx.beginPath();
            ctx.moveTo(ss.x, ss.y);
            ctx.lineTo(ss.x - ss.len * Math.cos(ang), ss.y + ss.len * Math.sin(ang));
            ctx.strokeStyle = grd;
            ctx.lineWidth = 2;
            ctx.stroke();
            ss.x += ss.spd * Math.cos(ang);
            ss.y -= ss.spd * Math.sin(ang) * -1; // downward diagonal
            ss.a -= 0.03;
            if (ss.a <= 0) shooting.splice(i, 1);
        }

        // Large decorative ★ symbols
        const deco = [
            { fx: 0.06, fy: 0.06, sz: 22, delay: 0 },
            { fx: 0.88, fy: 0.08, sz: 18, delay: 1 },
            { fx: 0.12, fy: 0.38, sz: 14, delay: 2 },
            { fx: 0.80, fy: 0.30, sz: 16, delay: 3 },
            { fx: 0.50, fy: 0.14, sz: 12, delay: 4 },
            { fx: 0.30, fy: 0.70, sz: 15, delay: 1.5 },
            { fx: 0.75, fy: 0.65, sz: 13, delay: 2.5 },
            { fx: 0.95, fy: 0.55, sz: 10, delay: 0.5 },
        ];
        for (const d of deco) {
            const pulse = 0.5 + 0.5 * Math.sin(tick * 0.02 + d.delay);
            ctx.font = `${d.sz}px serif`;
            ctx.fillStyle = `rgba(253,224,71,${0.5 + 0.5 * pulse})`;
            ctx.fillText('★', d.fx * W, d.fy * H);
        }

        requestAnimationFrame(draw);
    }

    window.addEventListener('resize', () => { resize(); mkStars(); });
    resize();
    mkStars();
    draw();

    // Update body background to match
    document.body.style.background = primaryColor || '#1E40AF';
    document.documentElement.style.setProperty('--primary', primaryColor || '#1E40AF');
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initStars('#1E40AF');

    const slug = getSlugFromUrl();
    if (slug) {
        fetchHaflahData(slug);
    } else {
        showCoverError('Buka dengan URL: /haflah/nama-slug');
    }

    setupListeners();
});

function getSlugFromUrl() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return (parts[0] === 'haflah' && parts[1]) ? parts[1] : null;
}

// ── Fetch Data ─────────────────────────────────────────────
async function fetchHaflahData(slug) {
    const apiUrl = typeof API_URL !== 'undefined' ? API_URL : null;
    if (!apiUrl) { showCoverError('Konfigurasi API tidak ditemukan.'); return; }

    try {
        const res = await fetch(`${apiUrl}/haflah/${slug}`);
        if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            throw new Error(e.message || 'Not found');
        }
        const data = await res.json();
        populateUI(data);
    } catch (err) {
        showCoverError('Undangan tidak ditemukan.');
    }
}

// ── Populate UI ────────────────────────────────────────────
function populateUI(data) {
    const primary   = data.primary_color   || '#1E40AF';
    const secondary = data.secondary_color || '#F59E0B';

    // Apply colors
    document.documentElement.style.setProperty('--primary', primary);
    document.documentElement.style.setProperty('--secondary', secondary);
    document.body.style.background = primary;

    // Re-init stars with actual color
    initStars(primary);

    // Cover
    if (data.banner_image) {
        const wrap = document.getElementById('cover-banner');
        const img  = document.getElementById('banner-img');
        if (wrap && img) {
            img.src = data.banner_image;
            wrap.classList.remove('hidden');
            document.getElementById('cover-text-block')?.classList.add('hidden');
        }
    }
    setText('cover-event-name', data.event_name);
    setText('cover-institution', data.institution_name || '');
    setText('cover-date', formatDate(data.event_date));

    // Main
    setText('main-event-name', data.event_name);
    setText('main-institution', data.institution_name || '');
    setText('main-subtitle', data.event_subtitle || '');
    setText('main-description', data.event_description || '');
    setText('main-date', formatDate(data.event_date));
    setText('main-venue', data.venue_name);

    // Location
    setText('location-venue', data.venue_name);
    setText('location-address', data.venue_address);
    const mapLink = document.getElementById('map-link');
    if (mapLink) {
        mapLink.href = data.maps_url ||
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.venue_address || '')}`;
    }

    // Schedule
    renderSchedule(data.schedule || []);

    // Gallery
    if (data.gallery && data.gallery.length > 0) {
        const grid = document.getElementById('gallery-grid');
        if (grid) {
            grid.innerHTML = data.gallery.map(img => `
                <div class="aspect-square overflow-hidden rounded-2xl shadow-lg cursor-pointer group"
                     style="border: 1px solid rgba(255,255,255,0.2)">
                    <img src="${esc(img.image_path)}" alt="Galeri"
                         class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                         loading="lazy">
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

    // Guest name from ?to=
    const guestName = new URLSearchParams(window.location.search).get('to');
    if (guestName) {
        setText('guest-display', decodeURIComponent(guestName));
    }

    // RSVP dataset
    const form = document.getElementById('rsvp-form');
    if (form) {
        form.dataset.haflahId = data.id;
        if (guestName) {
            const inp = form.querySelector('input[name="guest_name"]');
            if (inp) inp.value = decodeURIComponent(guestName);
        }
    }

    // Footer
    setText('footer-event', data.event_name);
    setText('footer-institution', data.institution_name || '');

    // Update cloud bottom color in cover
    const cloud = document.querySelector('.cover-cloud');
    if (cloud) cloud.style.setProperty('--primary', primary);

    document.title = `Undangan ${data.event_name}`;
}

// ── Render Schedule ────────────────────────────────────────
function renderSchedule(schedule) {
    const list = document.getElementById('schedule-list');
    if (!list) return;
    if (!schedule || !schedule.length) {
        list.innerHTML = '<p class="text-center text-white/40 text-sm py-8">Jadwal belum ditambahkan</p>';
        return;
    }
    list.innerHTML = schedule.map((item, i) => `
        <div class="schedule-item">
            <div class="schedule-num">${String(i + 1).padStart(2, '0')}</div>
            <div class="flex-1">
                ${item.time ? `<span class="inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-1"
                    style="background: rgba(245,158,11,.25); color: var(--secondary)">🕐 ${esc(item.time)}</span>` : ''}
                <p class="font-black text-white text-sm">${esc(item.title || '')}</p>
                ${item.description ? `<p class="text-white/60 text-xs mt-0.5">${esc(item.description)}</p>` : ''}
            </div>
        </div>
    `).join('');
}

// ── Open Invitation ────────────────────────────────────────
function openInvitation() {
    const cover = document.getElementById('cover');
    const main  = document.getElementById('main-content');
    const audio = document.getElementById('bg-music');
    const ctrl  = document.getElementById('audio-control');

    if (cover) cover.style.transform = 'translateY(-100%)';
    setTimeout(() => {
        if (main) main.style.opacity = '1';
        if (audio && audio.src && audio.src !== window.location.href) {
            audio.play().catch(() => {});
            if (ctrl) ctrl.classList.remove('hidden');
        }
    }, 500);
}

// ── Event Listeners ────────────────────────────────────────
function setupListeners() {
    document.getElementById('openBtn')?.addEventListener('click', openInvitation);

    // Music toggle
    const musicBtn = document.getElementById('musicBtn');
    const audio    = document.getElementById('bg-music');
    if (musicBtn && audio) {
        musicBtn.addEventListener('click', () => {
            if (audio.paused) {
                audio.play();
                musicBtn.classList.add('spin-slow');
            } else {
                audio.pause();
                musicBtn.classList.remove('spin-slow');
            }
        });
    }

    // RSVP
    document.getElementById('rsvp-form')?.addEventListener('submit', handleRsvp);

    // Radio visual feedback
    document.querySelectorAll('input[name="attendance"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.querySelectorAll('input[name="attendance"]').forEach(r => {
                r.closest('label').style.borderColor = '';
                r.closest('label').style.background  = '';
            });
            const lbl = radio.closest('label');
            const colors = { hadir: '#3B82F6', tidak: '#EF4444', ragu: '#F59E0B' };
            lbl.style.borderColor = colors[radio.value] || '#3B82F6';
            lbl.style.background  = colors[radio.value] + '15';
        });
    });
}

// ── RSVP Submit ────────────────────────────────────────────
async function handleRsvp(e) {
    e.preventDefault();
    const form     = e.target;
    const haflahId = form.dataset.haflahId;
    if (!haflahId) return;

    const fd = new FormData(form);
    const payload = {
        haflah_id:   haflahId,
        guest_name:  fd.get('guest_name'),
        attendance:  fd.get('attendance'),
        total_guest: parseInt(fd.get('total_guest')) || 1,
        message:     fd.get('message') || '',
    };

    if (!payload.guest_name || !payload.attendance) {
        showToast('Nama dan kehadiran wajib diisi', 'error'); return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Mengirim...';

    try {
        const res = await fetch(`${API_URL}/haflah-rsvp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (res.ok) {
            form.classList.add('hidden');
            document.getElementById('rsvp-success')?.classList.remove('hidden');
        } else {
            const e2 = await res.json().catch(() => ({}));
            showToast(e2.message || 'Gagal mengirim RSVP', 'error');
            btn.disabled = false;
            btn.textContent = 'Kirim Konfirmasi 🎓';
        }
    } catch {
        showToast('Terjadi kesalahan koneksi.', 'error');
        btn.disabled = false;
        btn.textContent = 'Kirim Konfirmasi 🎓';
    }
}

// ── Helpers ────────────────────────────────────────────────
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '';
}

function esc(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(d) {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

function showCoverError(msg) {
    const el = document.querySelector('#cover .space-y-5');
    if (el) el.innerHTML = `<p class="text-xl font-bold" style="color:var(--secondary)">${msg}</p>`;
}

function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.style.background = type === 'error' ? '#DC2626' : '#1f2937';
    t.style.opacity = '1';
    setTimeout(() => { t.style.opacity = '0'; }, 3000);
}
