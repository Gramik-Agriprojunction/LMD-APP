const originalLog = console.log;

const API_KEYWORDS = ['payload==', 'response==', 'error=='];

const stringify = (val) => {
  if (val === undefined) return 'undefined';
  if (val === null) return 'null';
  if (typeof val === 'string') return val;
  try {
    return JSON.stringify(val);
  } catch (e) {
    return String(val);
  }
};

console.log = (...args) => {
  originalLog(...args);

  const message = args.map(stringify).join(' ');
  const isApiLog = API_KEYWORDS.some((kw) => message.includes(kw));
  if (!isApiLog) return;

  try {
    fetch('http://localhost:8081/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    }).catch(() => {});
  } catch (e) {}
};
