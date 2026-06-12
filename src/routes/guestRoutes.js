const express = require('express');
const { addGuest, listGuests, deleteGuest, bulkAddGuests } = require('../controllers/guestController');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadDocument } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.post('/bulk', authMiddleware, uploadDocument.single('file'), bulkAddGuests);
router.post('/', authMiddleware, addGuest);
router.get('/:invitation_id', authMiddleware, listGuests);
router.delete('/:id', authMiddleware, deleteGuest);

module.exports = router;
