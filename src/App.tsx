import React, { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from '@/hooks/useAuth';
import { FavoritesProvider } from "@/features/favorites/FavoritesContext";
import { devAuthBypass } from "@/lib/devAuth";
import { astrologyEnabled } from "@/lib/features";

// Route-level code splitting: each page is fetched on demand so the initial
// bundle stays small. Pages are only loaded when their route is visited.
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Matches = lazy(() => import("./pages/Matches"));
const Search = lazy(() => import("./pages/Search"));
const VideoDatePage = lazy(() => import("./pages/VideoDatePage"));
const VideoMatchPage = lazy(() => import("./pages/VideoMatchPage"));
const AstrologerPage = lazy(() => import("./pages/AstrologerPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const EditProfilePage = lazy(() => import("./pages/EditProfilePage"));
const FavoritesPage = lazy(() => import("./pages/FavoritesPage"));
const SuccessStoriesPage = lazy(() => import("./pages/SuccessStoriesPage"));
const PlanPage = lazy(() => import("./pages/PlanPage"));
const HelpPage = lazy(() => import("./pages/HelpPage"));
const SignIn = lazy(() => import("./components/auth/SignIn"));
const SignUp = lazy(() => import("./components/auth/SignUp"));
const VerifyEmail = lazy(() => import("./components/auth/VerifyEmail"));
const ResetPassword = lazy(() => import("./components/auth/ResetPassword"));
const OnlinePage = lazy(() => import("./pages/OnlinePage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const EventsPage = lazy(() => import("./pages/EventsPage"));
const MyInterestsPage = lazy(() => import("./pages/MyInterestsPage"));
const InterestedInYouPage = lazy(() => import("./pages/InterestedInYouPage"));
const SavedMatchesPage = lazy(() => import("./pages/SavedMatchesPage"));
const PublicProfilePage = lazy(() => import("./pages/PublicProfilePage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isSignedIn, isLoaded } = useAuth();

  // Development-only bypass: opens every route without signing in.
  if (devAuthBypass) {
    return <>{children}</>;
  }

  if (!isLoaded) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return <>{children}</>;
};

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="h-8 w-8 border-2 border-mediblue-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => {
  return (
      <TooltipProvider>
        <div className="flex min-h-screen flex-col bg-background">
          <Toaster />
          <FavoritesProvider>
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public routes */}
                <Route path="/sign-in/*" element={<SignIn />} />
                <Route path="/sign-up/*" element={<SignUp />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/" element={<Index />} />
                <Route path="/online" element={<OnlinePage />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/success-stories" element={<SuccessStoriesPage />} />
                <Route path="/plan" element={<PlanPage />} />
                <Route path="/help" element={<HelpPage />} />

                {/* Protected routes (require authentication) */}
                <Route path="/matches" element={<ProtectedRoute><Matches /></ProtectedRoute>} />
                <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
                <Route path="/favorites" element={<ProtectedRoute><FavoritesPage /></ProtectedRoute>} />
                <Route path="/saved-matches" element={<ProtectedRoute><SavedMatchesPage /></ProtectedRoute>} />
                <Route path="/my-interests" element={<ProtectedRoute><MyInterestsPage /></ProtectedRoute>} />
                <Route path="/interested-in-you" element={<ProtectedRoute><InterestedInYouPage /></ProtectedRoute>} />
                <Route path="/video-dates" element={<ProtectedRoute><VideoDatePage /></ProtectedRoute>} />
                <Route path="/video-match" element={<ProtectedRoute><VideoMatchPage /></ProtectedRoute>} />
                {/* Astrology consultations: feature-flagged. Shipped in-repo but disabled
                    until VITE_ASTROLOGY_ENABLED=true at build time - the route is not
                    reachable (and its lazy chunk is never fetched) otherwise. */}
                {astrologyEnabled && (
                  <Route path="/astrology" element={<ProtectedRoute><AstrologerPage /></ProtectedRoute>} />
                )}
                <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><PublicProfilePage /></ProtectedRoute>} />
                <Route path="/profile/edit" element={<ProtectedRoute><EditProfilePage /></ProtectedRoute>} />
                <Route path="/doctor/:id" element={<ProtectedRoute><PublicProfilePage /></ProtectedRoute>} />
                <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </FavoritesProvider>
      </div>
    </TooltipProvider>
  );
};

export default App;
