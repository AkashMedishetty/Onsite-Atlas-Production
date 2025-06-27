/**
 * Pino logger – production: JSON to PM2, development: pretty-print
 */
const pino = require('pino');

const transport =
  process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { translateTime: true, colorize: true } }
    : undefined;

module.exports = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport
});
