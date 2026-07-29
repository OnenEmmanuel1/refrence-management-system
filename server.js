const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { connectWithRetry } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));

// Configure EJS view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Setup express session
app.use(session({
  secret: process.env.SESSION_SECRET || 'refertrack_fallback_secret_67890',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if utilizing HTTPS
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 8 // 8 hour session lifespan
  }
}));

// Apply global EJS rendering locals for session state availability
app.use((req, res, next) => {
  res.locals.currentUser = (req.session && req.session.user) ? req.session.user : null;
  next();
});

// Ensure uploads container directory exists on startup
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Register separated route layers
app.use('/api/auth', require('./routes/api/auth'));
app.use('/api/patients', require('./routes/api/patients'));
app.use('/api/references', require('./routes/api/references'));
app.use('/api/reports', require('./routes/api/reports'));
app.use('/api/admin', require('./routes/api/admin'));

// Page endpoints
app.use('/', require('./routes/pages/auth'));
app.use('/', require('./routes/pages/dashboard'));
app.use('/patients', require('./routes/pages/patients'));
app.use('/references', require('./routes/pages/references'));
app.use('/', require('./routes/pages/reports'));
app.use('/admin', require('./routes/pages/admin'));

// Direct index access to dashboard router
app.get('/', (req, res) => {
  return res.redirect('/dashboard');
});

// Catch unhandled errors
app.use((err, req, res, next) => {
  console.error('Unhandled request error:', err);
  return res.status(500).send('Severe server error. Transaction aborted.');
});

// Initialize database then start HTTP listeners
connectWithRetry()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`ReferTrack Hospital Reference System is online at http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database connection. Application halted.', err);
    process.exit(1);
  });
