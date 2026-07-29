const express = require('express');
const router = express.Router();
const { getPool } = require('../../config/db');
const { isAuthenticated, requireRole } = require('../../middleware/auth');

/**
 * GET /admin/manage
 * Renders the department and staff management view (Admin only)
 */
router.get('/manage', isAuthenticated, requireRole(['admin']), async (req, res) => {
  const error = req.session.error || null;
  const success = req.session.success || null;
  req.session.error = null;
  req.session.success = null;

  try {
    const pool = getPool();
    // 1. Fetch departments
    const [departments] = await pool.query(
      'SELECT id, name FROM departments ORDER BY name ASC'
    );

    // 2. Fetch workers/staff
    const [workers] = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       ORDER BY u.role, u.name ASC`
    );

    return res.render('admin_manage', {
      departments,
      workers,
      error,
      success
    });
  } catch (err) {
    console.error('Error loading admin manage page:', err);
    return res.status(500).send('Database query failed.');
  }
});

module.exports = router;
