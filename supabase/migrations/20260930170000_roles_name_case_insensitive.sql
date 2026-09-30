-- Role names are looked up case-insensitively ("Director", "director"), so
-- two roles must never differ only by case.
CREATE UNIQUE INDEX IF NOT EXISTS roles_name_lower_key ON roles (LOWER(name));
