import { useState } from 'react';
import { Page } from '../../components/ui/Page';
import { Button } from '../../components/ui/Button';
import { useStudent, CLASS_CODE_PATH } from '../../student';
import { useNavigate } from 'react-router-dom';
import { Trash2, CheckCircle2, Users, Image as ImageIcon } from 'lucide-react';

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
          <p className="text-text-muted">Manage your learning profiles and preferences.</p>
        </div>

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
              onClick={() => navigate(CLASS_CODE_PATH)}
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
