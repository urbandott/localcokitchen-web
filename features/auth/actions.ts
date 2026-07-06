"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseAccountIntent, postSignInDestination } from "@/features/auth/account-intent";
import { meetsPasswordRequirements, PASSWORD_MAX_LENGTH } from "@/features/auth/password-policy";

const emailSchema = z
  .string()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
const passwordSchema = z
  .string()
  .max(PASSWORD_MAX_LENGTH, `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`)
  .refine(meetsPasswordRequirements, {
    message: "Password must meet all requirements shown below.",
  });

export type AuthActionState = {
  message: string;
  ok: boolean;
  fieldErrors?: Record<string, string>;
};

export async function startCookOnboardingAction() {
  const supabase = await createClient();
  if (!supabase) redirect("/signup/?intent=cook");

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) redirect("/signup/?intent=cook");

  const identity = supabase.schema("lck_identity").from("users");
  const current = await identity
    .select("cook_onboarding_started_at")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (current.error || !current.data) redirect("/sell-your-food/?setup=error");

  if (!current.data.cook_onboarding_started_at) {
    const updated = await identity
      .update({ cook_onboarding_started_at: new Date().toISOString() })
      .eq("id", authData.user.id)
      .select("id")
      .single();

    if (updated.error) redirect("/sell-your-food/?setup=error");
  }

  redirect("/my-shop/");
}

function firstFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}

export async function signInAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = z
    .object({
      email: emailSchema,
      password: z.string().min(1),
      intent: z.string().optional(),
      next: z.string().optional(),
    })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) return { ok: false, message: "Enter a valid email and password." };

  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Authentication is not configured yet." };

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) return { ok: false, message: "Sign in failed. Check your credentials and try again." };

  const accountIntent = parseAccountIntent(parsed.data.intent);
  const identityApi = supabase.schema("lck_identity");
  if (accountIntent === "cook") {
    const intentUpdate = await identityApi
      .from("users")
      .update({ cook_onboarding_started_at: new Date().toISOString() })
      .eq("id", data.user.id)
      .select("id")
      .single();
    if (intentUpdate.error) {
      return {
        ok: false,
        message: "You are signed in, but cook setup could not be started. Refresh and try again.",
      };
    }
  }

  const [identity, application, admin] = await Promise.all([
    identityApi
      .from("users")
      .select("cook_onboarding_started_at")
      .eq("id", data.user.id)
      .maybeSingle(),
    supabase
      .schema("lck_marketplace")
      .from("cook_applications")
      .select("id")
      .eq("user_id", data.user.id)
      .maybeSingle(),
    parsed.data.next === "/admin/"
      ? identityApi.rpc("current_user_is_admin")
      : Promise.resolve({ data: false, error: null }),
  ]);

  const hasCookWorkspace = Boolean(
    accountIntent === "cook" ||
    (!identity.error && identity.data?.cook_onboarding_started_at) ||
    (!application.error && application.data),
  );

  redirect(
    postSignInDestination({
      hasCookWorkspace,
      requestedAdmin: parsed.data.next === "/admin/",
      isAdmin: !admin.error && admin.data === true,
    }),
  );
}

export async function signUpAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = z
    .object({
      email: emailSchema,
      password: passwordSchema,
      firstName: z.string().trim().max(80, "First name must be 80 characters or fewer.").optional(),
      lastName: z.string().trim().max(80, "Last name must be 80 characters or fewer.").optional(),
      intent: z.string().optional(),
    })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please correct the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Authentication is not configured yet." };

  const accountIntent = parseAccountIntent(parsed.data.intent);
  const { data } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        first_name: parsed.data.firstName ?? "",
        last_name: parsed.data.lastName ?? "",
        account_intent: accountIntent,
      },
    },
  });

  if (data.session) redirect(accountIntent === "cook" ? "/my-shop/" : "/");

  return {
    ok: true,
    message:
      "Thanks! Check your inbox and spam folder for a confirmation email. If you already have an account, you can sign in instead.",
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
