/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseState, Department, Course, CourseUnit, Profile, LecturerUnit, AttendanceRecord } from '../types';

// Constants for initial data seeding
const INITIAL_DEPARTMENTS: Department[] = [
  { id: 'dept-ict', name: 'Information Communication Technology (ICT)', created_at: '2025-01-10T08:00:00Z' },
  { id: 'dept-elec', name: 'Electrical & Electronics Engineering', created_at: '2025-01-11T09:00:00Z' },
  { id: 'dept-build', name: 'Building & Civil Engineering', created_at: '2025-01-12T10:00:00Z' },
  { id: 'dept-biz', name: 'Business & Management Studies', created_at: '2025-01-13T11:00:00Z' },
  { id: 'dept-hosp', name: 'Hospitality & Institutional Management', created_at: '2025-01-14T12:00:00Z' }
];

const INITIAL_COURSES: Course[] = [
  { id: 'course-dict', name: 'Diploma in Information Communication Technology (DICT)', department_id: 'dept-ict', duration_years: 3, created_at: '2025-01-15T08:00:00Z' },
  { id: 'course-cict', name: 'Certificate in Information Communication Technology (CICT)', department_id: 'dept-ict', duration_years: 2, created_at: '2025-01-15T09:00:00Z' },
  { id: 'course-deee', name: 'Diploma in Electrical & Electronics Engineering (Power Option)', department_id: 'dept-elec', duration_years: 3, created_at: '2025-01-16T10:00:00Z' },
  { id: 'course-cpbs', name: 'Certificate in Plumbing & Building Services', department_id: 'dept-build', duration_years: 2, created_at: '2025-01-17T11:00:00Z' },
  { id: 'course-dbm', name: 'Diploma in Business Management (DBM)', department_id: 'dept-biz', duration_years: 3, created_at: '2025-01-18T12:00:00Z' },
  { id: 'course-cfb', name: 'Certificate in Food & Beverage Production', department_id: 'dept-hosp', duration_years: 2, created_at: '2025-01-19T13:00:00Z' }
];

const INITIAL_COURSE_UNITS: CourseUnit[] = [
  // ICT - DICT Units
  { id: 'unit-oop', name: 'Object Oriented Programming (Java)', course_id: 'course-dict', year_of_study: 2, semester: 1, created_at: '2025-02-01T08:00:00Z' },
  { id: 'unit-dbms', name: 'Database Management Systems (MySQL)', course_id: 'course-dict', year_of_study: 2, semester: 1, created_at: '2025-02-01T09:00:00Z' },
  { id: 'unit-sad', name: 'System Analysis & Design', course_id: 'course-dict', year_of_study: 2, semester: 1, created_at: '2025-02-02T10:00:00Z' },
  { id: 'unit-os', name: 'Operating Systems', course_id: 'course-dict', year_of_study: 1, semester: 2, created_at: '2025-02-03T11:00:00Z' },
  { id: 'unit-net', name: 'Data Communication & Networking', course_id: 'course-dict', year_of_study: 3, semester: 1, created_at: '2025-02-04T12:00:00Z' },

  // Electrical Units
  { id: 'unit-epg', name: 'Electrical Power Generation & Transmission', course_id: 'course-deee', year_of_study: 2, semester: 1, created_at: '2025-02-05T08:00:00Z' },
  { id: 'unit-ect', name: 'Electrical Circuit Theory', course_id: 'course-deee', year_of_study: 1, semester: 2, created_at: '2025-02-05T09:00:00Z' },
  { id: 'unit-cs', name: 'Control Systems', course_id: 'course-deee', year_of_study: 3, semester: 1, created_at: '2025-02-06T10:00:00Z' },

  // Business Units
  { id: 'unit-fa', name: 'Financial Accounting I', course_id: 'course-dbm', year_of_study: 1, semester: 1, created_at: '2025-02-07T08:00:00Z' },
  { id: 'unit-hrm', name: 'Human Resource Management', course_id: 'course-dbm', year_of_study: 2, semester: 1, created_at: '2025-02-07T09:00:00Z' },
  { id: 'unit-ee', name: 'Entrepreneurship Education', course_id: 'course-dbm', year_of_study: 1, semester: 2, created_at: '2025-02-08T10:00:00Z' }
];

