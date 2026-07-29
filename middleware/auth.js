const { getPool } = require('../config/db');

/**
 * Verify if the user is authenticated in the current session
 */
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  return res.redirect('/login');
}

/**
 * Restrict routes to selected user roles
 */
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(401).json({ error: 'Unauthorized.' });
      }
      return res.redirect('/login');
    }
    
    if (roles.includes(req.session.user.role)) {
      return next();
    }
    
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(403).json({ error: 'Forbidden. Insufficient permissions.' });
    }
    
    req.session.error = 'You do not have permission to view that page.';
    return res.redirect('/dashboard');
  };
}

/**
 * Restrict document/reference access to Admin, the creator Doctor, 
 * or users belonging to the source/destination departments.
 */
async function canAccessReference(req, res, next) {
  if (!req.session || !req.session.user) {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    return res.redirect('/login');
  }

  const { role, id: userId, department_id: userDeptId } = req.session.user;
  
  if (role === 'admin') {
    return next();
  }

  const referenceId = req.params.referenceId || req.body.referenceId || req.query.referenceId;
  if (!referenceId) {
    return res.status(400).json({ error: 'Reference ID is required.' });
  }

  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT created_by_user_id, source_department_id, destination_department_id 
       FROM references_table WHERE id = ?`,
      [referenceId]
    );

    if (rows.length === 0) {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(404).json({ error: 'Reference not found.' });
      }
      return res.redirect('/dashboard');
    }

    const ref = rows[0];

    // Verification logic
    const isCreator = ref.created_by_user_id === userId;
    const isSourceStaff = userDeptId && ref.source_department_id === userDeptId;
    const isDestStaff = userDeptId && ref.destination_department_id === userDeptId;

    if (isCreator || isSourceStaff || isDestStaff) {
      return next();
    }

    if (req.originalUrl.startsWith('/api/')) {
      return res.status(403).json({ error: 'Forbidden. You do not have access to this reference.' });
    }
    req.session.error = 'You do not have access to that reference.';
    return res.redirect('/dashboard');
  } catch (err) {
    console.error('Error checking reference permissions:', err);
    return res.status(500).json({ error: 'Database error checking permissions.' });
  }
}

module.exports = {
  isAuthenticated,
  requireRole,
  canAccessReference
};
