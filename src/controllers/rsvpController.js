const { db } = require('../config/database');

const createRsvp = (req, res) => {
  const { invitation_id, guest_name, attendance, total_guest, message } = req.body;

  if (!invitation_id || !guest_name || !attendance) {
    return res.status(400).json({ message: 'Invitation ID, guest name, and attendance are required' });
  }

  try {
    // Check if invitation exists
    const invitation = db.prepare('SELECT id FROM invitations WHERE id = ?').get(invitation_id);
    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    const stmt = db.prepare(`
      INSERT INTO rsvps (invitation_id, guest_name, attendance, total_guest, message)
      VALUES (?, ?, ?, ?, ?)
    `);

    const info = stmt.run(invitation_id, guest_name, attendance, total_guest || 1, message || '');

    res.status(201).json({ message: 'RSVP sent successfully', id: info.lastInsertRowid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getRsvps = (req, res) => {
  const { invitation_id } = req.params;
  const user_id = req.user.id;

  try {
    // Check ownership
    const invitation = db.prepare('SELECT user_id FROM invitations WHERE id = ?').get(invitation_id);
    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }
    if (invitation.user_id !== user_id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const rsvps = db.prepare('SELECT * FROM rsvps WHERE invitation_id = ? ORDER BY created_at DESC').all(invitation_id);
    res.json(rsvps);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createRsvp, getRsvps };
