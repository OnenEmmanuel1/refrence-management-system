const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { getPool } = require('../../config/db');
const { isAuthenticated, requireRole } = require('../../middleware/auth');

/**
 * POST /api/admin/departments
 * Create a new department (Admin only)
 */
router.post('/departments', isAuthenticated, requireRole(['admin']), async (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Department name is required.' });
  }

  try {
    const pool = getPool();
    // Check duplicate
    const [existing] = await pool.query('SELECT id FROM departments WHERE name = ?', [name.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Department already exists.' });
    }

    await pool.query('INSERT INTO departments (name) VALUES (?)', [name.trim()]);
    return res.status(201).json({ success: true, message: 'Department created successfully.' });
  } catch (err) {
    console.error('Error creating department:', err);
    return res.status(500).json({ error: 'Internal server error creating department.' });
  }
});

/**
 * POST /api/admin/workers
 * Create a new worker/staff member (Admin only)
 */
router.post('/workers', isAuthenticated, requireRole(['admin']), async (req, res) => {
  const { name, email, password, role, department_id } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required.' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required.' });
  }
  if (!password || !password.trim()) {
    return res.status(400).json({ error: 'Password is required.' });
  }
  if (!role) {
    return res.status(400).json({ error: 'System role is required.' });
  }

  const validRoles = ['doctor', 'specialist', 'receptionist', 'admin'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid system role.' });
  }

  // Clinical roles validation
  if ((role === 'doctor' || role === 'specialist') && !department_id) {
    return res.status(400).json({ error: 'Clinical roles must be assigned to a department.' });
  }

  try {
    const pool = getPool();

    // Check duplicate email
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'A staff member with this email is already registered.' });
    }

    // Verify department if clinical
    let assignedDeptId = null;
    if (role === 'doctor' || role === 'specialist') {
      const [dept] = await pool.query('SELECT id FROM departments WHERE id = ?', [department_id]);
      if (dept.length === 0) {
        return res.status(400).json({ error: 'Selected department does not exist.' });
      }
      assignedDeptId = parseInt(department_id, 10);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    await pool.query(
      'INSERT INTO users (name, email, password_hash, role, department_id) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), email.trim(), passwordHash, role, assignedDeptId]
    );

    return res.status(201).json({ success: true, message: 'Staff member added successfully.' });
  } catch (err) {
    console.error('Error creating staff member:', err);
    return res.status(500).json({ error: 'Internal server error registering staff member.' });
  }
});

/**
 * DELETE /api/admin/workers/:id
 * Delete a worker/staff member (Admin only)
 */
router.delete('/workers/:id', isAuthenticated, requireRole(['admin']), async (req, res) => {
  const workerId = parseInt(req.params.id, 10);
  const currentUserId = req.session.user.id;

  if (workerId === currentUserId) {
    return res.status(400).json({ error: 'You cannot delete your own administrator account.' });
  }

  try {
    const pool = getPool();
    
    // Check if worker exists
    const [existing] = await pool.query('SELECT id, name FROM users WHERE id = ?', [workerId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Staff member not found.' });
    }

    // Delete user
    await pool.query('DELETE FROM users WHERE id = ?', [workerId]);
    return res.json({ success: true, message: `Staff member "${existing[0].name}" deleted successfully.` });
  } catch (err) {
    console.error('Error deleting staff member:', err);
    return res.status(500).json({ error: 'Internal server error deleting staff member.' });
  }
});

module.exports = router;
