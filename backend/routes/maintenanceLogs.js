const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// Get all
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM maintenance_logs ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM maintenance_logs WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create
router.post('/', auth, async (req, res) => {
  try {
    const { printer_name, maintenance_type, description, performed_by, cost, next_maintenance_date, status, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO maintenance_logs (printer_name, maintenance_type, description, performed_by, cost, next_maintenance_date, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [printer_name, maintenance_type, description, performed_by, cost, next_maintenance_date, status, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update
router.put('/:id', auth, async (req, res) => {
  try {
    const { printer_name, maintenance_type, description, performed_by, cost, next_maintenance_date, status, notes } = req.body;
    const result = await pool.query(
      `UPDATE maintenance_logs SET printer_name=$1, maintenance_type=$2, description=$3, performed_by=$4, cost=$5, next_maintenance_date=$6, status=$7, notes=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [printer_name, maintenance_type, description, performed_by, cost, next_maintenance_date, status, notes, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM maintenance_logs WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
