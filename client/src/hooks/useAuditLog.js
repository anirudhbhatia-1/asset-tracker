import { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { getAuditEvents } from '../api/auditApi';
import { queryKey } from '../utils/queryCache';
import { eventInGroup, eventTypeParamFor } from '../utils/auditText';
import useQuery, { errorMessageOf } from './useQuery';

export const AUDIT_KEY = 'audit';
export const AUDIT_PAGE_SIZE = 50;
const EMPTY = [];

const pageOf = (res) => {
  const body = res?.data || {};
  return {
    rows: Array.isArray(body.data) ? body.data : [],
    nextCursor: body.nextCursor ?? null,
  };
};

/**
 * Access history, newest first. The first page per filter set comes from the
 * shared query cache (instant on revisit, refreshed quietly); "Load more"
 * pages are kept here and dropped whenever the filters or the first page
 * change.
 *
 * filters: { group, from, to, q }
 */
// `enabled: false` (e.g. while the date range is the wrong way round) sends
// no request.
export default function useAuditLog({ group = 'all', from = '', to = '', q = '', enabled = true } = {}) {
  const params = useMemo(() => ({
    eventType: eventTypeParamFor(group),
    from: from || undefined,
    to: to || undefined,
    q: q.trim() || undefined,
    limit: AUDIT_PAGE_SIZE,
  }), [group, from, to, q]);
  const key = queryKey(AUDIT_KEY, params);

  const { data, loading, refreshing, isPlaceholder, error, refetch } = useQuery(
    key,
    () => getAuditEvents(params).then(pageOf),
    { keepPrevious: true, enabled },
  );

  // Extra pages belong to one first page; a new first page (other filters,
  // or a refresh) starts over.
  const [more, setMore] = useState({ base: null, rows: EMPTY, nextCursor: undefined });
  const [loadingMore, setLoadingMore] = useState(false);
  const extra = more.base === data ? more : { rows: EMPTY, nextCursor: undefined };
  // While other filters load, the rows shown are the previous filters' ones:
  // their cursor doesn't apply.
  const nextCursor = isPlaceholder ? null : (extra.nextCursor !== undefined ? extra.nextCursor : data?.nextCursor ?? null);

  // The server filters by eventType; the group check here only guards
  // against a server that ignores the parameter.
  const events = useMemo(() => {
    const all = [...(data?.rows || EMPTY), ...extra.rows];
    const seen = new Set();
    return all.filter((row) => {
      if (!row || seen.has(row.id)) return false;
      seen.add(row.id);
      return eventInGroup(row.eventType, group);
    });
  }, [data, extra.rows, group]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const base = data;
    setLoadingMore(true);
    try {
      const page = pageOf(await getAuditEvents({ ...params, before: nextCursor }));
      setMore((prev) => {
        const prevRows = prev.base === base ? prev.rows : EMPTY;
        return { base, rows: [...prevRows, ...page.rows], nextCursor: page.nextCursor };
      });
    } catch (err) {
      toast.error(errorMessageOf(err, 'Failed to load more history'));
    } finally {
      setLoadingMore(false);
    }
  }, [data, loadingMore, nextCursor, params]);

  return {
    events,
    loading,
    refreshing,
    loadingMore,
    hasMore: Boolean(nextCursor),
    error: errorMessageOf(error, 'Failed to load access history'),
    refresh: refetch,
    loadMore,
  };
}
