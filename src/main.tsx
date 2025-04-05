
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import './index.css';

// Use the provided publishable key
const PUBLISHABLE_KEY = "pk_test_ZnVsbC1rcmlsbC03MS5jbGVyay5hY2NvdW50cy5kZXYk";

// Check if we have a valid key
const hasValidClerkKey = PUBLISHABLE_KEY && 
  PUBLISHABLE_KEY !== 'pk_test_placeholder_value' && 
  !PUBLISHABLE_KEY.includes('placeholder');

// Create a DemoApp component that shows instructions when no valid Clerk key is found
const DemoApp = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold text-mediblue-600">MedicoMatch</h1>
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Authentication Setup Required</h2>
        <p className="mb-4">To enable authentication features, you need to set up your Clerk API key:</p>
        <ol className="list-decimal pl-5 mb-6 space-y-2">
          <li>Create a free account at <a href="https://clerk.com" className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">Clerk.com</a></li>
          <li>Get your publishable key from the Clerk dashboard</li>
          <li>Set it as the environment variable <code className="bg-gray-100 p-1 rounded">VITE_CLERK_PUBLISHABLE_KEY</code></li>
        </ol>
        <p className="text-sm text-gray-500">For demo purposes, you can still use the app without authentication, but sign-in functionality will be disabled.</p>
        <button 
          className="mt-4 px-4 py-2 bg-mediblue-600 text-white rounded hover:bg-mediblue-700"
          onClick={() => window.location.reload()}
        >
          Try Again
        </button>
      </div>
    </div>
  );
};

// Render the appropriate app version based on key availability
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {hasValidClerkKey ? (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <App />
      </ClerkProvider>
    ) : (
      <DemoApp />
    )}
  </React.StrictMode>,
);
