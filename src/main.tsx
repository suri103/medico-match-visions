import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// This file bootstraps the app; the ErrorBoundary below cannot be extracted
// without wrapping the root, so keep it local (no fast-refresh rules apply).

// Create a simple error boundary component
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ color: 'red' }}>Something went wrong</h1>
          <p>There was an error rendering the application:</p>
          <pre style={{
            backgroundColor: '#f5f5f5',
            padding: '10px',
            borderRadius: '5px',
            overflow: 'auto',
            maxHeight: '300px'
          }}>
            {this.state.error?.message || 'Unknown error'}
          </pre>
          <button
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
            onClick={() => window.location.reload()}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Render the application
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <ErrorBoundary>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </ErrorBoundary>
);
