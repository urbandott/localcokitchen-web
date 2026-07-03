export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export const passwordRequirementLabels = {
  length: `At least ${PASSWORD_MIN_LENGTH} characters`,
  lowercase: "One lowercase letter",
  uppercase: "One uppercase letter",
  digit: "One number",
  symbol: "One symbol",
} as const;

export type PasswordRequirementId = keyof typeof passwordRequirementLabels;
export type PasswordRequirementResults = Record<PasswordRequirementId, boolean>;

export function evaluatePasswordRequirements(password: string): PasswordRequirementResults {
  return {
    length: password.length >= PASSWORD_MIN_LENGTH,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
}

export function meetsPasswordRequirements(password: string): boolean {
  return (
    password.length <= PASSWORD_MAX_LENGTH &&
    Object.values(evaluatePasswordRequirements(password)).every(Boolean)
  );
}
