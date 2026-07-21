const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { legacyPrototypeRoutesEnabled } = require('./config/runtime').validateRuntime();

const { aiRateLimiter, generalLimiter } = require('./middleware/rateLimiter');

const app = express();
const HOST = process.env.BACKEND_HOST || '127.0.0.1';
const PORT = process.env.BACKEND_PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// Security middleware
app.use(helmet());
app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Apply general rate limiter to all routes
app.use(generalLimiter);

// Keep generated/demo APIs out of the supported product boundary. They can be
// inspected locally only through an explicit, non-production opt-in.
app.use('/api', (req, res, next) => {
  const supported = ['/auth', '/health', '/print-plan-workflows'];
  if (legacyPrototypeRoutesEnabled || supported.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))) return next();
  return res.status(410).json({ error: 'Legacy prototype route is quarantined', code: 'prototype_route_quarantined' });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/print-parameters', require('./routes/printParameters'));
app.use('/api/failure-predictions', require('./routes/failurePredictions'));
app.use('/api/material-selections', require('./routes/materialSelections'));
app.use('/api/build-time-estimates', require('./routes/buildTimeEstimates'));
app.use('/api/quality-scores', require('./routes/qualityScores'));
app.use('/api/print-jobs', require('./routes/printJobs'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/printers', require('./routes/printers'));
app.use('/api/print-profiles', require('./routes/printProfiles'));
app.use('/api/maintenance-logs', require('./routes/maintenanceLogs'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/powder-reuse-plan', require('./routes/powderReusePlan'));
app.use('/api/print-plan-workflows', require('./routes/printPlanWorkflow'));

// AI routes (with stricter AI rate limiting)
app.use('/api/ai', aiRateLimiter, require('./routes/aiRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, HOST, () => {
  console.log(`Backend server running at http://${HOST}:${PORT}`);
  console.log(`CORS enabled for: ${CLIENT_URL}`);
});

// Batch-generated stub and gap routes are intentionally not mounted as product APIs.

// Custom Views (synthesized data for visualization + non-viz views)
app.use('/api/custom-views', require('./routes/customViews'));
