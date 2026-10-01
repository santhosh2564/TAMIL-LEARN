import { useState } from 'react';
import { Page } from '../../components/ui/Page';
import { Button } from '../../components/ui/Button';
import { ProgressService, LocalProgressRepository } from '../../progress';
import { Trash2, CheckCircle2 } from 'lucide-react';

export function SettingsPage() {
  const [confirmClear, setConfirmClear] = useState(false);
  const [cleared, setCleared] = useState(false);

  const handleClearRequest = () => {
    setConfirmClear(true);
  };

  const handleClearConfirm = async () => {
    const service = new ProgressService(new LocalProgressRepository());
    await service.clearProgress();
    setConfirmClear(false);
    setCleared(true);
  };

  const handleClearCancel = () => {
    setConfirmClear(false);
  };

  return (
    <Page>
      <div className="max-w-2xl mx-auto py-12 space-y-10">
        <div>
          <h1 className="text-3xl font-display font-bold text-text mb-2">Settings</h1>
          <p className="text-text-muted">Manage your learning preferences.</p>
        </div>

        {/* Progress Section */}
        <section className="bg-surface-raised rounded-3xl p-8 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-text">Learning Progress</h2>
            <p className="text-text-muted mt-1">
              Your learning progress is saved locally in this browser. Clearing it cannot be undone.
            </p>
          </div>

          {cleared ? (
            <div className="flex items-center gap-3 text-success-600 font-bold">
              <CheckCircle2 size={20} />
              Learning progress has been cleared.
            </div>
          ) : confirmClear ? (
            <div className="border-2 border-danger-200 bg-danger-50 rounded-2xl p-6 space-y-4">
              <p className="font-bold text-danger-800">
                Are you sure? This will permanently remove all locally stored learning progress.
              </p>
              <p className="text-sm text-danger-700">
                Your activities and content will not be affected — only your completion records will be removed.
              </p>
              <div className="flex gap-4">
                <Button
                  variant="primary"
                  onClick={handleClearConfirm}
                  className="bg-danger-600 hover:bg-danger-700 text-white"
                >
                  <span className="flex items-center gap-2">
                    <Trash2 size={18} /> Yes, clear progress
                  </span>
                </Button>
                <Button variant="secondary" onClick={handleClearCancel}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" onClick={handleClearRequest}>
              <span className="flex items-center gap-2">
                <Trash2 size={18} /> Clear Learning Progress
              </span>
            </Button>
          )}
        </section>

        {/* Future Settings Placeholder */}
        <section className="bg-surface-raised rounded-3xl p-8 opacity-60">
          <h2 className="text-xl font-bold text-text">Sound & Language</h2>
          <p className="text-text-muted mt-1">Sound and language preferences will be available in a future update.</p>
        </section>
      </div>
    </Page>
  );
}
