/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'admin' | 'lecturer' | 'student';

export interface Department {
  id: string;
  name: string;
  created_at: string;
}

export interface Course {
  id: string;
  name: string;
  department_id: string;
  duration_years: number;
  created_at: string;
}

export interface CourseUnit {
  id: string;
  name: string;
  course_id: string;
  year_of_study: number; // 1, 2, 3
  semester: number; // 1, 2
  created_at: string;
}

export interface Profile {
  id: string; // UUID references auth.users
  full_name: string;
  role: UserRole;
  adm_no: string | null; // e.g. BTTI/ICT/2025/104
  course_id: string | null; // FK to courses
  phone: string;
  created_at: string;
  auth_linked?: boolean;
  must_change_password?: boolean;
}

export interface LecturerUnit {
  id: string;
  lecturer_id: string; // FK to profiles
  unit_id: string; // FK to course_units
  academic_year: string; // e.g. "2025/2026"
  semester: string; // e.g. "Year 1 Sem 1" or "Sem 1"
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Excused';

export interface AttendanceRecord {
  id: string;
  student_id: string; // FK to profiles (student)
  unit_id: string; // FK to course_units
  lecturer_id: string; // FK to profiles (lecturer)
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  marked_at: string;
  academic_year: string;
  semester: string;
}

export interface DatabaseState {
  departments: Department[];
  courses: Course[];
  courseUnits: CourseUnit[];
  profiles: Profile[];
  lecturerUnits: LecturerUnit[];
  attendance: AttendanceRecord[];
}
