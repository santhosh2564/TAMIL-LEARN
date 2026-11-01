import { useState } from 'react';
import { Page } from '../../components/ui/Page';
import { Button } from '../../components/ui/Button';
import { useStudent } from '../../student';
import { useNavigate } from 'react-router-dom';
import {
  Trash2,
  CheckCircle2,
  Users,
  Image as ImageIcon,
  Shield,
  Monitor,
  Info,
  Lock,
} from 'lucide-react';

export function SettingsPage() {
  const navigate = useNavigate();
  const { activeStudent, clearActiveStudentProgress } = useStudent();

  // Progress reset state
  const [confirmClearStudent, setConfirmClearStudent] = useState(false);
  const [clearedStudent, setClearedStudent] = useState(false);

  const handleClearStudentProgress = async () => {
    await clearActiveStudentProgress();
    setConfirmClearStudent(false);
    setClearedStudent(true);
  };

  return (
    <Page>
      <div className="max-w-2xl mx-auto py-8 sm:py-12 space-y-10">
        <div>
          <h1 className="text-3xl font-display font-bold text-text mb-2">Settings (அமைப்புகள்)</h1>
          <p className="text-text-muted">Manage your learning profiles, device setup, and administrator access.</p>
        </div>

        {/* Administrator Access Section */}
        <section
          data-testid="admin-access-section"
          className="bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 rounded-3xl p-6 sm:p-8 space-y-5 border-2 border-indigo-200/80 shadow-sm"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <Shield className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">Administrator Access</h2>
                <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-2.5 py-0.5 rounded-full">
                  Admin Only
                </span>
              </div>
              <p className="text-sm font-tamil text-slate-600 mt-0.5">நிர்வாகி அணுகல்</p>
              <p className="text-text-muted text-sm mt-2">
                Sign in to manage schools, students, roster imports, and view complete assessment analytics and reports.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap gap-3">
            <Button
              variant="primary"
              data-testid="admin-login-button"
              onClick={() => navigate('/admin/login')}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-2xl shadow-sm"
            >
              <Lock className="w-4 h-4" /> Sign In as Administrator (நிர்வாகி உள்நுழைவு)
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate('/setup')}
              className="flex items-center gap-2 font-medium px-4 py-2.5 rounded-2xl"
            >
              <Monitor className="w-4 h-4" /> Device Setup (கணினி அமைவு)
            </Button>
          </div>
        </section>

        {/* Student Profile Section */}
        <section className="bg-surface-raised rounded-3xl p-6 sm:p-8 space-y-6 border border-surface-highlight">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-bold text-text">Current Student (தற்போதைய மாணவர்)</h2>
              <p className="text-text-muted mt-1">
                {activeStudent
                  ? `Currently learning as ${activeStudent.name}.`
                  : 'No student is currently selected.'}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <Users size={18} /> Switch Student (மாணவர் மாற்றம்)
            </Button>
          </div>

          {activeStudent && (
            <div className="p-4 rounded-2xl bg-primary-50 border border-primary-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-500 text-white flex items-center justify-center font-bold text-lg">
                  {activeStudent.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-lg text-primary-900">{activeStudent.name}</div>
                  <div className="text-xs text-primary-700">
                    Active since: {new Date(activeStudent.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Progress Section */}
        {activeStudent && (
          <section className="bg-surface-raised rounded-3xl p-6 sm:p-8 space-y-6 border border-surface-highlight">
            <div>
              <h2 className="text-xl font-bold text-text">
                {activeStudent.name}'s Learning Progress
              </h2>
              <p className="text-text-muted mt-1">
                Learning progress and attempt history for {activeStudent.name} is stored locally on this device.
              </p>
            </div>

            {clearedStudent ? (
              <div className="flex items-center gap-3 text-success-600 font-bold p-4 bg-success-50 rounded-2xl border border-success-200">
                <CheckCircle2 size={20} />
                {activeStudent.name}'s learning progress has been cleared.
              </div>
            ) : confirmClearStudent ? (
              <div className="border-2 border-danger-200 bg-danger-50 rounded-2xl p-6 space-y-4">
                <p className="font-bold text-danger-800">
                  Are you sure you want to clear {activeStudent.name}'s progress?
                </p>
                <p className="text-sm text-danger-700">
                  This will remove {activeStudent.name}'s completions, scores, and attempt records. Other students' data will NOT be touched.
                </p>
                <div className="flex gap-4">
                  <Button
                    variant="primary"
                    onClick={handleClearStudentProgress}
                    className="bg-danger-600 hover:bg-danger-700 text-white"
                  >
                    <span className="flex items-center gap-2">
                      <Trash2 size={18} /> Yes, clear {activeStudent.name}'s progress
                    </span>
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmClearStudent(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setConfirmClearStudent(true)}>
                <span className="flex items-center gap-2">
                  <Trash2 size={18} /> Clear {activeStudent.name}'s Progress
                </span>
              </Button>
            )}
          </section>
        )}

        {/* Application Information */}
        <section className="bg-surface-raised rounded-3xl p-6 sm:p-8 space-y-4 border border-surface-highlight">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-text-muted shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-text">Application Information (செயலி தகவல்)</h2>
              <div className="text-sm text-text-muted space-y-1">
                <p><span className="font-medium text-text">Platform:</span> TAMIL-LEARN (Early Literacy & Language Platform)</p>
                <p><span className="font-medium text-text">Version:</span> 2.0 (Common Course Architecture)</p>
                <p><span className="font-medium text-text">Subjects:</span> Tamil (தமிழ்) & English (ஆங்கிலம்)</p>
                <p><span className="font-medium text-text">Environment:</span> Neon PostgreSQL Cloud Database with Shared Device Mode</p>
              </div>
            </div>
          </div>
        </section>

        {/* Credits & Attribution Section */}
        <section className="bg-surface-raised rounded-3xl p-6 sm:p-8 space-y-4 border border-surface-highlight">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-bold text-text">Image credits / படங்களுக்கான நன்றி</h2>
              <p className="text-text-muted mt-1">
                View creators, licenses, and sources for Creative Commons and open-licensed images used across activities.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => navigate('/credits')}
              className="flex items-center gap-2 font-bold"
            >
              <ImageIcon size={18} /> View Credits (நன்றியுரை)
            </Button>
          </div>
        </section>
      </div>
    </Page>
  );
}
