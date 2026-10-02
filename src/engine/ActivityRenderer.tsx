import { Activity } from '../types';
import { ActivityRuntimeState } from './types';
import { activityRegistry } from './ActivityRegistry';
import { Button } from '../components/ui/Button';
import { AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ActivityRendererProps {
  activity: Activity;
  state: ActivityRuntimeState;
  onSubmit: (input: unknown) => void;
  onNext?: () => void;
}

export function ActivityRenderer({ activity, state, onSubmit, onNext }: ActivityRendererProps) {
  const navigate = useNavigate();
  
  // Try to find the exact registered component
  let definition = activityRegistry.getDefinition(activity.category, activity.variant);
  
  // Fallback to placeholder if not found (during phase 5 this will almost always happen, 
  // but we explicitly map 'unknown' to placeholder)
  if (!definition) {
    definition = activityRegistry.getDefinition('unknown', 'unknown');
  }

  if (!definition) {
    // Failsafe error boundary when even the placeholder is missing
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-6 text-center">
        <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-2xl font-bold font-display">செயல் கிடைக்கவில்லை</h2>
        <p className="text-text-muted">இந்தக் கற்றல் செயல்பாடு கிடைக்கவில்லை.</p>
        <Button onClick={() => navigate(-1)} variant="secondary">பின்செல்</Button>
      </div>
    );
  }

  const Component = definition.component;

  return (
    <Component 
      activity={activity} 
      state={state} 
      onSubmit={onSubmit} 
      onNext={onNext}
    />
  );
}
