// Forwards JS console output to the Metro terminal (which doesn't print app logs
// natively on RN 0.73+). The Metro middleware in metro.config.js receives POSTs
// at /log and prints them.

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;
const originalInfo = console.info;

const stringify = (val) => {
  if (val === undefined) return 'undefined';
  if (val === null) return 'null';
  if (typeof val === 'string') return val;
  if (val instanceof Error) return `${val.message}\n${val.stack || ''}`;
  try {
    return JSON.stringify(val);
  } catch (e) {
    return String(val);
  }
};

const post = (level, args) => {
  const message = `[${level}] ` + args.map(stringify).join(' ');
  try {
    fetch('http://localhost:8081/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    }).catch(() => {});
  } catch (e) {}
};

console.log = (...args) => { originalLog(...args); post('LOG', args); };
console.warn = (...args) => { originalWarn(...args); post('WARN', args); };
console.error = (...args) => { originalError(...args); post('ERROR', args); };
console.info = (...args) => { originalInfo(...args); post('INFO', args); };
