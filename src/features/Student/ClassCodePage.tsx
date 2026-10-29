import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page } from '../../components/ui/Page';
import { Button } from '../../components/ui/Button';

const CLASS_CODE_LENGTH = 6;

/** Normalises what a child types: trims, drops inner spaces, uppercases, keeps letters and digits. */
function normaliseCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/**
 * Entry point for students. Students exist only on the server, so learning starts from the
 * class link (/c/:code) the teacher gives out; this page lets a child type that code.
 */
export function ClassCodePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const normalised = normaliseCode(code);
  const isComplete = normalised.length === CLASS_CODE_LENGTH;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isComplete) return;
    navigate(`/c/${normalised}`);
  };

  return (
    <Page className="flex flex-col items-center justify-center min-h-[75vh]">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-surface-highlight p-8 space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-text">
            உங்கள் ஆசிரியரிடம் வகுப்பு இணைப்பைக் கேளுங்கள்
          </h1>
          <p className="text-lg text-text-muted">Ask your teacher for your class link</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label htmlFor="class-code-input" className="block text-sm font-bold text-text-muted">
            வகுப்புக் குறியீடு / Class code
          </label>
          <input
            id="class-code-input"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={CLASS_CODE_LENGTH + 4}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABC234"
            className="w-full text-center tracking-[0.4em] font-mono font-bold text-3xl uppercase px-4 py-4 rounded-2xl border-2 border-surface-highlight focus:outline-none focus:ring-4 focus:ring-primary-100 focus:border-primary-500"
          />
          <Button type="submit" size="large" variant="primary" disabled={!isComplete} className="w-full">
            வகுப்பைத் திற / Open class
          </Button>
        </form>
      </div>
    </Page>
  );
}
