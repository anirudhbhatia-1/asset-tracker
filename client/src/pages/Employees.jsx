import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import useEmployees from '../hooks/useEmployees';
import EmployeeAssetDrawer from '../components/employees/EmployeeAssetDrawer';
import AddEmployeeModal from '../components/forms/AddEmployeeModal';
import RoleManagementModal from '../components/forms/RoleManagementModal';
import EditEmployeeModal from '../components/forms/EditEmployeeModal';
import BulkAssignModal from '../components/forms/BulkAssignModal';
import RoleManagementPanel from '../components/dashboard/RoleManagementPanel';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { Users, Search, UserPlus, RefreshCw, Archive, Filter, CheckCircle2, XCircle, ShieldCheck, Package } from 'lucide-react';

const DEPARTMENT_FILTERS = ['All', 'Engineering', 'Product', 'Design', 'Operations', 'HR', 'Finance', 'Marketing'];
const ACCESS_FILTERS = ['All', 'With Access', 'No Access'];

export default function Employees() {
  const { user, hasPermission } = useAuth();
  const isAdmin = hasPermission('employees:grant-access') || hasPermission('roles:manage');
  const { employees, loading, error, refresh, addEmployee, updateEmployee, deleteEmployee, changeRole, grantAccess, grantGoogleAccess, changeRoleInline } = useEmployees();
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

  const handleCardClick = (emp, action) => {
    if (action === 'bulk-assign') {
      setBulkAssignTarget(emp);
      setIsBulkAssignOpen(true);
    } else if (action === 'role') {
      setSelectedEmployee(emp);
      setIsRoleModalOpen(true);
    } else {
      setSelectedEmployee(emp);
      setIsEditModalOpen(true);
    }
  };

  useEffect(() => {
    if (!isAdmin && activeTab === 'roles') setActiveTab('directory');
  }, [isAdmin, activeTab]);

  const safeEmployees = Array.isArray(employees) ? employees : [];

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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-accent" />
            <span>Employee Directory ({safeEmployees.length})</span>
          </h1>
          <p className="text-sm text-secondary mt-1">
            Browse company staff, view allocated hardware, or manage system roles.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button type="button" onClick={refresh} className="p-2.5 rounded-xl bg-surface hover:bg-raised text-secondary border border-border transition-colors shadow-sm cursor-pointer" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-accent' : ''}`} />
          </button>
          <Button variant="primary" onClick={() => setIsAddModalOpen(true)}>
            <UserPlus className="w-4 h-4" />
            <span>Add Employee</span>
          </Button>
        </div>
      </div>

      {/* Tab Switcher */}
      {isAdmin && (
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
                      ? 'bg-accent text-white border-accent shadow-sm shadow-accent/20'
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
                      ? 'bg-accent text-white border-accent shadow-sm shadow-accent/20'
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
          actionText={searchTerm || selectedDepartment !== 'All' || selectedAccess !== 'All' ? 'Reset Filters' : 'Add First Employee'}
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
            <table className="w-full text-left text-sm">
              <thead className="bg-base/60 border-b border-border text-xs text-secondary uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Employee</th>
                  <th className="px-5 py-3.5 font-semibold">Department</th>
                  <th className="px-5 py-3.5 font-semibold">Location</th>
                  <th className="px-5 py-3.5 font-semibold">Access Level</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} onClick={() => handleRowClick(emp)} className="hover:bg-raised/30 transition-colors cursor-pointer group">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-raised border border-border flex items-center justify-center text-xs font-bold text-primary uppercase shrink-0 shadow-sm">
                          {emp.name?.substring(0, 2) || 'U'}
                        </div>
                        <div>
                          <div className="font-medium text-primary">{emp.name}</div>
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
                          {isAdmin && (
                            <button
                              onClick={(e) => handleGrantAccessClick(e, emp)}
                              className="text-[11px] font-semibold text-accent hover:underline px-2 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              Grant Access
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right flex items-center justify-end gap-2">
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

      {activeTab === 'roles' && isAdmin && (
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
        canEditRole={isAdmin}
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

      <BulkAssignModal
        isOpen={isBulkAssignOpen}
        onClose={() => { setIsBulkAssignOpen(false); setBulkAssignTarget(null); }}
        employee={bulkAssignTarget}
        onSuccess={refresh}
      />
    </div>
  );
}
