import { describe, it, expect } from 'vitest';
import { parseQueryToSearchCriteria } from './queryValidation';

/**
 * Preservation Property Tests - Fixed Implementation
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 * 
 * IMPORTANT: These tests validate Property 2: Preservation - Valid Query Parameters Produce Unchanged Behavior
 * 
 * These tests verify that the FIXED parsing implementation correctly handles all valid query parameter
 * combinations and produces the expected results.
 */

describe('Preservation Property Tests - Valid Query Parameters', () => {
  describe('Property 2.1: Valid Age Range Preservation', () => {
    it('should correctly parse valid minimum age', () => {
      const qs = new URLSearchParams('?min=25');
      const result = parseQueryToSearchCriteria(qs);
      
      expect(result).toBeDefined();
      expect(result?.minAge).toEqual([25]);
      expect(Number.isFinite(result?.minAge?.[0])).toBe(true);
      expect(result?.minAge?.[0]).toBeGreaterThanOrEqual(0);
    });
    
    it('should correctly parse valid maximum age', () => {
      const qs = new URLSearchParams('?max=45');
      const result = parseQueryToSearchCriteria(qs);
      
      expect(result).toBeDefined();
      expect(result?.maxAge).toEqual([45]);
      expect(Number.isFinite(result?.maxAge?.[0])).toBe(true);
      expect(result?.maxAge?.[0]).toBeGreaterThanOrEqual(0);
    });
    
    it('should correctly parse valid age range where min <= max', () => {
      const qs = new URLSearchParams('?min=30&max=50');
      const result = parseQueryToSearchCriteria(qs);
      
      expect(result).toBeDefined();
      expect(result?.minAge).toEqual([30]);
      const minVal = result?.minAge?.[0];
      const maxVal = result?.maxAge?.[0];
      expect(minVal !== undefined && maxVal !== undefined && minVal <= maxVal).toBe(true);
    });
    
    it('should preserve boundary age values: 0', () => {
      const qs = new URLSearchParams('?min=0');
      const result = parseQueryToSearchCriteria(qs);
      
      expect(result).toBeDefined();
      expect(result?.minAge).toEqual([0]);
    });
    
    it('should preserve boundary age values: 150', () => {
      const qs = new URLSearchParams('?max=150');
      const result = parseQueryToSearchCriteria(qs);
      
      expect(result).toBeDefined();
      expect(result?.maxAge).toEqual([150]);
    });
  });

  describe('Property 2.2: Valid Specialty Filter Preservation', () => {
    it('should correctly parse single specialty', () => {
      const qs = new URLSearchParams('?spec=Cardiologist');
      const result = parseQueryToSearchCriteria(qs);
      
      expect(result).toBeDefined();
      expect(result?.specialties).toEqual(['Cardiologist']);
      expect(result?.specialties?.length).toBe(1);
    });
    
    it('should correctly parse multiple specialties', () => {
      const qs = new URLSearchParams('?spec=Cardiologist,Neurologist');
      const result = parseQueryToSearchCriteria(qs);
      
      expect(result).toBeDefined();
      expect(result?.specialties).toEqual(['Cardiologist', 'Neurologist']);
      expect(result?.specialties?.length).toBe(2);
    });
  });

  describe('Property 2.3: Valid Location Filter Preservation', () => {
    it('should correctly parse country only', () => {
      const qs = new URLSearchParams('?country=india');
      const result = parseQueryToSearchCriteria(qs);
      
      expect(result).toBeDefined();
      expect(result?.country).toBe('india');
    });
    
    it('should correctly parse full location hierarchy', () => {
      const qs = new URLSearchParams('?country=india&state=maharashtra&city=mumbai');
      const result = parseQueryToSearchCriteria(qs);
      
      expect(result).toBeDefined();
      expect(result?.country).toBe('india');
      expect(result?.state).toBe('maharashtra');
      expect(result?.city).toBe('mumbai');
    });
  });

  describe('Property 2.4: Valid Search Term Preservation', () => {
    it('should correctly parse simple search term', () => {
      const qs = new URLSearchParams('?q=diabetes');
      const result = parseQueryToSearchCriteria(qs);
      
      expect(result).toBeDefined();
      expect(result?.searchTerm).toBe('diabetes');
    });
    
    it('should preserve search term with encoded spaces', () => {
      const qs = new URLSearchParams('?q=' + encodeURIComponent('heart disease'));
      const result = parseQueryToSearchCriteria(qs);
      
      expect(result).toBeDefined();
      expect(result?.searchTerm).toBe('heart disease');
    });
  });

  describe('Property 2.5: Valid Boolean Flag Preservation', () => {
    it('should correctly parse online=1 as true', () => {
      const qs = new URLSearchParams('?online=1');
      const result = parseQueryToSearchCriteria(qs);
      
      expect(result).toBeDefined();
      expect(result?.onlineOnly).toBe(true);
    });
    
    it('should correctly parse online=0 as false', () => {
      const qs = new URLSearchParams('?online=0');
      const result = parseQueryToSearchCriteria(qs);
      
      expect(result).toBeDefined();
      expect(result?.onlineOnly).toBe(false);
    });
  });

  describe('Property 2.6: Complex Valid Query Combinations', () => {
    it('should preserve comprehensive filter combination', () => {
      const qs = new URLSearchParams('?q=cardiology&min=30&max=50&spec=Cardiologist,Neurologist&country=india&online=1');
      const result = parseQueryToSearchCriteria(qs);
      
      expect(result).toBeDefined();
      expect(result?.searchTerm).toBe('cardiology');
      expect(result?.minAge).toEqual([30]);
      expect(result?.maxAge).toEqual([50]);
      expect(result?.specialties).toEqual(['Cardiologist', 'Neurologist']);
      expect(result?.country).toBe('india');
      expect(result?.onlineOnly).toBe(true);
    });
  });

  describe('Property 2.7: Empty/Missing Parameter Handling', () => {
    it('should return undefined for completely empty query string', () => {
      const qs = new URLSearchParams('');
      const result = parseQueryToSearchCriteria(qs);
      
      expect(result).toBeUndefined();
    });
    
    it('should handle single valid parameter correctly', () => {
      const qs = new URLSearchParams('?min=30');
      const result = parseQueryToSearchCriteria(qs);
      
      expect(result).toBeDefined();
      expect(result?.minAge).toEqual([30]);
      expect(result?.maxAge).toBeUndefined();
    });
  });
});
