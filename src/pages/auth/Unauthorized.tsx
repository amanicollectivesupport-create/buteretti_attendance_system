import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldX } from 'lucide-react';

export default function Unauthorized() {
  const { role } = useAuth();
  const navigate = useNavigate();

  const handleGoHome = () => {
    if (role === 'admin') navigate('/admin/dashboard', { replace: true });
    else if (role === 'lecturer') navigate('/lecturer/dashboard', { replace: true });
    else if (role === 'student') navigate('/student/attendance', { replace: true });
    else navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-red-100 p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center shadow-inner border border-red-100">
          <ShieldX className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Access Denied</h2>
          <p className="text-xs text-slate-500 leading-relaxed px-4">
            You do not have administrative clearance or matching roles to view this registry section.
          </p>
        </div>
        <button
          onClick={handleGoHome}
          className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-950 active:bg-emerald-950 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition-all cursor-pointer border border-emerald-900"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}
