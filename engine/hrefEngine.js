const { getPool } = require('../config/db');

/**
 * Log a session attempt to the database for audit tracking
 */
async function logSession(email, outcome) {
  const pool = getPool();
  try {
    await pool.query(
      'INSERT INTO session_log (email, outcome) VALUES (?, ?)',
      [email, outcome]
    );
  } catch (err) {
    console.error('Failed to write session audit log:', err);
  }
}

/**
 * Create a new hospital reference
 */
async function createReference({ patientId, creatorUserId, sourceDeptId, destDeptId, reason, uploadedFiles = [] }) {
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Validate patient existence
    const [patientRows] = await conn.query('SELECT name FROM patients WHERE id = ?', [patientId]);
    if (patientRows.length === 0) {
      throw new Error('Patient not found.');
    }
    const patientName = patientRows[0].name;

    // 2. Validate users and departments
    const [userRows] = await conn.query('SELECT name FROM users WHERE id = ?', [creatorUserId]);
    const creatorName = userRows.length > 0 ? userRows[0].name : 'Unknown Doctor';

    const [deptRows] = await conn.query(
      'SELECT id, name FROM departments WHERE id IN (?, ?)',
      [sourceDeptId, destDeptId]
    );
    const sourceDept = deptRows.find(d => d.id == sourceDeptId);
    const destDept = deptRows.find(d => d.id == destDeptId);
    const sourceName = sourceDept ? sourceDept.name : 'Unknown Department';
    const destName = destDept ? destDept.name : 'Unknown Department';

    // 3. Insert reference
    const [refResult] = await conn.query(
      `INSERT INTO references_table 
       (patient_id, created_by_user_id, source_department_id, destination_department_id, reason, current_status)
       VALUES (?, ?, ?, ?, ?, 'Pending')`,
      [patientId, creatorUserId, sourceDeptId, destDeptId, reason]
    );
    const referenceId = refResult.insertId;

    // 4. Append to status log
    await conn.query(
      `INSERT INTO reference_status_log (reference_id, status, changed_by_user_id) 
       VALUES (?, 'Pending', ?)`,
      [referenceId, creatorUserId]
    );

    // 5. Save uploaded documents path in DB if any
    for (const file of uploadedFiles) {
      await conn.query(
        `INSERT INTO documents (reference_id, filename, storage_path, uploaded_by_user_id)
         VALUES (?, ?, ?, ?)`,
        [referenceId, file.originalname, file.path, creatorUserId]
      );
    }

    // 6. Trigger in-app notification to the destination department
    const notificationMsg = `New reference (ID: ${referenceId}) for Patient ${patientName} referred from ${sourceName} by ${creatorName}.`;
    await conn.query(
      `INSERT INTO notifications (department_id, reference_id, message) 
       VALUES (?, ?, ?)`,
      [destDeptId, referenceId, notificationMsg]
    );

    await conn.commit();
    return referenceId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Handle reference status transition (Pending -> In Progress -> Resolved/Rejected)
 */
async function transitionReferenceStatus({ referenceId, newStatus, changedByUserId }) {
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Verify reference exists
    const [refRows] = await conn.query(
      `SELECT r.id, r.current_status, r.created_by_user_id, r.patient_id, p.name AS patient_name 
       FROM references_table r
       JOIN patients p ON r.patient_id = p.id
       WHERE r.id = ? FOR UPDATE`,
      [referenceId]
    );
    if (refRows.length === 0) {
      throw new Error('Reference not found.');
    }
    const reference = refRows[0];

    // Check that transition actually changes the state
    if (reference.current_status === newStatus) {
      throw new Error(`Reference is already in status '${newStatus}'.`);
    }

    // 2. Resolve user updating state
    const [userRows] = await conn.query('SELECT name, role FROM users WHERE id = ?', [changedByUserId]);
    if (userRows.length === 0) {
      throw new Error('User performing update not found.');
    }
    const updater = userRows[0];

    // 3. Update main reference status
    await conn.query(
      'UPDATE references_table SET current_status = ? WHERE id = ?',
      [newStatus, referenceId]
    );

    // 4. Append to reference status log
    await conn.query(
      `INSERT INTO reference_status_log (reference_id, status, changed_by_user_id)
       VALUES (?, ?, ?)`,
      [referenceId, newStatus, changedByUserId]
    );

    // 5. Trigger notification to the reference creator (doctor)
    const notificationMsg = `Reference ID: ${referenceId} (Patient: ${reference.patient_name}) status has been updated to '${newStatus}' by ${updater.name}.`;
    await conn.query(
      `INSERT INTO notifications (user_id, reference_id, message)
       VALUES (?, ?, ?)`,
      [reference.created_by_user_id, referenceId, notificationMsg]
    );

    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Upload an additional document to an existing reference
 */
async function attachDocument({ referenceId, file, uploadedByUserId }) {
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO documents (reference_id, filename, storage_path, uploaded_by_user_id)
     VALUES (?, ?, ?, ?)`,
    [referenceId, file.originalname, file.path, uploadedByUserId]
  );
  return result.insertId;
}

module.exports = {
  logSession,
  createReference,
  transitionReferenceStatus,
  attachDocument
};
