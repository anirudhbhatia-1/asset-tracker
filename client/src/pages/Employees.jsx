import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useEmployees from '../hooks/useEmployees';
import EmployeeAssetDrawer from '../components/employees/EmployeeAssetDrawer';
import EmployeeAccessModal from '../components/employees/EmployeeAccessModal';
import AddEmployeeModal from '../components/forms/AddEmployeeModal';
import RoleManagementModal from '../components/forms/RoleManagementModal';
import EditEmployeeModal from '../components/forms/EditEmployeeModal';
import BulkAssignModal from '../components/forms/BulkAssignModal';
import StartOffboardingModal from '../components/offboarding/StartOffboardingModal';
import { useOffboarding } from '../hooks/useOffboarding';
import { formatDate } from '../utils/formatters';
import RoleManagementPanel from '../components/dashboard/RoleManagementPanel';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import { Users, Search, UserPlus, RefreshCw, Archive, Filter, CheckCircle2, XCircle, ShieldCheck, Package, KeyRound, UserX, UserMinus, LogOut, Home, Shuffle, MapPin, Pencil } from 'lucide-react';
import { onActivateKey } from '../utils/a11y';
import { WORK_MODES, matchesWorkModeFilter } from '../utils/workMode';
import { getInitials } from '../utils/initials';
import { distinctDepartments } from '../utils/departments';
import { roleLabel } from '../utils/roleLabel';
import RowActionsMenu from '../components/employees/RowActionsMenu';
const ACCESS_FILTERS = ['All', 'With Access', 'No Access'];
const WORK_MODE_FILTERS = [{ value: 'all', label: 'All' }, ...WORK_MODES];
// Lower-priority columns, shown from lg / xl so the table fits beside the
// sidebar; below that their values sit under the employee's email.
const FROM_XL = 'hidden xl:table-cell';
const FROM_LG = 'hidden lg:table-cell';

// Remote and Hybrid get a small badge next to the name; Office has none.
function WorkModeBadge({ mode }) {
  if (mode !== 'remote' && mode !== 'hybrid') return null;
  const Icon = mode === 'remote' ? Home : Shuffle;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-info-blue bg-info-blue/10 border border-info-blue/20 px-2 py-0.5 rounded-full whitespace-nowrap">
      <Icon className="w-3 h-3" aria-hidden="true" />
      {mode === 'remote' ? 'Remote' : 'Hybrid'}
    </span>
  );
}

