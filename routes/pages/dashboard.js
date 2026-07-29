const express = require('express');
const router = express.Router();
const { getPool } = require('../../config/db');
const { isAuthenticated } = require('../../middleware/auth');

/**
 * GET /dashboard
 * Directs the authenticated user to their role-specific dashboard interface
 */
router.get('/dashboard', isAuthenticated, async (req, res) => {
  const { role, id: userId, department_id: deptId, name: userName } = req.session.user;
  const pool = getPool();
  const error = req.session.error || null;
  const success = req.session.success || null;
  req.session.error = null;
  req.session.success = null;

  try {
    if (role === 'doctor') {
      // Fetch references initiated by this doctor
      const [references] = await pool.query(
        `SELECT r.id, p.name AS patient_name, d.name AS dest_dept_name, r.current_status, r.created_at
         FROM references_table r
         JOIN patients p ON r.patient_id = p.id
         JOIN departments d ON r.destination_department_id = d.id
         WHERE r.created_by_user_id = ?
         ORDER BY r.created_at DESC`,
        [userId]
      );
      return res.render('dashboard_doctor', { references, userName, error, success });
      
    } else if (role === 'receptionist') {
      // Fetch recently registered patients
      const [recentPatients] = await pool.query(
        `SELECT id, name, dob, gender, contact_info, created_at
         FROM patients
         ORDER BY created_at DESC
         LIMIT 10`
      );
      return res.render('dashboard_receptionist', { recentPatients, userName, error, success });
      
    } else if (role === 'specialist') {
      // Fetch references assigned to the specialist's department
      const [incomingReferences] = await pool.query(
        `SELECT r.id, p.name AS patient_name, d_src.name AS source_dept_name, r.current_status, r.created_at
         FROM references_table r
         JOIN patients p ON r.patient_id = p.id
         JOIN departments d_src ON r.source_department_id = d_src.id
         WHERE r.destination_department_id = ?
         ORDER BY r.created_at DESC`,
        [deptId]
      );
      return res.render('dashboard_specialist', { incomingReferences, userName, error, success });
      
    } else if (role === 'admin') {
      // Fetch total statistics counts
      const [statsRows] = await pool.query(
        `SELECT 
           (SELECT COUNT(*) FROM references_table) AS total_count,
           (SELECT COUNT(*) FROM references_table WHERE current_status = 'Pending') AS pending_count,
           (SELECT COUNT(*) FROM references_table WHERE current_status = 'In Progress') AS in_progress_count,
           (SELECT COUNT(*) FROM references_table WHERE current_status = 'Resolved') AS resolved_count,
           (SELECT COUNT(*) FROM references_table WHERE current_status = 'Rejected') AS rejected_count`
      );

      // Fetch recent references across all departments
      const [recentReferences] = await pool.query(
        `SELECT r.id, p.name AS patient_name, d_src.name AS source_dept_name, d_dest.name AS dest_dept_name, r.current_status, r.created_at
         FROM references_table r
         JOIN patients p ON r.patient_id = p.id
         JOIN departments d_src ON r.source_department_id = d_src.id
         JOIN departments d_dest ON r.destination_department_id = d_dest.id
         ORDER BY r.created_at DESC
         LIMIT 15`
      );

      return res.render('dashboard_admin', { 
        stats: statsRows[0], 
        recentReferences, 
        userName, 
        error, 
        success 
      });
    }

    return res.redirect('/login');
  } catch (err) {
    console.error('Dashboard rendering failed:', err);
    return res.status(500).send('Error loading dashboard data.');
  }
});

module.exports = router;
