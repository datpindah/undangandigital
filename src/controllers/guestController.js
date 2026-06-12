const { db } = require('../config/database');
const xlsx = require('xlsx');
const fs = require('fs');

const bulkAddGuests = (req, res) => {
  const { invitation_id } = req.body;
  const user_id = req.user.id;
  const file = req.file;

  if (!invitation_id || !file) {
    return res.status(400).json({ message: 'Invitation ID dan file Excel wajib diisi' });
  }

  try {
    const inv = db.prepare('SELECT id, user_id FROM invitations WHERE id = ?').get(invitation_id);
    if (!inv) return res.status(404).json({ message: 'Undangan tidak ditemukan' });
    if (inv.user_id !== user_id) return res.status(403).json({ message: 'Tidak berhak' });

    const workbook = xlsx.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }); // Array of arrays

    // Expecting column A (index 0) to be guest name
    let addedCount = 0;
    const insertStmt = db.prepare('INSERT INTO guests (invitation_id, guest_name, slug) VALUES (?, ?, ?)');
    
    const insertMany = db.transaction((rows) => {
      for (const row of rows) {
        const guestName = row[0]; // Column A
        if (guestName && typeof guestName === 'string') {
          const slug = `${guestName}`.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '') + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
          try {
            insertStmt.run(invitation_id, guestName, slug);
            addedCount++;
          } catch (e) {
            console.error('Skipping duplicate or error:', guestName, e.message);
          }
        }
      }
    });

    insertMany(data);
    
    // Cleanup file
    fs.unlinkSync(file.path);

    res.status(201).json({ message: `Berhasil menambahkan ${addedCount} tamu` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error saat memproses file' });
  }
};

const addGuest = (req, res) => {
  const { invitation_id, guest_name, slug } = req.body;
  const user_id = req.user.id;

  if (!invitation_id || !guest_name) {
    return res.status(400).json({ message: 'Invitation ID dan nama tamu wajib diisi' });
  }

  try {
    const inv = db.prepare('SELECT id, user_id FROM invitations WHERE id = ?').get(invitation_id);
    if (!inv) return res.status(404).json({ message: 'Undangan tidak ditemukan' });
    if (inv.user_id !== user_id) return res.status(403).json({ message: 'Tidak berhak' });

    const finalSlug = slug || `${guest_name}`.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '') + '-' + Date.now();
    const info = db.prepare('INSERT INTO guests (invitation_id, guest_name, slug) VALUES (?, ?, ?)').run(invitation_id, guest_name, finalSlug);
    res.status(201).json({ id: info.lastInsertRowid, slug: finalSlug });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ message: 'Slug tamu sudah dipakai' });
    }
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

const listGuests = (req, res) => {
  const { invitation_id } = req.params;
  const user_id = req.user.id;
  try {
    const inv = db.prepare('SELECT id, user_id, slug FROM invitations WHERE id = ?').get(invitation_id);
    if (!inv) return res.status(404).json({ message: 'Undangan tidak ditemukan' });
    if (inv.user_id !== user_id) return res.status(403).json({ message: 'Tidak berhak' });
    const guests = db.prepare('SELECT id, guest_name, slug, created_at FROM guests WHERE invitation_id = ? ORDER BY created_at DESC').all(invitation_id);
    res.json({ invitation_slug: inv.slug, guests });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteGuest = (req, res) => {
  const { id } = req.params;
  const user_id = req.user.id;
  try {
    const guest = db.prepare('SELECT id, invitation_id FROM guests WHERE id = ?').get(id);
    if (!guest) return res.status(404).json({ message: 'Tamu tidak ditemukan' });
    const inv = db.prepare('SELECT id, user_id FROM invitations WHERE id = ?').get(guest.invitation_id);
    if (!inv || inv.user_id !== user_id) return res.status(403).json({ message: 'Tidak berhak' });
    db.prepare('DELETE FROM guests WHERE id = ?').run(id);
    res.json({ message: 'Tamu dihapus' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { addGuest, listGuests, deleteGuest, bulkAddGuests };
