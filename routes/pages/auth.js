const express = require('express');
const router = express.Router();

/**
 * GET /login
 * Render login screen
 */
router.get('/login', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  const error = req.session.error || null;
  req.session.error = null; // Clear flash error
  return res.render('login', { error });
});

/**
 * GET /logout
 * Destroys user session and redirects to login
 */
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy failed during logout:', err);
    }
    return res.redirect('/login');
  });
});

module.exports = router;
