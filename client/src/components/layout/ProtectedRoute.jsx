import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ChangePasswordModal from './ChangePasswordModal';

const ProtectedRoute = ({ requiredPermission, requiredAnyPermission }) => {
  const { user, hasPermission } = useAuth();
  const location = useLocation();

  if (!user) {
    // Login sends the user back here afterwards, query string included.
    const from = { pathname: location.pathname, search: location.search, hash: location.hash };
    return <Navigate to="/login" state={{ from }} replace />;
  }

  // The server refuses everything else until a temporary or shared password
  // is replaced, so show only the change-password screen.
  if (user.mustChangePassword) {
    return (
      <div className="min-h-screen bg-base">
        <ChangePasswordModal isOpen required onClose={() => {}} />
      </div>
    );
  }

  // Director / '*' bypass: Evaluated before any role or permission check (Risk Audit #17)
  if (user.role === 'director' || user.isDirector) {
    return <Outlet />;
  }

  // Permission check
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/" replace />;
  }

  // Parent areas can contain independently permissioned pages. In that case,
  // the user needs at least one supplied permission to enter the area.
  if (requiredAnyPermission && !requiredAnyPermission.some(hasPermission)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
