// Onboarding request workflow, mirrored from the server
// (onboardingService.js ALLOWED_REQUEST_STATUS_CHANGES); completed is final.

export const ONBOARDING_STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In Progress',
  arranged: 'Arranged',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const ALLOWED_ONBOARDING_STATUS_CHANGES = {
  pending: ['in_progress', 'arranged', 'cancelled'],
  in_progress: ['pending', 'arranged', 'cancelled'],
  arranged: ['in_progress', 'completed', 'cancelled'],
  completed: [],
  cancelled: ['pending'],
};

/** The current status first, then every status it may move to. */
export const getOnboardingStatusOptions = (currentStatus) => (
  currentStatus
    ? [currentStatus, ...(ALLOWED_ONBOARDING_STATUS_CHANGES[currentStatus] || [])]
    : []
);

/**
 * Assets that can fulfil an onboarding item: in-stock company assets of the
 * item's category. Reservations by other requests are checked by the server.
 */
export const getFulfilmentCandidates = (assets, item) => (
  (Array.isArray(assets) ? assets : []).filter(asset => (
    asset.status === 'available'
    && asset.assetType !== 'client'
    && (!item?.category_id || Number(asset.categoryId) === Number(item.category_id))
  ))
);
