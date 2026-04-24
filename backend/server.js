const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.BACKEND_PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
