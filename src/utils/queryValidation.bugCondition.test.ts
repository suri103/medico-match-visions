import { describe, it, expect } from 'vitest';
import { parseQueryToSearchCriteria } from './queryValidation';

/**
 * Bug Condition Exploration Tests - FIXED CODE
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 * 
 * IMPORTANT: These tests validate that the FIXED code correctly handles malformed query parameters.
 * These tests should PASS on the fixed code - they verify the expected behavior is satisfied.
 * 
 * This test file validates Property 1: Expected Behavior - Malformed Query Parameters Are Safely Rejected
 */

describe('Bug Condition Tests - Fixed Implementation', () => {
  describe('Test Case 1: Invalid integers are rejected', () => {
    it('should reject invalid integer ?min=abc (no NaN produced)', () => {
      const qs = new URLSearchParams('?min=abc');
      const result = parseQueryToSearchCriteria(qs);
      
      // EXPECTED: minAge should be undefined (not NaN)
      expect(result).toBeDefined();
      expect(result?.minAge).toBeUndefined();
    });
    
    it('should reject invalid integer ?max=xyz (no NaN produced)', () => {
      const qs = new URLSearchParams('?max=xyz');
      const result = parseQueryToSearchCriteria(qs);
      
      // EXPECTED: maxAge should be undefined (not NaN)
      expect(result).toBeDefined();
      expect(result?.maxAge).toBeUndefined();
    });
  });

  describe('Test Case 2: Negative age values are rejected', () => {
    it('should reject negative age ?min=-10', () => {
      const qs = new URLSearchParams('?min=-10');
      const result = parseQueryToSearchCriteria(qs);
      
      // EXPECTED: minAge should be undefined (negative ages rejected)
      expect(result).toBeDefined();
      expect(result?.minAge).toBeUndefined();
    });
    
    it('should reject negative age range ?min=-10&max=-5', () => {
      const qs = new URLSearchParams('?min=-10&max=-5');
      const result = parseQueryToSearchCriteria(qs);
      
      // EXPECTED: both should be undefined (negative ages rejected)
      expect(result).toBeDefined();
      expect(result?.minAge).toBeUndefined();
      expect(result?.maxAge).toBeUndefined();
    });
  });

  describe('Test Case 3: XSS vectors are sanitized', () => {
    it('should sanitize XSS vector in search term', () => {
      const xssPayload = '<script>alert("xss")</script>';
      const qs = new URLSearchParams(`?q=${encodeURIComponent(xssPayload)}`);
      const result = parseQueryToSearchCriteria(qs);
      
      // EXPECTED: script tags should be stripped
      expect(result).toBeDefined();
      if (result?.searchTerm !== undefined) {
        expect(result.searchTerm).not.toContain('<script>');
        expect(result.searchTerm).not.toContain('</script>');
        expect(result.searchTerm).not.toMatch(/<[^>]*>/);
      }
    });
    
    it('should sanitize XSS vector in keyword search', () => {
      const xssPayload = '<img src=x onerror=alert(1)>';
      const qs = new URLSearchParams(`?kw=${encodeURIComponent(xssPayload)}`);
      const result = parseQueryToSearchCriteria(qs);
      
      // EXPECTED: XSS should be sanitized or result should be undefined
      expect(result).toBeDefined();
      if (result?.keywordSearch !== undefined) {
        expect(result.keywordSearch).not.toMatch(/onerror/i);
        expect(result.keywordSearch).not.toMatch(/<[^>]*>/);
      }
    });
  });

  describe('Test Case 4: Empty array elements are filtered out', () => {
    it('should filter empty array elements from ?spec=cardiology,,surgery', () => {
      const qs = new URLSearchParams('?spec=cardiology,,surgery');
      const result = parseQueryToSearchCriteria(qs);
      
      // EXPECTED: empty strings should be filtered out
      expect(result).toBeDefined();
      expect(result?.specialties).toBeDefined();
      if (result?.specialties !== undefined) {
        expect(result.specialties.every(s => s.length > 0)).toBe(true);
        expect(result.specialties.length).toBe(2);
        expect(result.specialties).toEqual(['cardiology', 'surgery']);
      }
    });
    
    it('should filter trailing commas ?spec=cardiology,neurology,', () => {
      const qs = new URLSearchParams('?spec=cardiology,neurology,');
      const result = parseQueryToSearchCriteria(qs);
      
      // EXPECTED: empty strings should be filtered out
      expect(result).toBeDefined();
      expect(result?.specialties).toBeDefined();
      if (result?.specialties !== undefined) {
        expect(result.specialties.every(s => s.length > 0)).toBe(true);
        expect(result.specialties.length).toBe(2);
      }
    });
    
    it('should filter leading commas ?ori=,heterosexual', () => {
      const qs = new URLSearchParams('?ori=,heterosexual');
      const result = parseQueryToSearchCriteria(qs);
      
      // EXPECTED: empty strings should be filtered out
      expect(result).toBeDefined();
      expect(result?.sexualOrientation).toBeDefined();
      if (result?.sexualOrientation !== undefined) {
        expect(result.sexualOrientation.every(s => s.length > 0)).toBe(true);
        expect(result.sexualOrientation.length).toBe(1);
      }
    });
  });

  describe('Test Case 5: Invalid boolean values are rejected', () => {
    it('should reject ?online=yes (only 0 and 1 valid)', () => {
      const qs = new URLSearchParams('?online=yes');
      const result = parseQueryToSearchCriteria(qs);
      
      // EXPECTED: onlineOnly should be undefined
      expect(result).toBeDefined();
      expect(result?.onlineOnly).toBeUndefined();
    });
    
    it('should reject ?online=true (only 0 and 1 valid)', () => {
      const qs = new URLSearchParams('?online=true');
      const result = parseQueryToSearchCriteria(qs);
      
      // EXPECTED: onlineOnly should be undefined
      expect(result).toBeDefined();
      expect(result?.onlineOnly).toBeUndefined();
    });
    
    it('should reject ?online=2 (only 0 and 1 valid)', () => {
      const qs = new URLSearchParams('?online=2');
      const result = parseQueryToSearchCriteria(qs);
      
      // EXPECTED: onlineOnly should be undefined
      expect(result).toBeDefined();
      expect(result?.onlineOnly).toBeUndefined();
    });
  });

  describe('Test Case 6: Inverted ranges are rejected', () => {
    it('should reject inverted range ?min=60&max=30', () => {
      const qs = new URLSearchParams('?min=60&max=30');
      const result = parseQueryToSearchCriteria(qs);
      
      // EXPECTED: both should be undefined (inverted range rejected)
      expect(result).toBeDefined();
      expect(result?.minAge).toBeUndefined();
      expect(result?.maxAge).toBeUndefined();
    });
    
    it('should reject extreme inverted range ?min=100&max=20', () => {
      const qs = new URLSearchParams('?min=100&max=20');
      const result = parseQueryToSearchCriteria(qs);
      
      // EXPECTED: both should be undefined (inverted range rejected)
      expect(result).toBeDefined();
      expect(result?.minAge).toBeUndefined();
      expect(result?.maxAge).toBeUndefined();
    });
  });

  describe('Additional Edge Cases', () => {
    it('should reject extremely large age values (bounded to 150)', () => {
      const qs = new URLSearchParams('?min=999999');
      const result = parseQueryToSearchCriteria(qs);
      
      // EXPECTED: minAge should be undefined (out of bounds)
      expect(result).toBeDefined();
      expect(result?.minAge).toBeUndefined();
    });
    
    it('should reject decimal numbers', () => {
      const qs = new URLSearchParams('?min=25.5');
      const result = parseQueryToSearchCriteria(qs);
      
      // EXPECTED: minAge should be undefined (decimals not valid)
      expect(result).toBeDefined();
      expect(result?.minAge).toBeUndefined();
    });
  });
});
