"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import {
  createMenuItemAction,
  deleteMenuItemAction,
  savePickupWindowsAction,
  updateMenuItemAction,
  updateCookProfileAction,
  type KitchenManagementActionState,
} from "@/features/kitchen/actions";
import type { CookMenuItem, CookPickupWindow, CookProfile } from "@/types/database";

const initialKitchenManagementActionState: KitchenManagementActionState = {
  ok: false,
  message: "",
};

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const spiceLevels = ["Not spicy", "Mild", "Medium", "Hot", "Extra hot"];

function FieldError({ error }: { error?: string }) {
  return error ? (
    <p className="next-form-error" role="alert">
      {error}
    </p>
  ) : null;
}

function FormStatus({ state }: { state: KitchenManagementActionState }) {
  return state.message ? (
    <p className={state.ok ? "next-success" : "next-alert"} role="status">
      {state.message}
    </p>
  ) : null;
}

function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="primary-action compact-action" type="submit" disabled={pending}>
      {pending ? "Saving…" : children}
    </button>
  );
}

function dollarsFromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function CookProfileManagementForm({
  canMakePublic,
  liveDisabledReason = null,
  moderatorDisabled,
  profile,
}: {
  canMakePublic: boolean;
  liveDisabledReason?: string | null;
  moderatorDisabled: boolean;
  profile: CookProfile | null;
}) {
  const [state, formAction] = useActionState(
    updateCookProfileAction,
    initialKitchenManagementActionState,
  );
  const fieldErrors = state.fieldErrors ?? {};
  const isCurrentlyPublic = Boolean(profile?.is_public) && !moderatorDisabled;
  const disableLiveToggle = moderatorDisabled || (!canMakePublic && !isCurrentlyPublic);

  return (
    <form action={formAction} className="next-form">
      <div>
        <h2>Public cook profile</h2>
        <p className="next-muted">These customer-safe fields appear with your public menu.</p>
      </div>
      <FormStatus state={state} />
      {moderatorDisabled ? (
        <p className="next-alert">
          The moderator has disabled this kitchen. Please reach out to info@localcokitchen.com
          before making it public again.
        </p>
      ) : null}
      {liveDisabledReason ? <p className="next-alert">{liveDisabledReason}</p> : null}
      <label>
        <span>Display name</span>
        <input
          name="displayName"
          required
          maxLength={120}
          defaultValue={profile?.display_name ?? ""}
        />
        <FieldError error={fieldErrors.displayName} />
      </label>
      <label>
        <span>Cuisine type</span>
        <input name="cuisineType" maxLength={80} defaultValue={profile?.cuisine_type ?? ""} />
        <FieldError error={fieldErrors.cuisineType} />
      </label>
      <label>
        <span>Pickup ZIP code</span>
        <input
          name="pickupZipCode"
          inputMode="numeric"
          maxLength={5}
          pattern="[0-9]{5}"
          required
          defaultValue={profile?.pickup_zip_code ?? ""}
        />
        <FieldError error={fieldErrors.pickupZipCode} />
      </label>
      <label>
        <span>Preorder cutoff hours</span>
        <input
          name="preorderCutoffHours"
          type="number"
          min={1}
          max={168}
          required
          defaultValue={profile?.preorder_cutoff_hours ?? 24}
        />
        <FieldError error={fieldErrors.preorderCutoffHours} />
      </label>
      <label>
        <span>Description</span>
        <textarea name="description" maxLength={3500} defaultValue={profile?.description ?? ""} />
        <FieldError error={fieldErrors.description} />
      </label>
      <label>
        <span>Pickup/order notes</span>
        <textarea name="orderNotes" maxLength={800} defaultValue={profile?.order_notes ?? ""} />
        <FieldError error={fieldErrors.orderNotes} />
      </label>
      <label>
        <span>Profile image</span>
        <input accept="image/jpeg,image/png,image/webp" name="profileImage" type="file" />
        <small>Optional JPG, PNG, or WebP. Maximum 2 MB.</small>
        <FieldError error={fieldErrors.profileImage} />
      </label>
      <label className="next-check-field">
        <input
          name="isPublic"
          type="checkbox"
          defaultChecked={isCurrentlyPublic}
          disabled={disableLiveToggle}
        />
        <span>Make my kitchen public</span>
      </label>
      <SubmitButton>Save public profile</SubmitButton>
    </form>
  );
}