const INITIAL_PROFILES: Profile[] = [
  // Admins
  { id: 'usr-admin-1', full_name: 'Madam Beatrice Wekesa', role: 'admin', adm_no: null, course_id: null, phone: '+254712345678', created_at: '2025-01-01T08:00:00Z' },
  
  // Lecturers
  { id: 'usr-lect-omwamba', full_name: 'Dr. Christopher Omwamba', role: 'lecturer', adm_no: null, course_id: null, phone: '+254722998877', created_at: '2025-01-05T08:00:00Z' },
  { id: 'usr-lect-kiprop', full_name: 'Eng. Kennedy Kiprop', role: 'lecturer', adm_no: null, course_id: null, phone: '+254733445566', created_at: '2025-01-06T08:00:00Z' },
  { id: 'usr-lect-nyaboke', full_name: 'Mrs. Lydia Nyaboke', role: 'lecturer', adm_no: null, course_id: null, phone: '+254701234321', created_at: '2025-01-07T08:00:00Z' },
  { id: 'usr-lect-mutua', full_name: 'Mr. Johnstone Mutua', role: 'lecturer', adm_no: null, course_id: null, phone: '+254788776655', created_at: '2025-01-08T08:00:00Z' },

  // Students - ICT Course (DICT)
  { id: 'usr-stud-kipch', full_name: 'Emmanuel Kipchirchir', role: 'student', adm_no: 'BTTI/ICT/2024/001', course_id: 'course-dict', phone: '+254711223344', created_at: '2024-05-01T08:00:00Z' },
  { id: 'usr-stud-wanjiku', full_name: 'Mercy Wanjiku Kamau', role: 'student', adm_no: 'BTTI/ICT/2024/002', course_id: 'course-dict', phone: '+254722334455', created_at: '2024-05-01T09:00:00Z' },
  { id: 'usr-stud-omondi', full_name: 'Brian Omondi Otieno', role: 'student', adm_no: 'BTTI/ICT/2024/003', course_id: 'course-dict', phone: '+254733445566', created_at: '2024-05-02T08:00:00Z' },
  { id: 'usr-stud-nekesa', full_name: 'Stacy Nekesa Nafula', role: 'student', adm_no: 'BTTI/ICT/2024/004', course_id: 'course-dict', phone: '+254744556677', created_at: '2024-05-02T09:00:00Z' },
  { id: 'usr-stud-protich', full_name: 'Felix Kiprotich Cheruiyot', role: 'student', adm_no: 'BTTI/ICT/2024/005', course_id: 'course-dict', phone: '+254755667788', created_at: '2024-05-03T08:00:00Z' },

  // Students - Electrical (DEEE)
  { id: 'usr-stud-atieno', full_name: 'Brenda Atieno Onyango', role: 'student', adm_no: 'BTTI/ELE/2024/012', course_id: 'course-deee', phone: '+254712435465', created_at: '2024-05-10T08:00:00Z' },
  { id: 'usr-stud-barasa', full_name: 'David Wafula Barasa', role: 'student', adm_no: 'BTTI/ELE/2024/015', course_id: 'course-deee', phone: '+254790807060', created_at: '2024-05-10T09:00:00Z' },

  // Students - Business Management (DBM)
  { id: 'usr-stud-mwangi', full_name: 'Jane Muthoni Mwangi', role: 'student', adm_no: 'BTTI/BIZ/2024/054', course_id: 'course-dbm', phone: '+254721456987', created_at: '2024-05-12T08:00:00Z' },
  { id: 'usr-stud-aluso', full_name: 'Stephen Ochieng Aluso', role: 'student', adm_no: 'BTTI/BIZ/2024/055', course_id: 'course-dbm', phone: '+254735987154', created_at: '2024-05-12T09:00:00Z' }
];

const INITIAL_LECTURER_UNITS: LecturerUnit[] = [
  // Omwamba allocated to OOP & DBMS
  { id: 'alloc-1', lecturer_id: 'usr-lect-omwamba', unit_id: 'unit-oop', academic_year: '2025/2026', semester: 'Year 2 Sem 1' },
  { id: 'alloc-2', lecturer_id: 'usr-lect-omwamba', unit_id: 'unit-dbms', academic_year: '2025/2026', semester: 'Year 2 Sem 1' },
  { id: 'alloc-3', lecturer_id: 'usr-lect-omwamba', unit_id: 'unit-sad', academic_year: '2025/2026', semester: 'Year 2 Sem 1' },
  
  // Kiprop allocated to Electrical Power Generation
  { id: 'alloc-4', lecturer_id: 'usr-lect-kiprop', unit_id: 'unit-epg', academic_year: '2025/2026', semester: 'Year 2 Sem 1' },
  
  // Nyaboke allocated to Human Resource Management
  { id: 'alloc-5', lecturer_id: 'usr-lect-nyaboke', unit_id: 'unit-hrm', academic_year: '2025/2026', semester: 'Year 2 Sem 1' }
];

