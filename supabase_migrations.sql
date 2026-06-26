-- =============================================================================
-- BUTERE TTI ATTENDANCE MANAGEMENT SYSTEM — COMPLETE SUPABASE DATABASE SCHEMA
-- =============================================================================
-- Paste and execute this entire script in your Supabase SQL Editor to initialize
-- your database. No pre-registered accounts are created; you can sign up your
-- first admin account via the temporary registration portal in the app.
--
-- FIX APPLIED: Moved is_admin() from auth schema to public schema.
-- Supabase locks the auth schema — only public schema functions are allowed.
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. DEFINE CUSTOM ENUM TYPES
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'lecturer', 'student');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
        CREATE TYPE attendance_status AS ENUM ('Present', 'Absent', 'Excused');
    END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 2. CREATE TABLES
-- -----------------------------------------------------------------------------

-- Departments Table
CREATE TABLE IF NOT EXISTS public.departments (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Courses Table
CREATE TABLE IF NOT EXISTS public.courses (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT    NOT NULL UNIQUE,
    department_id   UUID    NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    duration_years  INT     NOT NULL CHECK (duration_years BETWEEN 1 AND 4),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Course Units Table
CREATE TABLE IF NOT EXISTS public.course_units (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT    NOT NULL,
    course_id       UUID    NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    year_of_study   INT     NOT NULL CHECK (year_of_study BETWEEN 1 AND 4),
    semester        INT     NOT NULL CHECK (semester BETWEEN 1 AND 2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_course_unit UNIQUE (course_id, name)
);

-- Profiles Table (Extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT        NOT NULL,
    role        user_role   NOT NULL,
    adm_no      TEXT        UNIQUE,
    course_id   UUID        REFERENCES public.courses(id) ON DELETE SET NULL,
    phone       TEXT,
    auth_linked BOOLEAN     DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Students must have an admission number and registered course.
    -- Lecturers & Admins must NOT have an admission number or course.
    CONSTRAINT check_student_metadata CHECK (
        (role = 'student' AND adm_no IS NOT NULL AND course_id IS NOT NULL) OR
        (role <> 'student' AND adm_no IS NULL AND course_id IS NULL)
    ),

    -- Admission number format validation: e.g., BTTI/ICT/2026/101
    CONSTRAINT check_adm_no_format CHECK (
        adm_no IS NULL OR adm_no ~ '^BTTI/[A-Z]{3,5}/\d{4}/\d{3}$'
    )
);

-- Lecturer Units Allocation Table (Junction Table)
CREATE TABLE IF NOT EXISTS public.lecturer_units (
    id            UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
    lecturer_id   UUID  NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    unit_id       UUID  NOT NULL REFERENCES public.course_units(id) ON DELETE CASCADE,
    academic_year TEXT  NOT NULL CHECK (academic_year ~ '^\d{4}/\d{4}$'),  -- e.g. '2025/2026'
    semester      TEXT  NOT NULL,

    -- Prevent duplicate allocation of same unit to same lecturer in same semester
    CONSTRAINT unique_lecturer_unit_semester UNIQUE (lecturer_id, unit_id, academic_year, semester)
);

-- Attendance Records Table
CREATE TABLE IF NOT EXISTS public.attendance (
    id            UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id    UUID              NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    unit_id       UUID              NOT NULL REFERENCES public.course_units(id) ON DELETE CASCADE,
    lecturer_id   UUID              REFERENCES public.profiles(id) ON DELETE SET NULL,
    date          DATE              NOT NULL DEFAULT CURRENT_DATE,
    status        attendance_status NOT NULL,
    marked_at     TIMESTAMPTZ       NOT NULL DEFAULT now(),
    academic_year TEXT              NOT NULL,
    semester      TEXT              NOT NULL,

    -- A student can only have one attendance status per unit per day
    CONSTRAINT unique_student_attendance_date UNIQUE (student_id, unit_id, date)
);

-- -----------------------------------------------------------------------------
-- 3. PERFORMANCE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_departments_name          ON public.departments(name);
CREATE INDEX IF NOT EXISTS idx_courses_department        ON public.courses(department_id);
CREATE INDEX IF NOT EXISTS idx_course_units_course       ON public.course_units(course_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role             ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_course           ON public.profiles(course_id);
CREATE INDEX IF NOT EXISTS idx_profiles_adm_no           ON public.profiles(adm_no);
CREATE INDEX IF NOT EXISTS idx_profiles_auth_linked      ON public.profiles(auth_linked);
CREATE INDEX IF NOT EXISTS idx_lecturer_units_lecturer   ON public.lecturer_units(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_lecturer_units_unit       ON public.lecturer_units(unit_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_unit   ON public.attendance(student_id, unit_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date           ON public.attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_unit_date      ON public.attendance(unit_id, date);

-- -----------------------------------------------------------------------------
-- 4. HELPER FUNCTIONS & TRIGGERS
-- -----------------------------------------------------------------------------

-- ✅ FIX: is_admin() moved from auth schema → public schema
-- Supabase locks the auth schema. All custom functions must live in public.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
END;
$$;

-- Validate student admission number during self-signup
-- Returns: 'valid' | 'not_found' | 'taken'
CREATE OR REPLACE FUNCTION public.validate_student_signup(p_adm_no TEXT)
RETURNS TEXT
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_exists BOOLEAN;
  v_linked BOOLEAN;
BEGIN
  -- Check if a student profile with this adm_no exists
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE UPPER(adm_no) = UPPER(p_adm_no)
      AND role = 'student'
  ) INTO v_exists;

  IF NOT v_exists THEN
    RETURN 'not_found';
  END IF;

  -- Check if the profile is already linked to an auth account
  SELECT auth_linked
  INTO v_linked
  FROM public.profiles
  WHERE UPPER(adm_no) = UPPER(p_adm_no)
    AND role = 'student'
  LIMIT 1;

  IF v_linked THEN
    RETURN 'taken';
  ELSE
    RETURN 'valid';
  END IF;
END;
$$;

-- Fetch student details by admission number (used to pre-fill signup form)
CREATE OR REPLACE FUNCTION public.get_student_by_adm_no(p_adm_no TEXT)
RETURNS TABLE (
  full_name   TEXT,
  adm_no      TEXT,
  course_id   UUID,
  course_name TEXT,
  phone       TEXT
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.full_name,
    p.adm_no,
    p.course_id,
    c.name AS course_name,
    p.phone
  FROM public.profiles p
  LEFT JOIN public.courses c ON c.id = p.course_id
  WHERE UPPER(p.adm_no) = UPPER(p_adm_no)
    AND p.role = 'student'
  LIMIT 1;
END;
$$;

-- Trigger function: automatically sets auth_linked = TRUE when
-- a student's profile id is updated during signup linking
CREATE OR REPLACE FUNCTION public.handle_profile_auth_linking()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.id IS DISTINCT FROM NEW.id THEN
    NEW.auth_linked := true;
  END IF;
  RETURN NEW;
END;
$$;

-- Bind trigger to profiles table
DROP TRIGGER IF EXISTS tr_on_profile_link_auth ON public.profiles;
CREATE TRIGGER tr_on_profile_link_auth
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_profile_auth_linking();

-- Attendance summary report per student per semester (aligned with client parameters and return names)
DROP FUNCTION IF EXISTS public.get_student_attendance_summary(UUID, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.get_student_attendance_summary(
  p_student_id            UUID,
  p_semester_filter       TEXT,
  p_academic_year_filter  TEXT
)
RETURNS TABLE (
  unit_id          UUID,
  unit_name        TEXT,
  total_classes    BIGINT,
  classes_attended BIGINT
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Guard: ensure the target profile is a student
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_student_id
      AND p.role = 'student'
  ) THEN
    RAISE EXCEPTION 'Profile ID % is not associated with a student role', p_student_id;
  END IF;

  RETURN QUERY
  SELECT
    cu.id AS unit_id,
    cu.name AS unit_name,
    COUNT(a.id) AS total_classes,
    COUNT(CASE WHEN a.status = 'Present' THEN 1 END) AS classes_attended
  FROM public.course_units cu
  JOIN public.profiles p
    ON p.id = p_student_id
  LEFT JOIN public.attendance a
    ON  a.unit_id    = cu.id
    AND a.student_id = p_student_id
    AND a.semester   = p_semester_filter
    AND a.academic_year = p_academic_year_filter
  WHERE cu.course_id = p.course_id
  GROUP BY cu.id, cu.name
  ORDER BY cu.name ASC;
END;
$$;

-- Daily attendance summary per unit (for Admin reports)
CREATE OR REPLACE FUNCTION public.get_daily_attendance_summary(
  p_date          DATE,
  p_department_id UUID DEFAULT NULL
)
RETURNS TABLE (
  unit_name       TEXT,
  course_name     TEXT,
  department_name TEXT,
  total_students  BIGINT,
  present_count   BIGINT,
  absent_count    BIGINT,
  excused_count   BIGINT
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cu.name                                                   AS unit_name,
    co.name                                                   AS course_name,
    d.name                                                    AS department_name,
    COUNT(DISTINCT a.student_id)                              AS total_students,
    COUNT(CASE WHEN a.status = 'Present' THEN 1 END)          AS present_count,
    COUNT(CASE WHEN a.status = 'Absent'  THEN 1 END)          AS absent_count,
    COUNT(CASE WHEN a.status = 'Excused' THEN 1 END)          AS excused_count
  FROM public.attendance a
  JOIN public.course_units cu ON cu.id = a.unit_id
  JOIN public.courses      co ON co.id = cu.course_id
  JOIN public.departments  d  ON d.id  = co.department_id
  WHERE a.date = p_date
    AND (p_department_id IS NULL OR co.department_id = p_department_id)
  GROUP BY cu.id, cu.name, co.name, d.name
  ORDER BY d.name, co.name, cu.name;
END;
$$;

-- At-risk students report: below 75% in any unit this semester
CREATE OR REPLACE FUNCTION public.get_at_risk_students(
  p_semester      TEXT,
  p_academic_year TEXT
)
RETURNS TABLE (
  student_name  TEXT,
  adm_no        TEXT,
  course_name   TEXT,
  unit_name     TEXT,
  percentage    NUMERIC
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.full_name   AS student_name,
    p.adm_no,
    co.name       AS course_name,
    cu.name       AS unit_name,
    ROUND(
      (COUNT(CASE WHEN a.status = 'Present' THEN 1 END)::NUMERIC
       / NULLIF(COUNT(a.id), 0)::NUMERIC) * 100,
      1
    ) AS percentage
  FROM public.profiles p
  JOIN public.courses     co ON co.id = p.course_id
  JOIN public.course_units cu ON cu.course_id = co.id
  LEFT JOIN public.attendance a
    ON  a.student_id    = p.id
    AND a.unit_id       = cu.id
    AND a.semester      = p_semester
    AND a.academic_year = p_academic_year
  WHERE p.role = 'student'
  GROUP BY p.id, p.full_name, p.adm_no, co.name, cu.id, cu.name
  HAVING
    ROUND(
      (COUNT(CASE WHEN a.status = 'Present' THEN 1 END)::NUMERIC
       / NULLIF(COUNT(a.id), 0)::NUMERIC) * 100,
      1
    ) < 75
  ORDER BY percentage ASC, p.full_name ASC;
END;
$$;

-- Trigger function to automatically handle profile creation or linking on auth signup
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
      v_role::user_role,
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

-- Bind the signup trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_signup();

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------

ALTER TABLE public.departments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_units   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecturer_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance     ENABLE ROW LEVEL SECURITY;

-- ── DEPARTMENTS ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "departments_select_authenticated" ON public.departments;
CREATE POLICY "departments_select_authenticated"
ON public.departments FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "departments_all_admin" ON public.departments;
CREATE POLICY "departments_all_admin"
ON public.departments FOR ALL
TO authenticated
USING      (public.is_admin())
WITH CHECK (public.is_admin());

-- ── COURSES ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "courses_select_authenticated" ON public.courses;
CREATE POLICY "courses_select_authenticated"
ON public.courses FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "courses_all_admin" ON public.courses;
CREATE POLICY "courses_all_admin"
ON public.courses FOR ALL
TO authenticated
USING      (public.is_admin())
WITH CHECK (public.is_admin());

-- ── COURSE UNITS ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "course_units_select_authenticated" ON public.course_units;
CREATE POLICY "course_units_select_authenticated"
ON public.course_units FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "course_units_all_admin" ON public.course_units;
CREATE POLICY "course_units_all_admin"
ON public.course_units FOR ALL
TO authenticated
USING      (public.is_admin())
WITH CHECK (public.is_admin());

-- ── PROFILES ──────────────────────────────────────────────────────────────────
-- Note: Policies use public.is_admin() helper for admin role validation to handle both 
-- direct user management and bulk registry insertions securely.

DROP POLICY IF EXISTS "profiles_select_all_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_all_authenticated"
ON public.profiles FOR SELECT
USING (true);

DROP POLICY IF EXISTS "profiles_insert_self_or_admin" ON public.profiles;
CREATE POLICY "profiles_insert_self_or_admin"
ON public.profiles FOR INSERT
WITH CHECK (
  auth.uid() = id
  OR
  public.is_admin()
);

DROP POLICY IF EXISTS "profiles_update_self_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_self_or_admin"
ON public.profiles FOR UPDATE
USING (
  id = auth.uid()
  OR auth_linked = false
  OR public.is_admin()
)
WITH CHECK (
  id = auth.uid()
  OR public.is_admin()
);

DROP POLICY IF EXISTS "profiles_delete_admin_only" ON public.profiles;
CREATE POLICY "profiles_delete_admin_only"
ON public.profiles FOR DELETE
TO authenticated
USING (
  public.is_admin()
);

-- ── LECTURER UNITS ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "lecturer_units_select_authenticated" ON public.lecturer_units;
CREATE POLICY "lecturer_units_select_authenticated"
ON public.lecturer_units FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "lecturer_units_all_admin" ON public.lecturer_units;
CREATE POLICY "lecturer_units_all_admin"
ON public.lecturer_units FOR ALL
TO authenticated
USING      (public.is_admin())
WITH CHECK (public.is_admin());

-- ── ATTENDANCE ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "attendance_all_admin" ON public.attendance;
CREATE POLICY "attendance_all_admin"
ON public.attendance FOR ALL
TO authenticated
USING      (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "attendance_lecturer_assigned_units" ON public.attendance;
CREATE POLICY "attendance_lecturer_assigned_units"
ON public.attendance FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.lecturer_units lu
    WHERE lu.lecturer_id = auth.uid()
      AND lu.unit_id     = attendance.unit_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.lecturer_units lu
    WHERE lu.lecturer_id = auth.uid()
      AND lu.unit_id     = attendance.unit_id
  )
);

DROP POLICY IF EXISTS "attendance_student_own_records" ON public.attendance;
CREATE POLICY "attendance_student_own_records"
ON public.attendance FOR SELECT
TO authenticated
USING (
  student_id = auth.uid()
);

-- -----------------------------------------------------------------------------
-- 6. ADMIN SEED DATA
-- -----------------------------------------------------------------------------
-- IMPORTANT: These are placeholder admin profiles only.
-- Actual auth accounts for admins must be created manually in:
-- Supabase Dashboard → Authentication → Users → Add User
-- Then update the UUIDs below to match the created auth user IDs.
--
-- After first login, admins should immediately change their passwords.
--
-- To create the auth users via SQL (requires service_role key in Edge Function
-- or Supabase Dashboard), use:
--   INSERT INTO auth.users ... (see Supabase docs for full payload)
-- OR simply use the Dashboard UI and paste the returned UUIDs here.
-- -----------------------------------------------------------------------------

-- Example placeholder — replace UUIDs after creating auth users in Dashboard:
-- INSERT INTO public.profiles (id, full_name, role, auth_linked)
-- VALUES
--   ('REPLACE-WITH-ADMIN1-UUID', 'System Administrator 1', 'admin', true),
--   ('REPLACE-WITH-ADMIN2-UUID', 'System Administrator 2', 'admin', true)
-- ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- SCHEMA COMPLETE
-- =============================================================================
-- Tables created   : departments, courses, course_units, profiles,
--                    lecturer_units, attendance
-- Functions created: public.is_admin(), public.validate_student_signup(),
--                    public.get_student_by_adm_no(),
--                    public.handle_profile_auth_linking(),
--                    public.get_student_attendance_summary(),
--                    public.get_daily_attendance_summary(),
--                    public.get_at_risk_students()
-- Triggers created : tr_on_profile_link_auth
-- RLS enabled on   : all 6 tables
-- =============================================================================