"use client";

import { useActionState, useId, useMemo, useState } from "react";
import type { AuthActionState } from "@/features/auth/actions";
import {
  evaluatePasswordRequirements,
  meetsPasswordRequirements,
  PASSWORD_MAX_LENGTH,
  passwordRequirementLabels,
  type PasswordRequirementId,
} from "@/features/auth/password-policy";

type Field = {
  name: string;
  label: string;
  type: string;
  autoComplete?: string;
};

type Props = {
  action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;
  fields: Field[];
  submitLabel: string;
  hiddenFields?: Record<string, string>;
  showPasswordRequirements?: boolean;
};

const initialState: AuthActionState = { ok: false, message: "" };
const passwordRequirementIds = Object.keys(passwordRequirementLabels) as PasswordRequirementId[];

export function AuthForm({
  action,
  fields,
  submitLabel,
  hiddenFields = {},
  showPasswordRequirements = false,
}: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formId = useId().replaceAll(":", "");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.name, ""])),
  );
  const [passwordChecklistVisible, setPasswordChecklistVisible] = useState(false);
  const password = values.password ?? "";
  const passwordResults = useMemo(() => evaluatePasswordRequirements(password), [password]);
  const passwordIsValid = !showPasswordRequirements || meetsPasswordRequirements(password);
  const metRequirementCount = passwordRequirementIds.filter(
    (requirement) => passwordResults[requirement],
  ).length;

  return (
    <form className="next-form auth-card" action={formAction}>
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {fields.map((field) => {
        const inputId = `${formId}-${field.name}`;
        const fieldError = state.fieldErrors?.[field.name];
        const isPasswordWithChecklist = showPasswordRequirements && field.name === "password";
        const describedBy =
          [
            isPasswordWithChecklist && passwordChecklistVisible
              ? `${formId}-password-requirements`
              : null,
            fieldError ? `${inputId}-error` : null,
          ]
            .filter(Boolean)
            .join(" ") || undefined;

        return (
          <div className="auth-field" key={field.name}>
            <label htmlFor={inputId}>
              <span>{field.label}</span>
              <input
                id={inputId}
                name={field.name}
                type={field.type}
                autoComplete={field.autoComplete}
                required
                value={values[field.name] ?? ""}
                maxLength={field.type === "password" ? PASSWORD_MAX_LENGTH : undefined}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={describedBy}
                onFocus={() => {
                  if (isPasswordWithChecklist) setPasswordChecklistVisible(true);
                }}
                onChange={(event) => {
                  setValues((current) => ({
                    ...current,
                    [field.name]: event.target.value,
                  }));
                }}
              />
            </label>
            {fieldError ? (
              <p className="auth-field-error" id={`${inputId}-error`}>
                {fieldError}
              </p>
            ) : null}
            {isPasswordWithChecklist && passwordChecklistVisible ? (
              <section
                className="password-requirements"
                id={`${formId}-password-requirements`}
                aria-label="Password requirements"
              >
                <p className="password-requirements__title">Your password must include:</p>
                <ul>
                  {passwordRequirementIds.map((requirement) => {
                    const met = passwordResults[requirement];
                    return (
                      <li
                        className={met ? "password-requirement is-met" : "password-requirement"}
                        key={requirement}
                      >
                        <span className="password-requirement__icon" aria-hidden="true">
                          {met ? "✓" : "○"}
                        </span>
                        <span>{passwordRequirementLabels[requirement]}</span>
                        <span className="sr-only">
                          {met ? " — requirement met" : " — requirement not met"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="sr-only" aria-live="polite">
                  {metRequirementCount} of {passwordRequirementIds.length} password requirements
                  met.
                </p>
              </section>
            ) : null}
          </div>
        );
      })}
      {state.message ? (
        <p className={state.ok ? "auth-message" : "next-alert"} aria-live="polite">
          {state.message}
        </p>
      ) : null}
      <button className="primary-action" type="submit" disabled={pending || !passwordIsValid}>
        {pending ? "Working..." : submitLabel}
      </button>
    </form>
  );
}
