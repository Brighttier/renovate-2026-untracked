const startTime = Date.now();

console.log('Loading vibe...');
const vibe = require('./lib/functions/src/vibe');
console.log('Vibe loaded in', Date.now() - startTime, 'ms');

console.log('Loading domains...');
const domains = require('./lib/functions/src/domains');
console.log('Domains loaded in', Date.now() - startTime, 'ms');

console.log('Loading gemini...');
const gemini = require('./lib/functions/src/gemini');
console.log('Gemini loaded in', Date.now() - startTime, 'ms');

console.log('ALL MODULES LOADED');
