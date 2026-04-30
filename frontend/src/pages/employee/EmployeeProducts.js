/**
 * EmployeeProducts — same product CRUD as the admin panel but auth via X-Employee-Token.
 * Easiest path: render AdminProducts inside an employee shell that mirrors the admin token
 * into a header alias. Backend product endpoints already accept either header via verify_auth.
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminProducts from '../admin/AdminProducts';

export default function EmployeeProducts() {
  const navigate = useNavigate();
  useEffect(() => {
    const token = sessionStorage.getItem('employeeToken') || localStorage.getItem('employeeToken');
    const data = sessionStorage.getItem('employeeData') || localStorage.getItem('employeeData');
    if (!token) { navigate('/employee/login'); return; }
    try {
      const parsed = JSON.parse(data || '{}');
      if (!parsed?.permissions?.products) {
        navigate('/employee/dashboard');
        return;
      }
    } catch { /* ignore */ }
    // AdminProducts uses sessionStorage.adminToken — mirror the employee token there
    // so its existing axios calls send X-Admin-Token. Backend's verify_auth accepts
    // employee tokens as admin tokens transparently.
    sessionStorage.setItem('adminToken', token);
  }, [navigate]);

  return <AdminProducts />;
}
