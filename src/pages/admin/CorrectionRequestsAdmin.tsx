import React, { useState, useEffect } from 'react';
import { useCorrectionRequests } from '../../hooks/useCorrectionRequests';
import { supabase, isSupabaseReal } from '../../lib/supabaseClient';
import { 
  ClipboardCheck, Clock, CheckCircle2, XCircle, RefreshCw, Loader2, 
  User, BookOpen, MessageSquare, ShieldAlert
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'react-hot-toast';

export default function CorrectionRequestsAdmin() {
  const { getAllRequestsAdmin } = useCorrectionRequests();

  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ pending: any[]; approved: any[]; rejected: any[] }>({
    pending: [],
    approved: [],
    rejected: []
  });

  const fetchAdminRequests = async () => {
    setLoading(true);
    try {
      const res = await getAllRequestsAdmin();
      setData(res);
    } catch (e: any) {
      console.error('Failed to load global requests:', e);
      toast.error(e.message || 'Could not retrieve global correction requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminRequests();

    if (!isSupabaseReal()) return;

    // Realtime subscription for admin: listen to all changes
    const channel = supabase
      .channel('admin_cr_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'correction_requests'
      }, () => {
        fetchAdminRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const activeList = data[activeTab] || [];

  const formatDate = (dateStr: string) => {
    try {
      const parsedDate = dateStr.includes('T') ? parseISO(dateStr) : new Date(dateStr);
      return format(parsedDate, 'MMM d, yyyy h:mm a');
    } catch (e) {
      return dateStr;
    }
  };

  const formatSimpleDate = (dateStr: string) => {
    try {
      const parsedDate = dateStr.includes('T') ? parseISO(dateStr) : new Date(dateStr);
      return format(parsedDate, 'EEEE, d MMM yyyy');
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 py-6" id="admin-correction-requests-root">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-600" />
            System Correction Requests (Admin)
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Global oversight and audit of student attendance disputes and lecturer resolutions.</p>
        </div>
        <button
          onClick={fetchAdminRequests}
          disabled={loading}
          className="self-start md:self-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh System Logs</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200/80 gap-1.5">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-all relative ${
            activeTab === 'pending'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Pending Review
          {data.pending.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-black bg-amber-500 text-white rounded-full">
              {data.pending.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          className={`px-4 py-2 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === 'approved'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Approved ({data.approved.length})
        </button>
        <button
          onClick={() => setActiveTab('rejected')}
          className={`px-4 py-2 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === 'rejected'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Rejected ({data.rejected.length})
        </button>
      </div>

      {/* Main List Body */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-xs font-bold text-slate-500">Auditing global database registers...</p>
        </div>
      ) : activeList.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-3xs p-12 text-center max-w-md mx-auto">
          {activeTab === 'pending' ? (
            <>
              <CheckCircle2 className="w-12 h-12 text-green-500/80 mx-auto mb-3" />
              <h3 className="text-sm font-extrabold text-slate-800">No pending disputes</h3>
              <p className="text-xs text-slate-400 mt-1">There are currently no unresolved attendance disputes logged in the system.</p>
            </>
          ) : activeTab === 'approved' ? (
            <>
              <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700">No approved records</h3>
              <p className="text-xs text-slate-400 mt-1">Historic records of approved student disputes will be listed here.</p>
            </>
          ) : (
            <>
              <XCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700">No rejected records</h3>
              <p className="text-xs text-slate-400 mt-1">Rejection logs of resolved attendance disputes will appear here.</p>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200/85 rounded-2xl shadow-3xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Lecturer</th>
                  <th className="py-3 px-4">Course Unit</th>
                  <th className="py-3 px-4">Class Date</th>
                  <th className="py-3 px-4 text-center">Original</th>
                  <th className="py-3 px-4 max-w-xs">Dispute Reason</th>
                  <th className="py-3 px-4">Filed At</th>
                  {activeTab !== 'pending' && <th className="py-3 px-4">Reviewer Note / Reason</th>}
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {activeList.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/30 transition-colors">
                    {/* Student */}
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-slate-800">{req.profiles?.full_name || 'Unknown Student'}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase">{req.profiles?.adm_no || 'N/A'}</div>
                    </td>

                    {/* Lecturer */}
                    <td className="py-3.5 px-4 font-bold text-slate-700">
                      {req.lecturer?.full_name || 'System Auto'}
                    </td>

                    {/* Unit */}
                    <td className="py-3.5 px-4 font-bold text-indigo-950" title={req.course_units?.name}>
                      <span className="block max-w-[140px] truncate">{req.course_units?.name || 'Syllabus Subject'}</span>
                    </td>

                    {/* Class Date */}
                    <td className="py-3.5 px-4 font-medium text-slate-600">
                      {req.attendance?.date ? formatSimpleDate(req.attendance.date) : 'N/A'}
                    </td>

                    {/* Original Status */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                        req.original_status === 'Absent'
                          ? 'bg-red-50 text-red-700 border border-red-100'
                          : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {req.original_status}
                      </span>
                    </td>

                    {/* Dispute Reason */}
                    <td className="py-3.5 px-4 text-slate-500 max-w-xs leading-relaxed">
                      <div className="flex gap-1 items-start">
                        <MessageSquare className="w-3.5 h-3.5 shrink-0 text-slate-300 mt-0.5" />
                        <span className="line-clamp-3">{req.reason}</span>
                      </div>
                    </td>

                    {/* Filed At */}
                    <td className="py-3.5 px-4 font-mono text-[10px] text-slate-400">
                      {formatDate(req.created_at)}
                    </td>

                    {/* Review Note */}
                    {activeTab !== 'pending' && (
                      <td className="py-3.5 px-4 text-slate-500 max-w-xs leading-relaxed italic">
                        {req.reviewer_note || <span className="text-slate-300 font-medium">No note added</span>}
                      </td>
                    )}

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 text-right">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide border ${
                        req.status === 'pending'
                          ? 'bg-amber-50 text-amber-700 border-amber-100'
                          : req.status === 'approved'
                            ? 'bg-green-50 text-green-700 border-green-100'
                            : 'bg-red-50 text-red-700 border-red-100'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
