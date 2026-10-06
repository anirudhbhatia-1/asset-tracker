/**
 * Short label for offboarding checklist progress (from getChecklistProgress).
 * "Collected" is only claimed for items that came back: when some are
 * missing the label says so, e.g. "3 returned, 1 missing of 4". List rows
 * only know how many items are still pending, so they say "resolved".
 */
export function describeChecklistProgress(progress) {
  const { total = 0, returned, missing, collected = 0 } = progress || {};
  if (total === 0) return 'No assets';
  if (returned == null || missing == null) return `${collected} of ${total} resolved`;
  if (missing > 0) return `${returned} returned, ${missing} missing of ${total}`;
  return `${returned} of ${total} collected`;
}
