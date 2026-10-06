import { useCallback } from 'react';
import { getEmployees, createEmployee, deleteEmployeeApi, updateEmployeeRole, updateEmployeeDetails, grantEmployeeAccess, grantEmployeeGoogleAccess, resetEmployeePassword, revokeEmployeeAccess } from '../api/employeesApi';
import { invalidateQueries, setQueryData } from '../utils/queryCache';
import useQuery, { errorMessageOf } from './useQuery';
import { listOf } from './useAssets';
import toast from 'react-hot-toast';

const EMPTY = [];
export const EMPLOYEES_KEY = 'employees';
export const fetchEmployeesList = () => getEmployees().then(listOf);

// Saves answer with the bare employee row; merge what it has so the list is
// right at once, then reload quietly for the joined fields (role name,
// offboarding badge...).
const mergeEmployee = (updated) => {
  if (!updated?.id) return;
  setQueryData(EMPLOYEES_KEY, (prev) => prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)));
};
const reloadEmployees = () => invalidateQueries(EMPLOYEES_KEY);

export default function useEmployees() {
  const { data, loading, refreshing, error, refetch } = useQuery(EMPLOYEES_KEY, fetchEmployeesList);

  const updateEmployee = useCallback(async (id, data) => {
    try {
      const res = await updateEmployeeDetails(id, data);
      const updated = res?.data?.data;
      if (updated?.id) {
        mergeEmployee(updated);
        reloadEmployees();
      } else {
        await reloadEmployees();
      }
      toast.success('Employee details updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update employee');
      throw err;
    }
  }, []);

  const changeRoleInline = useCallback(async (employeeId, newRole) => {
    try {
      await updateEmployeeRole(employeeId, newRole);
      await reloadEmployees();
      toast.success('Role updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role');
    }
  }, []);

  const addEmployee = async (data) => {
    try {
      const res = await createEmployee(data);
      const newEmp = res.data?.data || res.data;
      setQueryData(EMPLOYEES_KEY, (prev) => [newEmp, ...prev]);
      reloadEmployees();
      toast.success('Employee profile created successfully');
      // e.g. the onboarding request could not be linked; the employee exists.
      const warnings = Array.isArray(res.data?.warnings) ? res.data.warnings : [];
      warnings.forEach((warning) => toast(warning, { icon: '⚠️', duration: 8000 }));
      // Return full response so caller can access temporaryPassword if present
      return res.data;
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to add employee');
      throw err;
    }
  };

  const deleteEmployee = async (id) => {
    try {
      await deleteEmployeeApi(id);
      setQueryData(EMPLOYEES_KEY, (prev) => prev.filter((e) => e.id !== id));
      reloadEmployees();
      toast.success('Employee profile deleted');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to delete employee');
      throw err;
    }
  };

  // `quiet` skips the success toast when the caller already reports the
  // save (e.g. Edit Employee saves details and role in one go).
  const changeRole = async (id, role, { quiet = false } = {}) => {
    try {
      const res = await updateEmployeeRole(id, role);
      await reloadEmployees();
      if (!quiet) toast.success('Employee role updated');
      return res.data?.data || res.data;
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update role');
      throw err;
    }
  };

  const grantAccess = async (id, role) => {
    try {
      const res = await grantEmployeeAccess(id, role);
      await reloadEmployees();
      toast.success('Login access granted');
      return res.data; // Return the full response to access temporaryPassword
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to grant access');
      throw err;
    }
  };

  // Resolves to the temporary password, which the server returns only once.
  const resetPassword = async (id) => {
    try {
      const res = await resetEmployeePassword(id);
      toast.success('Password reset; the employee has been signed out');
      return res.data?.temporaryPassword ?? res.data?.data?.temporaryPassword;
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to reset password');
      throw err;
    }
  };

  const revokeAccess = async (id) => {
    try {
      const res = await revokeEmployeeAccess(id);
      const updated = res.data?.data;
      if (updated?.id) {
        mergeEmployee(updated);
        reloadEmployees();
      } else {
        await reloadEmployees();
      }
      toast.success('Login access revoked');
      return updated;
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to revoke access');
      throw err;
    }
  };

  // TESTING ONLY — remove when production Google Workspace flow is implemented
  const grantGoogleAccess = async (id) => {
    try {
      const res = await grantEmployeeGoogleAccess(id);
      await reloadEmployees();
      toast.success('Google login access granted');
      return res.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to grant Google access');
      throw err;
    }
  };

  return {
    employees: Array.isArray(data) ? data : EMPTY,
    loading,
    refreshing,
    error: errorMessageOf(error, 'Failed to load employees'),
    refresh: refetch,
    addEmployee,
    updateEmployee,
    changeRoleInline,
    deleteEmployee,
    changeRole,
    grantAccess,
    grantGoogleAccess,
    resetPassword,
    revokeAccess,
  };
}
