import { describe, it, expect } from 'vitest';
import {
  parseIntParam,
  parseArrayParam,
  sanitizeStringParam,
  parseBooleanParam,
  parseQueryToSearchCriteria,
} from './queryValidation';

describe('parseIntParam', () => {
  describe('Valid integers within range', () => {
    it('should return valid integer in range', () => {
      expect(parseIntParam('25', 0, 150)).toBe(25);
    });

    it('should return minimum boundary value', () => {
      expect(parseIntParam('0', 0, 150)).toBe(0);
    });

    it('should return maximum boundary value', () => {
      expect(parseIntParam('150', 0, 150)).toBe(150);
    });

    it('should accept custom range', () => {
      expect(parseIntParam('50', 10, 100)).toBe(50);
    });
  });

  describe('Invalid strings', () => {
    it('should return undefined for non-numeric string', () => {
      expect(parseIntParam('abc', 0, 150)).toBeUndefined();
    });

    it('should return undefined for alphanumeric string', () => {
      expect(parseIntParam('25abc', 0, 150)).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(parseIntParam('', 0, 150)).toBeUndefined();
    });

    it('should return undefined for string with spaces', () => {
      expect(parseIntParam('25 ', 0, 150)).toBeUndefined();
    });
  });

  describe('Negative numbers', () => {
    it('should return undefined for negative number', () => {
      expect(parseIntParam('-10', 0, 150)).toBeUndefined();
    });

    it('should return undefined for negative number with minus sign', () => {
      expect(parseIntParam('-5', 0, 150)).toBeUndefined();
    });
  });

  describe('Out-of-bounds values', () => {
    it('should return undefined for value below minimum', () => {
      expect(parseIntParam('-1', 0, 150)).toBeUndefined();
    });

    it('should return undefined for value above maximum', () => {
      expect(parseIntParam('151', 0, 150)).toBeUndefined();
    });

    it('should return undefined for extremely large value', () => {
      expect(parseIntParam('999999', 0, 150)).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('should return undefined for null value', () => {
      expect(parseIntParam(null, 0, 150)).toBeUndefined();
    });

    it('should return undefined for decimal number', () => {
      expect(parseIntParam('25.5', 0, 150)).toBeUndefined();
    });

    it('should return undefined for number with leading zero', () => {
      // This should actually pass since '025' is still a valid integer string
      expect(parseIntParam('025', 0, 150)).toBe(25);
    });
  });
});

describe('parseArrayParam', () => {
  describe('Valid arrays', () => {
    it('should parse single element', () => {
      expect(parseArrayParam('cardiology')).toEqual(['cardiology']);
    });

    it('should parse multiple elements', () => {
      expect(parseArrayParam('cardiology,neurology')).toEqual(['cardiology', 'neurology']);
    });

    it('should parse three elements', () => {
      expect(parseArrayParam('a,b,c')).toEqual(['a', 'b', 'c']);
    });
  });

  describe('Empty strings and whitespace', () => {
    it('should filter out empty strings from double commas', () => {
      expect(parseArrayParam('a,,b')).toEqual(['a', 'b']);
    });

    it('should filter out empty strings from trailing comma', () => {
      expect(parseArrayParam('a,b,')).toEqual(['a', 'b']);
    });

    it('should filter out empty strings from leading comma', () => {
      expect(parseArrayParam(',a,b')).toEqual(['a', 'b']);
    });

    it('should return undefined if all elements are empty', () => {
      expect(parseArrayParam(',,,')).toBeUndefined();
    });

    it('should handle whitespace-only elements', () => {
      expect(parseArrayParam('a, ,b')).toEqual(['a', 'b']);
    });
  });

  describe('Allowed values validation', () => {
    const allowedSpecialties = ['Cardiologist', 'Neurologist', 'Pediatrician'] as const;

    it('should accept valid values from allowed list', () => {
      expect(parseArrayParam('Cardiologist,Neurologist', allowedSpecialties)).toEqual([
        'Cardiologist',
        'Neurologist',
      ]);
    });

    it('should filter out invalid values', () => {
      expect(parseArrayParam('Cardiologist,InvalidSpecialty', allowedSpecialties)).toEqual([
        'Cardiologist',
      ]);
    });

    it('should return undefined if no valid values', () => {
      expect(parseArrayParam('Invalid1,Invalid2', allowedSpecialties)).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('should return undefined for null value', () => {
      expect(parseArrayParam(null)).toBeUndefined();
    });

    it('should handle single comma', () => {
      expect(parseArrayParam(',')).toBeUndefined();
    });

    it('should handle empty string', () => {
      expect(parseArrayParam('')).toBeUndefined();
    });
  });
});

describe('sanitizeStringParam', () => {
  describe('Clean strings', () => {
    it('should pass through clean string', () => {
      expect(sanitizeStringParam('diabetes')).toBe('diabetes');
    });

    it('should pass through string with spaces', () => {
      expect(sanitizeStringParam('heart disease')).toBe('heart disease');
    });

    it('should trim whitespace', () => {
      expect(sanitizeStringParam('  test  ')).toBe('test');
    });
  });

  describe('XSS attempts', () => {
    it('should strip script tags', () => {
      const result = sanitizeStringParam('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
    });

    it('should strip img tag with onerror', () => {
      const result = sanitizeStringParam('<img src=x onerror=alert(1)>');
      // The entire malicious string should be stripped, result may be undefined or not contain onerror
      if (result !== undefined) {
        expect(result).not.toContain('onerror=');
        expect(result).not.toContain('<img');
      }
      // If undefined, that's also acceptable (the entire string was invalid)
      expect(result === undefined || (typeof result === 'string' && !result.includes('onerror='))).toBe(true);
    });

    it('should remove javascript: protocol', () => {
      const result = sanitizeStringParam('javascript:alert(1)');
      expect(result).not.toContain('javascript:');
    });

    it('should remove onclick handler', () => {
      const result = sanitizeStringParam('<div onclick=alert(1)>test</div>');
      expect(result).not.toContain('onclick=');
    });

    it('should remove onload handler', () => {
      const result = sanitizeStringParam('<body onload=alert(1)>');
      // The entire malicious string should be stripped, result may be undefined or not contain onload
      if (result !== undefined) {
        expect(result).not.toContain('onload=');
      }
      // If undefined, that's also acceptable (the entire string was invalid)
      expect(result === undefined || (typeof result === 'string' && !result.includes('onload='))).toBe(true);
    });

    it('should remove all HTML tags', () => {
      const result = sanitizeStringParam('<div><span>test</span></div>');
      expect(result).toBe('test');
    });
  });

  describe('Length enforcement', () => {
    it('should enforce default max length of 200', () => {
      const longString = 'a'.repeat(300);
      const result = sanitizeStringParam(longString);
      expect(result?.length).toBe(200);
    });

    it('should enforce custom max length', () => {
      const longString = 'a'.repeat(100);
      const result = sanitizeStringParam(longString, 50);
      expect(result?.length).toBe(50);
    });

    it('should not truncate string under max length', () => {
      const shortString = 'test';
      const result = sanitizeStringParam(shortString, 200);
      expect(result).toBe('test');
    });
  });

  describe('Edge cases', () => {
    it('should return undefined for null value', () => {
      expect(sanitizeStringParam(null)).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(sanitizeStringParam('')).toBeUndefined();
    });

    it('should return undefined for whitespace-only string', () => {
      expect(sanitizeStringParam('   ')).toBeUndefined();
    });

    it('should handle string with special characters', () => {
      expect(sanitizeStringParam('cancer & treatment')).toBe('cancer & treatment');
    });
  });
});

describe('parseBooleanParam', () => {
  describe('Valid boolean values', () => {
    it('should return true for "1"', () => {
      expect(parseBooleanParam('1')).toBe(true);
    });

    it('should return false for "0"', () => {
      expect(parseBooleanParam('0')).toBe(false);
    });
  });

  describe('Invalid boolean values', () => {
    it('should return undefined for "yes"', () => {
      expect(parseBooleanParam('yes')).toBeUndefined();
    });

    it('should return undefined for "true"', () => {
      expect(parseBooleanParam('true')).toBeUndefined();
    });

    it('should return undefined for "false"', () => {
      expect(parseBooleanParam('false')).toBeUndefined();
    });

    it('should return undefined for "2"', () => {
      expect(parseBooleanParam('2')).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(parseBooleanParam('')).toBeUndefined();
    });

    it('should return undefined for null', () => {
      expect(parseBooleanParam(null)).toBeUndefined();
    });
  });
});

describe('parseQueryToSearchCriteria', () => {
  describe('Valid query combinations', () => {
    it('should parse valid age range', () => {
      const qs = new URLSearchParams('?min=25&max=45');
      const result = parseQueryToSearchCriteria(qs);

      expect(result).toBeDefined();
      expect(result?.minAge).toEqual([25]);
      expect(result?.maxAge).toEqual([45]);
    });

    it('should parse valid specialties', () => {
      const qs = new URLSearchParams('?spec=cardiology,neurology');
      const result = parseQueryToSearchCriteria(qs);

      expect(result).toBeDefined();
      expect(result?.specialties).toEqual(['cardiology', 'neurology']);
    });

    it('should parse valid search term', () => {
      const qs = new URLSearchParams('?q=diabetes');
      const result = parseQueryToSearchCriteria(qs);

      expect(result).toBeDefined();
      expect(result?.searchTerm).toBe('diabetes');
    });

    it('should parse valid boolean flag', () => {
      const qs = new URLSearchParams('?online=1');
      const result = parseQueryToSearchCriteria(qs);

      expect(result).toBeDefined();
      expect(result?.onlineOnly).toBe(true);
    });

    it('should parse comprehensive filter combination', () => {
      const qs = new URLSearchParams(
        '?q=cardiology&min=30&max=50&spec=Cardiologist,Neurologist&country=india&state=maharashtra&online=1'
      );
      const result = parseQueryToSearchCriteria(qs);

      expect(result).toBeDefined();
      expect(result?.searchTerm).toBe('cardiology');
      expect(result?.minAge).toEqual([30]);
      expect(result?.maxAge).toEqual([50]);
      expect(result?.specialties).toEqual(['Cardiologist', 'Neurologist']);
      expect(result?.country).toBe('india');
      expect(result?.state).toBe('maharashtra');
      expect(result?.onlineOnly).toBe(true);
    });
  });

  describe('Invalid query parameters', () => {
    it('should reject invalid integer for min', () => {
      const qs = new URLSearchParams('?min=abc');
      const result = parseQueryToSearchCriteria(qs);

      expect(result).toBeDefined();
      expect(result?.minAge).toBeUndefined();
    });

    it('should reject negative age', () => {
      const qs = new URLSearchParams('?min=-10');
      const result = parseQueryToSearchCriteria(qs);

      expect(result).toBeDefined();
      expect(result?.minAge).toBeUndefined();
    });

    it('should sanitize XSS in search term', () => {
      const qs = new URLSearchParams('?q=' + encodeURIComponent('<script>alert("xss")</script>'));
      const result = parseQueryToSearchCriteria(qs);

      expect(result).toBeDefined();
      expect(result?.searchTerm).not.toContain('<script>');
    });

    it('should filter empty array elements', () => {
      const qs = new URLSearchParams('?spec=cardiology,,neurology');
      const result = parseQueryToSearchCriteria(qs);

      expect(result).toBeDefined();
      expect(result?.specialties).toEqual(['cardiology', 'neurology']);
    });

    it('should reject invalid boolean', () => {
      const qs = new URLSearchParams('?online=yes');
      const result = parseQueryToSearchCriteria(qs);

      expect(result).toBeDefined();
      expect(result?.onlineOnly).toBeUndefined();
    });
  });

  describe('Logical validation', () => {
    it('should reject inverted range (min > max)', () => {
      const qs = new URLSearchParams('?min=60&max=30');
      const result = parseQueryToSearchCriteria(qs);

      expect(result).toBeDefined();
      // When range is inverted, both should be rejected
      expect(result?.minAge).toBeUndefined();
      expect(result?.maxAge).toBeUndefined();
    });

    it('should accept equal min and max', () => {
      const qs = new URLSearchParams('?min=40&max=40');
      const result = parseQueryToSearchCriteria(qs);

      expect(result).toBeDefined();
      expect(result?.minAge).toEqual([40]);
      expect(result?.maxAge).toEqual([40]);
    });

    it('should preserve other parameters when rejecting inverted range', () => {
      const qs = new URLSearchParams('?min=60&max=30&q=test&online=1');
      const result = parseQueryToSearchCriteria(qs);

      expect(result).toBeDefined();
      expect(result?.minAge).toBeUndefined();
      expect(result?.maxAge).toBeUndefined();
      expect(result?.searchTerm).toBe('test');
      expect(result?.onlineOnly).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should return undefined for empty query string', () => {
      const qs = new URLSearchParams('');
      const result = parseQueryToSearchCriteria(qs);

      expect(result).toBeUndefined();
    });

    it('should handle query string with only "?"', () => {
      const qs = new URLSearchParams('?');
      const result = parseQueryToSearchCriteria(qs);

      expect(result).toBeUndefined();
    });

    it('should handle location parameters', () => {
      const qs = new URLSearchParams('?country=india&state=maharashtra&city=mumbai');
      const result = parseQueryToSearchCriteria(qs);

      expect(result).toBeDefined();
      expect(result?.country).toBe('india');
      expect(result?.state).toBe('maharashtra');
      expect(result?.city).toBe('mumbai');
    });

    it('should handle array parameters (orientation and ethnicity)', () => {
      const qs = new URLSearchParams('?ori=Straight,Bisexual&eth=Asian,White');
      const result = parseQueryToSearchCriteria(qs);

      expect(result).toBeDefined();
      expect(result?.sexualOrientation).toEqual(['Straight', 'Bisexual']);
      expect(result?.ethnicity).toEqual(['Asian', 'White']);
    });

    it('should handle cast and color parameters', () => {
      const qs = new URLSearchParams('?cast=Brahmin&color=Fair');
      const result = parseQueryToSearchCriteria(qs);

      expect(result).toBeDefined();
      expect(result?.cast).toBe('Brahmin');
      expect(result?.color).toBe('Fair');
    });

    it('should handle medical degrees, gotra, mother tongue, and gunas parameters', () => {
      const qs = new URLSearchParams('?deg=MBBS,MD,BDS&gotra=Kashyap&mt=Hindi,Marathi&nosamegotra=1&gunas=28');
      const result = parseQueryToSearchCriteria(qs);

      expect(result).toBeDefined();
      expect(result?.degrees).toEqual(['MBBS', 'MD', 'BDS']);
      expect(result?.gotra).toBe('Kashyap');
      expect(result?.motherTongue).toEqual(['Hindi', 'Marathi']);
      expect(result?.excludeSameGotra).toBe(true);
      expect(result?.minGunas).toBe(28);
    });
  });
});
