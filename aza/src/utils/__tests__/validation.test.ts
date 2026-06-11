import {
  isValidEmail,
  isValidPhone,
  getPasswordRules,
  isValidPassword,
  isValidName,
  sanitizeText,
} from '../validation';

describe('isValidEmail', () => {
  it('accepts standard email addresses', () => {
    expect(isValidEmail('alice@example.com')).toBe(true);
    expect(isValidEmail('user.name+tag@sub.domain.org')).toBe(true);
    expect(isValidEmail('  alice@example.com  ')).toBe(true); // trims whitespace
  });

  it('rejects malformed addresses', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('@nodomain.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('user@domain')).toBe(false); // TLD < 2 chars
  });
});

describe('isValidPhone', () => {
  it('accepts digit-only and formatted numbers', () => {
    expect(isValidPhone('0201234567')).toBe(true);
    expect(isValidPhone('(020) 123-4567')).toBe(true);
    expect(isValidPhone('020 123 4567')).toBe(true);
  });

  it('accepts E.164 numbers with a leading + prefix', () => {
    expect(isValidPhone('+233201234567')).toBe(true);
    expect(isValidPhone('+14155552671')).toBe(true);
  });

  it('rejects too-short and too-long numbers', () => {
    expect(isValidPhone('123')).toBe(false);       // < 7 digits
    expect(isValidPhone('1234567890123456')).toBe(false); // > 15 digits
  });
});

describe('getPasswordRules', () => {
  it('returns 5 rules', () => {
    expect(getPasswordRules('any')).toHaveLength(5);
  });

  it('marks all rules met for a strong password', () => {
    const rules = getPasswordRules('Secure123!');
    expect(rules.every(r => r.met)).toBe(true);
  });

  it('marks length rule unmet for short passwords', () => {
    const rules = getPasswordRules('Ab1!');
    const lengthRule = rules.find(r => r.label.includes('8'));
    expect(lengthRule?.met).toBe(false);
  });

  it('marks uppercase rule unmet when missing', () => {
    const rules = getPasswordRules('secure123!');
    const upper = rules.find(r => r.label.includes('uppercase'));
    expect(upper?.met).toBe(false);
  });

  it('marks special-char rule unmet when missing', () => {
    const rules = getPasswordRules('Secure123');
    const special = rules.find(r => r.label.includes('special'));
    expect(special?.met).toBe(false);
  });
});

describe('isValidPassword', () => {
  it('accepts passwords meeting all five rules', () => {
    expect(isValidPassword('Secure123!')).toBe(true);
    expect(isValidPassword('P@ssw0rd!!')).toBe(true);
  });

  it('rejects passwords missing any rule', () => {
    expect(isValidPassword('short1!')).toBe(false);    // < 8 chars
    expect(isValidPassword('alllower1!')).toBe(false); // no uppercase
    expect(isValidPassword('ALLUPPER1!')).toBe(false); // no lowercase
    expect(isValidPassword('NoNumbers!')).toBe(false); // no digit
    expect(isValidPassword('NoSpecial1')).toBe(false); // no special char
  });
});

describe('isValidName', () => {
  it('accepts names with letters, spaces, hyphens, apostrophes', () => {
    expect(isValidName('Alice')).toBe(true);
    expect(isValidName('Jean-Pierre')).toBe(true);
    expect(isValidName("O'Brien")).toBe(true);
    expect(isValidName('José María')).toBe(true);
  });

  it('rejects single-character names and names with digits/symbols', () => {
    expect(isValidName('A')).toBe(false);         // too short
    expect(isValidName('Alice123')).toBe(false);   // digit
    expect(isValidName('Alice@')).toBe(false);     // @-symbol
  });
});

describe('sanitizeText', () => {
  it('preserves whitespace — it runs on every keystroke, so trimming would block typing spaces', () => {
    expect(sanitizeText('  hello  ')).toBe('  hello  ');
    expect(sanitizeText('John Smith')).toBe('John Smith');
  });

  it('removes ASCII control characters', () => {
    expect(sanitizeText('hel\x00lo\x1F')).toBe('hello');
    expect(sanitizeText('text\x7Fmore')).toBe('textmore');
  });

  it('preserves normal printable characters', () => {
    expect(sanitizeText('Hello, World! 123')).toBe('Hello, World! 123');
  });
});
