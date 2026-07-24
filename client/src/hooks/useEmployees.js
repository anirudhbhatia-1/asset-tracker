import { useState, useEffect, useCallback } from 'react';
import { getEmployees, createEmployee, deleteEmployeeApi } from '../api/employeesApi';
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

  const addEmployee = async (data) => {
    try {
      const res = await createEmployee(data);
      const newEmp = res.data?.data || res.data;
      setEmployees((prev) => [newEmp, ...prev]);
      toast.success('Employee profile created successfully');
      return newEmp;
    } catch (err) {
      toast.error(err.message || 'Failed to add employee');
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

  return {
    employees: Array.isArray(employees) ? employees : [],
    loading,
    error,
    refresh: fetchEmployeesData,
    addEmployee,
    deleteEmployee,
  };
}
