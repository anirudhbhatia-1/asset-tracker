import React, { useState, useMemo } from 'react';
import useEmployees from '../hooks/useEmployees';
import EmployeeCard from '../components/employees/EmployeeCard';
import EmployeeAssetDrawer from '../components/employees/EmployeeAssetDrawer';
import AddEmployeeModal from '../components/forms/AddEmployeeModal';
import RoleManagementModal from '../components/forms/RoleManagementModal';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonCard } from '../components/ui/Skeleton';
import { Users, Search, UserPlus, RefreshCw, Building2, Filter } from 'lucide-react';

const DEPARTMENT_FILTERS = ['All', 'Engineering', 'Product', 'Design', 'Operations', 'HR', 'Finance', 'Marketing'];

export default function Employees() {
  const { employees, loading, error, refresh, addEmployee, deleteEmployee, changeRole, grantAccess } = useEmployees();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

  const safeEmployees = Array.isArray(employees) ? employees : [];

  const filteredEmployees = useMemo(() => {
    return safeEmployees.filter((emp) => {
      // Department filter
      if (selectedDepartment !== 'All' && emp.department !== selectedDepartment) {
        return false;
      }
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
  }, [safeEmployees, searchTerm, selectedDepartment]);

  const handleCardClick = (emp, action = 'drawer') => {
    setSelectedEmployee(emp);
    if (action === 'role') {
      setIsRoleModalOpen(true);
    } else {
      setIsDrawerOpen(true);
    }
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
            Browse company staff, view allocated hardware assets, or manually add personnel profiles.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={refresh}
            className="p-2.5 rounded-xl bg-surface hover:bg-raised text-secondary border border-border transition-colors shadow-sm cursor-pointer"
            title="Refresh directory"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-accent' : ''}`} />
          </button>

          <Button variant="primary" onClick={() => setIsAddModalOpen(true)}>
            <UserPlus className="w-4 h-4" />
            <span>Add Employee</span>
          </Button>
        </div>
      </div>

      {/* Search & Department Filters Bar */}
      <div className="bg-surface rounded-2xl border border-border/80 p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by name, corporate email, office, or department..."
              className="w-full pl-10 pr-4 py-2.5 bg-base border border-border rounded-xl text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent transition-all"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-secondary">
            <Filter className="w-3.5 h-3.5 text-accent" />
            <span>Showing <strong className="text-primary">{filteredEmployees.length}</strong> of {safeEmployees.length} personnel</span>
          </div>
        </div>

        {/* Horizontal Department Pills */}
        <div className="relative">
          <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l from-surface to-transparent pointer-events-none z-10" />
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pr-6">
            <span className="text-xs font-semibold text-secondary uppercase tracking-wider mr-1 flex items-center gap-1 shrink-0">
              <Building2 className="w-3 h-3 text-accent" />
              <span>Department:</span>
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
        </div>
      </div>

      {/* Grid of Employee Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 bg-danger/10 border border-danger/30 rounded-2xl text-center">
          <p className="text-sm text-danger font-medium">{error}</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Employee Profiles Found"
          description={
            searchTerm || selectedDepartment !== 'All'
              ? 'No staff members match your current search queries or department filter selection.'
              : 'The company directory is currently empty. Add employee profiles manually or sync from Google Workspace.'
          }
          actionText={searchTerm || selectedDepartment !== 'All' ? 'Reset Filters' : 'Add First Employee'}
          onAction={() => {
            if (searchTerm || selectedDepartment !== 'All') {
              setSearchTerm('');
              setSelectedDepartment('All');
            } else {
              setIsAddModalOpen(true);
            }
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((emp) => (
            <EmployeeCard
              key={emp.id}
              employee={emp}
              onClick={handleCardClick}
              onDelete={(employeeToDelete) => {
                if (window.confirm(`Are you sure you want to delete employee profile for ${employeeToDelete.name}?`)) {
                  deleteEmployee(employeeToDelete.id);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Employee Assigned Assets Drawer / Modal */}
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
      />

      {/* Add Employee Modal */}
      <AddEmployeeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={addEmployee}
      />
    </div>
  );
}
