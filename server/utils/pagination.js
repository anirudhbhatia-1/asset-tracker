// Optional limit/offset paging for list endpoints. Without ?limit or
// ?offset a list endpoint returns everything, exactly as before.
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;

const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 });

// Returns null (no paging requested) or { limit, offset }.
const parsePagination = (query = {}) => {
  const { limit, offset } = query;
  if (limit === undefined && offset === undefined) return null;
  if (Array.isArray(limit) || Array.isArray(offset)) throw badRequest('limit and offset may be given only once');
  if (limit !== undefined && !/^\d{1,6}$/.test(String(limit))) throw badRequest('limit must be a whole number');
  if (offset !== undefined && !/^\d{1,9}$/.test(String(offset))) throw badRequest('offset must be a whole number');
  const parsedLimit = limit === undefined ? DEFAULT_PAGE_SIZE : Number(limit);
  if (parsedLimit < 1 || parsedLimit > MAX_PAGE_SIZE) throw badRequest(`limit must be between 1 and ${MAX_PAGE_SIZE}`);
  return { limit: parsedLimit, offset: offset === undefined ? 0 : Number(offset) };
};

// Runs `sql` (a SELECT whose select list ends where the {{total}} marker
// sits, and which ends with its ORDER BY) for one page. The total comes from
// a window count so a page needs a single query; a page past the end
// falls back to counting.
const queryPage = async (executor, sql, params, page) => {
  const pagedSql = `${sql.replace('{{total}}', ', COUNT(*) OVER () AS __total_count')} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const { rows } = await executor.query(pagedSql, [...params, page.limit, page.offset]);
  let total;
  if (rows.length > 0) {
    total = Number(rows[0].__total_count);
  } else {
    const countSql = `SELECT COUNT(*)::int AS count FROM (${sql.replace('{{total}}', '')}) counted`;
    total = (await executor.query(countSql, params)).rows[0].count;
  }
  // eslint-disable-next-line no-param-reassign, no-underscore-dangle
  rows.forEach((row) => { delete row.__total_count; });
  return { rows, total };
};

module.exports = { parsePagination, queryPage, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE };
