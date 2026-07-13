"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  submitCookApplicationAction,
  type CookApplicationActionState,
} from "@/features/kitchen/actions";
import type { CookApplication } from "@/types/database";

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

function SubmitButton({
  children,
  name,
  value,
  variant = "primary",
}: {
  children: string;
  name: string;
  value: string;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={`${variant === "primary" ? "primary-action" : "secondary-action"} compact-action`}
      name={name}
      type="submit"
      value={value}
      disabled={pending}
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

export function CookApplicationForm({
  application = null,
  initialState = initialCookApplicationActionState,
}: {
  application?: CookApplication | null;
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
          maxLength={120}
          placeholder="First and last name"
          defaultValue={application?.legal_name ?? ""}
        />
        <FieldError error={fieldErrors.legalName} />
      </label>

      <label className="next-field">
        <span>Phone number</span>
        <input
          autoComplete="tel"
          inputMode="tel"
          name="phone"
          maxLength={20}
          pattern="[0-9+().\\s-]{10,20}"
          placeholder="+1 555-555-5555"
          title="Use digits and phone punctuation only, for example +1 312-555-0142."
          defaultValue={application?.phone ?? ""}
        />
        <small>Use digits only with optional spaces, dashes, parentheses, or +1.</small>
        <FieldError error={fieldErrors.phone} />
      </label>

      <label className="next-field">
        <span>Private pickup address</span>
        <input
          autoComplete="street-address"
          name="pickupAddress"
          maxLength={240}
          placeholder="Street address used for admin review"
          defaultValue={application?.pickup_address ?? ""}
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
          maxLength={5}
          placeholder="60601"
          defaultValue={application?.pickup_zip_code ?? ""}
        />
        <FieldError error={fieldErrors.pickupZipCode} />
      </label>

      <label className="next-check-field">
        <input
          name="foodHandlerTrainingCompleted"
          type="checkbox"
          defaultChecked={application?.food_handler_training_completed ?? false}
        />
        <span>I have completed the required food handler training.</span>
      </label>
      <FieldError error={fieldErrors.foodHandlerTrainingCompleted} />

      <label className="next-field">
        <span>Food handler certificate</span>
        <input
          accept="application/pdf,image/jpeg,image/png,image/webp"
          name="foodHandlerCertificate"
          type="file"
        />
        <small>
          PDF, JPG, PNG, or WebP. Maximum 5 MB.
          {application?.food_handler_certificate_url ? " Existing file is saved." : ""}
        </small>
        <FieldError error={fieldErrors.foodHandlerCertificate} />
      </label>

      <label className="next-field">
        <span>Government ID</span>
        <input
          accept="application/pdf,image/jpeg,image/png,image/webp"
          name="governmentIdDocument"
          type="file"
        />
        <small>
          PDF, JPG, PNG, or WebP. Maximum 5 MB.
          {application?.government_id_document_url ? " Existing file is saved." : ""}
        </small>
        <FieldError error={fieldErrors.governmentIdDocument} />
      </label>

      <label className="next-field">
        <span>Selfie verification photo</span>
        <input accept="image/jpeg,image/png,image/webp" name="selfieVerification" type="file" />
        <small>
          JPG, PNG, or WebP. Maximum 5 MB.
          {application?.selfie_verification_url ? " Existing file is saved." : ""}
        </small>
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

      <div className="form-action-row">
        <SubmitButton name="intent" value="draft" variant="secondary">
          Save draft
        </SubmitButton>
        <SubmitButton name="intent" value="submit">
          Submit application
        </SubmitButton>
      </div>
    </form>
  );
}
