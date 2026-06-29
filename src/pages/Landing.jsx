import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ButereLogo from '../components/ButereLogo';
import { 
  ShieldCheck, 
  MapPin, 
  LogIn, 
  UserPlus, 
  ClipboardCheck, 
  AlertCircle, 
  MessageSquareWarning, 
  ChartBar, 
  Lock, 
  RefreshCw, 
  GraduationCap, 
  UserCircle, 
  Check, 
  ChevronRight, 
  Loader2,
  ArrowUp
} from 'lucide-react';


const FeatureCard = React.memo(function FeatureCard({ title, description, icon: Icon }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 hover:border-gray-200 transition-colors">
      <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-blue-600" />
      </div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1.5">{title}</h3>
      <p className="text-[11px] text-gray-500 leading-relaxed">
        {description}
      </p>
    </div>
  );
});

const RoleCard = React.memo(function RoleCard({ title, description, icon: Icon, checklist }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-blue-600" />
      </div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="text-[11px] text-gray-500 mt-1.5 mb-4 leading-relaxed">
        {description}
      </p>
      <ul className="space-y-2 pt-2 border-t border-gray-50">
        {checklist.map((item, index) => (
          <li key={index} className="flex items-start gap-2 text-[11px] text-gray-600">
            <Check className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
});

export default function Landing() {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    if (!loading && user && role) {
      navigate(`/${role}/dashboard`, { replace: true });
    }
  }, [user, role, loading, navigate]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs text-slate-500 font-medium mt-3 uppercase tracking-wider font-mono">
          Verifying Credentials...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col font-sans">
      {/* SECTION 1 — NAVBAR */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 h-14 px-4 md:px-8 flex items-center justify-between">
        {/* LEFT — Brand */}
        <div className="flex items-center gap-2.5">
          <ButereLogo size={36} />
          <div>
            <span className="text-sm font-medium text-gray-900 leading-none block">Butere TTI</span>
            <span className="text-[11px] text-gray-400 block mt-0.5 font-medium">Attendance System</span>
          </div>
        </div>

        {/* CENTER — Anchor links (hidden on mobile) */}
        <div className="hidden md:flex items-center gap-6">
          <button 
            onClick={() => scrollTo('features')}
            className="text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors cursor-pointer"
          >
            Features
          </button>
          <button 
            onClick={() => scrollTo('how-it-works')}
            className="text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors cursor-pointer"
          >
            How it works
          </button>
          <button 
            onClick={() => scrollTo('roles')}
            className="text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors cursor-pointer"
          >
            Roles
          </button>
          <button 
            onClick={() => scrollTo('faq')}
            className="text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors cursor-pointer"
          >
            FAQ
          </button>
        </div>

        {/* RIGHT — CTA buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/signup')}
            className="px-2.5 py-1.5 md:px-3.5 md:py-1.5 text-xs font-medium text-blue-600 bg-transparent border border-blue-200 rounded-lg hover:bg-blue-50/50 transition-colors cursor-pointer"
          >
            Student sign up
          </button>
          <button
            onClick={() => navigate('/login')}
            className="px-2.5 py-1.5 md:px-3.5 md:py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
          >
            Sign in
          </button>
        </div>
      </nav>

      {/* SECTION 2 — HERO */}
      <header className="bg-gray-50 border-b border-gray-100 py-16 px-4 md:px-8 text-center flex flex-col items-center">
        {/* LOGO */}
        <ButereLogo size={110} className="mb-5" />

        {/* BADGE */}
        <div className="bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1 rounded-full border border-blue-100 inline-flex items-center gap-1.5 mb-5">
          <MapPin className="w-3.5 h-3.5 text-blue-600" />
          <span>Butere Technical Training Institute · Kenya</span>
        </div>

        {/* TITLE */}
        <h1 className="text-3xl font-medium tracking-tight text-gray-900 leading-tight max-w-lg mx-auto">
          Attendance tracking built for Butere TTI
        </h1>

        {/* SUBTITLE */}
        <p className="text-sm text-gray-500 leading-relaxed max-w-md mx-auto mt-3 mb-7">
          A digital system for lecturers to mark attendance, students to monitor their records, and administrators to keep the institution on track.
        </p>

        {/* CTA BUTTONS */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign in</span>
          </button>
          <button
            onClick={() => navigate('/signup')}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-blue-600 bg-transparent border border-blue-200 rounded-lg hover:bg-blue-50/40 transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Student sign up</span>
          </button>
        </div>

        {/* DASHBOARD PREVIEW */}
        <div className="w-full max-w-xl mx-auto mt-10 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden text-left">
          {/* Mini browser bar */}
          <div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400"></span>
              <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
              <span className="w-2 h-2 rounded-full bg-green-400"></span>
            </div>
            <span className="text-[10px] text-gray-400 font-medium tracking-wider uppercase font-mono">
              Attendance dashboard
            </span>
            <div className="w-10"></div>
          </div>

          {/* Preview body */}
          <div className="p-4 md:p-5">
            {/* Row 1 — 4 mini stat cards */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wider block">Students</span>
                <span className="text-sm font-semibold text-gray-800 mt-1 block">248</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wider block">Lecturers</span>
                <span className="text-sm font-semibold text-gray-800 mt-1 block">18</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wider block">Avg Rate</span>
                <span className="text-sm font-semibold text-emerald-600 mt-1 block">81%</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wider block">At Risk</span>
                <span className="text-sm font-semibold text-rose-600 mt-1 block">34</span>
              </div>
            </div>

            {/* Row 2 — mini bar chart card */}
            <div className="bg-gray-50 rounded-lg p-4 mt-3 border border-gray-100">
              <h4 className="text-[11px] font-medium text-gray-600 uppercase tracking-wider mb-2.5">
                Unit attendance — Semester 1
              </h4>
              <div className="space-y-2">
                {/* Row A */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-500 w-28 truncate font-medium">Web Technologies</span>
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '92%' }}></div>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-600 w-8 text-right">92%</span>
                </div>
                {/* Row B */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-500 w-28 truncate font-medium">Database Systems</span>
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full" style={{ width: '64%' }}></div>
                  </div>
                  <span className="text-[10px] font-semibold text-rose-600 w-8 text-right">64%</span>
                </div>
                {/* Row C */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-500 w-28 truncate font-medium">Networking</span>
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: '77%' }}></div>
                  </div>
                  <span className="text-[10px] font-semibold text-amber-600 w-8 text-right">77%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STATS ROW */}
        <div className="w-full max-w-xl border-t border-gray-100 mt-10 pt-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 divide-y md:divide-y-0 md:divide-x divide-gray-100">
            <div className="flex flex-col items-center pt-2 md:pt-0">
              <span className="text-xl font-medium text-gray-900">3 Roles</span>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mt-1">Dedicated access</span>
            </div>
            <div className="flex flex-col items-center pt-2 md:pt-0">
              <span className="text-xl font-medium text-gray-900">75%</span>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mt-1">Minimum threshold</span>
            </div>
            <div className="flex flex-col items-center pt-2 md:pt-0">
              <span className="text-xl font-medium text-gray-900">Real-time</span>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mt-1">Updates & alerts</span>
            </div>
            <div className="flex flex-col items-center pt-2 md:pt-0">
              <span className="text-xl font-medium text-gray-900">PDF & Excel</span>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mt-1">Report exports</span>
            </div>
          </div>
        </div>
      </header>

      {/* SECTION 3 — FEATURES */}
      <section id="features" className="py-16 px-4 md:px-8 border-b border-gray-100 max-w-5xl mx-auto w-full">
        <span className="text-xs uppercase tracking-widest text-blue-600 font-semibold text-center block mb-2">
          Features
        </span>
        <h2 className="text-xl font-medium text-gray-900 text-center">
          Everything the institution needs
        </h2>
        <p className="text-xs text-gray-500 text-center max-w-sm mx-auto mt-2 mb-12">
          Built specifically for TVET institutions with the workflows lecturers, students, and administrators actually use.
        </p>

        {/* 6 FEATURE CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <FeatureCard 
            title="Fast attendance marking"
            description="Lecturers mark an entire class in under 2 minutes. Bulk actions and upsert protection prevent double marking."
            icon={ClipboardCheck}
          />
          <FeatureCard 
            title="At-risk alerts"
            description="Students below 75% are automatically flagged. Admins and lecturers see who's at risk of being barred before it's too late."
            icon={AlertCircle}
          />
          <FeatureCard 
            title="Correction requests"
            description="Students can dispute wrong marks with a written reason. Lecturers review and approve or reject — all tracked and audited."
            icon={MessageSquareWarning}
          />
          <FeatureCard 
            title="Reports and exports"
            description="Generate class, daily, and at-risk reports. Export to PDF or Excel with institution branding and custom date ranges."
            icon={ChartBar}
          />
          <FeatureCard 
            title="Secure by design"
            description="Row-level security ensures each role sees only their data. Lecturers are forced to change temporary passwords on first login."
            icon={Lock}
          />
          <FeatureCard 
            title="Live updates"
            description="Attendance changes, correction approvals, and notification badges update in real time — no page refresh needed."
            icon={RefreshCw}
          />
        </div>
      </section>

      {/* SECTION 4 — ROLES */}
      <section id="roles" className="py-16 px-4 md:px-8 bg-gray-50 border-b border-gray-100">
        <div className="max-w-5xl mx-auto w-full">
          <span className="text-xs uppercase tracking-widest text-blue-600 font-semibold text-center block mb-2">
            Roles
          </span>
          <h2 className="text-xl font-medium text-gray-900 text-center">
            Three roles, one system
          </h2>
          <p className="text-xs text-gray-500 text-center max-w-sm mx-auto mt-2 mb-12">
            Each role has a dedicated dashboard tailored to their specific responsibilities.
          </p>

          {/* 3 ROLE CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <RoleCard 
              title="Administrator"
              description="Full control over the institution's academic structure and users."
              icon={ShieldCheck}
              checklist={[
                "Create lecturer and student accounts",
                "Manage courses, units, and departments",
                "Assign units to lecturers",
                "Generate institution-wide reports",
                "Oversee all correction requests"
              ]}
            />
            <RoleCard 
              title="Lecturer"
              description="Mark attendance for assigned units and manage student disputes."
              icon={GraduationCap}
              checklist={[
                "Mark attendance for assigned units",
                "View today's class schedule",
                "Review correction requests",
                "Monitor at-risk students",
                "Approve or reject disputes"
              ]}
            />
            <RoleCard 
              title="Student"
              description="Monitor personal attendance and raise disputes for incorrect records."
              icon={UserCircle}
              checklist={[
                "View attendance per unit",
                "Track overall attendance rate",
                "See at-risk warnings early",
                "Raise correction requests",
                "Export personal PDF report"
              ]}
            />
          </div>
        </div>
      </section>

      {/* SECTION 5 — HOW IT WORKS */}
      <section id="how-it-works" className="py-16 px-4 md:px-8 border-b border-gray-100">
        <div className="max-w-5xl mx-auto w-full">
          <span className="text-xs uppercase tracking-widest text-blue-600 font-semibold text-center block mb-2">
            How it works
          </span>
          <h2 className="text-xl font-medium text-gray-900 text-center">
            From setup to reporting
          </h2>
          <p className="text-xs text-gray-500 text-center max-w-sm mx-auto mt-2 mb-12">
            A straightforward flow that mirrors how Butere TTI already operates.
          </p>

          {/* 4-STEP FLOW */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 md:gap-2">
            {/* Step 1 */}
            <div className="text-center flex-1">
              <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-3 text-sm font-semibold text-blue-600 shadow-sm">
                1
              </div>
              <h3 className="text-xs font-semibold text-gray-900 mb-1">Admin sets up</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed max-w-[150px] mx-auto">
                Creates courses, units, lecturers, and pre-registers students
              </p>
            </div>

            {/* Connector */}
            <div className="hidden md:flex items-center justify-center text-gray-300">
              <ChevronRight className="w-5 h-5" />
            </div>

            {/* Step 2 */}
            <div className="text-center flex-1">
              <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-3 text-sm font-semibold text-blue-600 shadow-sm">
                2
              </div>
              <h3 className="text-xs font-semibold text-gray-900 mb-1">Lecturer marks</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed max-w-[150px] mx-auto">
                Opens their unit, marks each student Present, Absent, or Excused
              </p>
            </div>

            {/* Connector */}
            <div className="hidden md:flex items-center justify-center text-gray-300">
              <ChevronRight className="w-5 h-5" />
            </div>

            {/* Step 3 */}
            <div className="text-center flex-1">
              <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-3 text-sm font-semibold text-blue-600 shadow-sm">
                3
              </div>
              <h3 className="text-xs font-semibold text-gray-900 mb-1">Student monitors</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed max-w-[150px] mx-auto">
                Sees live attendance per unit and raises disputes if records are wrong
              </p>
            </div>

            {/* Connector */}
            <div className="hidden md:flex items-center justify-center text-gray-300">
              <ChevronRight className="w-5 h-5" />
            </div>

            {/* Step 4 */}
            <div className="text-center flex-1">
              <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-3 text-sm font-semibold text-blue-600 shadow-sm">
                4
              </div>
              <h3 className="text-xs font-semibold text-gray-900 mb-1">Admin reports</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed max-w-[150px] mx-auto">
                Generates at-risk lists and exports PDF or Excel reports
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5.5 — FAQ */}
      <section id="faq" className="py-16 px-4 md:px-8 border-b border-gray-100 bg-white">
        <div className="max-w-3xl mx-auto w-full">
          <span className="text-xs uppercase tracking-widest text-blue-600 font-semibold text-center block mb-2">
            FAQ
          </span>
          <h2 className="text-xl font-medium text-gray-900 text-center">
            Frequently Asked Questions
          </h2>
          <p className="text-xs text-gray-500 text-center max-w-sm mx-auto mt-2 mb-12">
            Have questions about account access, password resets, or system support? We've got answers.
          </p>

          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 hover:border-gray-200 transition-colors">
              <h3 className="text-xs font-semibold text-gray-900 mb-2">How do students sign up or log in?</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Students can sign up using their official Admission Number. The system validates the Admission Number against the student roster pre-registered by the administrator. Once verified, you can set your password and log in immediately.
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 hover:border-gray-200 transition-colors">
              <h3 className="text-xs font-semibold text-gray-900 mb-2">How do lecturers and administrators get accounts?</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Lecturer and administrator accounts are created and provisioned directly by the Admin Office. If you are a staff member, please consult your department head or the administration office to receive your temporary login credentials.
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 hover:border-gray-200 transition-colors">
              <h3 className="text-xs font-semibold text-gray-900 mb-2">How can I reset my password?</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                If you have forgotten your password, go to the Sign In page and click on the "Forgot Password" link. Enter your registered email address to receive password reset instructions. For lecturers logging in for the first time, you will be prompted to change your temporary password immediately.
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 hover:border-gray-200 transition-colors">
              <h3 className="text-xs font-semibold text-gray-900 mb-2">What should I do if my attendance record is incorrect?</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Students can raise a "Correction Request" directly from their dashboard. Locate the specific lecture or date with the discrepancy, click "Dispute", and provide a written reason. Your unit lecturer will review, verify, and approve or reject the request.
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 hover:border-gray-200 transition-colors">
              <h3 className="text-xs font-semibold text-gray-900 mb-2">How do I reach the IT department for technical support?</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                For account verification issues, database errors, or technical support, you can reach out to the Butere TTI IT support desk at the main administration block or send an email to <a href="mailto:support@buteretti.ac.ke" className="text-blue-600 font-medium hover:underline">support@buteretti.ac.ke</a>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6 — CTA (bottom) */}
      <section className="py-16 px-4 md:px-8 text-center bg-gray-50 border-b border-gray-100 flex flex-col items-center">
        {/* LOGO */}
        <ButereLogo size={100} className="mb-5" />

        {/* BADGE */}
        <div className="bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1 rounded-full border border-blue-100 inline-flex items-center gap-1.5 mb-5">
          <MapPin className="w-3.5 h-3.5 text-blue-600" />
          <span>Butere, Kakamega County · Kenya</span>
        </div>

        {/* TITLE */}
        <h2 className="text-2xl font-medium tracking-tight text-gray-900 leading-tight max-w-md mx-auto">
          Ready to get started?
        </h2>

        {/* SUBTITLE */}
        <p className="text-xs text-gray-500 leading-relaxed max-w-sm mx-auto mt-3 mb-8">
          Students sign up with their admission number. Lecturers and admins use credentials from the admin office.
        </p>

        {/* CTA BUTTONS */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer animate-none"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign in</span>
          </button>
          <button
            onClick={() => navigate('/signup')}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-blue-600 bg-transparent border border-blue-200 rounded-lg hover:bg-blue-50/40 transition-colors cursor-pointer animate-none"
          >
            <UserPlus className="w-4 h-4" />
            <span>Student sign up</span>
          </button>
        </div>
      </section>

      {/* SECTION 7 — FOOTER */}
      <footer className="border-t border-gray-100 py-6 px-4 md:px-8 bg-white">
        <div className="max-w-5xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* LEFT */}
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <ButereLogo size={36} />
            <div>
              <span className="text-xs font-semibold text-gray-800 block">Butere TTI Attendance System</span>
              <span className="text-[10px] text-gray-400 block mt-1 font-medium">
                &copy; 2026 Butere Technical Training Institute
              </span>
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-4 text-[11px] text-gray-400 font-medium">
            <a href="#privacy" className="hover:text-blue-600 transition-colors">Privacy</a>
            <span>&bull;</span>
            <a href="mailto:support@buteretti.ac.ke" className="hover:text-blue-600 transition-colors">Contact admin</a>
            <span>&bull;</span>
            <a href="#help" className="hover:text-blue-600 transition-colors">Help</a>
          </div>
        </div>
      </footer>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all cursor-pointer z-50 flex items-center justify-center border border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="Scroll to top"
          id="scroll-to-top-btn"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
