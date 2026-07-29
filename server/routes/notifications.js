const express = require('express');
const { validateSession } = require('../middleware/validateSession');
const { getNotifications } = require('../services/notificationService');

const router = express.Router();

router.use(validateSession);

// GET /api/notifications — returns notifications for the logged-in user
router.get('/', async (req, res, next) => {
  try {
    const notifications = await getNotifications(req.user);
    res.status(200).json({
      data: notifications,
      count: notifications.length,
      message: 'OK',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