export function MenuItemCreateForm() {
  const [state, formAction] = useActionState(
    createMenuItemAction,
    initialKitchenManagementActionState,
  );
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="next-form">
      <div>
        <h2>Add a menu item</h2>
        <p className="next-muted">
          Customer-visible menu items require real inventory, image, ingredients, and allergen
          information.
        </p>
      </div>
      <FormStatus state={state} />
      <label>
        <span>Item name</span>
        <input name="name" required maxLength={120} />
        <FieldError error={fieldErrors.name} />
      </label>
      <label>
        <span>Description</span>
        <textarea name="description" required maxLength={1200} />
        <FieldError error={fieldErrors.description} />
      </label>
      <div className="kitchen-two-column">
        <label>
          <span>Price</span>
          <input name="price" inputMode="decimal" required placeholder="12.00" />
          <FieldError error={fieldErrors.priceCents} />
        </label>
        <label>
          <span>Quantity available</span>
          <input
            name="quantityAvailable"
            type="number"
            min={1}
            max={10000}
            required
            defaultValue={1}
          />
          <FieldError error={fieldErrors.quantityAvailable} />
        </label>
      </div>
      <label>
        <span>Category</span>
        <input name="category" required maxLength={80} placeholder="Dinner, desserts, sides…" />
        <FieldError error={fieldErrors.category} />
      </label>
      <label>
        <span>Main ingredients</span>
        <input name="mainIngredients" required placeholder="Chicken, rice, herbs" />
        <small>Comma-separated. Required for active items.</small>
        <FieldError error={fieldErrors.mainIngredients} />
      </label>
      <label>
        <span>Allergens</span>
        <input
          name="allergens"
          placeholder="Dairy, peanuts, wheat or leave blank for None declared"
        />
        <FieldError error={fieldErrors.allergens} />
      </label>
      <label>
        <span>Dietary tags</span>
        <input name="dietaryTags" placeholder="Vegetarian, halal, gluten-free" />
        <FieldError error={fieldErrors.dietaryTags} />
      </label>
      <div className="kitchen-two-column">
        <label>
          <span>Portion size</span>
          <input name="portionSize" maxLength={120} placeholder="16 oz bowl" />
          <FieldError error={fieldErrors.portionSize} />
        </label>
        <label>
          <span>Serves</span>
          <input name="portionServes" type="number" min={1} max={50} required defaultValue={1} />
          <FieldError error={fieldErrors.portionServes} />
        </label>
      </div>
      <label>
        <span>Spice level</span>
        <select name="spiceLevel" defaultValue="Not spicy">
          {spiceLevels.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        <FieldError error={fieldErrors.spiceLevel} />
      </label>
      <label>
        <span>Pickup note</span>
        <input name="pickupWindowNote" maxLength={500} placeholder="Best picked up after 5 PM" />
        <FieldError error={fieldErrors.pickupWindowNote} />
      </label>
      <label>
        <span>Menu item image</span>
        <input accept="image/jpeg,image/png,image/webp" name="image" required type="file" />
        <small>JPG, PNG, or WebP. Maximum 2 MB.</small>
        <FieldError error={fieldErrors.image} />
      </label>
      <label className="next-check-field">
        <input name="isActive" type="checkbox" defaultChecked />
        <span>Publish this item after saving</span>
      </label>
      <SubmitButton>Create menu item</SubmitButton>
    </form>
  );
}

