const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const asyncHandler = require('../middleware/async');
const { sendSuccess } = require('../utils/responseFormatter');
const { createApiError } = require('../middleware/error');

const LOGS_DIR = path.join(process.cwd(), 'logs');
const COMBINED_LOG = path.join(LOGS_DIR, 'combined.log');
const ERROR_LOG = path.join(LOGS_DIR, 'error.log');

// Helper to read last N lines quickly (read whole file then slice) -- acceptable for small logs (<5MB)
const readLastLines = (filePath, limit) => {
  if (!fs.existsSync(filePath)) return [];
  const data = fs.readFileSync(filePath, 'utf8');
  const lines = data.trim().split(/\r?\n/).filter(Boolean);
  return lines.slice(-limit);
};

// GET /api/system-logs
// Query params: limit, level
exports.getLogs = asyncHandler(async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
  const level = (req.query.level || 'all').toLowerCase();

  const lines = readLastLines(COMBINED_LOG, limit);

  const parsed = lines.map((l) => {
    try {
      return JSON.parse(l);
    } catch (error) {
      return { timestamp: null, level: 'raw', message: l };
    }
  });

  const filtered = level === 'all' ? parsed : parsed.filter((log) => log.level === level);

  return sendSuccess(res, 200, 'Logs retrieved', filtered.reverse());
});

// GET /api/system-logs/download
exports.downloadLogs = asyncHandler(async (req, res, next) => {
  if (!fs.existsSync(LOGS_DIR)) {
    return next(createApiError(404, 'Logs directory does not exist'));
  }

  const filename = `onsite-atlas-logs-${new Date().toISOString().slice(0, 10)}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);
  archive.directory(LOGS_DIR, false);
  archive.finalize();
}); 