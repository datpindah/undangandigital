-- ============================================================
-- Haflah Invitations Schema (idempotent — safe to run multiple times)
-- ============================================================

CREATE TABLE IF NOT EXISTS haflah_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  event_name TEXT NOT NULL,
  institution_name TEXT,
  event_subtitle TEXT,
  event_date TEXT NOT NULL,
  event_description TEXT,
  venue_name TEXT NOT NULL DEFAULT 'Venue',
  venue_address TEXT NOT NULL DEFAULT 'Alamat menyusul',
  maps_url TEXT,
  schedule JSONB DEFAULT '[]'::jsonb,
  primary_color TEXT DEFAULT '#1E40AF',
  secondary_color TEXT DEFAULT '#F59E0B',
  banner_image TEXT,
  music_url TEXT,
  organizer_name TEXT,
  organizer_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS haflah_gallery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  haflah_id UUID NOT NULL REFERENCES haflah_invitations(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS haflah_rsvps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  haflah_id UUID NOT NULL REFERENCES haflah_invitations(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  attendance TEXT NOT NULL CHECK (attendance IN ('hadir', 'tidak', 'ragu')),
  total_guest INTEGER DEFAULT 1,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS haflah_guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  haflah_id UUID NOT NULL REFERENCES haflah_invitations(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  slug TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE haflah_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE haflah_gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE haflah_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE haflah_guests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any, then recreate
DROP POLICY IF EXISTS "Public read haflah" ON haflah_invitations;
DROP POLICY IF EXISTS "Owner insert haflah" ON haflah_invitations;
DROP POLICY IF EXISTS "Owner update haflah" ON haflah_invitations;
DROP POLICY IF EXISTS "Owner delete haflah" ON haflah_invitations;
DROP POLICY IF EXISTS "Public read haflah gallery" ON haflah_gallery;
DROP POLICY IF EXISTS "Owner manage haflah gallery" ON haflah_gallery;
DROP POLICY IF EXISTS "Public insert haflah rsvp" ON haflah_rsvps;
DROP POLICY IF EXISTS "Owner read haflah rsvps" ON haflah_rsvps;
DROP POLICY IF EXISTS "Owner manage haflah guests" ON haflah_guests;

CREATE POLICY "Public read haflah" ON haflah_invitations
  FOR SELECT USING (true);

CREATE POLICY "Owner insert haflah" ON haflah_invitations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner update haflah" ON haflah_invitations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Owner delete haflah" ON haflah_invitations
  FOR DELETE USING (auth.uid() = user_id);

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

CREATE POLICY "Owner manage haflah guests" ON haflah_guests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM haflah_invitations
      WHERE haflah_invitations.id = haflah_guests.haflah_id
        AND haflah_invitations.user_id = auth.uid()
    )
  );
