import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCorrectionRequests } from '../../hooks/useCorrectionRequests';
import { supabase, isSupabaseReal } from '../../lib/supabaseClient';
import { 
  CheckCircle2, XCircle, AlertCircle, Clock, Calendar, User, 
  BookOpen, MessageSquare, ArrowRight, Loader2, RefreshCw, ClipboardCheck
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'react-hot-toast';

export default function CorrectionRequests() {
  const { profile } = useAuth();
  const { getLecturerRequests, approveRequest, rejectRequest } = useCorrectionRequests();

  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ pending: any[]; approved: any[]; rejected: any[] }>({
    pending: [],
    approved: [],
    rejected: []
  });

  // Action Modals State
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [reviewerNote, setReviewerNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchLecturerRequests = async () => {
    setLoading(true);
    try {
      const res = await getLecturerRequests();
      setData(res);
    } catch (e) {
      console.error('Failed to load requests:', e);
      toast.error('Could not load correction requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profile?.id) return;

    fetchLecturerRequests();

    if (!isSupabaseReal()) return;

    // Realtime subscription
    const channel = supabase
      .channel('lecturer_cr_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'correction_requests',
        filter: `lecturer_id=eq.${profile.id}`
      }, () => {
        fetchLecturerRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const handleOpenAction = (request: any, type: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setActionType(type);
    setReviewerNote('');
    setFormError(null);
  };

  const handleCloseAction = () => {
    if (submitting) return;
    setSelectedRequest(null);
    setActionType(null);
    setReviewerNote('');
    setFormError(null);
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !actionType) return;

    const trimmedNote = reviewerNote.trim();

    if (actionType === 'reject' && !trimmedNote) {
      setFormError('You must provide a reason when rejecting a dispute.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      let result;
      if (actionType === 'approve') {
        result = await approveRequest(selectedRequest.id, trimmedNote || undefined);
      } else {
        result = await rejectRequest(selectedRequest.id, trimmedNote);
      }

      if (result.error) {
        toast.error(result.error.message || `Failed to ${actionType} request.`);
      } else {
        toast.success(`Request successfully ${actionType}d.`);
        fetchLecturerRequests();
        handleCloseAction();
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during submission.');
    } finally {
      setSubmitting(false);
    }
  };

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
    <div className="space-y-6 max-w-6xl mx-auto px-4 py-6" id="lecturer-correction-requests-root">
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-blue-600" />
            Attendance Correction Requests
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Review, approve, or reject student disputes on marked classes.</p>
        </div>
        <button
          onClick={fetchLecturerRequests}
          disabled={loading}
          className="self-start md:self-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh List</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200/80 gap-1.5">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-all relative ${
            activeTab === 'pending'
              ? 'border-blue-600 text-blue-600'
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
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-xs font-bold text-slate-500">Retrieving official request logs...</p>
        </div>
      ) : activeList.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-3xs p-12 text-center max-w-md mx-auto">
          {activeTab === 'pending' ? (
            <>
              <CheckCircle2 className="w-12 h-12 text-green-500/80 mx-auto mb-3" />
              <h3 className="text-sm font-extrabold text-slate-800">All caught up!</h3>
              <p className="text-xs text-slate-400 mt-1">There are no pending correction requests for you to review at this moment.</p>
            </>
          ) : activeTab === 'approved' ? (
            <>
              <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700">No approved disputes</h3>
              <p className="text-xs text-slate-400 mt-1">Disputes approved by you will show up here for historical tracking.</p>
            </>
          ) : (
            <>
              <XCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700">No rejected disputes</h3>
              <p className="text-xs text-slate-400 mt-1">Any rejected student correction requests will be listed here.</p>
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
                  <th className="py-3 px-4">Course Unit</th>
                  <th className="py-3 px-4">Class Date</th>
                  <th className="py-3 px-4 text-center">Original</th>
                  <th className="py-3 px-4 max-w-xs">Student's Reason</th>
                  <th className="py-3 px-4">Filed At</th>
                  {activeTab !== 'pending' && <th className="py-3 px-4">Reviewer Note</th>}
                  {activeTab === 'pending' && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {activeList.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/30 transition-colors">
                    {/* Student */}
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-slate-800">{req.profiles?.full_name || 'Student'}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase">{req.profiles?.adm_no || 'N/A'}</div>
                    </td>

                    {/* Unit */}
                    <td className="py-3.5 px-4 font-bold text-slate-700" title={req.course_units?.name}>
                      <span className="block max-w-[160px] truncate">{req.course_units?.name || 'Syllabus Subject'}</span>
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

                    {/* Reviewer Note (Resolved Tabs Only) */}
                    {activeTab !== 'pending' && (
                      <td className="py-3.5 px-4 text-slate-500 max-w-xs leading-relaxed italic">
                        {req.reviewer_note || <span className="text-slate-300 font-medium">None</span>}
                      </td>
                    )}

                    {/* Actions (Pending Tab Only) */}
                    {activeTab === 'pending' && (
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenAction(req, 'reject')}
                            className="px-2.5 py-1.5 border border-red-200 bg-red-50/10 hover:bg-red-50 text-red-700 rounded-lg text-[10px] font-extrabold uppercase tracking-wide shadow-3xs transition-all cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleOpenAction(req, 'approve')}
                            className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-extrabold uppercase tracking-wide shadow-3xs hover:shadow-md transition-all cursor-pointer"
                          >
                            Approve
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RESOLVE DIALOG MODAL */}
      {selectedRequest && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="action-dialog-overlay">
          {/* Backdrop overlay */}
          <div
            onClick={handleCloseAction}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
          />

          {/* Modal Container */}
          <form
            onSubmit={handleActionSubmit}
            className="relative bg-white w-full max-w-md rounded-2xl border border-slate-100 shadow-2xl overflow-hidden z-10 p-5 space-y-4"
          >
            {/* Header */}
            <div>
              <h3 className="text-sm font-extrabold text-slate-850">
                {actionType === 'approve' ? 'Approve Correction Request' : 'Reject Correction Request'}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {actionType === 'approve'
                  ? 'The attendance record status will be updated to Present.'
                  : 'The student request will be rejected and the original status remains.'}
              </p>
            </div>

            {/* Info Summary Panel */}
            <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Student:</span>
                <span className="text-slate-700 font-extrabold">{selectedRequest.profiles?.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Unit:</span>
                <span className="text-slate-700 font-extrabold max-w-[240px] truncate">{selectedRequest.course_units?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Reason:</span>
                <span className="text-slate-500 font-medium italic max-w-[240px] truncate">{selectedRequest.reason}</span>
              </div>
            </div>

            {/* Textarea review note */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label htmlFor="reviewer-note" className="font-bold text-slate-700">
                  {actionType === 'approve' ? 'Reviewer Note (Optional)' : 'Reason for rejection (Required)'}
                  {actionType === 'reject' && <span className="text-red-500"> *</span>}
                </label>
              </div>
              <textarea
                id="reviewer-note"
                rows={3}
                value={reviewerNote}
                onChange={(e) => {
                  setReviewerNote(e.target.value);
                  if (e.target.value.trim()) setFormError(null);
                }}
                disabled={submitting}
                placeholder={
                  actionType === 'approve'
                    ? 'e.g. Verified. The student was present in class.'
                    : 'e.g. Class registers do not show your attendance on this day, and no justification was provided.'
                }
                className={`w-full px-3 py-2 text-xs border rounded-xl bg-slate-50/50 focus:bg-white outline-hidden focus:ring-2 transition-all resize-none ${
                  formError 
                    ? 'border-red-400 focus:ring-red-500/10 focus:border-red-500' 
                    : 'border-slate-200 focus:ring-blue-500/10 focus:border-blue-500'
                }`}
              />
              {formError && (
                <p className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {formError}
                </p>
              )}
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCloseAction}
                disabled={submitting}
                className="px-3.5 py-2 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || (actionType === 'reject' && !reviewerNote.trim())}
                className={`px-3.5 py-2 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md disabled:opacity-60 transition-all flex items-center gap-1.5 cursor-pointer ${
                  actionType === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>{actionType === 'approve' ? 'Approve dispute' : 'Reject dispute'}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