export default function Employees() {
  const { user, hasPermission } = useAuth();
  const canGrantAccess = hasPermission('employees:grant-access');
  const canManageRoles = hasPermission('roles:manage');
  const canCreate = hasPermission('employees:create');
  const canEdit = hasPermission('employees:manage');
  const canAssignAssets = hasPermission('employees:assign-assets');
  const canStartOffboarding = hasPermission('offboarding:create');
  const canReadOffboarding = hasPermission('offboarding:read');
  const navigate = useNavigate();
  const { createRequest: createOffboarding } = useOffboarding();
  const { employees, loading, refreshing, error, refresh, addEmployee, updateEmployee, changeRole, grantAccess, grantGoogleAccess, changeRoleInline, resetPassword, revokeAccess } = useEmployees();
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' | 'roles'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedAccess, setSelectedAccess] = useState('All');
  const [selectedWorkMode, setSelectedWorkMode] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [bulkAssignTarget, setBulkAssignTarget] = useState(null);
  // { mode: 'reset' | 'revoke', employee } for the access action dialog.
  const [accessAction, setAccessAction] = useState(null);
  // Employee whose exit is being started from their row.
  const [offboardTarget, setOffboardTarget] = useState(null);

  useEffect(() => {
    if (!canManageRoles && activeTab === 'roles') setActiveTab('directory');
  }, [canManageRoles, activeTab]);

  const safeEmployees = useMemo(() => (Array.isArray(employees) ? employees : []), [employees]);
  // Department chips come from the people actually in the directory.
  const departmentFilters = useMemo(() => ['All', ...distinctDepartments(safeEmployees)], [safeEmployees]);

  // The control that opened a dialog/drawer. Focus goes back to it on close
  // without scrolling the (horizontally scrollable) table.
  const returnFocusRef = useRef(null);
  const rememberFocus = (el) => { returnFocusRef.current = el || null; };
  const restoreFocus = () => {
    const el = returnFocusRef.current;
    returnFocusRef.current = null;
    if (el && document.contains(el)) el.focus({ preventScroll: true });
  };

  const filteredEmployees = useMemo(() => {
    return safeEmployees.filter((emp) => {
      // Department filter
      if (selectedDepartment !== 'All' && emp.department !== selectedDepartment) return false;
      
      // Access filter
      if (selectedAccess === 'With Access' && !emp.hasLogin) return false;
      if (selectedAccess === 'No Access' && emp.hasLogin) return false;

      // Work mode filter
      if (!matchesWorkModeFilter(emp, selectedWorkMode)) return false;

      // Search term
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        (emp.name && emp.name.toLowerCase().includes(q)) ||
        (emp.email && emp.email.toLowerCase().includes(q)) ||
        (emp.department && emp.department.toLowerCase().includes(q)) ||
        (emp.location && emp.location.toLowerCase().includes(q))
      );
    });
  }, [safeEmployees, searchTerm, selectedDepartment, selectedAccess, selectedWorkMode]);

  const openEdit = (emp) => {
    if (!canEdit) return;
    setSelectedEmployee(emp);
    setIsEditModalOpen(true);
  };

  const handleRowClick = (e, emp) => {
    if (!canEdit) return;
    rememberFocus(e.currentTarget);
    openEdit(emp);
  };

  const handleAssetsClick = (e, emp) => {
    e.stopPropagation();
    rememberFocus(e.currentTarget);
    setSelectedEmployee(emp);
    setIsDrawerOpen(true);
  };

  const openGrantAccess = (emp) => {
    setSelectedEmployee(emp);
    setIsRoleModalOpen(true);
  };

  const handleGrantAccessClick = (e, emp) => {
    e.stopPropagation();
    rememberFocus(e.currentTarget);
    openGrantAccess(emp);
  };

  const openAccessAction = (mode, emp) => {
    setAccessAction({ mode, employee: emp });
  };

  const openBulkAssign = (emp) => {
    setBulkAssignTarget(emp);
    setIsBulkAssignOpen(true);
  };

  // Everything but "Assets" lives in the row's ⋯ menu, with the same
  // permission checks the separate buttons had. The menu returns focus to its
  // own button before running an item, so remember that button for dialogs.
  const rowMenuItems = (emp) => {
    const isSelf = String(emp.id) === String(user?.id);
    const withFocus = (fn) => () => { rememberFocus(document.activeElement); fn(); };
    return [
      canAssignAssets && {
        key: 'assign',
        label: 'Assign Hardware',
        ariaLabel: `Assign hardware to ${emp.name}`,
        icon: Package,
        onSelect: withFocus(() => openBulkAssign(emp)),
      },
      canEdit && {
        key: 'edit',
        label: 'Edit details',
        ariaLabel: `Edit details for ${emp.name}`,
        icon: Pencil,
        onSelect: withFocus(() => openEdit(emp)),
      },
      canGrantAccess && !emp.hasLogin && {
        key: 'grant',
        label: 'Grant Access',
        ariaLabel: `Grant login access to ${emp.name}`,
        icon: ShieldCheck,
        onSelect: withFocus(() => openGrantAccess(emp)),
      },
      canGrantAccess && emp.hasLogin && {
        key: 'reset',
        label: 'Reset Password',
        ariaLabel: `Reset password for ${emp.name}`,
        icon: KeyRound,
        onSelect: withFocus(() => openAccessAction('reset', emp)),
      },
      canStartOffboarding && !emp.offboarding && !emp.deletedAt && !isSelf && {
        key: 'offboard',
        label: 'Offboard',
        ariaLabel: `Start offboarding for ${emp.name}`,
        icon: UserMinus,
        iconClassName: 'text-warning',
        onSelect: withFocus(() => setOffboardTarget(emp)),
      },
      canGrantAccess && emp.hasLogin && !isSelf && {
        key: 'revoke',
        label: 'Revoke Access',
        ariaLabel: `Revoke login access for ${emp.name}`,
        icon: UserX,
        tone: 'danger',
        onSelect: withFocus(() => openAccessAction('revoke', emp)),
      },
    ].filter(Boolean);
  };

  // Pieces shared by the table rows and the phone cards.
  const renderBadges = (emp) => (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="font-medium text-primary">{emp.name}</span>
      <WorkModeBadge mode={emp.workMode} />
      {emp.offboarding && (canReadOffboarding ? (
        <Link
          to={`/offboarding?request=${emp.offboarding.id}`}
          onClick={(e) => e.stopPropagation()}
          title="Open offboarding"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-warning bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-full hover:underline whitespace-nowrap"
        >
          <LogOut className="w-3 h-3" aria-hidden="true" />
          Leaving {formatDate(emp.offboarding.lastWorkingDate)}
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-warning bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-full whitespace-nowrap">
          <LogOut className="w-3 h-3" aria-hidden="true" />
          Leaving {formatDate(emp.offboarding.lastWorkingDate)}
        </span>
      ))}
    </div>
  );

  const renderAccess = (emp) => (
    <>
      {emp.hasLogin ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full whitespace-nowrap">
          <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
          {roleLabel(emp, 'Has access')}
        </span>
      ) : (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary bg-base border border-border px-2 py-0.5 rounded-full">
            <XCircle className="w-3 h-3" />
            No Access
          </span>
          {canGrantAccess && (
            <button
              type="button"
              onClick={(e) => handleGrantAccessClick(e, emp)}
              aria-label={`Grant access to ${emp.name}`}
              className="text-[11px] font-semibold text-accent hover:underline px-2 py-1 rounded whitespace-nowrap cursor-pointer"
            >
              Grant Access
            </button>
          )}
        </div>
      )}
    </>
  );

  const renderActions = (emp) => (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={(e) => handleAssetsClick(e, emp)}
        aria-label={`Assets for ${emp.name}`}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-primary bg-base hover:bg-surface border border-border transition-colors shadow-sm whitespace-nowrap cursor-pointer"
      >
        <Archive className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
        Assets
      </button>
      <RowActionsMenu
        label={`More actions for ${emp.name}`}
        items={rowMenuItems(emp)}
      />
    </div>
  );

  const openOffboarding = (requestId) => {
    if (requestId && canReadOffboarding) navigate(`/offboarding?request=${requestId}`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header & Actions */}
      <PageHeader
        icon={Users}
        title={loading ? 'Employee Directory' : `Employee Directory (${safeEmployees.length})`}
        subtitle="Browse company staff, view allocated hardware, or manage system roles."
        actions={<>
          <button type="button" aria-label="Refresh" onClick={refresh} className="p-2.5 rounded-xl bg-surface hover:bg-raised text-secondary border border-border transition-colors shadow-sm cursor-pointer" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading || refreshing ? 'animate-spin text-accent' : ''}`} />
          </button>
          {canCreate && (
            <Button variant="primary" onClick={() => setIsAddModalOpen(true)}>
              <UserPlus className="w-4 h-4" />
              <span>Add Employee</span>
            </Button>
          )}
        </>}
      />

      {/* Tab Switcher */}
      {canManageRoles && (
        <div className="flex items-center gap-1 bg-base p-1 rounded-xl border border-border w-fit">
          {[
            { id: 'directory', label: 'Directory', icon: Users },
            { id: 'roles', label: 'Role Management', icon: ShieldCheck },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-surface text-primary shadow-sm border border-border'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {activeTab === 'directory' && (
        <>
          {/* Search & Filters Bar */}
          <div className="bg-surface rounded-2xl border border-border/80 p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search employees"
              placeholder="Search by name, corporate email, office, or department..."
              className="w-full pl-10 pr-4 py-2.5 bg-base border border-border rounded-xl text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent transition-all"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-secondary">
            {/* Counts only once the directory has loaded (no "0 of 0" flash). */}
            {!loading && (
              <span>Showing <strong className="text-primary">{filteredEmployees.length}</strong> of {safeEmployees.length} personnel</span>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 sm:items-center pt-2">
          {/* Department Filter */}
          <div role="group" aria-label="Filter by department" className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 scrollbar-none pr-6 max-w-full">
            <span className="text-xs font-semibold text-secondary uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Dept:
            </span>
            {departmentFilters.map((dep) => {
              const isSelected = selectedDepartment === dep;
              return (
                <button
                  key={dep}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedDepartment(dep)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer border ${
                    isSelected
                      ? 'bg-accent text-on-accent border-accent shadow-sm shadow-accent/20'
                      : 'bg-base/80 text-secondary border-border/80 hover:bg-surface hover:text-primary'
                  }`}
                >
                  {dep}
                </button>
              );
            })}
          </div>

          {/* Access Level Filter */}
          <div role="group" aria-label="Filter by login access" className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 scrollbar-none max-w-full">
            <span className="text-xs font-semibold text-secondary uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
              <Users className="w-3 h-3" /> Access:
            </span>
            {ACCESS_FILTERS.map((acc) => {
              const isSelected = selectedAccess === acc;
              return (
                <button
                  key={acc}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedAccess(acc)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer border ${
                    isSelected
                      ? 'bg-accent text-on-accent border-accent shadow-sm shadow-accent/20'
                      : 'bg-base/80 text-secondary border-border/80 hover:bg-surface hover:text-primary'
                  }`}
                >
                  {acc}
                </button>
              );
            })}
          </div>

          {/* Work Mode Filter */}
          <div role="group" aria-label="Filter by work mode" className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 scrollbar-none max-w-full">
            <span className="text-xs font-semibold text-secondary uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Work mode:
            </span>
            {WORK_MODE_FILTERS.map((mode) => {
              const isSelected = selectedWorkMode === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setSelectedWorkMode(mode.value)}
                  aria-pressed={isSelected}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer border ${
                    isSelected
                      ? 'bg-accent text-on-accent border-accent shadow-sm shadow-accent/20'
                      : 'bg-base/80 text-secondary border-border/80 hover:bg-surface hover:text-primary'
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Table of Employees: skeleton rows only on the first load; a
          refresh (or a save) keeps the rows on screen. */}
      {error && safeEmployees.length > 0 && (
        <p role="status" className="text-xs text-warning">
          Couldn&apos;t refresh the list ({error}). Showing the last loaded copy.
        </p>
      )}
      {error && safeEmployees.length === 0 ? (
        <div className="p-8 bg-danger/10 border border-danger/30 rounded-2xl text-center">
          <p className="text-sm text-danger font-medium">{error}</p>
        </div>
      ) : !loading && filteredEmployees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Employee Profiles Found"
          description={
            searchTerm || selectedDepartment !== 'All' || selectedAccess !== 'All' || selectedWorkMode !== 'all'
              ? 'No staff members match your current filters.'
              : 'The company directory is currently empty.'
          }
          actionText={searchTerm || selectedDepartment !== 'All' || selectedAccess !== 'All' || selectedWorkMode !== 'all' ? 'Reset Filters' : (canCreate ? 'Add First Employee' : undefined)}
          onAction={() => {
            if (searchTerm || selectedDepartment !== 'All' || selectedAccess !== 'All' || selectedWorkMode !== 'all') {
              setSearchTerm('');
              setSelectedDepartment('All');
              setSelectedAccess('All');
              setSelectedWorkMode('all');
            } else {
              setIsAddModalOpen(true);
            }
          }}
        />
      ) : (
        <>
        {/* Phones: one card per employee, same actions as the table row. */}
        <ul aria-label="Employees" aria-busy={loading || undefined} className="md:hidden space-y-3">
          {loading ? [1, 2, 3].map((i) => (
            <li key={i} className="bg-surface rounded-2xl border border-border p-4 animate-pulse flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-raised shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 bg-raised rounded w-32" />
                <div className="h-3 bg-raised rounded w-44" />
              </div>
            </li>
          )) : filteredEmployees.map((emp) => (
            <li
              key={emp.id}
              onClick={(e) => handleRowClick(e, emp)}
              tabIndex={canEdit ? 0 : undefined}
              onKeyDown={canEdit ? onActivateKey((e) => handleRowClick(e, emp)) : undefined}
              className={`bg-surface rounded-2xl border border-border shadow-sm p-4 space-y-3 ${canEdit ? 'cursor-pointer hover:border-accent/50' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div aria-hidden="true" className="w-9 h-9 rounded-xl bg-raised border border-border flex items-center justify-center text-xs font-bold text-primary uppercase shrink-0 shadow-sm">
                  {getInitials(emp.name)}
                </div>
                <div className="min-w-0 flex-1">
                  {renderBadges(emp)}
                  <div className="text-xs text-secondary truncate">{emp.email}</div>
                  <div className="text-xs text-secondary mt-0.5 truncate">
                    {[emp.department, emp.location].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">{renderAccess(emp)}</div>
                {renderActions(emp)}
              </div>
            </li>
          ))}
        </ul>

        <div className="hidden md:block bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table aria-label="Employees" aria-busy={loading || undefined} className="w-full text-left text-sm">
              <thead className="bg-base/60 border-b border-border text-xs text-secondary uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Employee</th>
                  <th scope="col" className={`${FROM_LG} px-5 py-3.5 font-semibold`}>Department</th>
                  <th scope="col" className={`${FROM_XL} px-5 py-3.5 font-semibold`}>Location</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Access Level</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-raised shrink-0" />
                        <div className="space-y-1.5">
                          <div className="h-4 bg-raised rounded w-32" />
                          <div className="h-3 bg-raised rounded w-44" />
                        </div>
                      </div>
                    </td>
                    <td className={`${FROM_LG} px-5 py-3`}><div className="h-4 bg-raised rounded w-24" /></td>
                    <td className={`${FROM_XL} px-5 py-3`}><div className="h-4 bg-raised rounded w-20" /></td>
                    <td className="px-5 py-3"><div className="h-5 bg-raised rounded-full w-24" /></td>
                    <td className="px-5 py-3"><div className="h-8 bg-raised rounded-lg w-28 ml-auto" /></td>
                  </tr>
                )) : filteredEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    onClick={(e) => handleRowClick(e, emp)}
                    tabIndex={canEdit ? 0 : undefined}
                    onKeyDown={canEdit ? onActivateKey((e) => handleRowClick(e, emp)) : undefined}
                    className={`hover:bg-raised/30 transition-colors group ${canEdit ? 'cursor-pointer' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div aria-hidden="true" className="w-9 h-9 rounded-xl bg-raised border border-border flex items-center justify-center text-xs font-bold text-primary uppercase shrink-0 shadow-sm">
                          {getInitials(emp.name)}
                        </div>
                        <div>
                          {renderBadges(emp)}
                          <div className="text-xs text-secondary">{emp.email}</div>
                          {(emp.department || emp.location) && (
                            <div className="lg:hidden text-xs text-secondary mt-0.5">
                              {[emp.department, emp.location].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={`${FROM_LG} px-5 py-3 text-secondary`}>
                      {emp.department || '—'}
                      {/* Location has its own column from xl. */}
                      {emp.location && <div className="xl:hidden text-xs mt-0.5">{emp.location}</div>}
                    </td>
                    <td className={`${FROM_XL} px-5 py-3 text-secondary`}>{emp.location || '—'}</td>
                    <td className="px-5 py-3">
                      {renderAccess(emp)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {renderActions(emp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
      </>
      )}

      {activeTab === 'roles' && canManageRoles && (
        <RoleManagementPanel
          employees={safeEmployees}
          onRoleChange={changeRoleInline}
        />
      )}

      <EditEmployeeModal
        isOpen={isEditModalOpen}
        onClose={() => {
          restoreFocus();
          setIsEditModalOpen(false);
          setSelectedEmployee(null);
        }}
        employee={selectedEmployee}
        onSave={updateEmployee}
        onChangeRole={changeRole}
      />

      <EmployeeAssetDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          restoreFocus();
          setIsDrawerOpen(false);
          setSelectedEmployee(null);
        }}
        employee={selectedEmployee}
      />

      <RoleManagementModal
        isOpen={isRoleModalOpen}
        onClose={() => {
          restoreFocus();
          setIsRoleModalOpen(false);
          setSelectedEmployee(null);
        }}
        employee={selectedEmployee}
        onChangeRole={changeRole}
        onGrantAccess={grantAccess}
        onGrantGoogleAccess={grantGoogleAccess}
      />

      <AddEmployeeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={addEmployee}
        departments={departmentFilters.slice(1)}
      />

      <EmployeeAccessModal
        isOpen={!!accessAction}
        mode={accessAction?.mode}
        employee={accessAction?.employee}
        onClose={() => { restoreFocus(); setAccessAction(null); }}
        onResetPassword={resetPassword}
        onRevokeAccess={revokeAccess}
      />

      <StartOffboardingModal
        isOpen={!!offboardTarget}
        onClose={() => { restoreFocus(); setOffboardTarget(null); }}
        preselectedEmployee={offboardTarget}
        onSubmit={createOffboarding}
        onCreated={(created) => {
          refresh();
          openOffboarding(created?.id);
        }}
        onOpenExisting={canReadOffboarding ? (requestId) => {
          refresh();
          openOffboarding(requestId);
        } : undefined}
      />

      <BulkAssignModal
        isOpen={isBulkAssignOpen}
        onClose={() => { restoreFocus(); setIsBulkAssignOpen(false); setBulkAssignTarget(null); }}
        employee={bulkAssignTarget}
        onSuccess={refresh}
      />
    </div>
  );
}
