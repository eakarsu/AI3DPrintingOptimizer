const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Validate critical env vars at startup
const requiredEnv = ['JWT_SECRET', 'DATABASE_URL'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const { aiRateLimiter, generalLimiter } = require('./middleware/rateLimiter');

const app = express();
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

// AI routes (with stricter AI rate limiting)
app.use('/api/ai', aiRateLimiter, require('./routes/aiRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`CORS enabled for: ${CLIENT_URL}`);
});

// BATCH_00_AUDIT_MOUNTS
app.use('/api/slicing-search', require('./routes/slicingSearch'));
app.use('/api/load-balancer', require('./routes/loadBalancer'));
app.use('/api/defect-vision', require('./routes/defectVision'));
app.use('/api/supplier-sync', require('./routes/supplierSync'));
app.use('/api/cad-optimization', require('./routes/cadOptimization'));

// === Batch 00 Gaps & Frontend Mounts ===
app.use('/api/gap-ai-build-time-estimator-material', require('./routes/gap_ai_build_time_estimator_material'));
app.use('/api/gap-ai-cost-optimization-material-waste', require('./routes/gap_ai_cost_optimization_material_waste'));
app.use('/api/gap-ai-pre-print-quality-defect', require('./routes/gap_ai_pre_print_quality_defect'));
app.use('/api/gap-ai-streaming-printer-health-anomaly', require('./routes/gap_ai_streaming_printer_health_anomaly'));
app.use('/api/gap-ai-slicing-parameter-recommender-stl', require('./routes/gap_ai_slicing_parameter_recommender_stl'));
app.use('/api/gap-multi-material-scheduling-coordination', require('./routes/gap_multi_material_scheduling_coordination'));
app.use('/api/gap-upload-time-stl-printability-validation', require('./routes/gap_upload_time_stl_printability_validation'));
app.use('/api/gap-filament-auto-reorder-when-stock', require('./routes/gap_filament_auto_reorder_when_stock'));
app.use('/api/gap-notifications-subsystem-app-email', require('./routes/gap_notifications_subsystem_app_email'));
app.use('/api/gap-outbound-webhooks', require('./routes/gap_outbound_webhooks'));
app.use('/api/gap-multi-tenant-customer-separation', require('./routes/gap_multi_tenant_customer_separation'));
