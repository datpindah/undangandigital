const { db } = require('../config/database');
const fs = require('fs');
const path = require('path');

const createInvitation = (req, res) => {
  const {
    groom_name, bride_name, wedding_date, akad_time, resepsi_time,
    venue_name, venue_address, primary_color, slug
  } = req.body;

  const user_id = req.user.id;

  // Simple slug generation if not provided
  const finalSlug = slug || `${groom_name}-${bride_name}-${Date.now()}`.toLowerCase().replace(/\s+/g, '-');

  try {
    const safeAkadTime = akad_time || '08:00 WIB';
    const safeResepsiTime = resepsi_time || '11:00 - 13:00 WIB';
    const safeVenueName = venue_name || 'Venue';
    const safeVenueAddress = venue_address || 'Alamat menyusul';
    const safePrimaryColor = primary_color || '#4A6FA5';

    const stmt = db.prepare(`
      INSERT INTO invitations (
        user_id, slug, groom_name, bride_name, wedding_date, akad_time,
        resepsi_time, venue_name, venue_address, primary_color
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      user_id, finalSlug, groom_name, bride_name, wedding_date, safeAkadTime,
      safeResepsiTime, safeVenueName, safeVenueAddress, safePrimaryColor
    );

    res.status(201).json({
      message: 'Invitation created successfully',
      invitationId: info.lastInsertRowid,
      slug: finalSlug
    });
  } catch (error) {
    console.error(error);
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ message: 'Slug already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

const getInvitationBySlug = (req, res) => {
  const { slug } = req.params;

  try {
    const invitation = db.prepare('SELECT * FROM invitations WHERE slug = ?').get(slug);

    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    // Get gallery images
    const gallery = db.prepare('SELECT * FROM gallery WHERE invitation_id = ?').all(invitation.id);
    
    // Get RSVPs (optional, maybe distinct endpoint, but useful for dashboard)
    // For public view, maybe we don't need RSVPs list. 
    // But for admin, we might need it. This endpoint is public though.
    // So let's just return invitation details + gallery.

    res.json({ ...invitation, gallery });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateInvitation = (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const user_id = req.user.id;

  try {
    // Check ownership
    const invitation = db.prepare('SELECT * FROM invitations WHERE id = ?').get(id);
    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }
    if (invitation.user_id !== user_id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const fields = Object.keys(updates).map((key) => `${key} = ?`).join(', ');
    const values = Object.values(updates);

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const stmt = db.prepare(`UPDATE invitations SET ${fields} WHERE id = ?`);
    stmt.run(...values, id);

    res.json({ message: 'Invitation updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getMyInvitations = (req, res) => {
    const user_id = req.user.id;
    try {
        const invitations = db.prepare('SELECT * FROM invitations WHERE user_id = ?').all(user_id);
        res.json(invitations);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
}

const updateCouplePhoto = (req, res) => {
  const { id } = req.params;
  const { role } = req.body; // 'groom' or 'bride'
  const user_id = req.user.id;
  const file = req.file;

  if (!file || (role !== 'groom' && role !== 'bride')) {
    return res.status(400).json({ message: 'File dan role (groom/bride) wajib diisi' });
  }

  try {
    const inv = db.prepare('SELECT id, user_id FROM invitations WHERE id = ?').get(id);
    if (!inv) return res.status(404).json({ message: 'Undangan tidak ditemukan' });
    if (inv.user_id !== user_id) return res.status(403).json({ message: 'Tidak berhak' });

    let column = '';
    if (role === 'groom') column = 'groom_image';
    else if (role === 'bride') column = 'bride_image';
    
    const filePath = `/uploads/${file.filename}`;
    
    db.prepare(`UPDATE invitations SET ${column} = ? WHERE id = ?`).run(filePath, id);
    
    res.json({ message: 'Foto berhasil diupdate', path: filePath });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateMusic = (req, res) => {
  const { id } = req.params;
  const user_id = req.user.id;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ message: 'File music wajib diisi' });
  }

  try {
    const inv = db.prepare('SELECT id, user_id FROM invitations WHERE id = ?').get(id);
    if (!inv) return res.status(404).json({ message: 'Undangan tidak ditemukan' });
    if (inv.user_id !== user_id) return res.status(403).json({ message: 'Tidak berhak' });

    const filePath = `/uploads/${file.filename}`;
    
    db.prepare('UPDATE invitations SET music_url = ? WHERE id = ?').run(filePath, id);
    
    res.json({ message: 'Musik berhasil diupdate', path: filePath });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createInvitation, getInvitationBySlug, updateInvitation, getMyInvitations, updateCouplePhoto, updateMusic };
const deleteInvitation = (req, res) => {
  const { id } = req.params;
  const user_id = req.user.id;
  try {
    const inv = db.prepare('SELECT * FROM invitations WHERE id = ?').get(id);
    if (!inv) return res.status(404).json({ message: 'Invitation not found' });
    if (inv.user_id !== user_id) return res.status(403).json({ message: 'Not authorized' });
    const gallery = db.prepare('SELECT image_path FROM gallery WHERE invitation_id = ?').all(id);
    const files = [];
    if (inv.groom_image) files.push(inv.groom_image);
    if (inv.bride_image) files.push(inv.bride_image);
    for (const g of gallery) files.push(g.image_path);
    for (const p of files) {
      const fname = String(p || '').replace('/uploads/', '');
      const uploadDir = process.env.DATA_DIR 
        ? path.join(process.env.DATA_DIR, 'uploads')
        : path.resolve(__dirname, '../../uploads');
      const fpath = path.join(uploadDir, fname);
      try {
        if (fs.existsSync(fpath)) fs.unlinkSync(fpath);
      } catch {}
    }
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM gallery WHERE invitation_id = ?').run(id);
      db.prepare('DELETE FROM guests WHERE invitation_id = ?').run(id);
      db.prepare('DELETE FROM rsvps WHERE invitation_id = ?').run(id);
      db.prepare('DELETE FROM invitations WHERE id = ?').run(id);
    });
    tx();
    res.json({ message: 'Invitation deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports.deleteInvitation = deleteInvitation;
