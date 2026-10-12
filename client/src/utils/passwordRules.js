// The password rules PATCH /api/auth/change-password enforces, as a
// checklist the change-password form ticks while the user types. The server
// has the final word (it also refuses common passwords, which the browser
// can't check), and answers 400 with its own message.

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

// Exactly the server's rule (server/services/passwordPolicy.js): words of
// four or more letters/digits from the email's local part and the name —
// "ravi.kumar@x.com", "Ravi Kumar" -> ["ravi", "kumar"]. Kept identical so
// the checklist never blocks a password the server would accept.
const MIN_PIECE = 4;

/** Name and email-name fragments the password must not contain. */
export const personalWords = ({ name, email } = {}) => {
  const localPart = String(email || '').split('@')[0];
  return [...new Set(
    `${localPart} ${name || ''}`.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= MIN_PIECE)
  )];
};

export const isOneRepeatedCharacter = (password) => password.length > 0 && new Set([...password]).size === 1;

/**
 * [{ key, label, met }] for the checklist. `met` is null for the rule only
 * the server can check (common passwords).
 */
export const passwordChecks = (password = '', person = {}) => {
  const value = String(password);
  const lower = value.toLowerCase();
  const words = personalWords(person);
  return [
    {
      key: 'length',
      label: `${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters`,
      met: value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH,
    },
    {
      key: 'repeated',
      label: 'Not just one character repeated',
      met: value.length > 0 && !isOneRepeatedCharacter(value),
    },
    {
      key: 'personal',
      label: 'Doesn’t contain your name or the name part of your email',
      met: value.length > 0 && !words.some((word) => lower.includes(word)),
    },
    {
      key: 'common',
      label: 'Not a common password (checked when you save)',
      met: null,
    },
  ];
};

/** First unmet rule as a sentence for the error box, or null when all browser-side rules pass. */
export const passwordRuleError = (password = '', person = {}) => {
  const value = String(password);
  if (value.length < PASSWORD_MIN_LENGTH) return `New password must be at least ${PASSWORD_MIN_LENGTH} characters long`;
  if (value.length > PASSWORD_MAX_LENGTH) return `New password must be at most ${PASSWORD_MAX_LENGTH} characters long`;
  if (isOneRepeatedCharacter(value)) return 'New password can’t be one character repeated';
  const lower = value.toLowerCase();
  if (personalWords(person).some((word) => lower.includes(word))) {
    return 'New password can’t contain your name or the name part of your email';
  }
  return null;
};
