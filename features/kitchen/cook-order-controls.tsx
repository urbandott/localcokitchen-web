"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateCookOrderItemFulfillmentAction,
  type CookOrderActionState,
} from "@/features/kitchen/cook-order-actions";
import type { CookOrderItemSummary } from "@/types/database";

const initialState: CookOrderActionState = { ok: false, message: "" };

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="secondary-action compact-action" type="submit" disabled={pending}>
      {pending ? "Updating…" : children}
    </button>
  );
}

function FulfillmentForm({
  orderItemId,
  status,
  children,
}: {
  children: React.ReactNode;
  orderItemId: string;
  status: "ready" | "fulfilled";
}) {
  const [state, formAction] = useActionState(updateCookOrderItemFulfillmentAction, initialState);

  return (
    <form action={formAction} className="kitchen-order-action-form">
      <input name="orderItemId" type="hidden" value={orderItemId} />
      <input name="status" type="hidden" value={status} />
      <SubmitButton>{children}</SubmitButton>
      {state.message ? (
        <p className={state.ok ? "next-success" : "next-alert"} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function CookOrderControls({ item }: { item: CookOrderItemSummary }) {
  if (item.order_status !== "paid" || item.fulfillment_status === "fulfilled") return null;

  return (
    <div className="kitchen-inventory-actions">
      {item.fulfillment_status === "pending" ? (
        <FulfillmentForm orderItemId={item.order_item_id} status="ready">
          Mark ready
        </FulfillmentForm>
      ) : null}
      <FulfillmentForm orderItemId={item.order_item_id} status="fulfilled">
        Mark fulfilled
      </FulfillmentForm>
    </div>
  );
}
