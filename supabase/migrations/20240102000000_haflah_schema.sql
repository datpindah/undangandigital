-- ============================================================
-- Haflah Invitations Schema
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS haflah_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,

  -- Informasi Acara
  event_name TEXT NOT NULL,               -- "Haflah Akhirussannah"
  institution_name TEXT,                  -- "KBIT-TKIT-SDIT AN-NUUR"
  event_subtitle TEXT,                    -- "Dream Universe: Semesta Mimpi..."
  event_date TEXT NOT NULL,               -- "2026-06-21"
  event_description TEXT,                 -- Deskripsi singkat acara

  -- Lokasi
  venue_name TEXT NOT NULL DEFAULT 'Venue',
  venue_address TEXT NOT NULL DEFAULT 'Alamat menyusul',
  maps_url TEXT,

  -- Jadwal / Rangkaian Acara (JSON array of {time, title, description})
  schedule JSONB DEFAULT '[]'::jsonb,

  -- Tema & Tampilan
  primary_color TEXT DEFAULT '#1E40AF',   -- Biru default haflah
  secondary_color TEXT DEFAULT '#F59E0B', -- Kuning aksen
  banner_image TEXT,                      -- URL banner/spanduk

  -- Media
  music_url TEXT,

  -- Info Kontak/Penyelenggara
  organizer_name TEXT,
  organizer_phone TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE haflah_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read haflah" ON haflah_invitations
  FOR SELECT USING (true);

CREATE POLICY "Owner insert haflah" ON haflah_invitations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner update haflah" ON haflah_invitations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Owner delete haflah" ON haflah_invitations
  FOR DELETE USING (auth.uid() = user_id);

-- Haflah gallery (reuse same pattern)
CREATE TABLE IF NOT EXISTS haflah_gallery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  haflah_id UUID NOT NULL REFERENCES haflah_invitations(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE haflah_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read haflah gallery" ON haflah_gallery
  FOR SELECT USING (true);

CREATE POLICY "Owner manage haflah gallery" ON haflah_gallery
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM haflah_invitations
      WHERE haflah_invitations.id = haflah_gallery.haflah_id
        AND haflah_invitations.user_id = auth.uid()
    )
  );

-- Haflah RSVP
CREATE TABLE IF NOT EXISTS haflah_rsvps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  haflah_id UUID NOT NULL REFERENCES haflah_invitations(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  attendance TEXT NOT NULL CHECK (attendance IN ('hadir', 'tidak', 'ragu')),
  total_guest INTEGER DEFAULT 1,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE haflah_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public insert haflah rsvp" ON haflah_rsvps
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Owner read haflah rsvps" ON haflah_rsvps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM haflah_invitations
      WHERE haflah_invitations.id = haflah_rsvps.haflah_id
        AND haflah_invitations.user_id = auth.uid()
    )
  );

-- Haflah Guests
CREATE TABLE IF NOT EXISTS haflah_guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  haflah_id UUID NOT NULL REFERENCES haflah_invitations(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  slug TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE haflah_guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manage haflah guests" ON haflah_guests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM haflah_invitations
      WHERE haflah_invitations.id = haflah_guests.haflah_id
        AND haflah_invitations.user_id = auth.uid()
    )
  );
