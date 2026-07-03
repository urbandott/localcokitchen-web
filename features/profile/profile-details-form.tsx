"use client";

import Image from "next/image";
import { useActionState } from "react";
import { type ProfileActionState, updateProfileAction } from "@/features/profile/actions";
import type { AccountProfile } from "@/features/profile/profile-data";
import {
  PROFILE_IMAGE_MAX_DIMENSION,
  PROFILE_NAME_MAX_LENGTH,
} from "@/features/profile/profile-validation";

const initialState: ProfileActionState = { ok: false, message: "" };

export function ProfileDetailsForm({ profile }: { profile: AccountProfile }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);

  return (
    <form className="next-form profile-details-form" action={formAction}>
      <div className="profile-photo">
        {profile.signedAvatarUrl ? (
          <Image
            alt={`${profile.full_name ?? "Your"} profile photo`}
            className="profile-photo__image"
            height={96}
            src={profile.signedAvatarUrl}
            width={96}
          />
        ) : (
          <span className="profile-photo__fallback" aria-hidden="true">
            {(profile.first_name?.[0] ?? profile.email[0] ?? "?").toUpperCase()}
          </span>
        )}
        <div>
          <p className="profile-photo__title">Profile photo</p>
          <p className="next-muted">
            JPG, PNG, or WebP. Maximum 2 MB and {PROFILE_IMAGE_MAX_DIMENSION} ×{" "}
            {PROFILE_IMAGE_MAX_DIMENSION} pixels.
          </p>
        </div>
      </div>

      <label>
        First name
        <input
          aria-describedby={state.fieldErrors?.firstName ? "first-name-error" : undefined}
          aria-invalid={Boolean(state.fieldErrors?.firstName)}
          autoComplete="given-name"
          defaultValue={profile.first_name ?? ""}
          maxLength={PROFILE_NAME_MAX_LENGTH}
          minLength={1}
          name="firstName"
          required
        />
        {state.fieldErrors?.firstName ? (
          <span className="auth-field-error" id="first-name-error">
            {state.fieldErrors.firstName}
          </span>
        ) : null}
      </label>

      <label>
        Last name
        <input
          aria-describedby={state.fieldErrors?.lastName ? "last-name-error" : undefined}
          aria-invalid={Boolean(state.fieldErrors?.lastName)}
          autoComplete="family-name"
          defaultValue={profile.last_name ?? ""}
          maxLength={PROFILE_NAME_MAX_LENGTH}
          minLength={1}
          name="lastName"
          required
        />
        {state.fieldErrors?.lastName ? (
          <span className="auth-field-error" id="last-name-error">
            {state.fieldErrors.lastName}
          </span>
        ) : null}
      </label>

      <label>
        Email address
        <input autoComplete="email" readOnly type="email" value={profile.email} />
      </label>

      <label>
        Upload a new profile photo
        <input
          accept="image/jpeg,image/png,image/webp"
          aria-describedby={state.fieldErrors?.avatar ? "avatar-error" : undefined}
          aria-invalid={Boolean(state.fieldErrors?.avatar)}
          name="avatar"
          type="file"
        />
        {state.fieldErrors?.avatar ? (
          <span className="auth-field-error" id="avatar-error">
            {state.fieldErrors.avatar}
          </span>
        ) : null}
      </label>

      {profile.avatar_path ? (
        <label className="profile-remove-photo">
          <input name="removeAvatar" type="checkbox" />
          Remove my current profile photo
        </label>
      ) : null}

      {state.message ? (
        <p aria-live="polite" className={state.ok ? "next-success" : "next-alert"} role="status">
          {state.message}
        </p>
      ) : null}

      <button className="primary-action" disabled={pending} type="submit">
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
