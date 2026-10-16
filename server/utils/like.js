// Treat %, _ and \ in the user's text literally in LIKE/ILIKE patterns
// (backslash is Postgres's default LIKE escape character).
const escapeLike = (text) => text.replace(/[\\%_]/g, (ch) => `\\${ch}`);

module.exports = { escapeLike };
