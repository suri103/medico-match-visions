import { MatchSearchCriteria } from '@/features/matches/hooks/useMatches';

/**
 * Safe Query Parameter Validation Utilities
 * 
 * These functions safely parse and validate URL query parameters to prevent:
 * - NaN values from invalid integers
 * - Negative or out-of-bounds age values
 * - XSS attacks from unsanitized strings
 * - Empty array elements from malformed comma-separated lists
 * - Invalid boolean values
 * - Logically inconsistent ranges (min > max)
 */

/**
 * Safely parse an integer parameter with bounds validation
 * 
 * @param value - The string value to parse
 * @param min - Minimum allowed value (default: 0)
 * @param max - Maximum allowed value (default: 150)
 * @returns The parsed integer if valid, undefined otherwise
 */
export function parseIntParam(
  value: string | null,
  min: number = 0,
  max: number = 150
): number | undefined {
  if (value === null) {
    return undefined;
  }

  // Use regex to validate that the string contains only digits
  if (!/^\d+$/.test(value)) {
    return undefined;
  }

  const parsed = parseInt(value, 10);

  // Check that the parsed value is finite and within bounds
  if (!isFinite(parsed) || parsed < min || parsed > max) {
    return undefined;
  }

  return parsed;
}

/**
 * Safely parse a comma-separated array parameter
 * 
 * @param value - The comma-separated string value
 * @param allowedValues - Optional set of allowed values for validation
 * @returns Array of sanitized strings, or undefined if value is null
 */
export function parseArrayParam(
  value: string | null,
  allowedValues?: readonly string[]
): string[] | undefined {
  if (value === null) {
    return undefined;
  }

  // Split by comma and filter out empty strings
  const elements = value.split(',').filter(s => s.trim().length > 0);

  // If all elements were empty, return undefined
  if (elements.length === 0) {
    return undefined;
  }

  // If allowed values are specified, validate each element
  if (allowedValues) {
    const validElements = elements.filter(el => allowedValues.includes(el));
    return validElements.length > 0 ? validElements : undefined;
  }

  return elements;
}

/**
 * Sanitize a string parameter against XSS attacks
 * 
 * @param value - The string value to sanitize
 * @param maxLength - Maximum allowed length (default: 200)
 * @returns Sanitized string, or undefined if value is null
 */
export function sanitizeStringParam(
  value: string | null,
  maxLength: number = 200
): string | undefined {
  if (value === null) {
    return undefined;
  }

  // Strip HTML tags and script-related patterns
  let sanitized = value
    // Remove script-related patterns BEFORE removing tags (they might be attributes)
    .replace(/on\w+\s*=/gi, '')
    .replace(/javascript:/gi, '')
    // Remove all HTML tags
    .replace(/<[^>]*>/g, '');

  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Trim whitespace
  sanitized = sanitized.trim();

  // Return undefined if the result is empty
  return sanitized.length > 0 ? sanitized : undefined;
}

/**
 * Safely parse a boolean parameter
 * 
 * @param value - The string value to parse (should be '0' or '1')
 * @returns true for '1', false for '0', undefined otherwise
 */
export function parseBooleanParam(
  value: string | null
): boolean | undefined {
  if (value === '1') {
    return true;
  }
  if (value === '0') {
    return false;
  }
  return undefined;
}

/**
 * Parse URLSearchParams into a safe MatchSearchCriteria object
 * 
 * This function orchestrates all the individual parsing functions to safely
 * convert URL query parameters into a validated MatchSearchCriteria object.
 * 
 * @param qs - URLSearchParams object from location.search
 * @returns MatchSearchCriteria object, or undefined if query string is empty
 */
export function parseQueryToSearchCriteria(
  qs: URLSearchParams
): MatchSearchCriteria | undefined {
  // Return undefined if query string is empty
  if (!qs.toString()) {
    return undefined;
  }

  // Parse and validate age parameters
  const minAge = parseIntParam(qs.get('min'), 0, 150);
  const maxAge = parseIntParam(qs.get('max'), 0, 150);

  const casteValue = qs.get('caste') || qs.get('cast') || undefined;
  const religionValue = qs.get('rel') || qs.get('religion') || undefined;
  const subcasteValue = sanitizeStringParam(qs.get('subcaste')) || undefined;
  const gotraValue = sanitizeStringParam(qs.get('gotra')) || undefined;
  const motherTongueValue = parseArrayParam(qs.get('mt') || qs.get('lang'));
  const degreesValue = parseArrayParam(qs.get('deg') || qs.get('degree'));
  const excludeSameGotraValue = parseBooleanParam(qs.get('nosamegotra') || qs.get('exgotra'));
  const minGunasValue = parseIntParam(qs.get('gunas'), 0, 36);

  // Logical validation: if both min and max are present, ensure min <= max
  // If the range is invalid, reject both values
  if (minAge !== undefined && maxAge !== undefined && minAge > maxAge) {
    // Invalid range: reject both values
    return {
      searchTerm: sanitizeStringParam(qs.get('q')),
      usernameSearch: sanitizeStringParam(qs.get('u')),
      keywordSearch: sanitizeStringParam(qs.get('kw')),
      minAge: undefined,
      maxAge: undefined,
      specialties: parseArrayParam(qs.get('spec')),
      degrees: degreesValue,
      onlineOnly: parseBooleanParam(qs.get('online')),
      country: sanitizeStringParam(qs.get('country')) || null,
      state: sanitizeStringParam(qs.get('state')) || null,
      city: sanitizeStringParam(qs.get('city')) || null,
      sexualOrientation: parseArrayParam(qs.get('ori')),
      ethnicity: parseArrayParam(qs.get('eth')),
      religion: religionValue,
      caste: casteValue,
      cast: casteValue,
      subcaste: subcasteValue,
      gotra: gotraValue,
      motherTongue: motherTongueValue,
      excludeSameGotra: excludeSameGotraValue,
      minGunas: minGunasValue,
      color: sanitizeStringParam(qs.get('color')),
    };
  }

  // Build the criteria object with validated parameters
  return {
    searchTerm: sanitizeStringParam(qs.get('q')),
    usernameSearch: sanitizeStringParam(qs.get('u')),
    keywordSearch: sanitizeStringParam(qs.get('kw')),
    minAge: minAge !== undefined ? [minAge] : undefined,
    maxAge: maxAge !== undefined ? [maxAge] : undefined,
    specialties: parseArrayParam(qs.get('spec')),
    degrees: degreesValue,
    onlineOnly: parseBooleanParam(qs.get('online')),
    country: sanitizeStringParam(qs.get('country')) || null,
    state: sanitizeStringParam(qs.get('state')) || null,
    city: sanitizeStringParam(qs.get('city')) || null,
    sexualOrientation: parseArrayParam(qs.get('ori')),
    ethnicity: parseArrayParam(qs.get('eth')),
    religion: religionValue,
    caste: casteValue,
    cast: casteValue,
    subcaste: subcasteValue,
    gotra: gotraValue,
    motherTongue: motherTongueValue,
    excludeSameGotra: excludeSameGotraValue,
    minGunas: minGunasValue,
    color: sanitizeStringParam(qs.get('color')),
  };
}
