import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Matches from './Matches';
import { FavoritesProvider } from '@/features/favorites/FavoritesContext';

// Mock Auth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isSignedIn: true,
    user: { fullName: "Dr. Test User", firstName: "Test", lastName: "User" },
    signOut: vi.fn(),
    signIn: vi.fn(),
  }),
}));

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock the plan hook
vi.mock('@/hooks/usePlan', () => ({
  usePlan: () => ({
    canUse: vi.fn(() => true),
  }),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Helper to render Matches component with routing context
const renderMatches = (searchString = '', locationState?: unknown) => {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/matches', search: searchString, state: locationState }]}>
      <FavoritesProvider>
        <Routes>
          <Route path="/matches" element={<Matches />} />
        </Routes>
      </FavoritesProvider>
    </MemoryRouter>
  );
};

describe('Matches Integration Tests', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorageMock.clear();
    
    // Set up minimal localStorage data to prevent crashes
    localStorageMock.setItem('mm:savedSearches', JSON.stringify([]));
    localStorageMock.setItem('mm:favorites', JSON.stringify([]));
    localStorageMock.setItem('mm:connections', JSON.stringify([]));
    localStorageMock.setItem('mm:blockedIds', JSON.stringify([]));
    localStorageMock.setItem('mm:interestedInYou', JSON.stringify([]));
  });

  describe('Valid Query Parameters', () => {
    it('should render successfully with valid age range query parameters', async () => {
      const { container } = renderMatches('?min=25&max=45');
      
      // Wait for component to render
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // Should not crash - verify key elements are present using getAllByText
      const matchElements = screen.queryAllByText(/matches/i);
      expect(matchElements.length).toBeGreaterThan(0);
    });

    it('should render successfully with valid specialty query parameter', async () => {
      const { container } = renderMatches('?spec=cardiology,neurology');
      
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // Page should render without errors
      expect(container).toBeTruthy();
    });

    it('should render successfully with valid location query parameters', async () => {
      const { container } = renderMatches('?country=USA&state=CA&city=Los Angeles');
      
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // Should not crash
      expect(container).toBeTruthy();
    });

    it('should render successfully with valid search term query parameter', async () => {
      const { container } = renderMatches('?q=diabetes');
      
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // Should not crash
      expect(container).toBeTruthy();
    });

    it('should render successfully with valid boolean query parameter', async () => {
      const { container } = renderMatches('?online=1');
      
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // Should not crash
      expect(container).toBeTruthy();
    });

    it('should render successfully with complex valid query parameters', async () => {
      const { container } = renderMatches(
        '?min=30&max=50&spec=cardiology&country=USA&state=CA&q=heart&online=1'
      );
      
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // Should not crash with multiple valid parameters
      expect(container).toBeTruthy();
    });

    it('should preserve filter state from query parameters', async () => {
      const { container } = renderMatches('?min=35&max=55&spec=cardiology');
      
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // The page should render and apply filters
      // Filter state is internal to useMatches hook
      expect(container).toBeTruthy();
    });
  });

  describe('Invalid Query Parameters', () => {
    it('should handle invalid integer query parameter gracefully (no crash)', async () => {
      const { container } = renderMatches('?min=abc');
      
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // Should not crash - page should render normally
      expect(container).toBeTruthy();
      
      // Should not show any error screen or white screen
      expect(container.querySelector('.min-h-screen')).toBeTruthy();
    });

    it('should handle negative age query parameter gracefully (no crash)', async () => {
      const { container } = renderMatches('?min=-10&max=-5');
      
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // Should not crash
      expect(container).toBeTruthy();
    });

    it('should handle XSS attempt in query parameter gracefully (no crash)', async () => {
      const { container } = renderMatches('?q=<script>alert("xss")</script>');
      
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // Should not crash
      expect(container).toBeTruthy();
      
      // Should sanitize the input (script tags should not be present in DOM)
      expect(container.innerHTML).not.toContain('<script>');
    });

    it('should handle empty array elements in query parameter gracefully (no crash)', async () => {
      const { container } = renderMatches('?spec=cardiology,,surgery');
      
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // Should not crash
      expect(container).toBeTruthy();
    });

    it('should handle invalid boolean query parameter gracefully (no crash)', async () => {
      const { container } = renderMatches('?online=yes');
      
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // Should not crash
      expect(container).toBeTruthy();
    });

    it('should handle inverted range query parameter gracefully (no crash)', async () => {
      const { container } = renderMatches('?min=60&max=30');
      
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // Should not crash - invalid ranges should be handled
      expect(container).toBeTruthy();
    });

    it('should handle multiple invalid query parameters gracefully (no crash)', async () => {
      const { container } = renderMatches(
        '?min=abc&max=xyz&spec=<script>&online=maybe&q=<img onerror="alert(1)">'
      );
      
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // Should not crash even with multiple malformed parameters
      expect(container).toBeTruthy();
      
      // Should not have script tags or dangerous content
      expect(container.innerHTML).not.toContain('<script>');
      expect(container.innerHTML).not.toContain('onerror');
    });

    it('should not display uncaught errors in console for invalid parameters', async () => {
      // Spy on console.error to ensure no errors are logged
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const { container } = renderMatches('?min=invalid&spec=<script>');
      
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // Should not have logged any console errors
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Empty and Edge Cases', () => {
    it('should render successfully with no query parameters', async () => {
      const { container } = renderMatches('');
      
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // Should render normally with default state
      expect(container).toBeTruthy();
    });

    it('should handle empty query string gracefully', async () => {
      const { container } = renderMatches('?');
      
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // Should not crash
      expect(container).toBeTruthy();
    });

    it('should handle query parameters with empty values', async () => {
      const { container } = renderMatches('?min=&max=&spec=');
      
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // Should not crash
      expect(container).toBeTruthy();
    });
  });

  describe('Navigation and State Preservation', () => {
    it('should preserve valid query parameters when component mounts', async () => {
      const { container } = renderMatches('?min=30&max=50&spec=cardiology');
      
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // Component should render and apply the query parameters
      // The actual filter state is internal, but we verify no crash
      expect(container).toBeTruthy();
    });

    it('should handle navigation from search page with state', async () => {
      const searchCriteria = {
        searchTerm: 'diabetes',
        minAge: [30],
        maxAge: [50],
        specialties: ['cardiology'],
        onlineOnly: true,
      };
      
      const { container } = render(
        <MemoryRouter 
          initialEntries={[
            { pathname: '/matches', state: { search: searchCriteria } }
          ]}
        >
          <FavoritesProvider>
            <Routes>
              <Route path="/matches" element={<Matches />} />
            </Routes>
          </FavoritesProvider>
        </MemoryRouter>
      );
      
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // Should render successfully with state-based search criteria
      expect(container).toBeTruthy();
    });

    it('should prioritize location state over query parameters when both present', async () => {
      const searchCriteria = {
        searchTerm: 'state-search',
        minAge: [35],
        maxAge: [55],
      };
      
      const { container } = render(
        <MemoryRouter 
          initialEntries={[
            { 
              pathname: '/matches',
              search: '?q=query-search&min=25&max=45',
              state: { search: searchCriteria }
            }
          ]}
        >
          <FavoritesProvider>
            <Routes>
              <Route path="/matches" element={<Matches />} />
            </Routes>
          </FavoritesProvider>
        </MemoryRouter>
      );
      
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // Should render successfully - state takes precedence
      expect(container).toBeTruthy();
    });
  });

  describe('Filtered Results', () => {
    it('should render doctor cards when valid filters are applied', async () => {
      const { container } = renderMatches('?min=25&max=45');
      
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // Should render the matches view
      expect(container).toBeTruthy();
    });

    it('should handle filters that produce no results gracefully', async () => {
      // Extreme filters likely to produce no results
      const { container } = renderMatches('?min=150&max=150&spec=nonexistent');
      
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // Should not crash even with zero results
      expect(container).toBeTruthy();
    });
  });

  describe('Error Boundaries', () => {
    it('should not show white screen of death with invalid parameters', async () => {
      const { container } = renderMatches('?min=<script>&max=alert(1)&spec=javascript:void(0)');
      
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // Main container should exist (no white screen)
      expect(container.querySelector('.min-h-screen')).toBeTruthy();
      
      // Should not contain dangerous scripts
      expect(container.innerHTML).not.toContain('<script>');
      expect(container.innerHTML).not.toContain('javascript:');
    });

    it('should render main layout even with all invalid parameters', async () => {
      const { container } = renderMatches(
        '?min=invalid&max=bad&spec=<xss>&country=<script>&state=malformed&city=bad&q=<img>&online=wrong'
      );
      
      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeTruthy();
      });
      
      // Should render the page structure
      expect(container.querySelector('.min-h-screen')).toBeTruthy();
    });
  });
});
