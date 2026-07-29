const express = require('express');
const router = express.Router();
const { isAuthenticated, requireRole } = require('../../middleware/auth');

/**
 * GET /reports
 * Renders the administrator reports page (Admin only)
 */
router.get('/reports', isAuthenticated, requireRole(['admin']), (req, res) => {
  return res.render('reports', {
    currentUser: req.session.user
  });
});

module.exports = router;
