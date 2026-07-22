import React, { useState, useMemo } from 'react';
import useEmployees from '../hooks/useEmployees';
import EmployeeCard from '../components/employees/EmployeeCard';
import EmployeeAssetDrawer from '../components/employees/EmployeeAssetDrawer';
import AddEmployeeModal from '../components/forms/AddEmployeeModal';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonCard } from '../components/ui/Skeleton';
import { Users, Search, UserPlus, RefreshCw, Building2, Filter } from 'lucide-react';

const DEPARTMENT_FILTERS = ['All', 'Engineering', 'Product', 'Design', 'Operations', 'HR', 'Finance', 'Marketing'];

export default function Employees() {
  const { employees, loading, error, refresh, addEmployee, deleteEmployee } = useEmployees();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
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
  }, [employees, searchTerm, selectedDepartment]);

  const handleCardClick = (emp) => {
    setSelectedEmployee(emp);
    setIsDrawerOpen(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-indigo-400" />
            <span>Employee Directory ({employees.length})</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse company staff, view allocated hardware assets, or manually add personnel profiles.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={refresh}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors shadow-sm cursor-pointer"
            title="Refresh directory"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          <Button variant="primary" onClick={() => setIsAddModalOpen(true)}>
            <UserPlus className="w-4 h-4" />
            <span>Add Employee</span>
          </Button>
        </div>
      </div>

      {/* Search & Department Filters Bar */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700/80 p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by name, corporate email, office, or department..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5 text-indigo-400" />
            <span>Showing <strong className="text-slate-200">{filteredEmployees.length}</strong> of {employees.length} personnel</span>
          </div>
        </div>

        {/* Horizontal Department Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1 shrink-0">
            <Building2 className="w-3 h-3 text-indigo-400" />
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
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm shadow-indigo-500/20'
                    : 'bg-slate-900/80 text-slate-400 border-slate-700/80 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {dep}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Employee Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-center">
          <p className="text-sm text-rose-300 font-medium">{error}</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        onClose={() => setIsDrawerOpen(false)}
        employee={selectedEmployee}
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
