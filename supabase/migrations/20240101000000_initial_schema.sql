-- ============================================================
-- Undangan Digital - Initial Schema for Supabase PostgreSQL
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS (Admin)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Note: password auth is handled by Supabase Auth (auth.users)
-- This table stores extra profile data linked to auth.users

-- ============================================================
-- INVITATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  groom_name TEXT NOT NULL,
  bride_name TEXT NOT NULL,
  wedding_date TEXT NOT NULL,
  akad_time TEXT NOT NULL DEFAULT '08:00 WIB',
  resepsi_time TEXT NOT NULL DEFAULT '11:00 - 13:00 WIB',
  venue_name TEXT NOT NULL DEFAULT 'Venue',
  venue_address TEXT NOT NULL DEFAULT 'Alamat menyusul',
  primary_color TEXT DEFAULT '#4A6FA5',
  gift_bank TEXT,
  gift_account_name TEXT,
  gift_account_number TEXT,
  groom_parents_text TEXT,
  bride_parents_text TEXT,
  maps_url TEXT,
  groom_image TEXT,
  bride_image TEXT,
  music_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invitation_id UUID NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  slug TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RSVPs
-- ============================================================
CREATE TABLE IF NOT EXISTS rsvps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invitation_id UUID NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  attendance TEXT NOT NULL CHECK (attendance IN ('hadir', 'tidak', 'ragu')),
  total_guest INTEGER DEFAULT 1,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GALLERY
-- ============================================================
CREATE TABLE IF NOT EXISTS gallery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invitation_id UUID NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery ENABLE ROW LEVEL SECURITY;

-- INVITATIONS
-- Public: anyone can read invitations (for guest view)
CREATE POLICY "Public read invitations" ON invitations
  FOR SELECT USING (true);

-- Owner only: create, update, delete
CREATE POLICY "Owner insert invitations" ON invitations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner update invitations" ON invitations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Owner delete invitations" ON invitations
  FOR DELETE USING (auth.uid() = user_id);

-- GUESTS
-- Only invitation owner can manage guests
CREATE POLICY "Owner manage guests" ON guests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM invitations
      WHERE invitations.id = guests.invitation_id
        AND invitations.user_id = auth.uid()
    )
  );

-- RSVP
-- Public can insert RSVP
CREATE POLICY "Public insert rsvp" ON rsvps
  FOR INSERT WITH CHECK (true);

-- Only invitation owner can read RSVPs
CREATE POLICY "Owner read rsvps" ON rsvps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM invitations
      WHERE invitations.id = rsvps.invitation_id
        AND invitations.user_id = auth.uid()
    )
  );

-- GALLERY
-- Public can read gallery
CREATE POLICY "Public read gallery" ON gallery
  FOR SELECT USING (true);

-- Only invitation owner can manage gallery
CREATE POLICY "Owner manage gallery" ON gallery
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM invitations
      WHERE invitations.id = gallery.invitation_id
        AND invitations.user_id = auth.uid()
    )
  );

-- ============================================================
-- STORAGE BUCKETS (run in Supabase dashboard or via CLI)
-- ============================================================
-- Bucket: uploads (public)
-- Run these in Supabase SQL editor after creating the bucket:
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('uploads', 'uploads', true)
-- ON CONFLICT (id) DO NOTHING;
--
-- CREATE POLICY "Public read uploads" ON storage.objects
--   FOR SELECT USING (bucket_id = 'uploads');
--
-- CREATE POLICY "Auth users upload" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'uploads' AND auth.role() = 'authenticated');
--
-- CREATE POLICY "Owner delete uploads" ON storage.objects
--   FOR DELETE USING (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
