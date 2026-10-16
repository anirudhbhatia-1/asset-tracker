# AssetTrack UI improvement plan

From a review of `client/src` on 16 Oct 2026. The shared UI kit (Modal, Button, SegmentedControl, StatusPill, tokens) is solid; most problems are screens re-building the same pieces by hand, plus missing basics on the tickets queue.

Suggested order: the quick wins first, then M1–M2 (the ticket flow touches every role), then L1, since a fuller component kit makes the rest cheaper and keeps it consistent.

## Quick wins (under an hour each)

| # | What | Where | Who it helps |
|---|------|-------|--------------|
| Q1 | Show **who raised** a ticket in the ticket window. Use one ticket reference everywhere: `TK-0606`, not `#606` on some screens. Make "Related device" a link. | `TicketDetailsModal.jsx`, `Tickets.jsx`, `utils/ticketMeta.js` | IT/HR admins |
| Q2 | One status badge (`TicketStatusBadge`) everywhere. Make **Open blue, not red**, so red keeps meaning urgent. Add a shared `PriorityBadge` (also shown on the employee's ticket list). Neutral "issue/request" pill. | `EmployeeDashboard.jsx`, `TicketDetailsModal.jsx`, `Tickets.jsx`, `Dashboard.jsx` | Everyone |
| Q3 | Raise Ticket form: fields in a natural order (type → title → device/need → details → priority). Department picked automatically, with a one-line hint per queue. Add a priority hint: "Urgent = you can't work; escalates automatically". | `CreateTicketModal.jsx` | ~100 employees |
| Q4 | "Export Excel" ignores the filters on screen. Export what's shown, or label the button "Export all". | `Inventory.jsx` | IT, Directors |
| Q5 | Plain language: "Lifecycle & Operational Controls" → "Actions"; "Confirm Decommission & Retirement" → "Retire asset"; "Executive Super-Dashboard" → "Overview"; "personnel" → "people". | `LifecycleActions.jsx`, `DirectorDashboard.jsx`, `Employees.jsx`, `HrDashboard.jsx` | HR, employees |
| Q6 | HR dashboard: show 5 requests (upcoming joiners first), so "View all" means something. Rename "Pending" to "Open". | `HrDashboard.jsx` | HR |
| Q7 | IT dashboard: low-stock rows link to Inventory. "Open tickets" includes in-progress tickets, sorted urgent and oldest first. | `Dashboard.jsx` | IT |
| Q8 | Phone bottom bar: put Scanner and Tickets before Onboarding/Offboarding for IT. | `Sidebar.jsx` | IT on phones |
| Q9 | Swap about 40 hand-made buttons for `<Button>`: same height, radius, loading state and 44 px touch size. Fix the invisible "ghost" hover. | many pages, `ui/Button.jsx`, `ui/EmptyState.jsx` | Everyone |
| Q10 | One set of filter tab names (Open / Done / All), defaulting to Open on Tickets, Onboarding and Offboarding. | `Tickets.jsx`, `Onboarding.jsx`, `Offboarding.jsx`, `HrDashboard.jsx` | HR, IT |
| Q11 | Accessibility and dark mode:<br>• spinner colour token<br>• no text below 11 px<br>• no faded text on closed items<br>• real buttons/links in clickable table rows<br>• modal titles as `h2` | `ui/Spinner.jsx`, pills, `Tickets.jsx`, `Onboarding.jsx`, `ui/Modal.jsx` | Everyone |

## Medium (about half a day each)

- **M1. Tickets queue:**
  - Add search, a priority filter, sortable columns (default: urgent and oldest first) and a Priority column.
  - Keep the filters in the URL, so dashboard numbers ("IT: 7") open exactly those tickets.
- **M2. Ticket window for people working tickets:**
  - Move it onto the shared `Modal`: wider on desktop, full screen on phones.
  - Put the actions before the long timeline, and keep Save/Transfer in a sticky footer.
- **M3. One shared "My assets" card** for the Employee and HR dashboards:
  - Pin "Awaiting your confirmation" tickets at the top.
  - Use proper empty states with a "Raise a ticket" button.
  - No scroll-inside-scroll on phones.
- **M4. Asset page:**
  - Add a sticky header with name, serial, status, holder and the main Assign/Return buttons; put Retire/Delete in a "⋯" menu.
  - Confirm deletion by typing the serial, not the long name.
- **M5. One shared return dialog** (with a condition note) for the asset page, Scanner and bulk return, plus an 8-second **Undo** after assign/return.
- **M6. Notifications:**
  - An unread count on the bell, and new items highlighted until the panel closes.
  - A red "danger" style for escalated urgent tickets.
  - Read state kept on the server, so it follows the person across devices.
- **M7. Inventory filters:**
  - Show Company/Client as a removable chip.
  - Switch categories to a dropdown when there are more than ~8, and add an Assigned/Unassigned filter.
  - Keep the sort in the URL and drop the emoji from the options.
- **M8. Scanner on phones:**
  - Bring the result into view (bottom sheet) with the main action large.
  - Add a "Scan next" button that keeps the camera running.
- **M9. Onboarding/Offboarding on phones:**
  - Card lists like Tickets already has.
  - A "joining in N days" signal, plus name search and sort by date.

## Larger (several days each)

- **L1. Complete the component kit:**
  - A single `Pill`; `Field`/`Input`/`Select` with hint and error text; `Card` with a header.
  - One tabs style, `PageHeader` everywhere, and a `DataTable` with sorting, skeleton, empty state and phone cards.
  - It replaces six differently padded tables and dozens of copy-pasted badge and input styles.
- **L2. Tickets as a real work queue:**
  - "Claim" a ticket and an "Assigned to me" view.
  - An escalation/SLA indicator, bulk close/transfer and saved views.
  - Canned resolution notes, and a list-plus-detail layout on desktop.
- **L3. Director overview:**
  - Replace the "Role Matrix Builder" hero with numbers you can act on, each opening the filtered list:
    - urgent/escalated tickets
    - warranties ending within 30 days
    - overdue offboarding collections
    - joiners this week
  - Give roles one name and one home.
  - Add export and date presets to Access history.
- **L4. Stocktake mode in the Scanner:** scan everything at a location, then see which expected assets weren't found, with an export.
