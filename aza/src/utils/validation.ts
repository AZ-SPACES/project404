// ─── Email ───────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

// ─── Phone ───────────────────────────────────────────────────────────────────
// Accepts 7–15 digits (E.164 body), ignoring spaces, dashes, parentheses.
// An optional leading + is allowed for E.164 international format (+233…).

const PHONE_RE = /^\+?[\d\s\-().]{7,20}$/;

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 && PHONE_RE.test(value.trim());
}

// ─── Password ─────────────────────────────────────────────────────────────────

export type PasswordRule = {
  label: string;
  met: boolean;
};

export function getPasswordRules(password: string): PasswordRule[] {
  return [
    { label: 'At least 8 characters',        met: password.length >= 8 },
    { label: 'One uppercase letter (A–Z)',    met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter (a–z)',    met: /[a-z]/.test(password) },
    { label: 'One number (0–9)',              met: /\d/.test(password) },
    { label: 'One special character (!@#…)',  met: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function isValidPassword(password: string): boolean {
  return getPasswordRules(password).every((r) => r.met);
}

// ─── Name ────────────────────────────────────────────────────────────────────
// Allows letters (including accented/Unicode), spaces, hyphens, apostrophes.

const NAME_RE = /^[\p{L}\s'\-]{2,50}$/u;

export function isValidName(value: string): boolean {
  return NAME_RE.test(value.trim());
}

// ─── Sanitize ─────────────────────────────────────────────────────────────────
// Strips leading/trailing whitespace and ASCII control characters.

export function sanitizeText(value: string): string {
  return value.replace(/[\x00-\x1F\x7F]/g, '').trim();
}
