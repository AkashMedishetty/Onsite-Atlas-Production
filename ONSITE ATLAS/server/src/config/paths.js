const path = require('path');

// Base directory where uploaded files live on disk
// Can be overridden with env UPLOADS_DIR, otherwise defaults to <project root>/public/uploads
const UPLOADS_BASE_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'public', 'uploads');

// Build a directory path like uploads/abstracts/<eventId>
const buildUploadDir = (...segments) => {
  return path.join(UPLOADS_BASE_DIR, ...segments);
};

// Given a relative path inside uploads, build the public URL stored in DB
// e.g. ('abstracts','eventId','file.pdf') => '/uploads/abstracts/eventId/file.pdf'
const buildFileUrl = (...segments) => {
  return `/uploads/${segments.join('/')}`;
};

module.exports = {
  UPLOADS_BASE_DIR,
  buildUploadDir,
  buildFileUrl,
}; 