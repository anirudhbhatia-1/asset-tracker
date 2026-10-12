import { describe, expect, it } from 'vitest';
import { passwordChecks, passwordRuleError, personalWords } from './passwordRules';

const ravi = { name: 'Ravi Kumar', email: 'ravi.k@company.com' };
const metOf = (password, person = ravi) => Object.fromEntries(passwordChecks(password, person).map((c) => [c.key, c.met]));

describe('passwordChecks', () => {
  it('starts with nothing ticked', () => {
    expect(metOf('')).toEqual({ length: false, repeated: false, personal: false, common: null });
  });

  it('ticks each rule as it is met', () => {
    expect(metOf('Blue-Harbour-42')).toEqual({ length: true, repeated: true, personal: true, common: null });
    expect(metOf('short')).toMatchObject({ length: false, repeated: true, personal: true });
    expect(metOf('a'.repeat(129)).length).toBe(false);
    expect(metOf('aaaaaaaaaaaa')).toMatchObject({ length: true, repeated: false });
  });

  it('spots the name or email name, ignoring case', () => {
    expect(metOf('MyRAVIpassword1').personal).toBe(false);
    expect(metOf('kumar-is-great!').personal).toBe(false);
    expect(metOf('ravi.k-2026-pass').personal).toBe(false);
    // Two-letter pieces ("k") are not treated as names.
    expect(metOf('okay-keep-going').personal).toBe(true);
  });

  it('works without a known name or email', () => {
    expect(metOf('Blue-Harbour-42', {}).personal).toBe(true);
  });
});

describe('passwordRuleError', () => {
  it('names the first rule that fails', () => {
    expect(passwordRuleError('short', ravi)).toMatch(/at least 10/);
    expect(passwordRuleError('x'.repeat(129), ravi)).toMatch(/at most 128/);
    expect(passwordRuleError('zzzzzzzzzzzz', ravi)).toMatch(/repeated/);
    expect(passwordRuleError('ravikumar-2026', ravi)).toMatch(/your name/);
    expect(passwordRuleError('Blue-Harbour-42', ravi)).toBeNull();
  });

  it('collects the same name pieces as the server (4+ letters/digits)', () => {
    expect(personalWords(ravi)).toEqual(expect.arrayContaining(['ravi', 'kumar']));
    expect(personalWords(ravi).every((word) => word.length >= 4)).toBe(true);
  });

  it("doesn't block short names the server would accept", () => {
    const ali = { name: 'Ali Khan', email: 'ali.khan@thinkvibes.com' };
    const personal = passwordChecks('Totally-aligned-2026', ali).find((check) => check.key === 'personal');
    expect(personal.met).toBe(true);
  });
});
