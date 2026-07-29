const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getPool } = require('../../config/db');
const { 
  createReference, 
  transitionReferenceStatus, 
  attachDocument 
} = require('../../engine/hrefEngine');
const { 
  isAuthenticated, 
  requireRole, 
  canAccessReference 
} = require('../../middleware/auth');

// Multer storage setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

/**
 * POST /api/references
 * Create a new reference (Doctor only, optional document upload)
 */
router.post('/', isAuthenticated, requireRole(['doctor']), upload.array('attachments', 5), async (req, res) => {
  const { patientId, destDeptId, reason } = req.body;
  const creatorUserId = req.session.user.id;
  const sourceDeptId = req.session.user.department_id;

  if (!patientId || !destDeptId || !reason) {
    return res.status(400).json({ error: 'Patient ID, Destination Department, and Reason are required.' });
  }

  if (!sourceDeptId) {
    return res.status(400).json({ error: 'Creating doctor must be assigned to a department to refer.' });
  }

  try {
    const referenceId = await createReference({
      patientId: parseInt(patientId, 10),
      creatorUserId,
      sourceDeptId: parseInt(sourceDeptId, 10),
      destDeptId: parseInt(destDeptId, 10),
      reason: reason.trim(),
      uploadedFiles: req.files || []
    });

    return res.status(201).json({ success: true, referenceId, message: 'Referral created successfully.' });
  } catch (err) {
    console.error('Error initiating reference:', err);
    return res.status(500).json({ error: err.message || 'Failed to initiate referral.' });
  }
});

/**
 * POST /api/references/:referenceId/status
 * Transition reference status (Specialist or Admin only)
 */
router.post('/:referenceId/status', isAuthenticated, requireRole(['specialist', 'admin']), async (req, res) => {
  const { referenceId } = req.params;
  const { status: newStatus } = req.body;
  const { id: changedByUserId, role, department_id: userDeptId } = req.session.user;

  const validStatuses = ['Pending', 'In Progress', 'Resolved', 'Rejected'];
  if (!validStatuses.includes(newStatus)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const pool = getPool();
    // Verify reference exists and get details
    const [rows] = await pool.query(
      'SELECT destination_department_id FROM references_table WHERE id = ?',
      [referenceId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Reference not found.' });
    }

    const ref = rows[0];

    // Specialist can only transition referrals assigned to their department
    if (role !== 'admin' && ref.destination_department_id !== userDeptId) {
      return res.status(403).json({ error: 'Forbidden. You can only update references assigned to your department.' });
    }

    await transitionReferenceStatus({
      referenceId: parseInt(referenceId, 10),
      newStatus,
      changedByUserId
    });

    return res.json({ success: true, message: `Reference status updated to ${newStatus}.` });
  } catch (err) {
    console.error('Status transition error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update reference status.' });
  }
});

/**
 * GET /api/references/notifications
 * Polling endpoint for active notifications (relevant to logged-in user or their department)
 */
router.get('/notifications', isAuthenticated, async (req, res) => {
  const { id: userId, department_id: departmentId } = req.session.user;
  try {
    const pool = getPool();
    
    // Select unread notifications targeting either this user's department OR this user's direct ID
    const [rows] = await pool.query(
      `SELECT id, reference_id, message, created_at 
       FROM notifications 
       WHERE is_read = FALSE AND (department_id = ? OR user_id = ?) 
       ORDER BY created_at DESC`,
      [departmentId || -1, userId]
    );
    return res.json(rows);
  } catch (err) {
    console.error('Notifications fetch error:', err);
    return res.status(500).json({ error: 'Database error fetching notifications.' });
  }
});

/**
 * POST /api/references/notifications/:notificationId/read
 * Mark notification as read
 */
router.post('/notifications/:notificationId/read', isAuthenticated, async (req, res) => {
  const { notificationId } = req.params;
  try {
    const pool = getPool();
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = ?', [notificationId]);
    return res.json({ success: true });
  } catch (err) {
    console.error('Notification update error:', err);
    return res.status(500).json({ error: 'Failed to update notification.' });
  }
});

/**
 * POST /api/references/:referenceId/documents
 * Attach document to an existing reference (Restricted to reference visibility)
 */
router.post('/:referenceId/documents', isAuthenticated, canAccessReference, upload.single('attachment'), async (req, res) => {
  const { referenceId } = req.params;
  const uploadedByUserId = req.session.user.id;

  if (!req.file) {
    return res.status(400).json({ error: 'No document attached.' });
  }

  try {
    await attachDocument({
      referenceId: parseInt(referenceId, 10),
      file: req.file,
      uploadedByUserId
    });
    return res.json({ success: true, message: 'Document uploaded successfully.' });
  } catch (err) {
    console.error('File attach error:', err);
    return res.status(500).json({ error: 'Database error linking document.' });
  }
});

/**
 * GET /api/references/:referenceId/documents/:documentId/download
 * Download a clinical document securely (checked against reference visibility)
 */
router.get('/:referenceId/documents/:documentId/download', isAuthenticated, canAccessReference, async (req, res) => {
  const { referenceId, documentId } = req.params;

  try {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT filename, storage_path FROM documents WHERE id = ? AND reference_id = ?',
      [documentId, referenceId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Document not found for this reference.' });
    }

    const doc = rows[0];
    if (!fs.existsSync(doc.storage_path)) {
      return res.status(404).json({ error: 'File does not exist on disk.' });
    }

    return res.download(doc.storage_path, doc.filename);
  } catch (err) {
    console.error('Download error:', err);
    return res.status(500).json({ error: 'Failed to retrieve document.' });
  }
});

module.exports = router;
