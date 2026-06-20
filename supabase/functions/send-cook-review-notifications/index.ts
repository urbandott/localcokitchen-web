import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getVerifiedUser } from "../_shared/auth.ts";

type ReviewNotification = {
  review_id: string;
  recipient_email: string;
  recipient_name: string;
  decision: "approved" | "rejected";
  review_notes: string | null;
};

const corsHeaders = () => {
  return {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);

Deno.serve(async (req) => {
  const headers = corsHeaders();

  if (req.method === "OPTIONS") return new Response(null, { headers, status: 204 });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), { headers, status: 405 });
  }

  const verified = await getVerifiedUser(req);
  if (verified.error) {
    return new Response(await verified.error.text(), {
      headers: {
        ...Object.fromEntries(verified.error.headers.entries()),
        ...headers,
      },
      status: verified.error.status,
    });
  }

  const authorization = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const fromEmail = Deno.env.get("COOK_REVIEW_FROM_EMAIL")
    ?? "LocalCoKitchen <notifications@localcokitchen.com>";

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: isAdmin, error: adminError } = await userClient
    .schema("lck_identity")
    .rpc("current_user_is_admin");

  if (adminError || isAdmin !== true) {
    return new Response(JSON.stringify({ error: "Admin access required." }), { headers, status: 403 });
  }

  if (!serviceRoleKey || !resendApiKey) {
    return new Response(JSON.stringify({ error: "Email delivery is not configured." }), {
      headers,
      status: 503,
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error: claimError } = await adminClient
    .schema("lck_identity")
    .rpc("claim_pending_cook_review_notifications", { batch_size: 20 });

  if (claimError) {
    return new Response(JSON.stringify({ error: "Could not claim pending notifications." }), {
      headers,
      status: 500,
    });
  }

  const notifications = (data ?? []) as ReviewNotification[];
  let sent = 0;
  let failed = 0;

  for (const notification of notifications) {
    const approved = notification.decision === "approved";
    const subject = approved
      ? "Your LocalCoKitchen cook application was approved"
      : "Update on your LocalCoKitchen cook application";
    const decisionText = approved
      ? "Your cook application has been approved. You can now finish your kitchen profile, menu, and pickup schedule before making your kitchen public."
      : "Your cook application was not approved at this time. You can review the notes below, update your application, and submit it again.";
    const notes = notification.review_notes?.trim();
    const notesText = notes ? `\n\nReview notes:\n${notes}` : "";
    const notesHtml = notes
      ? `<h2 style="font-size:16px">Review notes</h2><p>${escapeHtml(notes)}</p>`
      : "";

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [notification.recipient_email],
          subject,
          text: `Hello ${notification.recipient_name},\n\n${decisionText}${notesText}\n\nLocalCoKitchen`,
          html: `<p>Hello ${escapeHtml(notification.recipient_name)},</p><p>${escapeHtml(decisionText)}</p>${notesHtml}<p>LocalCoKitchen</p>`,
        }),
      });
      const result = await response.json().catch(() => ({}));

      await adminClient.schema("lck_identity").rpc("complete_cook_review_notification", {
        p_review_id: notification.review_id,
        p_succeeded: response.ok,
        p_provider_id: response.ok ? String(result.id ?? "") : null,
        p_error_message: response.ok ? null : String(result.message ?? `Resend returned ${response.status}.`),
      });

      if (response.ok) sent += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      await adminClient.schema("lck_identity").rpc("complete_cook_review_notification", {
        p_review_id: notification.review_id,
        p_succeeded: false,
        p_provider_id: null,
        p_error_message: error instanceof Error ? error.message : "Email request failed.",
      });
    }
  }

  return new Response(JSON.stringify({ claimed: notifications.length, sent, failed }), {
    headers,
    status: failed > 0 ? 207 : 200,
  });
});