export function MenuItemEditForm({ item }: { item: CookMenuItem }) {
  const [state, formAction] = useActionState(
    updateMenuItemAction,
    initialKitchenManagementActionState,
  );
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <details className="menu-item-editor">
      <summary>Edit item details</summary>
      <form action={formAction} className="next-form">
        <input type="hidden" name="itemId" value={item.id} />
        <FormStatus state={state} />
        <label>
          <span>Item name</span>
          <input name="name" required maxLength={120} defaultValue={item.name} />
          <FieldError error={fieldErrors.name} />
        </label>
        <label>
          <span>Description</span>
          <textarea name="description" required maxLength={1200} defaultValue={item.description} />
          <FieldError error={fieldErrors.description} />
        </label>
        <div className="kitchen-two-column">
          <label>
            <span>Price</span>
            <input
              name="price"
              inputMode="decimal"
              required
              defaultValue={dollarsFromCents(item.price_cents)}
            />
            <FieldError error={fieldErrors.priceCents} />
          </label>
          <label>
            <span>Quantity available</span>
            <input
              name="quantityAvailable"
              type="number"
              min={1}
              max={10000}
              required
              defaultValue={item.quantity_available}
            />
            <FieldError error={fieldErrors.quantityAvailable} />
          </label>
        </div>
        <label>
          <span>Category</span>
          <input name="category" required maxLength={80} defaultValue={item.category} />
          <FieldError error={fieldErrors.category} />
        </label>
        <label>
          <span>Main ingredients</span>
          <input name="mainIngredients" required defaultValue={item.main_ingredients.join(", ")} />
          <FieldError error={fieldErrors.mainIngredients} />
        </label>
        <label>
          <span>Allergens</span>
          <input name="allergens" defaultValue={item.allergens.join(", ")} />
          <FieldError error={fieldErrors.allergens} />
        </label>
        <label>
          <span>Dietary tags</span>
          <input name="dietaryTags" defaultValue={item.dietary_tags.join(", ")} />
          <FieldError error={fieldErrors.dietaryTags} />
        </label>
        <div className="kitchen-two-column">
          <label>
            <span>Portion size</span>
            <input name="portionSize" maxLength={120} defaultValue={item.portion_size ?? ""} />
            <FieldError error={fieldErrors.portionSize} />
          </label>
          <label>
            <span>Serves</span>
            <input
              name="portionServes"
              type="number"
              min={1}
              max={50}
              required
              defaultValue={item.portion_serves ?? 1}
            />
            <FieldError error={fieldErrors.portionServes} />
          </label>
        </div>
        <label>
          <span>Spice level</span>
          <select name="spiceLevel" defaultValue={item.spice_level ?? "Not spicy"}>
            {spiceLevels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          <FieldError error={fieldErrors.spiceLevel} />
        </label>
        <label>
          <span>Pickup note</span>
          <input
            name="pickupWindowNote"
            maxLength={500}
            defaultValue={item.pickup_window_note ?? ""}
          />
          <FieldError error={fieldErrors.pickupWindowNote} />
        </label>
        <label>
          <span>Replace menu item image</span>
          <input accept="image/jpeg,image/png,image/webp" name="image" type="file" />
          <small>Optional JPG, PNG, or WebP. Maximum 2 MB.</small>
          <FieldError error={fieldErrors.image} />
        </label>
        <label className="next-check-field">
          <input name="isActive" type="checkbox" defaultChecked={item.is_active} />
          <span>Published</span>
        </label>
        <SubmitButton>Save item changes</SubmitButton>
      </form>
      <form action={deleteMenuItemAction} className="menu-item-delete-form">
        <input type="hidden" name="itemId" value={item.id} />
        <label className="next-check-field">
          <input name="confirmDelete" type="checkbox" required />
          <span>I understand this permanently deletes this menu item.</span>
        </label>
        <button className="secondary-action compact-action" type="submit">
          Delete menu item
        </button>
      </form>
    </details>
  );
}

export function PickupWindowsForm({ windows = [] }: { windows?: CookPickupWindow[] }) {
  const [state, formAction] = useActionState(
    savePickupWindowsAction,
    initialKitchenManagementActionState,
  );
  const windowsByDay = new Map(windows.map((window) => [window.day_of_week, window]));

  return (
    <form action={formAction} className="next-form">
      <div>
        <h2>Pickup windows</h2>
        <p className="next-muted">Set the weekly windows customers can use for planning pickups.</p>
      </div>
      <FormStatus state={state} />
      <div className="pickup-window-grid">
        {weekdays.map((day, index) => {
          const window = windowsByDay.get(index);
          return (
            <fieldset className="pickup-window-row" key={day}>
              <legend>{day}</legend>
              <label className="next-check-field">
                <input
                  name={`isActive-${index}`}
                  type="checkbox"
                  defaultChecked={window?.is_active ?? false}
                />
                <span>Active</span>
              </label>
              <label>
                <span>Start</span>
                <input
                  name={`startTime-${index}`}
                  type="time"
                  required
                  defaultValue={window?.start_time?.slice(0, 5) ?? "09:00"}
                />
              </label>
              <label>
                <span>End</span>
                <input
                  name={`endTime-${index}`}
                  type="time"
                  required
                  defaultValue={window?.end_time?.slice(0, 5) ?? "17:00"}
                />
              </label>
            </fieldset>
          );
        })}
      </div>
      <SubmitButton>Save pickup windows</SubmitButton>
    </form>
  );
}
