const { getNextSequenceValue } = require('./counterUtils');

/**
 * Generate a unique abstract number.
 * Format: ABS-<EVENT_PREFIX>-XXXXX
 * @param {Object} event - Event document (must include _id and registrationSettings.idPrefix)
 * @returns {Promise<string>} abstract number
 */
const generateAbstractNumber = async (event) => {
  if (!event || !event._id) throw new Error('Event document required');
  const prefix = event.registrationSettings?.idPrefix || 'EVT';
  const sequenceName = `${event._id}_abstract_id`;
  const seq = await getNextSequenceValue(sequenceName, 1);
  return `ABS-${prefix}-${seq.toString().padStart(5, '0')}`;
};

module.exports = { generateAbstractNumber }; 