// lib/storage.js
// Centralised file-storage abstraction.
//
// DEVELOPMENT — local disk via Multer diskStorage (default; no setup needed).
// PRODUCTION  — Supabase Storage, activated automatically when SUPABASE_URL +
//               SUPABASE_SERVICE_ROLE_KEY are set in the environment.
//               Falls back to local disk if they're not set, so local dev
//               never needs real Supabase credentials (same pattern as the
//               ThaiBulkSMS dev-mode fallback in utils/otp.js).
//
// Usage in routes:
//   const { getUploader, saveFile, FILTERS } = require('../lib/storage');
//   const upload = getUploader({ fileFilter: FILTERS.imagesPdf });
//   router.post('/payment-slip', upload.single('paymentSlip'), async (req, res) => {
//     const filePath = await saveFile('payments', req.file);
//     ...
//   });
//
// `filePath` is always in the form `/uploads/<folder>/<filename>` regardless
// of which backend stored it — the frontend never needs to know which mode
// is active. In cloud mode, GET requests to that path are handled by a
// signed-URL redirect route registered in server.js instead of express.static.

const multer = require('multer');
const path   = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseBucket = process.env.SUPABASE_BUCKET || 'payment-slips';

const isCloudStorage = Boolean(supabaseUrl && supabaseKey);

const supabase = isCloudStorage
  ? require('@supabase/supabase-js').createClient(supabaseUrl, supabaseKey)
  : null;

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
 * Returns a configured multer instance.
 * - Local disk mode: writes straight to `uploads/<folder>/` (unchanged from before).
 * - Cloud mode: buffers in memory; saveFile() uploads the buffer to Supabase.
 *
 * @param {'payments'} folder - Target upload folder.
 * @param {Object}  [opts]
 * @param {string|Function} [opts.prefix]     - Filename prefix string or (req) => string.
 *                                              Defaults to the folder name.
 * @param {number}  [opts.maxSize]            - Max file size in bytes. Default: 10 MB.
 * @param {Function} [opts.fileFilter]        - multer fileFilter. Default: no filter.
 */
function getUploader(folder, opts = {}) {
  const storage = isCloudStorage
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, `uploads/${folder}`),
        filename: (req, file, cb) => {
          const prefix =
            typeof opts.prefix === 'function' ? opts.prefix(req) : (opts.prefix || folder);
          cb(null, `${prefix}-${Date.now()}${path.extname(file.originalname)}`);
        },
      });

  return multer({
    storage,
    limits: { fileSize: opts.maxSize || 10 * 1024 * 1024 },
    ...(opts.fileFilter ? { fileFilter: opts.fileFilter } : {}),
  });
}

/**
 * Persists an uploaded file and returns its DB-storable path.
 * - Local disk mode: the file is already on disk (multer wrote it); just builds the path.
 * - Cloud mode: uploads the in-memory buffer to the Supabase bucket.
 *
 * @param {'payments'} folder
 * @param {Express.Multer.File} file - req.file from the multer middleware
 * @returns {Promise<string>} e.g. "/uploads/payments/payments-1699999999999.jpg"
 */
async function saveFile(folder, file) {
  if (!isCloudStorage) {
    return `/uploads/${folder}/${file.filename}`;
  }

  const filename = `${folder}-${Date.now()}${path.extname(file.originalname)}`;
  const { error } = await supabase.storage
    .from(supabaseBucket)
    .upload(`${folder}/${filename}`, file.buffer, { contentType: file.mimetype });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  return `/uploads/${folder}/${filename}`;
}

/**
 * Generates a short-lived signed URL for a file stored in the private Supabase
 * bucket. Only meaningful in cloud mode — server.js only calls this when
 * isCloudStorage is true (local mode serves /uploads via express.static instead).
 *
 * @param {'payments'} folder
 * @param {string} filename
 * @returns {Promise<string>} a signed URL valid for 60 seconds
 */
async function getSignedUrl(folder, filename) {
  const { data, error } = await supabase.storage
    .from(supabaseBucket)
    .createSignedUrl(`${folder}/${filename}`, 60);

  if (error) throw new Error(`Supabase signed URL failed: ${error.message}`);

  return data.signedUrl;
}

module.exports = { getUploader, saveFile, getSignedUrl, FILTERS, isCloudStorage };
