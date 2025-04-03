
import React from 'react';
import { SignUp as ClerkSignUp } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

const SignUp = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold text-mediblue-600">MedicoMatch</h1>
      <div className="w-full max-w-md">
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
      </div>
    </div>
  );
};

export default SignUp;
