-- Users (Admin)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Invitations
CREATE TABLE IF NOT EXISTS invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  groom_name TEXT NOT NULL,
  bride_name TEXT NOT NULL,
  wedding_date TEXT NOT NULL,
  akad_time TEXT NOT NULL,
  resepsi_time TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  venue_address TEXT NOT NULL,
  primary_color TEXT DEFAULT '#FFFFFF',
  gift_bank TEXT,
  gift_account_name TEXT,
  gift_account_number TEXT,
  groom_parents_text TEXT,
  bride_parents_text TEXT,
  maps_url TEXT,
  groom_image TEXT,
  bride_image TEXT,
  music_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Guests
CREATE TABLE IF NOT EXISTS guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invitation_id INTEGER NOT NULL,
  guest_name TEXT NOT NULL,
  slug TEXT UNIQUE, -- for unique invitation link per guest if needed, optional
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE
);

-- RSVPs
CREATE TABLE IF NOT EXISTS rsvps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invitation_id INTEGER NOT NULL,
  guest_name TEXT NOT NULL,
  attendance TEXT CHECK(attendance IN ('hadir', 'tidak', 'ragu')) NOT NULL,
  total_guest INTEGER DEFAULT 1,
  message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE
);

-- Gallery
CREATE TABLE IF NOT EXISTS gallery (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invitation_id INTEGER NOT NULL,
  image_path TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE
);
