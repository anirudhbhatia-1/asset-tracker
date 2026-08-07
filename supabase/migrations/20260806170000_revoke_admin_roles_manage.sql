-- Migration: Revoke roles:manage from Admin (role_id = 2)
-- Per OPTION_2_WORKFLOW_SPEC.md §3 Permission Hierarchy Matrix, roles:manage is Director-only.
BEGIN;

DELETE FROM role_permissions
WHERE role_id = 2 
  AND permission_id = (SELECT id FROM permissions WHERE key = 'roles:manage');

COMMIT;
