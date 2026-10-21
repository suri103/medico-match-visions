import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Ban, WifiOff, SearchX, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Reusable error/empty/forbidden state (launch-gap fix #6).
 *
 * 404/403/500/offline/session-expired should be consistent COMPONENTS and
 * states — never ad-hoc text and never new standalone URLs (an empty
 * shortlist is a state, not /empty-shortlist). This block is used by the
 * admin console (403), the session-expired banner target, and fetch-failure
 * screens (offline/500).
 */
export type ErrorStateVariant = 'forbidden' | 'error' | 'offline' | 'empty' | 'expired';

const ICONS: Record<ErrorStateVariant, React.ComponentType<{ size?: number | string; className?: string }>> = {
  forbidden: Ban,
  error: AlertTriangle,
  offline: WifiOff,
  empty: SearchX,
  expired: KeyRound,
};

interface ErrorStateProps {
  variant?: ErrorStateVariant;
  title: string;
  description?: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  variant = 'error',
  title,
  description,
  actionLabel,
  actionTo,
  onAction,
}) => {
  const navigate = useNavigate();
  const Icon = ICONS[variant];
  const handle = () => {
    if (onAction) onAction();
    else if (actionTo) void navigate(actionTo);
  };
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      <div className="rounded-full bg-slate-100 p-4 mb-3">
        <Icon size={26} className="text-slate-500" />
      </div>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {description && <p className="text-sm text-slate-500 mt-1 max-w-md">{description}</p>}
      {(actionLabel && (actionTo || onAction)) && (
        <Button variant="outline" size="sm" className="mt-4" onClick={handle}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default ErrorState;
