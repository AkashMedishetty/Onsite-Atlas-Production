const logger = require('./logger');
const levels = { log:'info', info:'info', debug:'debug', warn:'warn', error:'error' };
Object.keys(levels).forEach((fn) => {
  console[fn] = (...args) => {
    try { logger[levels[fn]](args.length === 1 ? args[0] : args); }
    catch (e) { process.stdout.write(args.join(' ') + '\n'); }
  };
});
