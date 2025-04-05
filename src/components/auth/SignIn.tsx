
import React from 'react';
import { SignIn as ClerkSignIn } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

const SignIn = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold text-mediblue-600">MedicoMatch</h1>
      <div className="w-full max-w-md">
        <ClerkSignIn 
          routing="path" 
          path="/sign-in" 
          signUpUrl="/sign-up"
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
        
        {/* Add custom social buttons below the Clerk component */}
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600 mb-3">Or sign in with</p>
          <div className="grid grid-cols-3 gap-2">
            <button 
              onClick={() => window.location.href = '/sign-in?strategy=oauth_facebook'}
              className="flex items-center justify-center py-2 px-3 rounded-md transition-colors bg-blue-600 hover:bg-blue-700 text-white"
            >
              Facebook
            </button>
            <button 
              onClick={() => window.location.href = '/sign-in?strategy=oauth_instagram'}
              className="flex items-center justify-center py-2 px-3 rounded-md transition-colors bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white"
            >
              Instagram
            </button>
            <button 
              onClick={() => window.location.href = '/sign-in?strategy=oauth_twitter'}
              className="flex items-center justify-center py-2 px-3 rounded-md transition-colors bg-black hover:bg-gray-800 text-white"
            >
              X
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
