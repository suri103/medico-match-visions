
import React from 'react';
import { SignUp as ClerkSignUp } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { Facebook, Instagram, Twitter } from 'lucide-react';

const SignUp = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold text-mediblue-600">MedicoMatch</h1>
      <div className="w-full max-w-md">
        {/* Social signup buttons above email field */}
        <div className="mb-4 bg-white p-6 rounded-lg shadow-md text-center">
          <p className="mb-4 text-gray-600 font-medium">Sign up with</p>
          <div className="flex justify-center space-x-6">
            <button 
              onClick={() => window.location.href = '/sign-up?strategy=oauth_facebook'}
              className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              aria-label="Sign up with Facebook"
            >
              <Facebook size={24} />
            </button>
            <button 
              onClick={() => window.location.href = '/sign-up?strategy=oauth_instagram'}
              className="flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 text-white transition-colors"
              aria-label="Sign up with Instagram"
            >
              <Instagram size={24} />
            </button>
            <button 
              onClick={() => window.location.href = '/sign-up?strategy=oauth_twitter'}
              className="flex items-center justify-center h-12 w-12 rounded-full bg-black hover:bg-gray-800 text-white transition-colors"
              aria-label="Sign up with X (Twitter)"
            >
              <Twitter size={24} />
            </button>
          </div>
        </div>
        
        <ClerkSignUp 
          routing="path" 
          path="/sign-up" 
          signInUrl="/sign-in"
          appearance={{
            elements: {
              rootBox: "mx-auto w-full",
              card: "shadow-md rounded-lg border border-gray-200 bg-white",
              headerTitle: "text-xl font-semibold text-mediblue-600",
              headerSubtitle: "text-gray-600",
              socialButtonsBlockButton: "border border-gray-300 hover:bg-gray-50",
              formButtonPrimary: "bg-mediblue-600 hover:bg-mediblue-700",
              footerAction: "text-mediblue-600 hover:text-mediblue-700"
            }
          }}
        />
        
        {/* Remove the old custom social buttons section */}
      </div>
    </div>
  );
};

export default SignUp;
