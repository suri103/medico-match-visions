import React from 'react';
import { Link } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { EMPTY_PROFILE } from '@/lib/profile';
import {
  computeCompleteness,
  needsCompletionPush,
  COMPLETENESS_TARGET,
  type CompletenessResult,
} from '@/lib/profileCompleteness';

/**
 * Persistent profile-completion nudge (onboarding gap-fix #2).
 *
 * Modelled on the incumbent matrimony apps: a meter that is always visible
 * while the profile is below target, listing the highest-weight missing items
 * with deep links straight into the exact onboarding step. Renders nothing
 * once the member is at/above target, so it never becomes furniture.
 */
interface ProfileCompletenessBannerProps {
  /** `compact` for the top of grid pages, `full` for dashboard/profile. */
  variant?: 'compact' | 'full';
  className?: string;
  /** Optional externally computed result (avoids re-deriving per render). */
  result?: CompletenessResult;
}

export const ProfileCompletenessBanner: React.FC<ProfileCompletenessBannerProps> = ({
  variant = 'compact',
  className = '',
  result,
}) => {
  const [profile] = usePersistedState('mm:profileData', EMPTY_PROFILE);
  const [photos] = usePersistedState<Array<{ url?: string }>>('mm:profilePhotos', []);
  const [interests] = usePersistedState<string[]>('mm:profileInterests', []);

  const completeness =
    result ?? computeCompleteness({ profile: profile as unknown as Record<string, unknown>, photos, interests });

  if (!needsCompletionPush(completeness)) return null;

  const missing = completeness.missing;
  const shown = variant === 'full' ? missing.slice(0, 4) : missing.slice(0, 2);
  const remaining = missing.length - shown.length;

  return (
    <div
      className={`rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <AlertCircle size={18} className="text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-amber-900">
              Your profile is {completeness.percent}% complete
            </p>
            <span className="text-[11px] font-medium text-amber-800">
              {COMPLETENESS_TARGET}% needed for full matching
            </span>
          </div>
          <Progress value={completeness.percent} className="mt-2 h-2" />
          <p className="text-[11px] text-amber-800 mt-2">
            {completeness.canInteract
              ? 'Complete the steps below to appear higher in search and get better matches.'
              : 'Add your basics and a real photo to start sending and receiving interests.'}
          </p>

          <ul className="mt-3 space-y-1.5">
            {shown.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs text-slate-700 min-w-0">
                  <span className="h-3.5 w-3.5 rounded-full border border-amber-400 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                <Link to={item.href} className="shrink-0">
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]">
                    {item.cta} <ArrowRight size={10} className="ml-1" />
                  </Button>
                </Link>
              </li>
            ))}
            {remaining > 0 && (
              <li className="text-[11px] text-amber-800 pl-5">+ {remaining} more step{remaining === 1 ? '' : 's'}</li>
            )}
          </ul>

          <div className="mt-3 flex items-center gap-2">
            <Link to="/onboarding">
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] h-7">
                {completeness.percent === 0 ? 'Complete your profile' : 'Continue setup'}
              </Button>
            </Link>
            {completeness.canInteract && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-700">
                <CheckCircle2 size={12} /> You can already browse and send interests
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileCompletenessBanner;