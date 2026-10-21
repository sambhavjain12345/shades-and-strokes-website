const crypto = require('crypto');
const express = require('express');
const fs = require('fs/promises');
const multer = require('multer');
const path = require('path');
const cloudinary = require('../config/cloudinary');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
const allowedTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => allowedTypes.has(file.mimetype)
    ? cb(null, true)
    : cb(Object.assign(new Error('Only JPG, PNG, WEBP, or GIF images are allowed'), { statusCode: 422 })),
});
const receiveImage = (req, res, next) => upload.single('image')(req, res, error => {
  if (!error) return next();
  const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : (error.statusCode || 422);
  return res.status(status).json({ success:false, message:error.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller' : error.message });
});

const hasValidSignature = (buffer, mime) => {
  if (mime === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (mime === 'image/webp') return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
  if (mime === 'image/gif') return ['GIF87a','GIF89a'].includes(buffer.subarray(0, 6).toString());
  return false;
};

// Local disk is the zero-configuration default. Cloudinary is opt-in so stale
// or partially configured environment variables can never break local uploads.
const cloudinaryConfigured = () => process.env.UPLOAD_PROVIDER?.trim().toLowerCase() === 'cloudinary' && Boolean(
  process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
  process.env.CLOUDINARY_API_KEY?.trim() &&
  process.env.CLOUDINARY_API_SECRET?.trim()
);

router.post('/', protect, authorize('admin', 'artist'), receiveImage, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success:false, message:'No file uploaded' });
    if (!hasValidSignature(req.file.buffer, req.file.mimetype)) {
      return res.status(422).json({ success:false, message:'The uploaded file is not a valid image' });
    }

    if (cloudinaryConfigured()) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({
          folder:'shades-and-strokes', resource_type:'image',
          transformation:[{ quality:'auto', fetch_format:'auto' }],
        }, (error, value) => error ? reject(error) : resolve(value));
        stream.end(req.file.buffer);
      });
      return res.json({ success:true, url:result.secure_url, storage:'cloudinary' });
    }

    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({success:false,message:'Cloudinary must be configured for production uploads'});
    }

    const uploadDir = path.join(__dirname, '..', 'uploads', 'artworks');
    await fs.mkdir(uploadDir, { recursive:true });
    const filename = `${crypto.randomUUID()}${allowedTypes.get(req.file.mimetype)}`;
    await fs.writeFile(path.join(uploadDir, filename), req.file.buffer, { flag:'wx' });
    const url = `${req.protocol}://${req.get('host')}/uploads/artworks/${filename}`;
    return res.status(201).json({ success:true, url, storage:'local' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
