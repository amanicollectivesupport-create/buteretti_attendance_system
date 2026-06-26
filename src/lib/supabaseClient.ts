import { createClient } from '@supabase/supabase-js';

// Clean helper to check if Supabase is genuinely configured
export const isSupabaseReal = (): boolean => {
  if (typeof window !== 'undefined' && localStorage.getItem('force_demo_mode') === 'true') {
    return false;
  }
  let url = ((import.meta as any).env.VITE_SUPABASE_URL || '').trim();
  let key = ((import.meta as any).env.VITE_SUPABASE_ANON_KEY || '').trim();
  
  // Strip outer quotes if present
  url = url.replace(/^["']|["']$/g, '').trim();
  key = key.replace(/^["']|["']$/g, '').trim();

  if (!url || !key) return false;
  if (
    url.includes('your-project.supabase.co') ||
    key.includes('your-anon-key') ||
    url === '' ||
    key === ''
  ) {
    return false;
  }
  return true;
};

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

// Create a real client only if credentials are valid, else create a fully featured mock client
let supabaseInstance: any;

const DEFAULT_PROFILES = [
  { id: 'usr-admin-1', full_name: 'Madam Beatrice Wekesa', role: 'admin', adm_no: null, course_id: null, phone: '+254712345678', created_at: '2025-01-01T08:00:00Z' },
  { id: 'usr-lect-omwamba', full_name: 'Dr. Christopher Omwamba', role: 'lecturer', adm_no: null, course_id: null, phone: '+254722998877', created_at: '2025-01-05T08:00:00Z' },
  { id: 'usr-lect-kiprop', full_name: 'Eng. Kennedy Kiprop', role: 'lecturer', adm_no: null, course_id: null, phone: '+254733445566', created_at: '2025-01-06T08:00:00Z' },
  { id: 'usr-lect-nyaboke', full_name: 'Mrs. Lydia Nyaboke', role: 'lecturer', adm_no: null, course_id: null, phone: '+254701234321', created_at: '2025-01-07T08:00:00Z' },
  { id: 'usr-lect-mutua', full_name: 'Mr. Johnstone Mutua', role: 'lecturer', adm_no: null, course_id: null, phone: '+254788776655', created_at: '2025-01-08T08:00:00Z' },
  { id: 'usr-stud-kipch', full_name: 'Emmanuel Kipchirchir', role: 'student', adm_no: 'BTTI/ICT/2024/001', course_id: 'course-dict', phone: '+254711223344', created_at: '2024-05-01T08:00:00Z' },
  { id: 'usr-stud-wanjiku', full_name: 'Mercy Wanjiku Kamau', role: 'student', adm_no: 'BTTI/ICT/2024/002', course_id: 'course-dict', phone: '+254722334455', created_at: '2024-05-01T09:00:00Z' },
  { id: 'usr-stud-omondi', full_name: 'Brian Omondi Otieno', role: 'student', adm_no: 'BTTI/ICT/2024/003', course_id: 'course-dict', phone: '+254733445566', created_at: '2024-05-02T08:00:00Z' },
  { id: 'usr-stud-nekesa', full_name: 'Stacy Nekesa Nafula', role: 'student', adm_no: 'BTTI/ICT/2024/004', course_id: 'course-dict', phone: '+254744556677', created_at: '2024-05-02T09:00:00Z' },
  { id: 'usr-stud-protich', full_name: 'Felix Kiprotich Cheruiyot', role: 'student', adm_no: 'BTTI/ICT/2024/005', course_id: 'course-dict', phone: '+254755667788', created_at: '2024-05-03T08:00:00Z' },
  { id: 'usr-stud-atieno', full_name: 'Brenda Atieno Onyango', role: 'student', adm_no: 'BTTI/ELE/2024/012', course_id: 'course-deee', phone: '+254712435465', created_at: '2024-05-10T08:00:00Z' },
  { id: 'usr-stud-barasa', full_name: 'David Wafula Barasa', role: 'student', adm_no: 'BTTI/ELE/2024/015', course_id: 'course-deee', phone: '+254790807060', created_at: '2024-05-10T09:00:00Z' },
  { id: 'usr-stud-mwangi', full_name: 'Jane Muthoni Mwangi', role: 'student', adm_no: 'BTTI/BIZ/2024/054', course_id: 'course-dbm', phone: '+254721456987', created_at: '2024-05-12T08:00:00Z' },
  { id: 'usr-stud-aluso', full_name: 'Stephen Ochieng Aluso', role: 'student', adm_no: 'BTTI/BIZ/2024/055', course_id: 'course-dbm', phone: '+254735987154', created_at: '2024-05-12T09:00:00Z' }
];

const listeners: any[] = [];
const triggerAuthChange = (event: string, session: any) => {
  listeners.forEach(cb => cb(event, session));
};

const getProfileByEmail = (emailStr: string) => {
  const email = emailStr.toLowerCase().trim();
  const dbStateStr = localStorage.getItem('butere_tti_attendance_db');
  let profiles = DEFAULT_PROFILES;
  
  if (dbStateStr) {
    try {
      const dbState = JSON.parse(dbStateStr);
      if (dbState && dbState.profiles && dbState.profiles.length > 0) {
        profiles = dbState.profiles;
      }
    } catch (e) {}
  }

  for (const p of profiles) {
    const names = p.full_name.toLowerCase().split(' ');
    const matched = names.some((n: string) => n.length > 2 && email.includes(n)) || 
                    (p.role === 'admin' && email.includes('admin')) ||
                    (p.adm_no && email.includes(p.adm_no.toLowerCase().replace(/[^a-z0-9]/g, '')));
    if (matched) return p;
  }
  
  // Fallback based on email keywords
  if (email.includes('admin')) {
    return profiles.find((p: any) => p.role === 'admin') || DEFAULT_PROFILES[0];
  }
  if (email.includes('lecturer') || email.includes('lect')) {
    return profiles.find((p: any) => p.role === 'lecturer') || DEFAULT_PROFILES[1];
  }
  if (email.includes('student') || email.includes('stud')) {
    return profiles.find((p: any) => p.role === 'student') || DEFAULT_PROFILES[5];
  }
  return null;
};

const getLocalData = (table: string): any[] => {
  const stored = localStorage.getItem('butere_tti_attendance_db');
  if (!stored) return [];
  try {
    const db = JSON.parse(stored);
    let key = table;
    if (table === 'course_units') key = 'courseUnits';
    if (table === 'lecturer_units') key = 'lecturerUnits';
    return db[key] || [];
  } catch (e) {
    return [];
  }
};

const saveLocalData = (table: string, data: any[]) => {
  const stored = localStorage.getItem('butere_tti_attendance_db');
  if (!stored) return;
  try {
    const db = JSON.parse(stored);
    let key = table;
    if (table === 'course_units') key = 'courseUnits';
    if (table === 'lecturer_units') key = 'lecturerUnits';
    db[key] = data;
    localStorage.setItem('butere_tti_attendance_db', JSON.stringify(db));
  } catch (e) {}
};

class MockQueryBuilder {
  private table: string;
  private data: any[];
  
  constructor(table: string) {
    this.table = table;
    this.data = getLocalData(table);
  }
  
  select(fields: string = '*') {
    return this;
  }
  
  eq(field: string, value: any) {
    this.data = this.data.filter(item => {
      const itemVal = item[field];
      if (itemVal === undefined || itemVal === null) return false;
      return String(itemVal).toLowerCase() === String(value).toLowerCase();
    });
    return this;
  }
  
  maybeSingle() {
    return Promise.resolve({ data: this.data[0] || null, error: null });
  }
  
  single() {
    if (this.data.length === 0) {
      return Promise.resolve({ data: null, error: { message: 'Not found' } });
    }
    return Promise.resolve({ data: this.data[0], error: null });
  }
  
  limit(num: number) {
    this.data = this.data.slice(0, num);
    return this;
  }
  
  then(onfulfilled: any, onrejected: any) {
    return Promise.resolve({ data: this.data, error: null }).then(onfulfilled, onrejected);
  }
  
  async insert(rowOrRows: any) {
    const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
    const current = getLocalData(this.table);
    const updated = [...current, ...rows];
    saveLocalData(this.table, updated);
    return { data: rowOrRows, error: null };
  }
  
  async upsert(rowOrRows: any) {
    const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
    const current = getLocalData(this.table);
    for (const r of rows) {
      const idx = current.findIndex(item => item.id === r.id);
      if (idx !== -1) {
        current[idx] = { ...current[idx], ...r };
      } else {
        current.push(r);
      }
    }
    saveLocalData(this.table, current);
    return { data: rowOrRows, error: null };
  }
  
  async delete() {
    return {
      eq: async (field: string, value: any) => {
        const current = getLocalData(this.table);
        const updated = current.filter(item => String(item[field]).toLowerCase() !== String(value).toLowerCase());
        saveLocalData(this.table, updated);
        return { data: null, error: null };
      }
    };
  }

  async update(values: any) {
    const current = getLocalData(this.table);
    const matchedIds = this.data.map(item => item.id);
    const updated = current.map(item => {
      if (matchedIds.includes(item.id)) {
        return { ...item, ...values };
      }
      return item;
    });
    saveLocalData(this.table, updated);
    this.data = this.data.map(item => {
      if (matchedIds.includes(item.id)) {
        return { ...item, ...values };
      }
      return item;
    });
    return { data: this.data, error: null };
  }
}

if (isSupabaseReal()) {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.log('Using robust, functional local storage fallback client for Supabase...');
  supabaseInstance = {
    auth: {
      getSession: async () => {
        const stored = localStorage.getItem('mock_session');
        if (stored) {
          return { data: { session: JSON.parse(stored) }, error: null };
        }
        return { data: { session: null }, error: null };
      },
      signInWithPassword: async ({ email, password }: any) => {
        const profile = getProfileByEmail(email);
        if (!profile) {
          return { data: { user: null }, error: { message: 'Invalid email or profile not found in local database.' } };
        }
        const session = {
          user: {
            id: profile.id,
            email: email,
            user_metadata: {
              full_name: profile.full_name,
              role: profile.role
            }
          }
        };
        localStorage.setItem('mock_session', JSON.stringify(session));
        triggerAuthChange('SIGNED_IN', session);
        return { data: { user: session.user }, error: null };
      },
      signUp: async ({ email, password, options }: any) => {
        const role = options?.data?.role || 'student';
        const full_name = options?.data?.full_name || 'New User';
        const id = `usr-stud-linked-${Date.now()}`;
        const session = {
          user: {
            id,
            email,
            user_metadata: {
              full_name,
              role
            }
          }
        };
        localStorage.setItem('mock_session', JSON.stringify(session));
        
        // Also ensure the profile exists in local state
        const stored = localStorage.getItem('butere_tti_attendance_db');
        if (stored) {
          try {
            const db = JSON.parse(stored);
            const profiles = db.profiles || [];
            const index = profiles.findIndex((p: any) => p.full_name === full_name || p.id === id);
            if (index === -1) {
              profiles.push({
                id,
                full_name,
                role,
                adm_no: null,
                course_id: null,
                phone: '',
                created_at: new Date().toISOString()
              });
              db.profiles = profiles;
              localStorage.setItem('butere_tti_attendance_db', JSON.stringify(db));
            }
          } catch (e) {}
        }
        
        triggerAuthChange('SIGNED_IN', session);
        return { data: { user: session.user }, error: null };
      },
      signOut: async () => {
        localStorage.removeItem('mock_session');
        triggerAuthChange('SIGNED_OUT', null);
        return { error: null };
      },
      resetPasswordForEmail: async (email: string, options: any) => {
        return { error: null };
      },
      updateUser: async (data: any) => {
        return { error: null };
      },
      onAuthStateChange: (callback: any) => {
        listeners.push(callback);
        const stored = localStorage.getItem('mock_session');
        const session = stored ? JSON.parse(stored) : null;
        callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                const idx = listeners.indexOf(callback);
                if (idx !== -1) listeners.splice(idx, 1);
              }
            }
          }
        };
      }
    },
    from: (table: string) => {
      return new MockQueryBuilder(table);
    },
    rpc: async (name: string, args: any) => {
      if (name === 'validate_student_signup') {
        const admNo = args.p_adm_no;
        const profiles = getLocalData('profiles');
        const match = profiles.find(p => p.role === 'student' && p.adm_no?.toUpperCase() === admNo.toUpperCase());
        if (!match) return { data: 'not_found', error: null };
        if (match.auth_linked) return { data: 'taken', error: null };
        return { data: 'valid', error: null };
      }
      
      if (name === 'get_student_attendance_summary') {
        const studentId = args.p_student_id || args.student_id;
        const semester = args.p_semester_filter || args.semester_filter;
        const academicYear = args.p_academic_year_filter || args.academic_year_filter;
        
        const student = getLocalData('profiles').find(p => p.id === studentId);
        if (!student || !student.course_id) return { data: [], error: null };
        
        const studentCourseUnits = getLocalData('course_units').filter(u => u.course_id === student.course_id);
        
        const attendance = getLocalData('attendance');
        const data = studentCourseUnits.map(unit => {
          const unitAttendance = attendance.filter(
            a => a.student_id === studentId && 
                 a.unit_id === unit.id && 
                 a.academic_year === academicYear && 
                 a.semester === semester
          );
          const total_classes = unitAttendance.length;
          const classes_attended = unitAttendance.filter(a => a.status === 'Present').length;
          return {
            unit_id: unit.id,
            unit_name: unit.name,
            total_classes,
            classes_attended
          };
        });
        return { data, error: null };
      }

      if (name === 'approve_correction_request') {
        const reqId = args.p_request_id;
        const note = args.p_reviewer_note;
        
        const requests = getLocalData('correction_requests');
        const reqIdx = requests.findIndex(r => r.id === reqId);
        if (reqIdx === -1) return { data: null, error: { message: 'Request not found' } };
        
        requests[reqIdx].status = 'approved';
        requests[reqIdx].reviewer_note = note;
        requests[reqIdx].reviewed_at = new Date().toISOString();
        saveLocalData('correction_requests', requests);
        
        // Update actual attendance
        const attId = requests[reqIdx].attendance_id;
        const attendance = getLocalData('attendance');
        const attIdx = attendance.findIndex(a => a.id === attId);
        if (attIdx !== -1) {
          attendance[attIdx].status = 'Present';
          saveLocalData('attendance', attendance);
        }
        
        return { data: null, error: null };
      }
      
      if (name === 'reject_correction_request') {
        const reqId = args.p_request_id;
        const note = args.p_reviewer_note;
        
        if (!note || !note.trim()) {
          return { data: null, error: { message: 'A reason is required when rejecting a request' } };
        }
        
        const requests = getLocalData('correction_requests');
        const reqIdx = requests.findIndex(r => r.id === reqId);
        if (reqIdx === -1) return { data: null, error: { message: 'Request not found' } };
        
        requests[reqIdx].status = 'rejected';
        requests[reqIdx].reviewer_note = note;
        requests[reqIdx].reviewed_at = new Date().toISOString();
        saveLocalData('correction_requests', requests);
        
        return { data: null, error: null };
      }
      
      return { data: null, error: { message: `RPC ${name} is not mocked` } };
    }
  };
}

export const supabase = supabaseInstance;
