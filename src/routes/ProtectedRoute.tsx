import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole | UserRole[];
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, role, mustChangePassword, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs text-slate-500 font-medium mt-3 uppercase tracking-wider font-mono">
          Verifying Credentials...
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole) {
    const rolesArray = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!role || !rolesArray.includes(role)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Force password change for lecturers on first login
  if (
    role === 'lecturer' &&
    mustChangePassword === true &&
    location.pathname !== '/lecturer/change-password'
  ) {
    return <Navigate to="/lecturer/change-password" replace />;
  }

  return <>{children}</>;
}
