"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { FilteredInput } from "@/components/filtered-input";
import {
  createMenuItemAction,
  deleteMenuItemAction,
  savePickupWindowsAction,
  updateMenuItemAction,
  updateCookProfileAction,
  type KitchenManagementActionState,
} from "@/features/kitchen/actions";
import type { KitchenMenuItem } from "@/features/kitchen/kitchen-data";
import type { CookPickupWindow, CookProfile } from "@/types/database";

const initialKitchenManagementActionState: KitchenManagementActionState = {
  ok: false,
  message: "",
};

type PreviewPhoto = {
  name: string;
  signedUrl: string;
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

function photoNameFromPath(path: string, index: number): string {
  const fallback = `Photo ${index + 1}`;
  const rawName = path.split("/").pop()?.trim();
  if (!rawName) return fallback;

  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
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
        <FilteredInput
          name="pickupZipCode"
          filter="digits"
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
        <FilteredInput
          name="preorderCutoffHours"
          filter="digits"
          inputMode="numeric"
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
          <FilteredInput
            name="price"
            filter="decimal"
            inputMode="decimal"
            maxIntegerDigits={5}
            decimalPlaces={2}
            required
            placeholder="12.00"
          />
          <FieldError error={fieldErrors.priceCents} />
        </label>
        <label>
          <span>Quantity available</span>
          <FilteredInput
            name="quantityAvailable"
            filter="digits"
            inputMode="numeric"
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
          <FilteredInput
            name="portionSize"
            filter="noLetters"
            inputMode="decimal"
            maxLength={120}
            placeholder="16"
          />
          <FieldError error={fieldErrors.portionSize} />
        </label>
        <label>
          <span>Serves</span>
          <FilteredInput
            name="portionServes"
            filter="digits"
            inputMode="numeric"
            min={1}
            max={50}
            required
            defaultValue={1}
          />
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
        <span>Menu item photos</span>
        <input
          accept="image/jpeg,image/png,image/webp"
          multiple
          name="images"
          required
          type="file"
        />
        <small>Upload 1–3 JPG, PNG, or WebP photos. Maximum 2 MB each.</small>
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

export function MenuItemEditForm({ item }: { item: KitchenMenuItem }) {
  const [state, formAction] = useActionState(
    updateMenuItemAction,
    initialKitchenManagementActionState,
  );
  const [previewPhoto, setPreviewPhoto] = useState<PreviewPhoto | null>(null);
  const [photosMarkedForRemoval, setPhotosMarkedForRemoval] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fieldErrors = state.fieldErrors ?? {};

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (previewPhoto && !dialog.open) {
      dialog.showModal();
      return;
    }

    if (!previewPhoto && dialog.open) {
      dialog.close();
    }
  }, [previewPhoto]);

  function togglePhotoRemoval(path: string, checked: boolean) {
    setPhotosMarkedForRemoval((current) => {
      const next = new Set(current);
      if (checked) next.add(path);
      else next.delete(path);
      return next;
    });
  }

  function closePreview() {
    setPreviewPhoto(null);
  }

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
            <FilteredInput
              name="price"
              filter="decimal"
              inputMode="decimal"
              maxIntegerDigits={5}
              decimalPlaces={2}
              required
              defaultValue={dollarsFromCents(item.price_cents)}
            />
            <FieldError error={fieldErrors.priceCents} />
          </label>
          <label>
            <span>Quantity available</span>
            <FilteredInput
              name="quantityAvailable"
              filter="digits"
              inputMode="numeric"
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
            <FilteredInput
              name="portionSize"
              filter="noLetters"
              inputMode="decimal"
              maxLength={120}
              defaultValue={item.portion_size ?? ""}
            />
            <FieldError error={fieldErrors.portionSize} />
          </label>
          <label>
            <span>Serves</span>
            <FilteredInput
              name="portionServes"
              filter="digits"
              inputMode="numeric"
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
        <div className="form-field">
          <span>Current photos</span>
          {item.image_urls.length > 0 ? (
            <div className="menu-photo-manager">
              {item.image_urls.map((path, index) => {
                const photoName = item.image_names?.[index] || photoNameFromPath(path, index);
                const signedUrl = item.signed_image_urls[index] ?? "";
                const isMarkedForRemoval = photosMarkedForRemoval.has(path);

                return (
                  <div
                    className={`menu-photo-manager__row${
                      isMarkedForRemoval ? " is-marked-for-removal" : ""
                    }`}
                    key={path}
                  >
                    <span className="menu-photo-manager__name" title={photoName}>
                      {photoName}
                    </span>
                    <div className="menu-photo-manager__actions">
                      <button
                        className="secondary-action compact-action menu-photo-manager__view"
                        disabled={!signedUrl}
                        onClick={() => setPreviewPhoto({ name: photoName, signedUrl })}
                        type="button"
                      >
                        View
                      </button>
                      <label className="menu-photo-manager__delete" title={`Remove ${photoName}`}>
                        <input
                          checked={isMarkedForRemoval}
                          name="removeImageUrls"
                          onChange={(event) => togglePhotoRemoval(path, event.target.checked)}
                          type="checkbox"
                          value={path}
                        />
                        <span aria-hidden="true">🗑</span>
                        <span className="sr-only">Remove {photoName}</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="next-muted">No saved photos found. Add at least one photo below.</p>
          )}
          <small>Photos marked with the delete icon are removed when you save changes.</small>
        </div>
        <label>
          <span>Add replacement photos</span>
          <input accept="image/jpeg,image/png,image/webp" multiple name="images" type="file" />
          <small>
            Optional. Add enough photos to keep this item between 1 and 3 total photos. Maximum 2 MB
            each.
          </small>
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
      <dialog
        aria-labelledby={`menu-photo-preview-title-${item.id}`}
        className="menu-item-dialog menu-photo-preview-dialog"
        onCancel={closePreview}
        ref={dialogRef}
      >
        {previewPhoto ? (
          <div className="menu-dialog__content menu-photo-preview-dialog__content">
            <div className="modal-heading">
              <h2 id={`menu-photo-preview-title-${item.id}`}>{previewPhoto.name}</h2>
              <button
                aria-label="Close photo preview"
                className="modal-close"
                onClick={closePreview}
                type="button"
              >
                ×
              </button>
            </div>
            <Image
              alt={`${item.name} preview: ${previewPhoto.name}`}
              className="menu-photo-preview-dialog__image"
              height={720}
              src={previewPhoto.signedUrl}
              width={960}
            />
          </div>
        ) : null}
      </dialog>
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
