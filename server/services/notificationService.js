const { pool } = require('../db');
const { hasPermission } = require('../middleware/validateSession');

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
      link: `/tickets?ticket=${row.ticket_id}`,
      createdAt: row.created_at,
    });
  }

  // 2. Tickets that are resolved but not yet confirmed by employee (still need action)
  const { rows: pendingConfirm } = await pool.query(
    `SELECT id, title, updated_at FROM tickets
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
      link: `/tickets?ticket=${row.id}`,
      // When it was resolved, so marking it read sticks across refreshes.
      createdAt: row.updated_at,
    });
  }

  // 3. Assets assigned to them in the last 7 days
  const { rows: assetEvents } = await pool.query(
    `SELECT ah.id, ah.event_type, ah.event_at, a.name as asset_name
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
      id: `asset-history-${row.id}`,
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
        link: `/tickets?ticket=${row.id}`,
        createdAt: row.created_at,
      });
    }

    // 2. Tickets transferred to them (from ticket_history, last 24 hours)
    const { rows: transfers } = await pool.query(
      `SELECT th.created_at, th.performed_by, t.title, t.id
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
        title: row.performed_by ? 'Ticket Transferred to You' : 'Ticket moved to you automatically',
        message: row.performed_by
          ? `Ticket "${row.title}" has been transferred to your queue.`
          : `"${row.title}" wasn't picked up by the other team within 10 minutes, so it was moved to your queue.`,
        link: `/tickets?ticket=${row.id}`,
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
      link: `/onboarding?request=${row.id}`,
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
      link: `/onboarding?request=${row.id}`,
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
      link: `/onboarding?request=${row.id}`,
      createdAt: row.created_at,
    });
  }

  return notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

/**
 * Exit (offboarding) notifications:
 * - collectors: exits whose last day is within a week (or past) with assets still out;
 * - whoever started an exit: when it is completed;
 * - the departing employee: which assets to hand back, and by when.
 */
const getOffboardingNotifications = async (user, { collector, requester, accessManager }) => {
  const notifications = [];

  if (collector) {
    const { rows } = await pool.query(
      `SELECT o.id, o.last_working_date, o.created_at, e.name, COUNT(a.id) AS pending
       FROM offboarding_requests o
       JOIN employees e ON e.id = o.employee_id
       JOIN assets a ON a.assigned_to = o.employee_id AND a.status = 'in-use'
       WHERE o.status IN ('pending', 'in_progress')
         AND o.last_working_date <= CURRENT_DATE + 7
       GROUP BY o.id, e.name
       ORDER BY o.last_working_date
       LIMIT 10`
    );
    for (const row of rows) {
      notifications.push({
        id: `offboarding-collect-${row.id}`,
        type: 'warning',
        title: 'Collect Assets Before Exit',
        message: `${row.name} leaves on ${row.last_working_date}; ${row.pending} asset(s) still to collect.`,
        link: `/offboarding?request=${row.id}`,
        createdAt: row.created_at,
      });
    }
  }

  if (requester) {
    const { rows } = await pool.query(
      `SELECT o.id, o.completed_at, e.name
       FROM offboarding_requests o JOIN employees e ON e.id = o.employee_id
       WHERE o.requested_by = $1 AND o.status = 'completed'
         AND o.completed_at > NOW() - INTERVAL '7 days'
       ORDER BY o.completed_at DESC LIMIT 10`,
      [user.id]
    );
    for (const row of rows) {
      notifications.push({
        id: `offboarding-completed-${row.id}`,
        type: 'success',
        title: 'Offboarding Completed',
        message: `All assets from ${row.name} are accounted for.`,
        link: `/offboarding?request=${row.id}`,
        createdAt: row.completed_at,
      });
    }
  }

  // Exits completed while the person can still sign in (the completer could
  // not, or chose not to, revoke access).
  if (accessManager) {
    const { rows } = await pool.query(
      `SELECT o.id, o.completed_at, e.name
       FROM offboarding_requests o JOIN employees e ON e.id = o.employee_id
       WHERE o.status = 'completed' AND o.completed_at > NOW() - INTERVAL '30 days'
         AND e.deleted_at IS NULL
         AND (e.password_hash IS NOT NULL OR e.google_id IS NOT NULL OR e.role IS NOT NULL)
       ORDER BY o.completed_at DESC LIMIT 10`
    );
    for (const row of rows) {
      notifications.push({
        id: `offboarding-access-${row.id}`,
        type: 'warning',
        title: 'Login Still Active After Exit',
        message: `${row.name} has left but can still sign in. Revoke their access from Employees.`,
        link: '/employees',
        createdAt: row.completed_at,
      });
    }
  }

  const { rows: own } = await pool.query(
    `SELECT o.id, o.last_working_date, o.created_at, COUNT(a.id) AS pending
     FROM offboarding_requests o
     JOIN assets a ON a.assigned_to = o.employee_id AND a.status = 'in-use'
     WHERE o.employee_id = $1 AND o.status IN ('pending', 'in_progress')
     GROUP BY o.id`,
    [user.id]
  );
  for (const row of own) {
    notifications.push({
      id: `offboarding-own-${row.id}`,
      type: 'info',
      title: 'Return Company Assets',
      message: `Please hand back ${row.pending} asset(s) before your last working day, ${row.last_working_date}.`,
      link: '/',
      createdAt: row.created_at,
    });
  }

  return notifications;
};

