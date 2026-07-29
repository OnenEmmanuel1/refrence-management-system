const express = require('express');
const router = express.Router();
const { getPool } = require('../../config/db');
const { isAuthenticated, requireRole } = require('../../middleware/auth');

/**
 * GET /patients/lookup
 * Renders patient lookup and search interface with pre-loaded patients list.
 */
router.get('/lookup', isAuthenticated, requireRole(['receptionist', 'doctor']), async (req, res) => {
  const error = req.session.error || null;
  const success = req.session.success || null;
  req.session.error = null;
  req.session.success = null;

  try {
    const pool = getPool();
    const [patients] = await pool.query(
      'SELECT id, name, dob, gender, contact_info FROM patients ORDER BY name ASC'
    );
    return res.render('patient_lookup', { error, success, patients });
  } catch (err) {
    console.error('Error fetching patients for lookup:', err);
    return res.status(500).send('Database error loading patient registry.');
  }
});

/**
 * GET /patients/register
 * Renders patient registration form (Receptionist only)
 */
router.get('/register', isAuthenticated, requireRole(['receptionist']), (req, res) => {
  const error = req.session.error || null;
  const success = req.session.success || null;
  req.session.error = null;
  req.session.success = null;
  return res.render('patient_register', { error, success });
});

module.exports = router;
