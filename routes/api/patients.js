const express = require('express');
const router = express.Router();
const { getPool } = require('../../config/db');
const { isAuthenticated, requireRole } = require('../../middleware/auth');

/**
 * GET /api/patients/search
 * Search patients by name or ID (Accessible by Receptionists and Doctors)
 */
router.get('/search', isAuthenticated, requireRole(['receptionist', 'doctor']), async (req, res) => {
  const queryVal = req.query.q || '';
  
  if (!queryVal.trim()) {
    return res.json([]);
  }

  try {
    const pool = getPool();
    // Support searching by name or exact ID or contact_info
    const [rows] = await pool.query(
      `SELECT id, name, dob, gender, contact_info, created_at 
       FROM patients 
       WHERE name LIKE ? OR id = ? OR contact_info LIKE ? 
       LIMIT 10`,
      [`%${queryVal}%`, parseInt(queryVal, 10) || 0, `%${queryVal}%`]
    );
    return res.json(rows);
  } catch (err) {
    console.error('Patient search error:', err);
    return res.status(500).json({ error: 'Database search query failed.' });
  }
});

/**
 * POST /api/patients/register
 * Register a new patient (Accessible by Receptionist only)
 */
router.post('/register', isAuthenticated, requireRole(['receptionist']), async (req, res) => {
  const { name, dob, gender, contact_info } = req.body;

  if (!name || !dob || !gender || !contact_info) {
    return res.status(400).json({ error: 'All fields (name, dob, gender, contact_info) are required.' });
  }

  try {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO patients (name, dob, gender, contact_info) VALUES (?, ?, ?, ?)`,
      [name.trim(), dob, gender, contact_info.trim()]
    );
    return res.json({ success: true, patientId: result.insertId, message: 'Patient registered successfully.' });
  } catch (err) {
    console.error('Patient registration error:', err);
    return res.status(500).json({ error: 'Database insert failed for new patient.' });
  }
});

module.exports = router;
