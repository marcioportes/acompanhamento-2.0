import { describe, it, expect } from 'vitest';
import { validateReviewUrl, validateNotesText, MAX_NOTES_LENGTH, ALLOWED_URL_HOSTS } from '../../utils/reviewUrlValidator';

describe('validateReviewUrl', () => {
  it('accepts null/empty/undefined as valid (optional field)', () => {
    expect(validateReviewUrl(null).valid).toBe(true);
    expect(validateReviewUrl('').valid).toBe(true);
    expect(validateReviewUrl(undefined).valid).toBe(true);
    expect(validateReviewUrl('   ').valid).toBe(true);
  });

  it('rejects non-https', () => {
    expect(validateReviewUrl('http://zoom.us/j/123').valid).toBe(false);
    expect(validateReviewUrl('ftp://zoom.us/x').valid).toBe(false);
    expect(validateReviewUrl('//zoom.us/j/123').valid).toBe(false);
  });

  it('rejects malformed URLs', () => {
    expect(validateReviewUrl('https://').valid).toBe(false);
    expect(validateReviewUrl('https:// spaces here').valid).toBe(false);
  });

  it('accepts zoom.us subdomains', () => {
    expect(validateReviewUrl('https://zoom.us/j/1234567890').valid).toBe(true);
    expect(validateReviewUrl('https://us02web.zoom.us/j/1234567890').valid).toBe(true);
  });

  it('accepts meet.google.com / teams.microsoft.com / loom.com / youtube', () => {
    expect(validateReviewUrl('https://meet.google.com/abc-defg-hij').valid).toBe(true);
    expect(validateReviewUrl('https://teams.microsoft.com/l/meetup-join/x').valid).toBe(true);
    expect(validateReviewUrl('https://loom.com/share/abc').valid).toBe(true);
    expect(validateReviewUrl('https://www.loom.com/share/abc').valid).toBe(true);
    expect(validateReviewUrl('https://youtube.com/watch?v=x').valid).toBe(true);
    expect(validateReviewUrl('https://youtu.be/abc').valid).toBe(true);
    expect(validateReviewUrl('https://drive.google.com/file/d/xyz/view').valid).toBe(true);
    expect(validateReviewUrl('https://vimeo.com/12345').valid).toBe(true);
  });

  it('rejects hosts outside the allowlist', () => {
    const r = validateReviewUrl('https://evil.example.com/x');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/Host não permitido/);
  });

  it('rejects protocol-less strings', () => {
    expect(validateReviewUrl('zoom.us/j/123').valid).toBe(false);
  });

  it('is case-insensitive for https and host', () => {
    expect(validateReviewUrl('HTTPS://Zoom.us/j/123').valid).toBe(true);
  });

  it('exports the allowlist (for UI hinting)', () => {
    expect(ALLOWED_URL_HOSTS).toContain('zoom.us');
    expect(ALLOWED_URL_HOSTS).toContain('meet.google.com');
  });
});

describe('validateNotesText', () => {
  it('accepts null/empty', () => {
    expect(validateNotesText(null).valid).toBe(true);
    expect(validateNotesText('').valid).toBe(true);
  });

  it('accepts strings up to MAX_NOTES_LENGTH', () => {
    expect(MAX_NOTES_LENGTH).toBe(5000);
    const long = 'x'.repeat(MAX_NOTES_LENGTH);
    expect(validateNotesText(long).valid).toBe(true);
  });

  it('rejects strings longer than MAX_NOTES_LENGTH', () => {
    const tooLong = 'x'.repeat(MAX_NOTES_LENGTH + 1);
    const r = validateNotesText(tooLong);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/5000/);
  });

  it('rejects non-string', () => {
    expect(validateNotesText(42).valid).toBe(false);
    expect(validateNotesText({}).valid).toBe(false);
  });
});
