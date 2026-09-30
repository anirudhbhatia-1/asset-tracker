// Calendar dates are business dates in the company's timezone (India), not UTC:
// before 05:30 IST, toISOString() would still report yesterday.
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

const todayISO = (now = new Date(), timeZone = APP_TIMEZONE) => (
  // en-CA formats as YYYY-MM-DD.
  now.toLocaleDateString('en-CA', { timeZone })
);

module.exports = { APP_TIMEZONE, todayISO };
