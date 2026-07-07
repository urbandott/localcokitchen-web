import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import {
  parseStripePaymentWebhookEvent,
  verifyStripeWebhookSignature,
} from "@/features/payments/stripe-webhook";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const env = getServerEnv();
  const signature = request.headers.get("stripe-signature");

  if (
    !verifyStripeWebhookSignature({
      rawBody,
      signatureHeader: signature,
      secret: env.STRIPE_WEBHOOK_SECRET,
    })
  ) {
    return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }

  const event = parseStripePaymentWebhookEvent(payload);
  if (!event) return NextResponse.json({ ok: true, ignored: true });

  const supabase = createPrivilegedClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Payments are not configured." }, { status: 503 });
  }

  const { error } = await supabase.schema("lck_marketplace").rpc("record_payment_webhook_event", {
    p_provider: "stripe",
    p_provider_event_id: event.eventId,
    p_event_type: event.eventType,
    p_provider_reference: event.providerReference,
    p_payment_status: event.paymentStatus,
    p_order_id: event.orderId,
    p_amount_cents: event.amountCents,
    p_currency: event.currency,
    p_payload: payload,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Payment event could not be processed." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
