const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = process.env.DATA_DIR 
  ? path.join(process.env.DATA_DIR, 'uploads')
  : path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilterImage = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|webp/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Only images are allowed'));
};

const fileFilterDocument = (req, file, cb) => {
  const filetypes = /xlsx|xls|csv/;
  // Mime types for excel can be tricky, relying on extension is safer for now or adding specific mimes
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (extname) {
    return cb(null, true);
  }
  cb(new Error('Only Excel files are allowed'));
};

const fileFilterAudio = (req, file, cb) => {
  const filetypes = /mp3|wav|mpeg/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Only audio files are allowed'));
};

const uploadImage = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilterImage
});

const uploadDocument = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilterDocument
});

const uploadAudio = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilterAudio
});

module.exports = uploadImage;
module.exports.uploadImage = uploadImage;
module.exports.uploadDocument = uploadDocument;
module.exports.uploadAudio = uploadAudio;
