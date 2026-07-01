// lib/storage.js
// Centralised file-storage abstraction.
//
// DEVELOPMENT  — local disk via Multer diskStorage (current)
// PRODUCTION   — swap getUploader() internals to use Supabase Storage or S3.
//                Only this file needs to change; all routes stay the same.
//
// Usage in routes:
//   const { getUploader, getFilePath, FILTERS } = require('../lib/storage');
//   const upload = getUploader('payments', { fileFilter: FILTERS.imagesPdf });
//   router.post('/payment-slip', upload.single('paymentSlip'), (req, res) => {
//     const path = getFilePath('payments', req.file.filename);
//     ...
//   });

const multer = require('multer');
const path   = require('path');

// ─── Folder registry ──────────────────────────────────────────────────────────
// Maps logical folder name → local disk path (relative to the backend root).
// Add new folders here if needed.
const FOLDER_PATHS = {
  payments: 'uploads/payments',
};

// ─── Shared file filters ──────────────────────────────────────────────────────

const FILTERS = {
  /** Accepts jpeg, jpg, png, webp images only */
  images: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    const valid = /jpeg|jpg|png|webp/.test(ext) && /jpeg|jpg|png|webp/.test(mime);
    if (valid) cb(null, true);
    else cb(new Error('Only images (jpeg, jpg, png, webp) are allowed'));
  },

  /** Accepts jpeg, jpg, png, webp images + PDF */
  imagesPdf: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    // Check both extension AND MIME type — prevents renaming e.g. .exe → .pdf
    const valid = /jpeg|jpg|png|webp|pdf/.test(ext) && /jpeg|jpg|png|webp|pdf/.test(mime);
    if (valid) cb(null, true);
    else cb(new Error('Only images (jpeg, jpg, png, webp) and PDFs are allowed'));
  },
};

// ─── Core API ─────────────────────────────────────────────────────────────────

/**
 * Returns a configured multer instance backed by local disk storage.
 *
 * @param {'payments'} folder - Target upload folder.
 * @param {Object}  [opts]
 * @param {string|Function} [opts.prefix]     - Filename prefix string or (req) => string.
 *                                              Defaults to the folder name.
 * @param {number}  [opts.maxSize]            - Max file size in bytes. Default: 10 MB.
 * @param {Function} [opts.fileFilter]        - multer fileFilter. Default: no filter.
 */
function getUploader(folder, opts = {}) {
  const dir = FOLDER_PATHS[folder];
  if (!dir) throw new Error(`storage.getUploader: unknown folder "${folder}"`);

  const diskStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const prefix =
        typeof opts.prefix === 'function'
          ? opts.prefix(req)
          : (opts.prefix || folder);
      cb(null, `${prefix}-${Date.now()}${path.extname(file.originalname)}`);
    },
  });

  return multer({
    storage: diskStorage,
    limits: { fileSize: opts.maxSize || 10 * 1024 * 1024 },
    ...(opts.fileFilter ? { fileFilter: opts.fileFilter } : {}),
  });
}

/**
 * Returns the URL path stored in the database for a given folder + filename.
 *
 * Development:  relative path served by express.static  →  /uploads/folder/filename
 * Production:   TODO — return Supabase Storage / S3 public URL instead.
 *
 * @param {'payments'} folder
 * @param {string} filename - The filename set by multer (req.file.filename)
 */
function getFilePath(folder, filename) {
  return `/uploads/${folder}/${filename}`;
}

module.exports = { getUploader, getFilePath, FILTERS };
