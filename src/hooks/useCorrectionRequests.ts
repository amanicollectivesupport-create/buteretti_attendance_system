import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseReal } from '../lib/supabaseClient';

const getLocalDB = () => {
  const stored = localStorage.getItem('butere_tti_attendance_db');
  if (!stored) return { profiles: [], courseUnits: [], attendance: [], correction_requests: [] };
  try {
    const parsed = JSON.parse(stored);
    return {
      profiles: parsed.profiles || [],
      courseUnits: parsed.courseUnits || parsed.course_units || [],
      attendance: parsed.attendance || [],
      correction_requests: parsed.correction_requests || parsed.correctionRequests || []
    };
  } catch (e) {
    return { profiles: [], courseUnits: [], attendance: [], correction_requests: [] };
  }
};

export function useCorrectionRequests() {
  const { profile } = useAuth();

  const submitCorrectionRequest = async ({
    attendanceId,
    lecturerId,
    unitId,
    originalStatus,
    reason,
  }: {
    attendanceId: string;
    lecturerId: string;
    unitId: string;
    originalStatus: string;
    reason: string;
  }) => {
    if (!profile?.id) {
      return { data: null, error: new Error('User is not authenticated') };
    }
    if (reason.trim().length < 10) {
      return { data: null, error: new Error('Dispute reason must be at least 10 characters long') };
    }

    if (!isSupabaseReal()) {
      const db = getLocalDB();
      const pendingExists = db.correction_requests.some(
        (r: any) => r.attendance_id === attendanceId && r.status === 'pending'
      );
      if (pendingExists) {
        return { data: null, error: new Error('A pending request already exists for this record') };
      }

      const newRequest = {
        id: `cr-${Date.now()}`,
        student_id: profile.id,
        attendance_id: attendanceId,
        lecturer_id: lecturerId,
        unit_id: unitId,
        original_status: originalStatus,
        reason: reason.trim(),
        status: 'pending',
        reviewer_note: null,
        reviewed_at: null,
        created_at: new Date().toISOString(),
      };

      const updated = [...db.correction_requests, newRequest];
      const stored = localStorage.getItem('butere_tti_attendance_db');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          parsed.correction_requests = updated;
          localStorage.setItem('butere_tti_attendance_db', JSON.stringify(parsed));
        } catch (e) {}
      }

      return { data: newRequest, error: null };
    } else {
      // Check if a pending request already exists in real DB
      const { data: existing, error: checkError } = await supabase
        .from('correction_requests')
        .select('id')
        .eq('attendance_id', attendanceId)
        .eq('status', 'pending');

      if (checkError) return { data: null, error: checkError };
      if (existing && existing.length > 0) {
        return { data: null, error: new Error('A pending request already exists for this record') };
      }

      const { data, error } = await supabase
        .from('correction_requests')
        .insert({
          student_id: profile.id,
          attendance_id: attendanceId,
          lecturer_id: lecturerId,
          unit_id: unitId,
          original_status: originalStatus,
          reason: reason.trim(),
        })
        .select()
        .single();

      return { data, error };
    }
  };

  const getStudentRequests = async () => {
    if (!profile?.id) return [];

    if (!isSupabaseReal()) {
      const db = getLocalDB();
      const studentReqs = db.correction_requests.filter((r: any) => r.student_id === profile.id);

      const mapped = studentReqs.map((r: any) => {
        const unit = db.courseUnits.find((u: any) => u.id === r.unit_id);
        const att = db.attendance.find((a: any) => a.id === r.attendance_id);
        return {
          ...r,
          course_units: unit ? { name: unit.name } : { name: 'Unknown Subject' },
          attendance: att ? { date: att.date, status: att.status } : { date: '', status: '' }
        };
      });

      mapped.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return mapped;
    }

    const { data, error } = await supabase
      .from('correction_requests')
      .select(`
        id, status, reason, reviewer_note, 
        original_status, created_at, reviewed_at,
        course_units!unit_id ( name ),
        attendance!attendance_id ( date, status )
      `)
      .eq('student_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching student requests:', error);
      return [];
    }
    return data || [];
  };

  const getLecturerRequests = async () => {
    if (!profile?.id) return { pending: [], approved: [], rejected: [] };

    if (!isSupabaseReal()) {
      const db = getLocalDB();
      const lecturerReqs = db.correction_requests.filter((r: any) => r.lecturer_id === profile.id);

      const mapped = lecturerReqs.map((r: any) => {
        const unit = db.courseUnits.find((u: any) => u.id === r.unit_id);
        const att = db.attendance.find((a: any) => a.id === r.attendance_id);
        const stud = db.profiles.find((p: any) => p.id === r.student_id);
        return {
          ...r,
          course_units: unit ? { name: unit.name } : { name: 'Unknown Subject' },
          attendance: att ? { date: att.date } : { date: '' },
          profiles: stud ? { full_name: stud.full_name, adm_no: stud.adm_no } : { full_name: 'Unknown Student', adm_no: '' }
        };
      });

      mapped.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return {
        pending: mapped.filter((r: any) => r.status === 'pending'),
        approved: mapped.filter((r: any) => r.status === 'approved'),
        rejected: mapped.filter((r: any) => r.status === 'rejected')
      };
    }

    const { data, error } = await supabase
      .from('correction_requests')
      .select(`
        id, status, reason, original_status, created_at, reviewer_note, reviewed_at,
        course_units!unit_id ( name ),
        attendance!attendance_id ( date ),
        profiles!student_id ( full_name, adm_no )
      `)
      .eq('lecturer_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching lecturer requests:', error);
      return { pending: [], approved: [], rejected: [] };
    }

    const records = data || [];
    return {
      pending: records.filter((r: any) => r.status === 'pending'),
      approved: records.filter((r: any) => r.status === 'approved'),
      rejected: records.filter((r: any) => r.status === 'rejected')
    };
  };

  const approveRequest = async (requestId: string, reviewerNote?: string) => {
    const { error } = await supabase.rpc('approve_correction_request', {
      p_request_id: requestId,
      p_reviewer_note: reviewerNote || null
    });
    return { error };
  };

  const rejectRequest = async (requestId: string, reviewerNote: string) => {
    if (!reviewerNote || !reviewerNote.trim()) {
      return { error: new Error('A reason is required when rejecting a request') };
    }
    const { error } = await supabase.rpc('reject_correction_request', {
      p_request_id: requestId,
      p_reviewer_note: reviewerNote
    });
    return { error };
  };

  const getAllRequestsAdmin = async () => {
    if (!isSupabaseReal()) {
      const db = getLocalDB();
      const allReqs = db.correction_requests;

      const mapped = allReqs.map((r: any) => {
        const unit = db.courseUnits.find((u: any) => u.id === r.unit_id);
        const att = db.attendance.find((a: any) => a.id === r.attendance_id);
        const stud = db.profiles.find((p: any) => p.id === r.student_id);
        const lect = db.profiles.find((p: any) => p.id === r.lecturer_id);
        return {
          ...r,
          course_units: unit ? { name: unit.name } : { name: 'Unknown Subject' },
          attendance: att ? { date: att.date } : { date: '' },
          profiles: stud ? { full_name: stud.full_name, adm_no: stud.adm_no } : { full_name: 'Unknown Student', adm_no: '' },
          lecturer: lect ? { full_name: lect.full_name } : { full_name: 'System Auto' }
        };
      });

      mapped.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return {
        pending: mapped.filter((r: any) => r.status === 'pending'),
        approved: mapped.filter((r: any) => r.status === 'approved'),
        rejected: mapped.filter((r: any) => r.status === 'rejected')
      };
    }

    const { data, error } = await supabase
      .from('correction_requests')
      .select(`
        id, status, reason, reviewer_note,
        original_status, created_at, reviewed_at,
        course_units!unit_id ( name ),
        attendance!attendance_id ( date ),
        student:profiles!student_id ( full_name, adm_no ),
        lecturer:profiles!lecturer_id ( full_name )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching admin requests:', error);
      throw new Error(`Error fetching admin requests: ${error.message} (${error.code || 'no code'})`);
    }

    const records = data || [];
    const mapped = records.map((r: any) => {
      // Standardize the student profile join and lecturer profile join names so they are safe
      const profilesStudent = r.student || r.profiles || r['profiles!student_id'] || {};
      const profilesLecturer = r.lecturer || r['profiles!lecturer_id'] || {};

      return {
        ...r,
        profiles: Array.isArray(profilesStudent) ? profilesStudent[0] : profilesStudent,
        lecturer: Array.isArray(profilesLecturer) ? profilesLecturer[0] : profilesLecturer
      };
    });

    return {
      pending: mapped.filter((r: any) => r.status === 'pending'),
      approved: mapped.filter((r: any) => r.status === 'approved'),
      rejected: mapped.filter((r: any) => r.status === 'rejected')
    };
  };

  return {
    submitCorrectionRequest,
    getStudentRequests,
    getLecturerRequests,
    approveRequest,
    rejectRequest,
    getAllRequestsAdmin
  };
}
