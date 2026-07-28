import { format, parseISO, isValid } from 'date-fns';

/**
 * Formats a numeric value into a localized currency string (e.g. $1,250.00).
 * Falls back to $0.00 for invalid inputs.
 */
export function formatCurrency(amount, currency = 'USD') {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '$0.00';
  }
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch (e) {
    return `$${Number(amount).toFixed(2)}`;
  }
}

/**
 * Formats an ISO date string or Date object into a readable date string (default: MMM dd, yyyy).
 * Handles SQLite strings safely.
 */
export function formatDate(dateInput, patternStr = 'MMM dd, yyyy') {
  if (!dateInput) return 'N/A';
  try {
    let dateObj;
    if (dateInput instanceof Date) {
      dateObj = dateInput;
    } else if (typeof dateInput === 'string') {
      const cleanStr = dateInput.replace(' ', 'T');
      dateObj = new Date(cleanStr);
    } else {
      return 'Invalid Date';
    }

    if (!isValid(dateObj)) return 'Invalid Date';
    return format(dateObj, patternStr);
  } catch (e) {
    return 'Invalid Date';
  }
}

/**
 * Formats a date with time (e.g. MMM dd, yyyy HH:mm).
 */
export function formatDateTime(dateInput) {
  return formatDate(dateInput, 'MMM dd, yyyy HH:mm');
}

/**
 * Computes warranty status based on the expiry date string.
 * Returns: 'in warranty', 'expiring soon', 'expired', or 'no warranty data'
 */
export function getWarrantyStatus(warrantyExpiryDate) {
  if (!warrantyExpiryDate) return 'no warranty data';
  
  const expiry = new Date(warrantyExpiryDate);
  if (!isValid(expiry)) return 'no warranty data';
  
  // Set times to midnight for clean day-diff
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  
  const diffTime = expiry - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return 'expired';
  } else if (diffDays <= 60) {
    return 'expiring soon';
  } else {
    return 'in warranty';
  }
}
