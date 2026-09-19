import React from 'react';
import { Users, RefreshCw, UserPlus, Camera, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { usePersistedState } from '@/hooks/usePersistedState';
import { EMPTY_PROFILE } from '@/lib/profile';
import { computeCompleteness, COMPLETENESS_TARGET } from '@/lib/profileCompleteness';

interface EmptyMatchesProps {
  onResetFilters: () => void;
  filterCount?: number;
  showSearchTips?: boolean;
}

/**
 * Empty-state component (onboarding gap-fix #4).
 *
 * Two very different situations look identical to a user today: "your filters
 * matched nothing" and "there is genuinely no one here yet / your profile is
 * too thin to be matched". The incumbents always pair an empty state with the
 * single next action — so this version distinguishes the cases and, when the
 * member's own profile is incomplete, leads with the fix that actually changes
 * their outcomes (photo first, then details) instead of only offering a filter
 * reset that cannot help.
 */
const EmptyMatches: React.FC<EmptyMatchesProps> = ({
  onResetFilters,
  filterCount = 0,
  showSearchTips = false
}) => {
  const [profile] = usePersistedState('mm:profileData', EMPTY_PROFILE);
  const [photos] = usePersistedState<Array<{ url?: string }>>('mm:profilePhotos', []);
  const [interests] = usePersistedState<string[]>('mm:profileInterests', []);

  const completeness = computeCompleteness({
    profile: profile as unknown as Record<string, unknown>,
    photos,
    interests,
  });
  const thinProfile = completeness.percent < COMPLETENESS_TARGET;
  const top = completeness.missing.slice(0, 3);

  return (
    <Card className="w-full overflow-hidden">
      <CardContent className="p-0">
        <div className="text-center py-14 px-4">
          <Users className="mx-auto h-14 w-14 text-gray-300 mb-4" />
          <h3 className="text-xl font-medium text-gray-900">
            {filterCount > 0 ? 'No doctors match your filters' : 'No profiles to show yet'}
          </h3>

          {filterCount > 0 ? (
            <p className="text-gray-500 mt-2 max-w-md mx-auto">
              Your filters are quite specific. Try widening the age range or removing a
              community / location filter — new members join daily.
            </p>
          ) : (
            <p className="text-gray-500 mt-2 max-w-md mx-auto">
              You are early — the member pool is still filling up. Complete your profile so
              you are ready the moment compatible doctors join, and we will surface them first.
            </p>
          )}

          {/* The real next action when the member's OWN profile is thin. */}
          {thinProfile && top.length > 0 && (
            <div className="mt-6 max-w-md mx-auto text-left rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <Sparkles size={15} /> Your profile is {completeness.percent}% complete
              </p>
              <ul className="mt-2 space-y-1.5">
                {top.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs text-slate-700 min-w-0">
                      {item.id === 'photo' ? (
                        <Camera size={13} className="text-amber-700 shrink-0" />
                      ) : (
                        <UserPlus size={13} className="text-amber-700 shrink-0" />
                      )}
                      <span className="truncate">{item.label}</span>
                    </span>
                    <Link to={item.href} className="shrink-0 text-[11px] font-semibold text-mediblue-700 hover:underline">
                      {item.cta}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link to="/onboarding">
                <Button size="sm" className="mt-3 bg-amber-600 hover:bg-amber-700 text-white text-xs">
                  Complete setup
                </Button>
              </Link>
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
            {filterCount > 0 && (
              <Button className="flex items-center gap-2" onClick={onResetFilters}>
                <RefreshCw size={16} />
                Reset all filters
              </Button>
            )}
            <Link to="/profile/edit">
              <Button variant={filterCount > 0 ? 'outline' : 'default'} className="flex items-center gap-2 w-full sm:w-auto">
                <UserPlus size={16} />
                {thinProfile ? 'Improve my profile' : 'Edit my profile'}
              </Button>
            </Link>
          </div>

          {showSearchTips && (
            <div className="mt-10 max-w-lg mx-auto text-left">
              <h4 className="font-medium text-gray-800 mb-3 text-center">Make your profile easier to match</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start">
                  <div className="bg-mediblue-100 text-mediblue-700 rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5 shrink-0">1</div>
                  <span>Add a clear profile photo — photoless profiles rank last in search</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-mediblue-100 text-mediblue-700 rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5 shrink-0">2</div>
                  <span>Set your partner age range and preferred location</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-mediblue-100 text-mediblue-700 rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5 shrink-0">3</div>
                  <span>Add horoscope details to unlock Kundali compatibility scoring</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-mediblue-100 text-mediblue-700 rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5 shrink-0">4</div>
                  <span>Submit council verification to earn the Verified badge</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EmptyMatches;