/**
 * Main entry point — routes to correct function by permissions.
 */
/**
 * Escalations of High/Urgent tickets nobody picked up (see
 * ticketEscalationService): Directors hear about tickets two queues ignored;
 * the employee hears when HR didn't pick theirs up. Shown until the ticket
 * is no longer open.
 */
const getEscalationNotifications = async (user, isDirector) => {
  const notifications = [];
  if (isDirector) {
    const { rows } = await pool.query(
      `SELECT t.id, t.title, t.priority, t.escalated_at, e.name AS employee_name
       FROM tickets t LEFT JOIN employees e ON e.id = t.employee_id
       WHERE t.escalation_stage = 'directors_alerted' AND t.status = 'open'
         AND t.current_admin_type IN ('it', 'hardware')
       ORDER BY t.escalated_at DESC LIMIT 10`
    );
    for (const row of rows) {
      notifications.push({
        id: `ticket-escalated-${row.id}`,
        type: 'danger',
        title: `${row.priority === 'urgent' ? 'Urgent' : 'High priority'} ticket not picked up`,
        message: `"${row.title}" from ${row.employee_name || 'an employee'} was moved between IT Admin and Admin and still nobody has started on it.`,
        link: `/tickets?ticket=${row.id}`,
        createdAt: row.escalated_at,
      });
    }
  }
  const { rows: own } = await pool.query(
    `SELECT id, title, escalated_at FROM tickets
     WHERE employee_id = $1 AND escalation_stage = 'employee_notified' AND status = 'open'
       AND current_admin_type = 'hr'
     ORDER BY escalated_at DESC LIMIT 5`,
    [user.id]
  );
  for (const row of own) {
    notifications.push({
      id: `ticket-hr-unanswered-${row.id}`,
      type: 'warning',
      title: 'HR hasn\'t picked up your ticket yet',
      message: `Nobody in HR has started on "${row.title}" yet. Please contact management directly about it.`,
      link: `/tickets?ticket=${row.id}`,
      createdAt: row.escalated_at,
    });
  }
  return notifications;
};

const getNotifications = async (user) => {
  let allNotifications = [];
  const isDirector = user.role === 'director' || user.isDirector;

  // Director sees all queues combined
  if (isDirector) {
    const [adminNotifs, hrNotifs, empNotifs] = await Promise.all([
      getAdminNotifications(user),
      getHrNotifications(user.id),
      getEmployeeNotifications(user.id),
    ]);
    allNotifications = [...adminNotifs, ...hrNotifs, ...empNotifs];
  } else {
    if (hasPermission(user, 'onboarding:fulfill')) {
      const adminNotifs = await getAdminNotifications(user);
      allNotifications = allNotifications.concat(adminNotifs);
    }
    if (hasPermission(user, 'onboarding:create') && !hasPermission(user, 'onboarding:fulfill')) {
      const hrNotifs = await getHrNotifications(user.id);
      allNotifications = allNotifications.concat(hrNotifs);
    }
    // All users get their own employee notifications (own tickets, own assets)
    const empNotifs = await getEmployeeNotifications(user.id);
    allNotifications = allNotifications.concat(empNotifs);
  }

  allNotifications = allNotifications.concat(await getEscalationNotifications(user, isDirector));

  allNotifications = allNotifications.concat(await getOffboardingNotifications(user, {
    collector: hasPermission(user, 'offboarding:collect'),
    requester: hasPermission(user, 'offboarding:create'),
    accessManager: hasPermission(user, 'employees:grant-access'),
  }));

  // Deduplicate by ID
  const unique = Array.from(new Map(allNotifications.map(item => [item.id, item])).values());
  return unique.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

module.exports = { getNotifications };
