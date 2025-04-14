
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Matches from "./pages/Matches";
import Search from "./pages/Search";
import VideoDatePage from "./pages/VideoDatePage";
import VideoMatchPage from "./pages/VideoMatchPage";
import MessagesPage from "./pages/MessagesPage";
import ProfilePage from "./pages/ProfilePage";
import AstrologerPage from "./pages/AstrologerPage";
import FavoritesPage from "./pages/FavoritesPage";
import SuccessStoriesPage from "./pages/SuccessStoriesPage";
import PlanPage from "./pages/PlanPage";
import HelpPage from "./pages/HelpPage";
import SignIn from "./components/auth/SignIn";
import SignUp from "./components/auth/SignUp";
import OnlinePage from "./pages/OnlinePage";
import AccountPage from "./pages/AccountPage";
import EventsPage from "./pages/EventsPage";
import MyInterestsPage from "./pages/MyInterestsPage";
import InterestedInYouPage from "./pages/InterestedInYouPage";

const queryClient = new QueryClient();

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  // Get clerk initialization status
  const { isLoaded } = useAuth();
  
  // Only check authentication when Clerk is loaded
  if (!isLoaded) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <Navigate to="/sign-in" replace />
      </SignedOut>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/sign-in/*" element={<SignIn />} />
            <Route path="/sign-up/*" element={<SignUp />} />
            
            {/* Protected routes */}
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/online" element={<ProtectedRoute><OnlinePage /></ProtectedRoute>} />
            <Route path="/matches" element={<ProtectedRoute><Matches /></ProtectedRoute>} />
            <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
            <Route path="/favorites" element={<ProtectedRoute><FavoritesPage /></ProtectedRoute>} />
            <Route path="/my-interests" element={<ProtectedRoute><MyInterestsPage /></ProtectedRoute>} />
            <Route path="/interested-in-you" element={<ProtectedRoute><InterestedInYouPage /></ProtectedRoute>} />
            <Route path="/video-dates" element={<ProtectedRoute><VideoDatePage /></ProtectedRoute>} />
            <Route path="/video-match" element={<ProtectedRoute><VideoMatchPage /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
            <Route path="/events" element={<ProtectedRoute><EventsPage /></ProtectedRoute>} />
            <Route path="/astrologer" element={<ProtectedRoute><AstrologerPage /></ProtectedRoute>} />
            <Route path="/success-stories" element={<ProtectedRoute><SuccessStoriesPage /></ProtectedRoute>} />
            <Route path="/plan" element={<ProtectedRoute><PlanPage /></ProtectedRoute>} />
            <Route path="/help" element={<ProtectedRoute><HelpPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </div>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
