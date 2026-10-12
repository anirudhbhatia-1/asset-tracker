# AssetTrack docs

The repository [README.md](../README.md) is the source of truth for setup,
configuration, the security model and the API. Start there.

## Operations (current)

| Doc | What it covers |
|---|---|
| [RUNBOOK.md](RUNBOOK.md) | Deploy and rollback, which build is live, VM rebuild, backups and restore tests, rotating secrets, monitoring, Supabase settings checklist |
| [PRIVACY_AND_RETENTION.md](PRIVACY_AND_RETENTION.md) | **Draft** DPDP Act notice: employee data stored, who can see/export it, retention proposal (for HR/legal review) |
| [../production_checklist.md](../production_checklist.md) | Checklist to work through before each production deploy |

## Guides and specs

These describe intent and design; where they disagree with the code, the code
and the root README win.

| Doc | What it covers |
|---|---|
| [ARCHITECTURE_GUIDE.md](ARCHITECTURE_GUIDE.md) | Technical architecture overview |
| [WORKFLOW_GUIDE.md](WORKFLOW_GUIDE.md) | Workflows and features, end to end |
| [OPTION_2_WORKFLOW_SPEC.md](OPTION_2_WORKFLOW_SPEC.md) | Dynamic RBAC and custom roles |
| [ROLE_MANAGEMENT_DIRECTOR_SPEC.md](ROLE_MANAGEMENT_DIRECTOR_SPEC.md) | Director (root) role and RBAC design |
| [SCALING_GUIDE.md](SCALING_GUIDE.md) | Growing from 1 to 1,000 users |
| [COST_ESTIMATION_GUIDE.md](COST_ESTIMATION_GUIDE.md) | Cloud vs. bare-metal cost estimates |

## Historical planning documents

Written for the original plan; parts no longer match the code (e.g. SQLite,
in-memory sessions or JWT). Kept for context.

| Doc | What it covers |
|---|---|
| [AssetTrack_PRD.md](AssetTrack_PRD.md) | Product requirements |
| [AssetTrack_Architecture.md](AssetTrack_Architecture.md) | Original technical architecture |
| [AssetTrack_Design.md](AssetTrack_Design.md) | UI/UX design |
| [AssetTrack_Rules.md](AssetTrack_Rules.md) | Engineering rules and standards |
| [AssetTrack_Phases.md](AssetTrack_Phases.md) | Delivery phases |
| [AssetTrack_User_Flow_Guide.md](AssetTrack_User_Flow_Guide.md) | User flows and feature specification |
| [AssetTrack_RBAC_Risk_Audit.md](AssetTrack_RBAC_Risk_Audit.md) | Dynamic RBAC risk audit |
| [AssetTrack_Memory.md](AssetTrack_Memory.md) | Project context log kept during early development |
| [migration_notes.md](migration_notes.md) | `inventory:*` → `assets:*` permission key audit |
| [LEARN.md](LEARN.md) | Beginner's learning guide to the codebase |
