import { generateRecoveryCode, secondsUntilRefresh } from '../recoveryTotp';

// RFC 6238 standard test secret (base32-encoded)
const TEST_SECRET = 'JBSWY3DPEHPK3PXP';

describe('generateRecoveryCode', () => {
  it('returns a zero-padded 6-digit string', () => {
    const code = generateRecoveryCode(TEST_SECRET);
    expect(code).toMatch(/^\d{6}$/);
    expect(code).toHaveLength(6);
  });

  it('is deterministic: same secret + same counter = same code', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));

    const first  = generateRecoveryCode(TEST_SECRET);
    const second = generateRecoveryCode(TEST_SECRET);
    expect(first).toBe(second);

    jest.useRealTimers();
  });

  it('produces different codes for well-separated timestamps', () => {
    jest.useFakeTimers();

    jest.setSystemTime(0);              // counter = 0
    const codeA = generateRecoveryCode(TEST_SECRET);

    jest.setSystemTime(30_000);         // counter = 1
    const codeB = generateRecoveryCode(TEST_SECRET);

    // Astronomically unlikely to collide across adjacent counters
    expect(codeA).not.toBe(codeB);

    jest.useRealTimers();
  });

  it('accepts a custom period', () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);

    const code60 = generateRecoveryCode(TEST_SECRET, 60);
    expect(code60).toMatch(/^\d{6}$/);

    jest.useRealTimers();
  });

  it('pads codes shorter than 6 digits with leading zeros', () => {
    // Force counter to a value that produces a small TOTP output.
    // We can't easily control the hash, but we can assert the contract holds
    // over many time steps.
    jest.useFakeTimers();

    for (let t = 0; t < 10; t++) {
      jest.setSystemTime(t * 30_000);
      const code = generateRecoveryCode(TEST_SECRET);
      expect(code.length).toBe(6);
    }

    jest.useRealTimers();
  });
});

describe('secondsUntilRefresh', () => {
  it('returns a value between 1 and 30 (inclusive)', () => {
    jest.useFakeTimers();

    for (let offset = 0; offset < 30; offset++) {
      jest.setSystemTime(offset * 1000);
      const s = secondsUntilRefresh();
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(30);
    }

    jest.useRealTimers();
  });

  it('returns 30 at the start of a period boundary', () => {
    jest.useFakeTimers();
    jest.setSystemTime(0); // t=0s → counter=0 boundary

    expect(secondsUntilRefresh()).toBe(30);

    jest.useRealTimers();
  });

  it('returns 1 one second before the end of a period', () => {
    jest.useFakeTimers();
    jest.setSystemTime(29_000); // 29s into first period

    expect(secondsUntilRefresh()).toBe(1);

    jest.useRealTimers();
  });

  it('accepts a custom period', () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);

    const s = secondsUntilRefresh(60);
    expect(s).toBe(60);

    jest.useRealTimers();
  });
});
