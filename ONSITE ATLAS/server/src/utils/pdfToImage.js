// Stubbed PDF-to-image utility.
// The original version used the native `pdf-poppler` module, which is not
// needed and breaks on this server.  We keep the same interface so callers
// continue to work, but simply resolve with null.

/**
 * Dummy implementation – pretends to convert the first page of a PDF to PNG.
 * @param {string} _pdfPath   ignored
 * @param {string} _outputDir ignored
 * @param {string} [_outputName] ignored
 * @returns {Promise<null>} always resolves to null
 */
async function convertPdfToPng(_pdfPath, _outputDir, _outputName = null) {
  return null;   // No-op
}

module.exports = { convertPdfToPng };
