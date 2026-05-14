const rateLimit = require('express-rate-limit');

// AI rate limiter: 20 requests per user per hour
const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  keyGenerator: (req) => {
    return req.user ? String(req.user.id) : req.ip;
  },
  message: { error: 'Too many AI requests. Limit is 20 per hour per user.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General rate limiter: 100 requests per 15 minutes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  keyGenerator: (req) => {
    return req.user ? String(req.user.id) : req.ip;
  },
  message: { error: 'Too many requests. Limit is 100 per 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { aiRateLimiter, generalLimiter };
