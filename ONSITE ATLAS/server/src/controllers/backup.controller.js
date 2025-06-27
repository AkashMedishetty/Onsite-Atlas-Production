const path = require('path');
const archiver = require('archiver');
const unzipper = require('unzipper');
const mongoose = require('mongoose');
const asyncHandler = require('../middleware/async');
const { sendSuccess } = require('../utils/responseFormatter');
const { createApiError } = require('../middleware/error');

// Helper: stream a zip of all collections
exports.createBackup = asyncHandler(async (req, res, next) => {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const filename = `onsite-atlas-backup-${new Date().toISOString().slice(0, 10)}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  archive.pipe(res);

  const collections = Object.keys(mongoose.connection.collections);
  for (const collName of collections) {
    const data = await mongoose.connection.db.collection(collName).find({}).toArray();
    archive.append(JSON.stringify(data), { name: `${collName}.json` });
  }
  archive.finalize();
});

// Helper: restore from uploaded zip (multipart field: backup)
exports.restoreBackup = asyncHandler(async (req, res, next) => {
  if (!req.files || !req.files.backup) {
    return next(createApiError(400, 'No backup file uploaded (field name should be "backup")'));
  }

  const zipBuffer = req.files.backup.data;
  const directory = await unzipper.Open.buffer(zipBuffer);
  for (const file of directory.files) {
    if (path.extname(file.path) !== '.json') continue;
    const collName = path.basename(file.path, '.json');
    const buffer = await file.buffer();
    let docs;
    try {
      docs = JSON.parse(buffer.toString());
    } catch (err) {
      return next(createApiError(400, `Invalid JSON in ${file.path}`));
    }
    if (!Array.isArray(docs)) docs = [];
    const collection = mongoose.connection.db.collection(collName);
    await collection.deleteMany({});
    if (docs.length) await collection.insertMany(docs);
  }

  return sendSuccess(res, 200, 'Restore completed successfully');
}); 