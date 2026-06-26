import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, AlertTriangle, HelpCircle } from 'lucide-react';
import { useCorrectionRequests } from '../../hooks/useCorrectionRequests';
import { toast } from 'react-hot-toast';
import { format, parseISO } from 'date-fns';

interface DisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  attendanceRecord: {
    id: string;
    date: string;
    status: 'Absent' | 'Excused';
    lecturer_id: string;
    unit_id: string;
    unit_name: string;
  } | null;
}

export default function DisputeModal({
  isOpen,
  onClose,
  onSuccess,
  attendanceRecord
}: DisputeModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const { submitCorrectionRequest } = useCorrectionRequests();

  if (!isOpen || !attendanceRecord) return null;

  const handleReasonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setReason(val);
    if (val.trim().length >= 10) {
      setErrorMsg(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedReason = reason.trim();

    if (trimmedReason.length < 10) {
      setErrorMsg('Dispute reason must be at least 10 characters long.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await submitCorrectionRequest({
        attendanceId: attendanceRecord.id,
        lecturerId: attendanceRecord.lecturer_id,
        unitId: attendanceRecord.unit_id,
        originalStatus: attendanceRecord.status,
        reason: trimmedReason
      });

      if (error) {
        toast.error(error.message || 'Failed to submit correction request.');
      } else {
        toast.success('Dispute submitted. Your lecturer will review it shortly.');
        onSuccess();
        setReason('');
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during submission.');
    } finally {
      setLoading(false);
    }
  };

  // Safe date formatting
  let formattedDate = attendanceRecord.date;
  try {
    const parsedDate = attendanceRecord.date.includes('T') 
      ? parseISO(attendanceRecord.date) 
      : new Date(attendanceRecord.date);
    formattedDate = format(parsedDate, 'EEEE, d MMMM yyyy');
  } catch (e) {
    console.error('Error parsing date:', e);
  }

  const isStatusAbsent = attendanceRecord.status === 'Absent';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          id="dispute-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            if (!loading) onClose();
          }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
        />

        {/* Modal content container */}
        <motion.div
          id="dispute-modal-content"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative bg-white w-full max-w-md rounded-2xl border border-slate-100 shadow-2xl overflow-hidden z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-extrabold text-slate-850">Dispute Attendance Record</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Submit an official review request to your lecturer.</p>
            </div>
            {!loading && (
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Info block */}
            <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-start">
                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider mt-0.5">Unit:</span>
                <span className="text-slate-800 font-extrabold text-right max-w-[240px] truncate" title={attendanceRecord.unit_name}>
                  {attendanceRecord.unit_name}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Date:</span>
                <span className="text-slate-700 font-medium">{formattedDate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Marked as:</span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                  isStatusAbsent 
                    ? 'bg-red-50 text-red-700 border border-red-100' 
                    : 'bg-amber-50 text-amber-700 border border-amber-100'
                }`}>
                  {attendanceRecord.status}
                </span>
              </div>
            </div>

            {/* Input field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label htmlFor="dispute-reason" className="font-bold text-slate-700">
                  Reason for dispute <span className="text-red-500">*</span>
                </label>
                <span className={`text-[10px] font-medium ${reason.trim().length >= 10 ? 'text-slate-400' : 'text-amber-600'}`}>
                  {reason.trim().length} / 10 characters minimum
                </span>
              </div>
              <textarea
                id="dispute-reason"
                rows={4}
                value={reason}
                onChange={handleReasonChange}
                disabled={loading}
                placeholder="Explain why this record is incorrect. e.g. I was present in class but my attendance was not captured in the system during the roll call."
                className={`w-full px-3 py-2 text-xs border rounded-xl bg-slate-50/50 focus:bg-white outline-hidden focus:ring-2 transition-all resize-none ${
                  errorMsg 
                    ? 'border-red-400 focus:ring-red-500/10 focus:border-red-500' 
                    : 'border-slate-200 focus:ring-blue-500/10 focus:border-blue-500'
                }`}
              />
              {errorMsg && (
                <p className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  {errorMsg}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-3.5 py-2 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || reason.trim().length < 10}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md disabled:opacity-60 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit Request</span>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
