import { useState, useEffect, useCallback } from 'react';
import { getEmployees, createEmployee, deleteEmployeeApi, updateEmployeeRole, updateEmployeeDetails, grantEmployeeAccess, grantEmployeeGoogleAccess } from '../api/employeesApi';
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
      setError(err.message || 'Failed to load employees');
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
      toast.error(err.message || 'Failed to delete employee');
      throw err;
    }
  };

  const changeRole = async (id, role) => {
    try {
      const res = await updateEmployeeRole(id, role);
      const updatedEmp = res.data?.data || res.data;
      setEmployees((prev) => prev.map((e) => (e.id === id ? updatedEmp : e)));
      toast.success('Employee role updated');
      return updatedEmp;
    } catch (err) {
      toast.error(err.message || 'Failed to update role');
      throw err;
    }
  };

  const grantAccess = async (id, role) => {
    try {
      const res = await grantEmployeeAccess(id, role);
      const updatedEmp = res.data?.data || res.data;
      setEmployees((prev) => prev.map((e) => (e.id === id ? updatedEmp : e)));
      toast.success('Login access granted');
      return res.data; // Return the full response to access temporaryPassword
    } catch (err) {
      toast.error(err.message || 'Failed to grant access');
      throw err;
    }
  };

  // TESTING ONLY — remove when production Google Workspace flow is implemented
  const grantGoogleAccess = async (id) => {
    try {
      const res = await grantEmployeeGoogleAccess(id);
      const updatedEmp = res.data?.data || res.data;
      setEmployees((prev) => prev.map((e) => (e.id === id ? updatedEmp : e)));
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
  };
}
