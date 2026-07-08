"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { cancelPendingOrderAction, type CancelOrderActionState } from "@/features/orders/actions";

const initialState: CancelOrderActionState = { ok: false, message: "" };

function CancelButton() {
  const { pending } = useFormStatus();
  return (
    <button className="secondary-action compact-action" type="submit" disabled={pending}>
      {pending ? "Cancelling…" : "Cancel pending order"}
    </button>
  );
}

export function CancelOrderForm({ orderId }: { orderId: string }) {
  const [state, formAction] = useActionState(cancelPendingOrderAction, initialState);

  return (
    <form action={formAction} className="order-cancel-form">
      <input name="orderId" type="hidden" value={orderId} />
      <p>
        If you do not want to complete payment, cancel this pending order to release the reserved
        inventory immediately.
      </p>
      <CancelButton />
      {state.message ? (
        <p className={state.ok ? "next-success" : "next-alert"} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
