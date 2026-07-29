const express = require('express');
const router = express.Router();
const { getPool } = require('../../config/db');
const { isAuthenticated, requireRole } = require('../../middleware/auth');

/**
 * GET /api/reports/turnaround
 * Calculates Turnaround Times for Resolved Referrals (Admin only)
 */
router.get('/turnaround', isAuthenticated, requireRole(['admin']), async (req, res) => {
  try {
    const pool = getPool();
    // Turnaround time for each resolved referral (in minutes)
    const [individualRows] = await pool.query(
      `SELECT 
         r.id AS reference_id,
         p.name AS patient_name,
         d_src.name AS source_dept,
         d_dest.name AS dest_dept,
         r.created_at AS initiated_at,
         log.changed_at AS resolved_at,
         TIMESTAMPDIFF(MINUTE, r.created_at, log.changed_at) AS turnaround_minutes
       FROM references_table r
       JOIN patients p ON r.patient_id = p.id
       JOIN departments d_src ON r.source_department_id = d_src.id
       JOIN departments d_dest ON r.destination_department_id = d_dest.id
       JOIN reference_status_log log ON r.id = log.reference_id AND log.status = 'Resolved'
       WHERE r.current_status = 'Resolved'
       ORDER BY r.id DESC`
    );

    // Hospital-wide overall average turnaround time
    const [averageRows] = await pool.query(
      `SELECT AVG(TIMESTAMPDIFF(MINUTE, r.created_at, log.changed_at)) AS avg_turnaround_minutes
       FROM references_table r
       JOIN reference_status_log log ON r.id = log.reference_id AND log.status = 'Resolved'
       WHERE r.current_status = 'Resolved'`
    );

    return res.json({
      individual: individualRows,
      averageMinutes: averageRows[0].avg_turnaround_minutes || 0
    });
  } catch (err) {
    console.error('Turnaround calculation failed:', err);
    return res.status(500).json({ error: 'Database query failed for turnaround analysis.' });
  }
});

/**
 * GET /api/reports/workload
 * Computes referrals volume by destination department (Admin only)
 */
router.get('/workload', isAuthenticated, requireRole(['admin']), async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 
         d.name AS department_name,
         COUNT(r.id) AS referral_count,
         SUM(CASE WHEN r.current_status = 'Pending' THEN 1 ELSE 0 END) AS pending_count,
         SUM(CASE WHEN r.current_status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress_count,
         SUM(CASE WHEN r.current_status = 'Resolved' THEN 1 ELSE 0 END) AS resolved_count,
         SUM(CASE WHEN r.current_status = 'Rejected' THEN 1 ELSE 0 END) AS rejected_count
       FROM departments d
       LEFT JOIN references_table r ON d.id = r.destination_department_id
       GROUP BY d.id, d.name
       ORDER BY referral_count DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('Workload calculation failed:', err);
    return res.status(500).json({ error: 'Database query failed for departmental workload.' });
  }
});

/**
 * GET /api/reports/patterns
 * Analyzes source -> destination hospital referral frequencies (Admin only)
 */
router.get('/patterns', isAuthenticated, requireRole(['admin']), async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 
         d_src.name AS source_department,
         d_dest.name AS destination_department,
         COUNT(r.id) AS frequency
       FROM references_table r
       JOIN departments d_src ON r.source_department_id = d_src.id
       JOIN departments d_dest ON r.destination_department_id = d_dest.id
       GROUP BY r.source_department_id, r.destination_department_id, d_src.name, d_dest.name
       ORDER BY frequency DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('Referral patterns analysis failed:', err);
    return res.status(500).json({ error: 'Database query failed for referral patterns.' });
  }
});

/**
 * GET /api/reports/csv
 * Aggregates all references and downloads a CSV spreadsheet (Admin only)
 */
router.get('/csv', isAuthenticated, requireRole(['admin']), async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT 
        r.id AS ref_id,
        p.name AS patient_name,
        p.dob AS patient_dob,
        u.name AS referring_doctor,
        d_src.name AS source_dept,
        d_dest.name AS dest_dept,
        r.current_status AS current_status,
        r.created_at AS created_at,
        (SELECT MIN(changed_at) FROM reference_status_log WHERE reference_id = r.id AND status = 'Resolved') AS resolved_at
      FROM references_table r
      JOIN patients p ON r.patient_id = p.id
      JOIN users u ON r.created_by_user_id = u.id
      JOIN departments d_src ON r.source_department_id = d_src.id
      JOIN departments d_dest ON r.destination_department_id = d_dest.id
      ORDER BY r.id DESC
    `);

    let csvContent = 'Referral ID,Patient Name,Patient DOB,Referring Doctor,Source Department,Destination Department,Current Status,Date Created,Date Resolved,Turnaround Time (Hours)\n';

    rows.forEach(row => {
      const created = new Date(row.created_at);
      const resolved = row.resolved_at ? new Date(row.resolved_at) : null;
      let turnaround = 'N/A';
      if (resolved) {
        const diffMs = resolved - created;
        turnaround = (diffMs / (1000 * 60 * 60)).toFixed(2);
      }

      // Safe CSV cell escaping (wrapping in quotes, doubling internal double-quotes)
      const escapeCell = (val) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const dobString = row.patient_dob instanceof Date 
        ? row.patient_dob.toISOString().split('T')[0] 
        : String(row.patient_dob);

      const createdString = row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at);

      const resolvedString = resolved
        ? resolved.toISOString()
        : 'N/A';

      const line = [
        row.ref_id,
        escapeCell(row.patient_name),
        dobString,
        escapeCell(row.referring_doctor),
        escapeCell(row.source_dept),
        escapeCell(row.dest_dept),
        row.current_status,
        createdString,
        resolvedString,
        turnaround
      ];

      csvContent += line.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="refertrack_turnaround_report.csv"');
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('CSV export failed:', err);
    return res.status(500).send('Error generating CSV spreadsheet report.');
  }
});

module.exports = router;
