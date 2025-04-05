
import React from 'react';
import { SignIn as ClerkSignIn } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

const SignIn = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold text-mediblue-600">MedicoMatch</h1>
      <div className="w-full max-w-md">
        <div className="mb-4 bg-white p-6 rounded-lg shadow-md text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Welcome Back</h2>
          <p className="text-gray-600">Sign in to access your MedicoMatch account</p>
        </div>
        
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
              formButtonPrimary: "bg-mediblue-600 hover:bg-mediblue-700",
              footerAction: "text-mediblue-600 hover:text-mediblue-700"
            }
          }}
        />
      </div>
      
      {/* Professional healthcare information */}
      <div className="mt-8 text-center text-sm text-gray-500 max-w-md">
        <p className="mb-2">Secure access for medical professionals</p>
        <p>By signing in, you agree to our professional code of conduct and privacy policy</p>
      </div>
    </div>
  );
};

export default SignIn;
