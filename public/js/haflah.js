// ============================================================
// haflah.js — Guest-facing haflah invitation page
// URL pattern: /haflah/:slug
// ============================================================

// ---- Animated Stars ----
function initStars(primaryColor) {
    const canvas = document.getElementById('stars-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let stars = [];
    let shootingStars = [];
    let animFrame;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = document.body.scrollHeight;
    }

    function createStars() {
        stars = [];
        const count = Math.floor((canvas.width * canvas.height) / 3000);
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                r: Math.random() * 1.8 + 0.3,
                alpha: Math.random(),
                speed: Math.random() * 0.01 + 0.003,
                twinkleOffset: Math.random() * Math.PI * 2,
            });
        }
    }

    function createShootingStar() {
        if (Math.random() > 0.97) {
            shootingStars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height * 0.5,
                len: Math.random() * 80 + 40,
                speed: Math.random() * 8 + 4,
                alpha: 1,
                angle: Math.PI / 6,
            });
        }
    }

    function hexToRgb(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `${r},${g},${b}`;
    }

    const bgRgb = hexToRgb(primaryColor || '#1E40AF');

    let tick = 0;
    function draw() {
        tick++;
        canvas.height = document.body.scrollHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Background gradient
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, `rgba(${bgRgb}, 1)`);
        grad.addColorStop(0.5, `rgba(${bgRgb}, 0.95)`);
        grad.addColorStop(1, `rgba(${bgRgb}, 1)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Stars
        for (const s of stars) {
            const alpha = 0.4 + 0.6 * Math.abs(Math.sin(tick * s.speed + s.twinkleOffset));
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fill();
        }

        // Shooting stars
        createShootingStar();
        shootingStars = shootingStars.filter(ss => ss.alpha > 0.05);
        for (const ss of shootingStars) {
            ctx.beginPath();
            ctx.moveTo(ss.x, ss.y);
            ctx.lineTo(ss.x - ss.len * Math.cos(ss.angle), ss.y - ss.len * Math.sin(ss.angle));
            const lineGrad = ctx.createLinearGradient(
                ss.x, ss.y,
                ss.x - ss.len * Math.cos(ss.angle),
                ss.y - ss.len * Math.sin(ss.angle)
            );
            lineGrad.addColorStop(0, `rgba(255,255,200,${ss.alpha})`);
            lineGrad.addColorStop(1, `rgba(255,255,200,0)`);
            ctx.strokeStyle = lineGrad;
            ctx.lineWidth = 2;
            ctx.stroke();
            ss.x += ss.speed * Math.cos(ss.angle);
            ss.y += ss.speed * Math.sin(ss.angle);
            ss.alpha -= 0.025;
        }

        // Decorative large stars (★)
        const bigStars = [
            { x: 0.05, y: 0.04, size: 22 },
            { x: 0.9,  y: 0.06, size: 18 },
            { x: 0.15, y: 0.35, size: 14 },
            { x: 0.82, y: 0.28, size: 16 },
            { x: 0.5,  y: 0.15, size: 12 },
            { x: 0.3,  y: 0.65, size: 15 },
            { x: 0.75, y: 0.6,  size: 13 },
        ];
        for (const bs of bigStars) {
            const pulse = 0.6 + 0.4 * Math.abs(Math.sin(tick * 0.02 + bs.x * 10));
            ctx.font = `${bs.size}px serif`;
            ctx.fillStyle = `rgba(253, 224, 71, ${pulse})`;
            ctx.fillText('★', bs.x * canvas.width, bs.y * canvas.height);
        }

        animFrame = requestAnimationFrame(draw);
    }

    window.addEventListener('resize', () => { resize(); createStars(); });
    resize();
    createStars();
    draw();
}

// ----

document.addEventListener('DOMContentLoaded', () => {
    // Init stars dengan warna default dulu
    initStars('#1E40AF');

    const slug = getSlugFromUrl();
    if (slug) {
        fetchHaflahData(slug);
    } else {
        showError('Undangan tidak ditemukan. Buka dengan URL: /haflah/nama-slug');
    }
    setupEventListeners();
});

function getSlugFromUrl() {
    // Path: /haflah/nama-slug
    const parts = window.location.pathname.split('/').filter(Boolean);
    // parts[0] = 'haflah', parts[1] = slug
    if (parts[0] === 'haflah' && parts[1]) return parts[1];
    return null;
}

async function fetchHaflahData(slug) {
    const apiUrl = typeof API_URL !== 'undefined' ? API_URL : null;
    if (!apiUrl) { showError('Konfigurasi API tidak ditemukan.'); return; }

    try {
        const res = await fetch(`${apiUrl}/haflah/${slug}`);
        if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            throw new Error(e.message || 'Not found');
        }
        const data = await res.json();
        populateUI(data);
    } catch (err) {
        console.error(err);
        showError('Undangan tidak ditemukan atau terjadi kesalahan.');
    }
}

function populateUI(data) {
    // Apply theme colors
    const primary = data.primary_color || '#1E40AF';
    const secondary = data.secondary_color || '#F59E0B';
    document.documentElement.style.setProperty('--color-primary', primary);
    document.documentElement.style.setProperty('--color-secondary', secondary);

    // Update body background
    document.body.style.background = primary;

    // Init animated stars with primary color
    initStars(primary);

    // Cover
    if (data.banner_image) {
        const bannerEl = document.getElementById('cover-banner');
        const bannerImg = document.getElementById('banner-img');
        if (bannerEl && bannerImg) {
            bannerImg.src = data.banner_image;
            bannerEl.classList.remove('hidden');
            // Hide text block if banner is available
            const textBlock = document.getElementById('cover-text-block');
            if (textBlock) textBlock.classList.add('hidden');
        }
    }

    setEl('cover-event-name', data.event_name);
    setEl('cover-institution', data.institution_name || '');
    setEl('cover-date', formatDate(data.event_date));

    // Main sections
    setEl('main-event-name', data.event_name);
    setEl('main-institution', data.institution_name || '');
    setEl('main-subtitle', data.event_subtitle || '');
    setEl('main-description', data.event_description || '');
    setEl('main-date', formatDate(data.event_date));
    setEl('main-venue', data.venue_name);

    // Location
    setEl('location-venue', data.venue_name);
    setEl('location-address', data.venue_address);
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
                <div class="aspect-square bg-gray-100 rounded-2xl overflow-hidden group cursor-pointer hover:shadow-xl transition-all duration-300">
                    <img src="${escHtml(img.image_path)}" alt="Galeri" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy">
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

    // Guest name from ?to= param
    const urlParams = new URLSearchParams(window.location.search);
    const guestName = urlParams.get('to');
    const guestDisplay = document.getElementById('guest-display');
    if (guestName && guestDisplay) guestDisplay.textContent = decodeURIComponent(guestName);

    // RSVP form
    const rsvpForm = document.getElementById('rsvp-form');
    if (rsvpForm) {
        rsvpForm.dataset.haflahId = data.id;
        if (guestName) {
            const nameInput = rsvpForm.querySelector('input[name="guest_name"]');
            if (nameInput) nameInput.value = decodeURIComponent(guestName);
        }
    }

    // Footer
    setEl('footer-event', data.event_name);
    setEl('footer-institution', data.institution_name || '');

    // Page title
    document.title = `Undangan ${data.event_name}`;

    // Update cover star-bg color dynamically
    const cover = document.getElementById('cover');
    if (cover) cover.style.backgroundColor = primary;
}

function renderSchedule(schedule) {
    const list = document.getElementById('schedule-list');
    if (!list) return;

    if (!schedule || schedule.length === 0) {
        list.innerHTML = '<div class="text-center text-gray-400 text-sm py-8">Jadwal belum ditambahkan</div>';
        return;
    }

    list.innerHTML = schedule.map((item, i) => `
        <div class="flex gap-4 items-start bg-gradient-to-r from-blue-50 to-white p-4 rounded-2xl border border-blue-100">
            <div class="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-md"
                 style="background: var(--color-primary, #1E40AF)">
                ${String(i + 1).padStart(2, '0')}
            </div>
            <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                    ${item.time ? `<span class="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-0.5 rounded-full">🕐 ${escHtml(item.time)}</span>` : ''}
                </div>
                <p class="font-bold text-blue-900 text-sm">${escHtml(item.title || '')}</p>
                ${item.description ? `<p class="text-gray-500 text-xs mt-0.5">${escHtml(item.description)}</p>` : ''}
            </div>
        </div>
    `).join('');
}

function openInvitation() {
    const cover = document.getElementById('cover');
    const main = document.getElementById('main-content');
    const audio = document.getElementById('bg-music');
    const audioControl = document.getElementById('audio-control');

    cover.style.transform = 'translateY(-100%)';
    setTimeout(() => {
        main.classList.remove('opacity-0');
        if (audio && audio.src && audio.src !== window.location.href) {
            audio.play().catch(() => {});
            if (audioControl) audioControl.classList.remove('hidden');
        }
    }, 500);
}

function setupEventListeners() {
    // Music toggle
    const musicBtn = document.getElementById('musicBtn');
    const audio = document.getElementById('bg-music');
    if (musicBtn && audio) {
        musicBtn.addEventListener('click', () => {
            if (audio.paused) {
                audio.play();
                musicBtn.classList.add('animate-spin-slow');
            } else {
                audio.pause();
                musicBtn.classList.remove('animate-spin-slow');
            }
        });
    }

    // RSVP
    const rsvpForm = document.getElementById('rsvp-form');
    if (rsvpForm) rsvpForm.addEventListener('submit', handleRsvp);
}

async function handleRsvp(e) {
    e.preventDefault();
    const form = e.target;
    const haflahId = form.dataset.haflahId;
    if (!haflahId) return;

    const formData = new FormData(form);
    const payload = {
        haflah_id: haflahId,
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
            const err = await res.json().catch(() => ({}));
            showToast(err.message || 'Gagal mengirim RSVP', 'error');
            btn.disabled = false;
            btn.textContent = 'Kirim Konfirmasi 🎓';
        }
    } catch (err) {
        showToast('Terjadi kesalahan koneksi.', 'error');
        btn.disabled = false;
        btn.textContent = 'Kirim Konfirmasi 🎓';
    }
}

// ---- Helpers ----
function setEl(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '';
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function showError(msg) {
    const cover = document.querySelector('#cover .relative.z-10');
    if (cover) cover.innerHTML = `<p class="text-xl text-red-300 font-semibold">${msg}</p>`;
}

function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `fixed bottom-24 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg transition-opacity duration-300 pointer-events-none z-50 ${type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'}`;
    t.style.opacity = '1';
    setTimeout(() => { t.style.opacity = '0'; }, 3000);
}
