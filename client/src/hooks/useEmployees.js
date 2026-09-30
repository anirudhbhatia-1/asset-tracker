import { useState, useEffect, useCallback } from 'react';
import { getEmployees, createEmployee, deleteEmployeeApi, updateEmployeeRole, updateEmployeeDetails, grantEmployeeAccess, grantEmployeeGoogleAccess, resetEmployeePassword, revokeEmployeeAccess } from '../api/employeesApi';
import toast from 'react-hot-toast';

export default function useEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEmployeesData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getEmployees();
      setEmployees(res.data?.data || (Array.isArray(res.data) ? res.data : []));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployeesData();
  }, [fetchEmployeesData]);

  const updateEmployee = useCallback(async (id, data) => {
    try {
      await updateEmployeeDetails(id, data);
      await fetchEmployeesData();
      toast.success('Employee details updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update employee');
      throw err;
    }
  }, [fetchEmployeesData]);

  const changeRoleInline = useCallback(async (employeeId, newRole) => {
    try {
      await updateEmployeeRole(employeeId, newRole);
      await fetchEmployeesData();
      toast.success('Role updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role');
    }
  }, [fetchEmployeesData]);

  const addEmployee = async (data) => {
    try {
      const res = await createEmployee(data);
      const newEmp = res.data?.data || res.data;
      setEmployees((prev) => [newEmp, ...prev]);
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
      setEmployees((prev) => prev.filter((e) => e.id !== id));
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
      await fetchEmployeesData();
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
      await fetchEmployeesData();
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
        setEmployees((prev) => prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)));
      } else {
        await fetchEmployeesData();
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
      await fetchEmployeesData();
      toast.success('Google login access granted');
      return res.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to grant Google access');
      throw err;
    }
  };

  return {
    employees: Array.isArray(employees) ? employees : [],
    loading,
    error,
    refresh: fetchEmployeesData,
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
