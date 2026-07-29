const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { getPool } = require('../../config/db');
const { logSession } = require('../../engine/hrefEngine');

/**
 * POST /api/auth/login
 * Handles user login API
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('reached');


  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.department_id, d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.email = ?`,
      [email.trim()]
    );

    if (rows.length === 0) {
      await logSession(email, 'FAILED - Invalid Email');
      return res.status(400).json({ success: false, error: 'Invalid email.' });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      await logSession(email, 'FAILED - Incorrect Password');
      return res.status(400).json({ success: false, error: 'Incorrect password.' });
    }

    // Initialize session structure
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department_id: user.department_id,
      department_name: user.department_name
    };

    await logSession(email, 'SUCCESS');
    return res.json({ success: true, user: req.session.user });
  } catch (err) {
    console.error('Login error:', err);
    await logSession(email, `ERROR - ${err.message}`);
    return res.status(500).json({ success: false, error: 'Internal server error during login.' });
  }
});

module.exports = router;
