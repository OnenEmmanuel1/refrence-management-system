const express = require('express');
const router = express.Router();
const { getPool } = require('../../config/db');
const { isAuthenticated, requireRole, canAccessReference } = require('../../middleware/auth');

/**
 * GET /references/create
 * Initiate referral form (Doctor only). Verifies patient existence first or loads all patients.
 */
router.get('/create', isAuthenticated, requireRole(['doctor']), async (req, res) => {
  const patientId = req.query.patientId;

  try {
    const pool = getPool();
    let patient = null;
    let patients = [];

    if (patientId) {
      // 1. Verify patient exists
      const [patientRows] = await pool.query(
        'SELECT id, name, dob, gender, contact_info FROM patients WHERE id = ?',
        [patientId]
      );

      if (patientRows.length === 0) {
        req.session.error = 'Selected patient does not exist. Please register them first.';
        return res.redirect('/patients/lookup');
      }
      patient = patientRows[0];
    } else {
      // Fetch all patients for selection dropdown
      const [patientRows] = await pool.query(
        'SELECT id, name, dob, gender FROM patients ORDER BY name ASC'
      );
      patients = patientRows;
    }

    // 2. Fetch destination departments (excluding current doctor's department)
    const doctorDeptId = req.session.user.department_id;
    const [departments] = await pool.query(
      'SELECT id, name FROM departments WHERE id != ?',
      [doctorDeptId || 0]
    );

    return res.render('reference_create', { 
      patient,
      patients,
      departments,
      error: req.session.error || null
    });
  } catch (err) {
    console.error('Error opening reference creation form:', err);
    return res.status(500).send('Database query failed.');
  }
});

/**
 * GET /references/:referenceId
 * Views detailed reference timeline, documents, and logs. Checked for department visibility.
 */
router.get('/:referenceId', isAuthenticated, canAccessReference, async (req, res) => {
  const { referenceId } = req.params;
  const pool = getPool();

  try {
    // 1. Fetch referral details
    const [refRows] = await pool.query(
      `SELECT 
         r.id, r.reason, r.current_status, r.created_at,
         p.id AS patient_id, p.name AS patient_name, p.dob AS patient_dob, p.gender AS patient_gender, p.contact_info AS patient_contact,
         u.name AS creator_name,
         d_src.name AS source_dept_name,
         d_dest.id AS dest_dept_id, d_dest.name AS dest_dept_name
       FROM references_table r
       JOIN patients p ON r.patient_id = p.id
       JOIN users u ON r.created_by_user_id = u.id
       JOIN departments d_src ON r.source_department_id = d_src.id
       JOIN departments d_dest ON r.destination_department_id = d_dest.id
       WHERE r.id = ?`,
      [referenceId]
    );

    if (refRows.length === 0) {
      req.session.error = 'Referral not found.';
      return res.redirect('/dashboard');
    }

    const reference = refRows[0];

    // 2. Fetch status change logs (audit trail)
    const [statusLogs] = await pool.query(
      `SELECT l.status, l.changed_at, u.name AS changer_name, u.role AS changer_role
       FROM reference_status_log l
       JOIN users u ON l.changed_by_user_id = u.id
       WHERE l.reference_id = ?
       ORDER BY l.changed_at ASC`,
      [referenceId]
    );

    // 3. Fetch supporting clinical files
    const [documents] = await pool.query(
      `SELECT d.id, d.filename, d.uploaded_at, u.name AS uploader_name
       FROM documents d
       JOIN users u ON d.uploaded_by_user_id = u.id
       WHERE d.reference_id = ?
       ORDER BY d.uploaded_at DESC`,
      [referenceId]
    );

    // 4. Fetch list of destinations to support reassignment or logging
    const error = req.session.error || null;
    const success = req.session.success || null;
    req.session.error = null;
    req.session.success = null;

    return res.render('reference_detail', {
      reference,
      statusLogs,
      documents,
      currentUser: req.session.user,
      error,
      success
    });
  } catch (err) {
    console.error('Error loading reference details:', err);
    return res.status(500).send('Database error loading reference details.');
  }
});

module.exports = router;
