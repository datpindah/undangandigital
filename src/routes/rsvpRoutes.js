const express = require('express');
const { createRsvp, getRsvps } = require('../controllers/rsvpController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', createRsvp); // Public
router.get('/:invitation_id', authMiddleware, getRsvps); // Protected, for admin

module.exports = router;
