const express = require('express');
const { uploadImage, getGallery, deleteImage } = require('../controllers/galleryController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.post('/upload', authMiddleware, upload.single('image'), uploadImage);
router.get('/:invitation_id', getGallery);
router.delete('/:id', authMiddleware, deleteImage);

module.exports = router;
