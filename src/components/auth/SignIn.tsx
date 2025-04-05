
import React from 'react';
import { SignIn as ClerkSignIn } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SignIn = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-mediblue-600">MedicoMatch</h1>
          <p className="text-sm text-gray-600 mt-2">Healthcare Professional Network</p>
        </div>
        
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Welcome Back</h2>
            <p className="text-gray-600 text-sm mt-1">Sign in to access your MedicoMatch account</p>
          </div>
          
          <ClerkSignIn 
            routing="path" 
            path="/sign-in" 
            signUpUrl="/sign-up"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none p-0 bg-transparent",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                socialButtonsBlockButton: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
                socialButtonsBlockButtonText: "font-medium",
                dividerLine: "bg-gray-200",
                dividerText: "text-gray-500 text-sm",
                formButtonPrimary: "bg-mediblue-600 hover:bg-mediblue-700 text-white font-medium py-2.5",
                formFieldInput: "border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mediblue-500 focus:border-mediblue-500",
                formFieldLabel: "text-gray-700 font-medium text-sm",
                footerActionText: "text-gray-600",
                footerActionLink: "text-mediblue-600 hover:text-mediblue-700 font-medium",
                identityPreviewText: "text-gray-700",
                identityPreviewEditButton: "text-mediblue-600 hover:text-mediblue-700"
              }
            }}
          />
        </div>
        
        <div className="mt-6 text-center text-sm text-gray-500">
          <p className="mb-2">Secure access for medical professionals</p>
          <p>By signing in, you agree to our <a href="#" className="text-mediblue-600 hover:underline">Terms of Service</a> and <a href="#" className="text-mediblue-600 hover:underline">Privacy Policy</a></p>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
