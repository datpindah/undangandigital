const { db } = require('../config/database');
const fs = require('fs');
const path = require('path');

const uploadImage = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const { invitation_id } = req.body;
  if (!invitation_id) {
    return res.status(400).json({ message: 'Invitation ID is required' });
  }

  // Check if invitation belongs to user
  const invitation = db.prepare('SELECT * FROM invitations WHERE id = ?').get(invitation_id);
  if (!invitation) {
      // Clean up uploaded file if invitation invalid
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Invitation not found' });
  }
  if (invitation.user_id !== req.user.id) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ message: 'Not authorized' });
  }

  const image_path = `/uploads/${req.file.filename}`;

  try {
    const stmt = db.prepare('INSERT INTO gallery (invitation_id, image_path) VALUES (?, ?)');
    const info = stmt.run(invitation_id, image_path);

    res.status(201).json({ 
      message: 'Image uploaded successfully', 
      id: info.lastInsertRowid,
      image_path 
    });
  } catch (error) {
    console.error(error);
    fs.unlinkSync(req.file.path); // Clean up on error
    res.status(500).json({ message: 'Server error' });
  }
};

const getGallery = (req, res) => {
  const { invitation_id } = req.params;
  try {
    const images = db.prepare('SELECT * FROM gallery WHERE invitation_id = ?').all(invitation_id);
    res.json(images);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteImage = (req, res) => {
  const { id } = req.params;
  const user_id = req.user.id;

  try {
    const image = db.prepare('SELECT * FROM gallery WHERE id = ?').get(id);
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    // Check ownership via invitation
    const invitation = db.prepare('SELECT user_id FROM invitations WHERE id = ?').get(image.invitation_id);
    if (!invitation || invitation.user_id !== user_id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Delete file
    const filename = path.basename(image.image_path);
    const uploadDir = process.env.DATA_DIR 
      ? path.join(process.env.DATA_DIR, 'uploads')
      : path.resolve(__dirname, '../../uploads');
    
    const filePath = path.join(uploadDir, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete db record
    db.prepare('DELETE FROM gallery WHERE id = ?').run(id);

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { uploadImage, getGallery, deleteImage };
