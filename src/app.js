require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./config/database');
const seedAdmin = require('./scripts/seed_admin');

const authRoutes = require('./routes/authRoutes');
const invitationRoutes = require('./routes/invitationRoutes');
const galleryRoutes = require('./routes/galleryRoutes');
const rsvpRoutes = require('./routes/rsvpRoutes');
const guestRoutes = require('./routes/guestRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database
initDb();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public'))); // Serve static files
const uploadDir = process.env.DATA_DIR 
  ? path.join(process.env.DATA_DIR, 'uploads')
  : path.join(__dirname, '../uploads');

app.use('/uploads', express.static(uploadDir));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/rsvp', rsvpRoutes);
app.use('/api/guests', guestRoutes);

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});
app.get(['/', '/:slug'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
seedAdmin().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