// Helper to seed dynamic attendance for testing rates
// We'll generate attendance for OOP (unit-oop) and DBMS (unit-dbms) for DICT students
// across 6 dates in June 2026.
const generateMockAttendance = (): AttendanceRecord[] => {
  const records: AttendanceRecord[] = [];
  const dictStudents = ['usr-stud-kipch', 'usr-stud-wanjiku', 'usr-stud-omondi', 'usr-stud-nekesa', 'usr-stud-protich'];
  const units = ['unit-oop', 'unit-dbms'];
  const dates = [
    '2026-06-10',
    '2026-06-12',
    '2026-06-15',
    '2026-06-17',
    '2026-06-19',
    '2026-06-22',
    '2026-06-24'
  ];

  // We want to create variance so some students are below 75%
  // kipch: ~100% Present (7/7 Present)
  // wanjiku: ~85% Present (6/7 Present, 1 Excused)
  // omondi: ~71% Present (5/7 Present, 2 Absent) -> BARRED
  // nekesa: ~100% Present (7/7 Present)
  // protich: ~57% Present (4/7 Present, 3 Absent) -> BARRED

  const getStatus = (studentId: string, dateIdx: number): 'Present' | 'Absent' | 'Excused' => {
    if (studentId === 'usr-stud-kipch') return 'Present';
    if (studentId === 'usr-stud-nekesa') return 'Present';
    
    if (studentId === 'usr-stud-wanjiku') {
      return dateIdx === 3 ? 'Excused' : 'Present';
    }
    
    if (studentId === 'usr-stud-omondi') {
      return (dateIdx === 2 || dateIdx === 5) ? 'Absent' : 'Present';
    }
    
    if (studentId === 'usr-stud-protich') {
      return (dateIdx === 1 || dateIdx === 3 || dateIdx === 5) ? 'Absent' : 'Present';
    }

    return 'Present';
  };

  let idCounter = 1;
  for (const unitId of units) {
    for (const studentId of dictStudents) {
      dates.forEach((date, idx) => {
        const status = getStatus(studentId, idx);
        records.push({
          id: `att-rec-${idCounter++}`,
          student_id: studentId,
          unit_id: unitId,
          lecturer_id: 'usr-lect-omwamba',
          date,
          status,
          marked_at: `${date}T10:30:00Z`,
          academic_year: '2025/2026',
          semester: 'Year 2 Sem 1'
        });
      });
    }
  }

  // Also add some electrical attendance
  const electricalStudents = ['usr-stud-atieno', 'usr-stud-barasa'];
  dates.slice(0, 4).forEach((date, idx) => {
    electricalStudents.forEach((studId) => {
      records.push({
        id: `att-rec-${idCounter++}`,
        student_id: studId,
        unit_id: 'unit-epg',
        lecturer_id: 'usr-lect-kiprop',
        date,
        status: (studId === 'usr-stud-barasa' && idx === 1) ? 'Absent' : 'Present',
        marked_at: `${date}T08:15:00Z`,
        academic_year: '2025/2026',
        semester: 'Year 2 Sem 1'
      });
    });
  });

  return records;
};

const LOCAL_STORAGE_KEY = 'butere_tti_attendance_db';

export function getDatabaseState(): DatabaseState {
  try {
    const serialized = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (serialized) {
      return JSON.parse(serialized);
    }
  } catch (e) {
    console.error('Failed to parse database state from localStorage', e);
  }

  // Fallback / Initial Seed
  const initialState: DatabaseState = {
    departments: INITIAL_DEPARTMENTS,
    courses: INITIAL_COURSES,
    courseUnits: INITIAL_COURSE_UNITS,
    profiles: INITIAL_PROFILES,
    lecturerUnits: INITIAL_LECTURER_UNITS,
    attendance: generateMockAttendance()
  };
  saveDatabaseState(initialState);
  return initialState;
}

export function saveDatabaseState(state: DatabaseState): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save database state to localStorage', e);
  }
}

// Emulate get_student_attendance_summary database function
export interface StudentAttendanceSummary {
  unitId: string;
  unitName: string;
  totalClasses: number;
  attended: number;
  excused: number;
  absent: number;
  percentage: number;
}

export function getStudentAttendanceSummary(
  state: DatabaseState,
  studentId: string,
  academicYear: string,
  semester: string
): StudentAttendanceSummary[] {
  // Find the student profile to identify their course
  const student = state.profiles.find(p => p.id === studentId);
  if (!student || !student.course_id) return [];

  // Find all course units for this student's course and semester config
  // Let's filter units that belong to the student's course
  const studentCourseUnits = state.courseUnits.filter(u => u.course_id === student.course_id);

  return studentCourseUnits.map(unit => {
    const unitAttendance = state.attendance.filter(
      a => a.student_id === studentId && 
           a.unit_id === unit.id && 
           a.academic_year === academicYear && 
           a.semester === semester
    );

    const totalClasses = unitAttendance.length;
    const attended = unitAttendance.filter(a => a.status === 'Present').length;
    const excused = unitAttendance.filter(a => a.status === 'Excused').length;
    const absent = unitAttendance.filter(a => a.status === 'Absent').length;

    // Calculation logic in the stored procedure:
    // Attended counts as full 1. Excused counts as neutral or attended?
    // In standard KNEC policies, excused counts as missing but justified, 
    // or sometimes we calculate percentage = attended / total_classes. Let's do attended / total_classes
    // If total_classes = 0, percentage is 100% (default starting rate)
    const percentage = totalClasses > 0 ? (attended / totalClasses) * 100 : 100.0;

    return {
      unitId: unit.id,
      unitName: unit.name,
      totalClasses,
      attended,
      excused,
      absent,
      percentage: Number(percentage.toFixed(1))
    };
  });
}
