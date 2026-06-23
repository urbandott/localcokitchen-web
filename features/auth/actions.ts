"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/security/safe-path";

const emailSchema = z
  .string()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
const passwordSchema = z.string().min(10).max(128);

export type AuthActionState = {
  message: string;
  ok: boolean;
};

export async function signInAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = z
    .object({
      email: emailSchema,
      password: z.string().min(1),
      next: z.string().optional(),
    })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) return { ok: false, message: "Enter a valid email and password." };

  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Authentication is not configured yet." };

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) return { ok: false, message: "Sign in failed. Check your credentials and try again." };
  redirect(safeRedirectPath(parsed.data.next, "/profile/"));
}

export async function signUpAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = z
    .object({
      email: emailSchema,
      password: passwordSchema,
      firstName: z.string().trim().max(80).optional(),
      lastName: z.string().trim().max(80).optional(),
    })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) return { ok: false, message: "Enter a valid email and a strong password." };

  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Authentication is not configured yet." };

  await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        first_name: parsed.data.firstName ?? "",
        last_name: parsed.data.lastName ?? "",
      },
    },
  });

  return {
    ok: true,
    message:
      "If your email can be registered, you will receive the next sign-in or confirmation steps shortly.",
  };
}

export async function forgotPasswordAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = z.object({ email: emailSchema }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Enter a valid email address." };

  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Authentication is not configured yet." };
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: "/reset-password/" });
  return { ok: true, message: "If the account exists, reset instructions will be sent." };
}

export async function resetPasswordAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = z
    .object({
      password: passwordSchema,
      confirmPassword: z.string().min(10).max(128),
    })
    .refine((value) => value.password === value.confirmPassword, {
      message: "Passwords must match.",
      path: ["confirmPassword"],
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Enter matching strong passwords." };

  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Authentication is not configured yet." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error)
    return {
      ok: false,
      message: "Password could not be updated. Open the latest reset link and try again.",
    };
  return { ok: true, message: "Password updated. You can sign in with your new password." };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase?.auth.signOut();
  redirect("/");
}
