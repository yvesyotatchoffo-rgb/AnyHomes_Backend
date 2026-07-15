// responseTimeMiddleware.js
const responseTimeMiddleware = (req, res, next) => {
    // Skip logging for static assets to avoid log spam
    if (req.originalUrl && req.originalUrl.startsWith('/img/')) {
      return next();
    }

    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.warn(`Response time: for ${req.originalUrl} is ${duration}ms`);
    });
  
    next();
  };
  
  module.exports = responseTimeMiddleware;