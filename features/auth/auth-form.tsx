"use client";

import { useActionState } from "react";
import type { AuthActionState } from "@/features/auth/actions";

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
};

const initialState: AuthActionState = { ok: false, message: "" };

export function AuthForm({ action, fields, submitLabel, hiddenFields = {} }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form className="next-form auth-card" action={formAction}>
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {fields.map((field) => (
        <label key={field.name}>
          <span>{field.label}</span>
          <input name={field.name} type={field.type} autoComplete={field.autoComplete} required />
        </label>
      ))}
      {state.message ? (
        <p className={state.ok ? "auth-message" : "next-alert"} aria-live="polite">
          {state.message}
        </p>
      ) : null}
      <button className="primary-action" type="submit" disabled={pending}>
        {pending ? "Working..." : submitLabel}
      </button>
    </form>
  );
}
