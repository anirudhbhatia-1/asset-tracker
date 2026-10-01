import React, { useState, useMemo, useEffect } from 'react';
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
import { Users, Search, UserPlus, RefreshCw, Archive, Filter, CheckCircle2, XCircle, ShieldCheck, Package, KeyRound, UserX, UserMinus, LogOut } from 'lucide-react';
import { onActivateKey } from '../utils/a11y';

const DEPARTMENT_FILTERS = ['All', 'Engineering', 'Product', 'Design', 'Operations', 'HR', 'Finance', 'Marketing'];
const ACCESS_FILTERS = ['All', 'With Access', 'No Access'];

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
  const { employees, loading, error, refresh, addEmployee, updateEmployee, changeRole, grantAccess, grantGoogleAccess, changeRoleInline, resetPassword, revokeAccess } = useEmployees();
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' | 'roles'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedAccess, setSelectedAccess] = useState('All');
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

  const filteredEmployees = useMemo(() => {
    return safeEmployees.filter((emp) => {
      // Department filter
      if (selectedDepartment !== 'All' && emp.department !== selectedDepartment) return false;
      
      // Access filter
      if (selectedAccess === 'With Access' && !emp.hasLogin) return false;
      if (selectedAccess === 'No Access' && emp.hasLogin) return false;

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
  }, [safeEmployees, searchTerm, selectedDepartment, selectedAccess]);

  const handleRowClick = (emp) => {
    if (!canEdit) return;
    setSelectedEmployee(emp);
    setIsEditModalOpen(true);
  };

  const handleAssetsClick = (e, emp) => {
    e.stopPropagation();
    setSelectedEmployee(emp);
    setIsDrawerOpen(true);
  };

  const handleGrantAccessClick = (e, emp) => {
    e.stopPropagation();
    setSelectedEmployee(emp);
    setIsRoleModalOpen(true);
  };

  const openAccessAction = (e, mode, emp) => {
    e.stopPropagation();
    setAccessAction({ mode, employee: emp });
  };

  const openOffboarding = (requestId) => {
    if (requestId && canReadOffboarding) navigate(`/offboarding?request=${requestId}`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header & Actions */}
      <PageHeader
        icon={Users}
        title={`Employee Directory (${safeEmployees.length})`}
        subtitle="Browse company staff, view allocated hardware, or manage system roles."
        actions={<>
          <button type="button" aria-label="Refresh" onClick={refresh} className="p-2.5 rounded-xl bg-surface hover:bg-raised text-secondary border border-border transition-colors shadow-sm cursor-pointer" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-accent' : ''}`} />
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
            <span>Showing <strong className="text-primary">{filteredEmployees.length}</strong> of {safeEmployees.length} personnel</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 sm:items-center pt-2">
          {/* Department Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pr-6 max-w-full">
            <span className="text-xs font-semibold text-secondary uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Dept:
            </span>
            {DEPARTMENT_FILTERS.map((dep) => {
              const isSelected = selectedDepartment === dep;
              return (
                <button
                  key={dep}
                  type="button"
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
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none max-w-full">
            <span className="text-xs font-semibold text-secondary uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
              <Users className="w-3 h-3" /> Access:
            </span>
            {ACCESS_FILTERS.map((acc) => {
              const isSelected = selectedAccess === acc;
              return (
                <button
                  key={acc}
                  type="button"
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
        </div>
      </div>

      {/* Table of Employees */}
      {loading ? (
        <div className="p-8 text-center text-secondary">Loading employees...</div>
      ) : error ? (
        <div className="p-8 bg-danger/10 border border-danger/30 rounded-2xl text-center">
          <p className="text-sm text-danger font-medium">{error}</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Employee Profiles Found"
          description={
            searchTerm || selectedDepartment !== 'All' || selectedAccess !== 'All'
              ? 'No staff members match your current filters.'
              : 'The company directory is currently empty.'
          }
          actionText={searchTerm || selectedDepartment !== 'All' || selectedAccess !== 'All' ? 'Reset Filters' : (canCreate ? 'Add First Employee' : undefined)}
          onAction={() => {
            if (searchTerm || selectedDepartment !== 'All' || selectedAccess !== 'All') {
              setSearchTerm('');
              setSelectedDepartment('All');
              setSelectedAccess('All');
            } else {
              setIsAddModalOpen(true);
            }
          }}
        />
      ) : (
        <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table aria-label="Employees" className="w-full text-left text-sm">
              <thead className="bg-base/60 border-b border-border text-xs text-secondary uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Employee</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Department</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Location</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Access Level</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    onClick={() => handleRowClick(emp)}
                    tabIndex={canEdit ? 0 : undefined}
                    onKeyDown={canEdit ? onActivateKey(() => handleRowClick(emp)) : undefined}
                    className={`hover:bg-raised/30 transition-colors group ${canEdit ? 'cursor-pointer' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-raised border border-border flex items-center justify-center text-xs font-bold text-primary uppercase shrink-0 shadow-sm">
                          {emp.name?.substring(0, 2) || 'U'}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-medium text-primary">{emp.name}</span>
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
                          <div className="text-xs text-secondary">{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-secondary">{emp.department || '—'}</td>
                    <td className="px-5 py-3 text-secondary">{emp.location || '—'}</td>
                    <td className="px-5 py-3">
                      {emp.hasLogin ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full capitalize">
                          <CheckCircle2 className="w-3 h-3" />
                          {emp.role}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary bg-base border border-border px-2 py-0.5 rounded-full">
                            <XCircle className="w-3 h-3" />
                            No Access
                          </span>
                          {canGrantAccess && (
                            <button
                              onClick={(e) => handleGrantAccessClick(e, emp)}
                              className="text-[11px] font-semibold text-accent hover:underline px-2 py-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100 transition-opacity"
                            >
                              Grant Access
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right flex items-center justify-end gap-2">
                      {canGrantAccess && emp.hasLogin && (
                        <button
                          type="button"
                          onClick={(e) => openAccessAction(e, 'reset', emp)}
                          aria-label={`Reset password for ${emp.name}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary bg-base hover:bg-surface border border-border transition-colors shadow-sm"
                          title="Reset password"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-accent" />
                          Reset Password
                        </button>
                      )}
                      {canGrantAccess && emp.hasLogin && String(emp.id) !== String(user?.id) && (
                        <button
                          type="button"
                          onClick={(e) => openAccessAction(e, 'revoke', emp)}
                          aria-label={`Revoke login access for ${emp.name}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-danger bg-base hover:bg-danger/10 border border-border transition-colors shadow-sm"
                          title="Revoke login access"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          Revoke Access
                        </button>
                      )}
                      {canAssignAssets && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setBulkAssignTarget(emp);
                            setIsBulkAssignOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary bg-base hover:bg-surface border border-border transition-colors shadow-sm"
                          title="Assign Hardware to Employee"
                        >
                          <Package className="w-3.5 h-3.5 text-accent" />
                          Assign Hardware
                        </button>
                      )}
                      {canStartOffboarding && !emp.offboarding && !emp.deletedAt && String(emp.id) !== String(user?.id) && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setOffboardTarget(emp); }}
                          aria-label={`Start offboarding for ${emp.name}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary bg-base hover:bg-surface border border-border transition-colors shadow-sm"
                          title="Start offboarding"
                        >
                          <UserMinus className="w-3.5 h-3.5 text-warning" />
                          Offboard
                        </button>
                      )}
                      <button
                        onClick={(e) => handleAssetsClick(e, emp)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary bg-base hover:bg-surface border border-border transition-colors shadow-sm"
                      >
                        <Archive className="w-3.5 h-3.5 text-accent" />
                        Assets
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
          setIsDrawerOpen(false);
          setSelectedEmployee(null);
        }}
        employee={selectedEmployee}
      />

      <RoleManagementModal
        isOpen={isRoleModalOpen}
        onClose={() => {
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
      />

      <EmployeeAccessModal
        isOpen={!!accessAction}
        mode={accessAction?.mode}
        employee={accessAction?.employee}
        onClose={() => setAccessAction(null)}
        onResetPassword={resetPassword}
        onRevokeAccess={revokeAccess}
      />

      <StartOffboardingModal
        isOpen={!!offboardTarget}
        onClose={() => setOffboardTarget(null)}
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
        onClose={() => { setIsBulkAssignOpen(false); setBulkAssignTarget(null); }}
        employee={bulkAssignTarget}
        onSuccess={refresh}
      />
    </div>
  );
}
