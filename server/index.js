require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const db = require('./db');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(morgan('dev'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', version: '1.0.0', database: 'connected' });
});

// Route Mounting
app.use('/api/assets', require('./routes/assets'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/history', require('./routes/history'));
app.use('/api/serial', require('./routes/serial'));
app.use('/api/google', require('./routes/google'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/onboarding', require('./routes/onboarding'));
app.use('/api/notifications', require('./routes/notifications'));

// 404 Handler for unmatched routes
app.use((req, res, next) => {
  res.status(404).json({
    error: true,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    code: 404,
  });
});

// Global Error Handler
app.use(errorHandler);

let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = app;

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
      db.pool.end(() => {
        console.log('Postgres pool closed');
        process.exit(0);
      });
    });
  } else {
    db.pool.end(() => {
      process.exit(0);
    });
  }
});
