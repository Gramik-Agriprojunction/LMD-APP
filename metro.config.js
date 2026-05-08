const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {
  server: {
    enhanceMiddleware: (middleware) => {
      return (req, res, next) => {
        if (req.url === '/log' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', () => {
            try {
              const { message } = JSON.parse(body);
              if (message) console.log(message);
            } catch (e) {}
            res.writeHead(200);
            res.end('ok');
          });
          return;
        }
        return middleware(req, res, next);
      };
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
