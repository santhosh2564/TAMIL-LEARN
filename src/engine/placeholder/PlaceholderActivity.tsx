import { ActivityComponentProps } from '../types';
import { Button } from '../../components/ui/Button';

export function PlaceholderActivity({ onSubmit }: ActivityComponentProps<string>) {
  return (
    <div className="flex flex-col items-center text-center space-y-8 p-8 bg-surface-raised rounded-3xl max-w-2xl mx-auto w-full">
      <div className="space-y-4">
        <h2 className="text-3xl font-bold font-display text-text">செயல்பாடு விரைவில் வரும்</h2>
        <p className="text-xl text-text-muted">
          இந்த வகை செயல்பாட்டை நாங்கள் இன்னும் உருவாக்கி வருகிறோம். இதை இப்போதைக்குத் தவிர்க்கவும்!
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
        <Button 
          className="px-8"
          onClick={() => onSubmit('skip')}
        >
          செயல்பாட்டைத் தவிர்
        </Button>
      </div>
    </div>
  );
}
