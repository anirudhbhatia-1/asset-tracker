const { pool } = require('../db');

/**
 * Returns notifications for an employee role user.
 * Looks at their tickets and assigned assets.
 */
const getEmployeeNotifications = async (employeeId) => {
  const notifications = [];

  // 1. Tickets that were resolved or rejected (from ticket_history, last 7 days)
  const { rows: ticketEvents } = await pool.query(
    `SELECT th.event_type, th.created_at, t.id as ticket_id, t.title, t.status
     FROM ticket_history th
     JOIN tickets t ON th.ticket_id = t.id
     WHERE t.employee_id = $1
       AND th.event_type IN ('resolved', 'rejected')
       AND th.created_at > NOW() - INTERVAL '7 days'
     ORDER BY th.created_at DESC
     LIMIT 20`,
    [employeeId]
  );

  for (const row of ticketEvents) {
    notifications.push({
      id: `ticket-${row.event_type}-${row.ticket_id}-${row.created_at}`,
      type: row.event_type === 'resolved' ? 'success' : 'warning',
      title: row.event_type === 'resolved' ? 'Ticket Resolved' : 'Ticket Rejected',
      message: `Your ticket "${row.title}" has been ${row.event_type}.`,
      link: '/tickets',
      createdAt: row.created_at,
    });
  }

  // 2. Tickets that are resolved but not yet confirmed by employee (still need action)
  const { rows: pendingConfirm } = await pool.query(
    `SELECT id, title FROM tickets
     WHERE employee_id = $1 AND status = 'resolved'
     ORDER BY updated_at DESC`,
    [employeeId]
  );

  for (const row of pendingConfirm) {
    notifications.push({
      id: `ticket-confirm-${row.id}`,
      type: 'info',
      title: 'Action Required: Confirm Resolution',
      message: `Please confirm if ticket "${row.title}" was resolved to your satisfaction.`,
      link: '/tickets',
      createdAt: new Date(),
    });
  }

  // 3. Assets assigned to them in the last 7 days
  const { rows: assetEvents } = await pool.query(
    `SELECT ah.event_type, ah.event_at, a.name as asset_name
     FROM asset_history ah
     JOIN assets a ON ah.asset_id = a.id
     WHERE ah.employee_id = $1
       AND ah.event_type IN ('assigned', 'returned')
       AND ah.event_at > NOW() - INTERVAL '7 days'
     ORDER BY ah.event_at DESC
     LIMIT 10`,
    [employeeId]
  );

  for (const row of assetEvents) {
    notifications.push({
      id: `asset-${row.event_type}-${row.asset_name}-${row.event_at}`,
      type: row.event_type === 'assigned' ? 'success' : 'info',
      title: row.event_type === 'assigned' ? 'Asset Assigned to You' : 'Asset Returned',
      message: row.event_type === 'assigned'
        ? `"${row.asset_name}" has been assigned to you.`
        : `"${row.asset_name}" has been marked as returned.`,
      link: '/',
      createdAt: row.event_at,
    });
  }

  return notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

/**
 * Returns notifications for an admin role user.
 * Scoped by their admin_type (it or hardware).
 */
const getAdminNotifications = async (adminEmployee) => {
  const notifications = [];
  const adminType = adminEmployee.adminType;

  // 1. New tickets in their queue (last 48 hours)
  if (adminType) {
    const { rows: newTickets } = await pool.query(
      `SELECT id, title, created_at, type
       FROM tickets
       WHERE current_admin_type = $1
         AND status = 'open'
         AND created_at > NOW() - INTERVAL '48 hours'
       ORDER BY created_at DESC
       LIMIT 15`,
      [adminType]
    );

    for (const row of newTickets) {
      notifications.push({
        id: `admin-ticket-new-${row.id}`,
        type: 'info',
        title: 'New Ticket in Your Queue',
        message: `"${row.title}" — ${row.type} ticket waiting for action.`,
        link: '/tickets',
        createdAt: row.created_at,
      });
    }

    // 2. Tickets transferred to them (from ticket_history, last 24 hours)
    const { rows: transfers } = await pool.query(
      `SELECT th.created_at, t.title, t.id
       FROM ticket_history th
       JOIN tickets t ON th.ticket_id = t.id
       WHERE th.event_type = 'transferred'
         AND th.to_admin_type = $1
         AND th.created_at > NOW() - INTERVAL '24 hours'
       ORDER BY th.created_at DESC
       LIMIT 10`,
      [adminType]
    );

    for (const row of transfers) {
      notifications.push({
        id: `admin-ticket-transfer-${row.id}-${row.created_at}`,
        type: 'warning',
        title: 'Ticket Transferred to You',
        message: `Ticket "${row.title}" has been transferred to your queue.`,
        link: '/tickets',
        createdAt: row.created_at,
      });
    }
  }

  // 3. New onboarding requests pending (last 7 days) — all admins see this
  const { rows: onboarding } = await pool.query(
    `SELECT id, new_hire_name, created_at
     FROM onboarding_requests
     WHERE status = 'pending'
       AND created_at > NOW() - INTERVAL '7 days'
     ORDER BY created_at DESC
     LIMIT 10`
  );

  for (const row of onboarding) {
    notifications.push({
      id: `admin-onboarding-${row.id}`,
      type: 'info',
      title: 'New Onboarding Request',
      message: `New hire "${row.new_hire_name}" needs hardware to be arranged.`,
      link: '/onboarding',
      createdAt: row.created_at,
    });
  }

  return notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

/**
 * Returns notifications for an HR role user.
 * Shows status updates on onboarding requests they submitted.
 */
const getHrNotifications = async (employeeId) => {
  const notifications = [];

  // 1. Status updates on their onboarding requests (last 7 days)
  const { rows: updates } = await pool.query(
    `SELECT id, new_hire_name, status, updated_at
     FROM onboarding_requests
     WHERE requested_by = $1
       AND status IN ('in_progress', 'arranged', 'completed', 'cancelled')
       AND updated_at > NOW() - INTERVAL '7 days'
     ORDER BY updated_at DESC
     LIMIT 15`,
    [employeeId]
  );

  const statusMessages = {
    in_progress: { title: 'Onboarding In Progress', type: 'info' },
    arranged:    { title: 'Hardware Arranged', type: 'success' },
    completed:   { title: 'Onboarding Completed', type: 'success' },
    cancelled:   { title: 'Onboarding Cancelled', type: 'warning' },
  };

  for (const row of updates) {
    const meta = statusMessages[row.status] || { title: 'Onboarding Updated', type: 'info' };
    notifications.push({
      id: `hr-onboarding-${row.id}-${row.status}`,
      type: meta.type,
      title: meta.title,
      message: `Onboarding for "${row.new_hire_name}" is now ${row.status.replace('_', ' ')}.`,
      link: '/onboarding',
      createdAt: row.updated_at,
    });
  }

  // 2. Their own pending requests that are still not actioned (reminder)
  const { rows: pending } = await pool.query(
    `SELECT id, new_hire_name, created_at
     FROM onboarding_requests
     WHERE requested_by = $1
       AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 5`,
    [employeeId]
  );

  for (const row of pending) {
    notifications.push({
      id: `hr-onboarding-pending-${row.id}`,
      type: 'warning',
      title: 'Onboarding Awaiting Action',
      message: `Request for "${row.new_hire_name}" is still pending admin review.`,
      link: '/onboarding',
      createdAt: row.created_at,
    });
  }

  return notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

/**
 * Main entry point — routes to correct function by role.
 */
const getNotifications = async (user) => {
  if (user.role === 'employee') {
    return getEmployeeNotifications(user.id);
  }
  if (user.role === 'admin') {
    return getAdminNotifications(user);
  }
  if (user.role === 'hr') {
    return getHrNotifications(user.id);
  }
  return [];
};

module.exports = { getNotifications };
