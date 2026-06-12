# Undangan Digital

Web app undangan pernikahan digital berbasis Supabase + Cloudflare Pages.

## Stack

- **Backend**: Supabase Edge Functions (Deno/TypeScript)
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage
- **Auth**: Supabase Auth
- **Frontend**: Vanilla JS + Tailwind CSS
- **Hosting**: Cloudflare Pages

## Setup

### 1. Buat Supabase Project

1. Buka [supabase.com](https://supabase.com) → New Project
2. Catat **Project URL** dan **Anon Key** dari Settings → API

### 2. Setup Database

Jalankan SQL berikut di Supabase SQL Editor:

```
supabase/migrations/20240101000000_initial_schema.sql
```

### 3. Setup Storage Bucket

Di Supabase SQL Editor, jalankan:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read uploads" ON storage.objects
  FOR SELECT USING (bucket_id = 'uploads');

CREATE POLICY "Auth users upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'uploads' AND auth.role() = 'authenticated');

CREATE POLICY "Owner delete uploads" ON storage.objects
  FOR DELETE USING (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### 4. Buat Admin User

Di Supabase Dashboard → Authentication → Users → Add User:
- Email: admin@example.com
- Password: (pilih password kuat)

### 5. Deploy Edge Functions

Install Supabase CLI:
```bash
npm install -g supabase
```

Login dan link project:
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Deploy semua functions:
```bash
supabase functions deploy invitations
supabase functions deploy rsvp
supabase functions deploy gallery
supabase functions deploy guests
```

### 6. Set Secrets pada Edge Functions

```bash
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
supabase secrets set SUPABASE_ANON_KEY=YOUR_ANON_KEY
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

> **Note**: `SUPABASE_URL` dan `SUPABASE_ANON_KEY` sudah otomatis tersedia di Edge Functions. Hanya `SUPABASE_SERVICE_ROLE_KEY` yang perlu di-set manual.

### 7. Update Config Frontend

Edit `public/js/config.js`:

```js
const SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";
```

### 8. Deploy ke Cloudflare Pages

1. Push repo ke GitHub
2. Buka [Cloudflare Pages](https://pages.cloudflare.com)
3. Connect GitHub repository
4. Build settings:
   - **Build command**: (kosongkan)
   - **Build output directory**: `public`
5. Deploy

## Struktur Folder

```
├── public/                  # Frontend (di-hosting di Cloudflare Pages)
│   ├── index.html           # Halaman undangan untuk tamu
│   ├── admin.html           # Dashboard admin
│   ├── _redirects           # Routing rules Cloudflare Pages
│   ├── _headers             # Security headers
│   └── js/
│       ├── config.js        # Supabase URL & Key (edit ini!)
│       ├── main.js          # Frontend tamu
│       └── admin.js         # Frontend admin
└── supabase/
    ├── config.toml          # Supabase local dev config
    ├── migrations/          # SQL schema
    └── functions/           # Edge Functions
        ├── _shared/         # Shared utilities
        ├── invitations/     # CRUD undangan
        ├── rsvp/            # RSVP
        ├── gallery/         # Galeri foto
        └── guests/          # Manajemen tamu
```

## Fitur

- Multi undangan per akun
- Info mempelai + foto
- Jadwal akad & resepsi
- Galeri foto
- Musik latar
- RSVP tamu
- Link undangan personal per tamu (`?to=NamaTamu`)
- Import tamu massal via CSV
- Info hadiah/rekening bank
- Peta lokasi (Google Maps)
