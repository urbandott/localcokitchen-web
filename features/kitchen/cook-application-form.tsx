"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  submitCookApplicationAction,
  type CookApplicationActionState,
} from "@/features/kitchen/actions";

const initialCookApplicationActionState: CookApplicationActionState = {
  ok: false,
  message: "",
};

function FieldError({ error }: { error?: string }) {
  return error ? (
    <p className="next-form-error" role="alert">
      {error}
    </p>
  ) : null;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="primary-action compact-action" type="submit" disabled={pending}>
      {pending ? "Submitting…" : "Submit application"}
    </button>
  );
}

export function CookApplicationForm({
  initialState = initialCookApplicationActionState,
}: {
  initialState?: CookApplicationActionState;
}) {
  const [state, formAction] = useActionState(submitCookApplicationAction, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="next-form">
      <div>
        <p className="eyebrow">Cook application</p>
        <h2>Submit your kitchen for review</h2>
        <p className="next-muted">
          We use this information only to review your application. Government ID, selfie, address,
          and certificate files are stored privately and are not shown to customers.
        </p>
      </div>

      {state.message ? (
        <p className={state.ok ? "next-success" : "next-alert"} role="status">
          {state.message}
        </p>
      ) : null}

      <label className="next-field">
        <span>Legal full name</span>
        <input
          autoComplete="name"
          name="legalName"
          required
          maxLength={120}
          placeholder="First and last name"
        />
        <FieldError error={fieldErrors.legalName} />
      </label>

      <label className="next-field">
        <span>Phone number</span>
        <input
          autoComplete="tel"
          inputMode="tel"
          name="phone"
          required
          placeholder="+1 555-555-5555"
        />
        <FieldError error={fieldErrors.phone} />
      </label>

      <label className="next-field">
        <span>Private pickup address</span>
        <input
          autoComplete="street-address"
          name="pickupAddress"
          required
          maxLength={240}
          placeholder="Street address used for admin review"
        />
        <FieldError error={fieldErrors.pickupAddress} />
      </label>

      <label className="next-field">
        <span>Pickup ZIP code</span>
        <input
          autoComplete="postal-code"
          inputMode="numeric"
          name="pickupZipCode"
          pattern="[0-9]{5}"
          required
          maxLength={5}
          placeholder="60601"
        />
        <FieldError error={fieldErrors.pickupZipCode} />
      </label>

      <label className="next-check-field">
        <input name="foodHandlerTrainingCompleted" required type="checkbox" />
        <span>I have completed the required food handler training.</span>
      </label>
      <FieldError error={fieldErrors.foodHandlerTrainingCompleted} />

      <label className="next-field">
        <span>Food handler certificate</span>
        <input
          accept="application/pdf,image/jpeg,image/png,image/webp"
          name="foodHandlerCertificate"
          required
          type="file"
        />
        <small>PDF, JPG, PNG, or WebP. Maximum 5 MB.</small>
        <FieldError error={fieldErrors.foodHandlerCertificate} />
      </label>

      <label className="next-field">
        <span>Government ID</span>
        <input
          accept="application/pdf,image/jpeg,image/png,image/webp"
          name="governmentIdDocument"
          required
          type="file"
        />
        <small>PDF, JPG, PNG, or WebP. Maximum 5 MB.</small>
        <FieldError error={fieldErrors.governmentIdDocument} />
      </label>

      <label className="next-field">
        <span>Selfie verification photo</span>
        <input
          accept="image/jpeg,image/png,image/webp"
          name="selfieVerification"
          required
          type="file"
        />
        <small>JPG, PNG, or WebP. Maximum 5 MB.</small>
        <FieldError error={fieldErrors.selfieVerification} />
      </label>

      <label className="next-field">
        <span>Additional permit or certification</span>
        <input
          accept="application/pdf,image/jpeg,image/png,image/webp"
          name="permitOrCertification"
          type="file"
        />
        <small>Optional. PDF, JPG, PNG, or WebP. Maximum 5 MB.</small>
        <FieldError error={fieldErrors.permitOrCertification} />
      </label>

      <SubmitButton />
    </form>
  );
}
