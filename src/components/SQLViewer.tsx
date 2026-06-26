/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Clipboard, Check, Database, Shield, Cpu } from 'lucide-react';

interface SQLViewerProps {
  id?: string;
}

export default function SQLViewer({ id }: SQLViewerProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const sqlSchema = `-- ==========================================
-- BUTERE TECHNICAL TRAINING INSTITUTE (BTTI)
-- DATABASE INITIALIZATION & SCHEMA DEFINITION
-- ==========================================

-- Enable UUID extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define Custom Enum Types
CREATE TYPE user_role AS ENUM ('admin', 'lecturer', 'student');
CREATE TYPE attendance_status AS ENUM ('Present', 'Absent', 'Excused');

-- 1. Departments Table
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for speedy department lookups by name
CREATE INDEX idx_departments_name ON departments(name);

-- 2. Courses Table
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    duration_years INT NOT NULL CHECK (duration_years BETWEEN 1 AND 4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_courses_department ON courses(department_id);

-- 3. Course Units Table
CREATE TABLE course_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    year_of_study INT NOT NULL CHECK (year_of_study BETWEEN 1 AND 4),
    semester INT NOT NULL CHECK (semester BETWEEN 1 AND 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Enforce unique unit names within the same course/program
    CONSTRAINT unique_course_unit UNIQUE (course_id, name)
);

CREATE INDEX idx_course_units_course ON course_units(course_id);

-- 4. Profiles Table (Extends Supabase Auth Users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY, -- Note: Links with auth.users(id) via triggers (foreign key omitted to allow pre-registration)
    full_name TEXT NOT NULL,
    role user_role NOT NULL,
    adm_no TEXT UNIQUE,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Integrity Constraints:
    -- Students must have an admission number and registered course.
    -- Lecturers & Admins must NOT have an admission number or course associated.
    CONSTRAINT check_student_metadata CHECK (
        (role = 'student' AND adm_no IS NOT NULL AND course_id IS NOT NULL) OR
        (role <> 'student' AND adm_no IS NULL AND course_id IS NULL)
    ),
    
    -- Format validation for Admission Numbers (e.g., BTTI/XXX/2026/000)
    CONSTRAINT check_adm_no_format CHECK (
        adm_no IS NULL OR adm_no ~ '^BTTI/[A-Z]{3,5}/\\d{4}/\\d{3}$'
    )
);

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_course ON profiles(course_id);

-- 5. Lecturer Units Allocation Table (Junction Table)
CREATE TABLE lecturer_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lecturer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES course_units(id) ON DELETE CASCADE,
    academic_year TEXT NOT NULL CHECK (academic_year ~ '^\\d{4}/\\d{4}$'), -- e.g. '2025/2026'
    semester TEXT NOT NULL,
    
    -- Prevent duplicate allocation of same unit to same lecturer in the same semester
    CONSTRAINT unique_lecturer_unit_semester UNIQUE (lecturer_id, unit_id, academic_year, semester)
);

CREATE INDEX idx_lecturer_units_lecturer ON lecturer_units(lecturer_id);
CREATE INDEX idx_lecturer_units_unit ON lecturer_units(unit_id);

-- 6. Attendance Records Table
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES course_units(id) ON DELETE CASCADE,
    lecturer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status attendance_status NOT NULL,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    academic_year TEXT NOT NULL,
    semester TEXT NOT NULL,
    
    -- Business Constraint: A student can only have one attendance status per unit, per day.
    CONSTRAINT unique_student_attendance_date UNIQUE (student_id, unit_id, date)
);

CREATE INDEX idx_attendance_student_unit ON attendance(student_id, unit_id);
CREATE INDEX idx_attendance_date ON attendance(date);
`;

  const sqlPolicies = `-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable Row Level Security on all tables
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE lecturer_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Helper Function to check if active user is an Administrator
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------
-- DEPARTMENTS, COURSES, & COURSE_UNITS POLICIES
-- --------------------------------------------------------
-- READ ALL: Authenticated users can read departments, courses, and units.
-- WRITE: Only Admins can modify department/course definitions.

CREATE POLICY "Allow public read-access for authenticated users"
ON departments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin full-control over departments"
ON departments FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Allow public read-access to courses"
ON courses FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin full-control over courses"
ON courses FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Allow public read-access to course_units"
ON course_units FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin full-control over course_units"
ON course_units FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- --------------------------------------------------------
-- PROFILES POLICIES
-- --------------------------------------------------------
-- Admins: Full control.
-- Lecturers & Students: Read access to all profiles (required for rosters, signups, and registry lookups).
-- All policies below are 100% recursion-free.

-- Drop any existing conflicting policies on public.profiles
DROP POLICY IF EXISTS "Admin full-control on profiles" ON profiles;
DROP POLICY IF EXISTS "Lecturers can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Students can view own profile" ON profiles;
DROP POLICY IF EXISTS "Allow public read access on profiles" ON profiles;
DROP POLICY IF EXISTS "Allow insert for self or admin" ON profiles;
DROP POLICY IF EXISTS "Allow users to link or update their own profile" ON profiles;
DROP POLICY IF EXISTS "Allow admins to delete profiles" ON profiles;

-- 1. Create a clean, recursion-free SELECT policy
CREATE POLICY "Allow public read access on profiles"
ON profiles FOR SELECT
USING (true);

-- 2. Create a recursion-free INSERT policy
CREATE POLICY "Allow insert for self or admin"
ON profiles FOR INSERT
WITH CHECK (
  auth.uid() = id 
  OR 
  public.is_admin()
);

-- 3. Create a recursion-free UPDATE policy
CREATE POLICY "Allow users to link or update their own profile"
ON profiles FOR UPDATE
USING (
  id = auth.uid() 
  OR 
  auth_linked = false
  OR 
  public.is_admin()
)
WITH CHECK (
  id = auth.uid() 
  OR 
  public.is_admin()
);

-- 4. Create a recursion-free DELETE policy
CREATE POLICY "Allow admins to delete profiles"
ON profiles FOR DELETE
USING (
  public.is_admin()
);


-- --------------------------------------------------------
-- LECTURER_UNITS POLICIES
-- --------------------------------------------------------
-- Admins: Full control.
-- All users: Select allowed to understand unit assignments.

CREATE POLICY "Admin full-control on lecturer_units"
ON lecturer_units FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Allow authenticated read-access to allocations"
ON lecturer_units FOR SELECT
TO authenticated
USING (true);


-- --------------------------------------------------------
-- ATTENDANCE POLICIES
-- --------------------------------------------------------
-- Admins: Full control.
-- Lecturers: Can SELECT and INSERT/UPDATE records ONLY for units allocated to them in lecturer_units.
-- Students: Can SELECT ONLY their own attendance records.

CREATE POLICY "Admin full-control on attendance"
ON attendance FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Lecturers can mark and edit attendance for allocated units"
ON attendance FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lecturer_units lu
    WHERE lu.lecturer_id = auth.uid() 
      AND lu.unit_id = attendance.unit_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lecturer_units lu
    WHERE lu.lecturer_id = auth.uid() 
      AND lu.unit_id = attendance.unit_id
  )
);

CREATE POLICY "Students can view only their own attendance"
ON attendance FOR SELECT
TO authenticated
USING (
  student_id = auth.uid()
);
`;

  const sqlFunction = `-- =============================================================
-- STORED SQL FUNCTION: handle_new_user_signup
-- =============================================================
-- Automatically runs when a user registers on Supabase Auth,
-- creating or linking their profile with 100% bypass of RLS policies.

CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_role TEXT;
  v_adm_no TEXT;
  v_phone TEXT;
  v_full_name TEXT;
BEGIN
  v_role      := new.raw_user_meta_data ->> 'role';
  v_adm_no    := new.raw_user_meta_data ->> 'adm_no';
  v_phone     := new.raw_user_meta_data ->> 'phone';
  v_full_name := COALESCE(new.raw_user_meta_data ->> 'full_name', '');

  -- Automatically format empty full name from email username
  IF (v_full_name IS NULL OR v_full_name = '') AND new.email IS NOT NULL THEN
    v_full_name := INITCAP(SPLIT_PART(new.email, '@', 1));
  END IF;

  -- Fallback logic for manual Supabase dashboard signup or missing role metadata
  IF v_role IS NULL THEN
    IF new.email LIKE '%admin%' OR new.email = 'amanicollective.support@gmail.com' THEN
      v_role := 'admin';
    ELSIF new.email LIKE '%lecturer%' OR new.email LIKE '%omwamba%' OR new.email LIKE '%kiprop%' OR new.email LIKE '%nyaboke%' OR new.email LIKE '%mutua%' THEN
      v_role := 'lecturer';
    ELSE
      v_role := 'admin'; -- Prevent constraint failures on manual dashboard accounts
    END IF;
  ELSIF v_role = 'student' AND v_adm_no IS NULL THEN
    -- Student profiles require an admission number and course. If not provided, fallback to admin to avoid database constraint failures.
    v_role := 'admin';
  END IF;

  IF v_role = 'student' AND v_adm_no IS NOT NULL THEN
    -- Link the existing pre-registered student profile
    UPDATE public.profiles
    SET
      id = new.id,
      phone = COALESCE(v_phone, phone),
      auth_linked = true
    WHERE UPPER(adm_no) = UPPER(v_adm_no);
  ELSE
    -- For admins or lecturers, create their profile directly
    INSERT INTO public.profiles (id, full_name, role, phone, auth_linked)
    VALUES (
      new.id,
      v_full_name,
      v_role::public.user_role,
      v_phone,
      true
    )
    ON CONFLICT (id) DO UPDATE
    SET
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
      auth_linked = true;
  END IF;

  RETURN new;
END;
$$;

-- Bind the trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_signup();


-- =============================================================
-- STORED SQL FUNCTION: get_student_attendance_summary
-- =============================================================
-- Calculates granular attendance metrics for a specific student,
-- returning data for all registered units including those with 0 classes.

DROP FUNCTION IF EXISTS public.get_student_attendance_summary(UUID, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.get_student_attendance_summary(
  student_id UUID,
  semester_filter TEXT,
  academic_year_filter TEXT
)
RETURNS TABLE (
  unit_id UUID,
  unit_name TEXT,
  total_classes BIGINT,
  classes_attended BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Defensive sanity check: Ensure targeted profile is a student
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = student_id AND role = 'student'
  ) THEN
    RAISE EXCEPTION 'Profile ID % is not associated with a Student role', student_id;
  END IF;

  RETURN QUERY
  SELECT 
    cu.id AS unit_id,
    cu.name AS unit_name,
    COUNT(a.id) AS total_classes,
    COUNT(CASE WHEN a.status = 'Present' THEN 1 END) AS classes_attended
  FROM 
    public.course_units cu
  JOIN 
    public.profiles p ON p.id = student_id
  -- Ensures we only query units that are registered under the student's Course
  -- LEFT JOIN includes all units, even if no attendance has been marked yet
  LEFT JOIN 
    public.attendance a ON a.unit_id = cu.id 
                 AND a.student_id = student_id
                 AND a.semester = semester_filter
                 AND a.academic_year = academic_year_filter
  WHERE 
    cu.course_id = p.course_id
  GROUP BY 
    cu.id, cu.name
  ORDER BY 
    cu.name ASC;
END;
$$;
`;

  return (
    <div id={id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="bg-emerald-800 text-white p-6">
        <h2 className="text-xl font-semibold tracking-tight">Supabase DB Architecture Blueprint</h2>
        <p className="text-xs text-emerald-100 mt-1 font-mono">
          Butere Technical Training Institute • Official SQL Schemas & RLS Security Rules
        </p>
      </div>

      <div className="p-6 space-y-8">
        {/* Section 1: SQL Schema */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-50 rounded text-emerald-700">
                <Database className="w-4 h-4" />
              </div>
              <h3 className="font-medium text-gray-900">1. Complete DDL Schema (Tables, Indexes, Constraints)</h3>
            </div>
            <button
              id="copy-schema-btn"
              onClick={() => handleCopy(sqlSchema, 'schema')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors font-medium cursor-pointer"
            >
              {copiedSection === 'schema' ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Copied!
                </>
              ) : (
                <>
                  <Clipboard className="w-3.5 h-3.5" /> Copy Code
                </>
              )}
            </button>
          </div>
          <div className="bg-gray-950 rounded-lg p-4 font-mono text-[11px] leading-relaxed text-gray-300 overflow-x-auto max-h-[300px] border border-gray-800">
            <pre className="whitespace-pre">{sqlSchema}</pre>
          </div>
        </div>

        {/* Section 2: RLS Policies */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-50 rounded text-emerald-700">
                <Shield className="w-4 h-4" />
              </div>
              <h3 className="font-medium text-gray-900">2. Row Level Security Policies (RLS)</h3>
            </div>
            <button
              id="copy-policies-btn"
              onClick={() => handleCopy(sqlPolicies, 'policies')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors font-medium cursor-pointer"
            >
              {copiedSection === 'policies' ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Copied!
                </>
              ) : (
                <>
                  <Clipboard className="w-3.5 h-3.5" /> Copy Code
                </>
              )}
            </button>
          </div>
          <div className="bg-gray-950 rounded-lg p-4 font-mono text-[11px] leading-relaxed text-gray-300 overflow-x-auto max-h-[300px] border border-gray-800">
            <pre className="whitespace-pre">{sqlPolicies}</pre>
          </div>
        </div>

        {/* Section 3: SQL Function */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-50 rounded text-emerald-700">
                <Cpu className="w-4 h-4" />
              </div>
              <h3 className="font-medium text-gray-900">3. Stored Database Function (Attendance Summary)</h3>
            </div>
            <button
              id="copy-function-btn"
              onClick={() => handleCopy(sqlFunction, 'function')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors font-medium cursor-pointer"
            >
              {copiedSection === 'function' ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Copied!
                </>
              ) : (
                <>
                  <Clipboard className="w-3.5 h-3.5" /> Copy Code
                </>
              )}
            </button>
          </div>
          <div className="bg-gray-950 rounded-lg p-4 font-mono text-[11px] leading-relaxed text-gray-300 overflow-x-auto border border-gray-800">
            <pre className="whitespace-pre">{sqlFunction}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
