"use client";

import Image from "next/image";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  addCartItem,
  CART_STORAGE_KEY,
  getSubtotalCents,
  normalizeCartEntries,
  removeCartItem,
  setCartQuantity,
  type CartEntry,
} from "@/features/cart/cart-utils";
import { createCheckoutOrderAction, type CheckoutActionState } from "@/features/checkout/actions";
import {
  emptyMenuFilters,
  itemMatchesFilters,
  uniqueSorted,
  type MenuFilters,
} from "@/features/menu/menu-filters";
import { formatCurrency } from "@/lib/utils/format";
import type { CustomerMenuItemView } from "@/features/menu/menu-data";

type Props = {
  items: CustomerMenuItemView[];
  error: string | null;
};

function arrayText(values: string[]): string {
  return values.filter(Boolean).join(", ");
}

const initialCheckoutState: CheckoutActionState = {
  ok: false,
  message: "",
};

export function MenuBrowser({ items, error }: Props) {
  const [filters, setFilters] = useState<MenuFilters>(emptyMenuFilters);
  const [cart, setCart] = useState<CartEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return normalizeCartEntries(
        JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]"),
      );
    } catch {
      return [];
    }
  });
  const [selectedItem, setSelectedItem] = useState<CustomerMenuItemView | null>(null);
  const [selectedCook, setSelectedCook] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [checkoutState, checkoutAction] = useActionState(
    async (state: CheckoutActionState, formData: FormData) => {
      const result = await createCheckoutOrderAction(state, formData);
      if (result.ok) {
        setCart([]);
        window.localStorage.removeItem(CART_STORAGE_KEY);
      }
      return result;
    },
    initialCheckoutState,
  );

  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const validCart = useMemo(() => normalizeCartEntries(cart, itemsById), [cart, itemsById]);
  const visibleItems = useMemo(
    () => items.filter((item) => itemMatchesFilters(item, filters)),
    [items, filters],
  );
  const selectedCookItem = useMemo(
    () => items.find((item) => item.cook_id === selectedCook) ?? null,
    [items, selectedCook],
  );

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(validCart));
  }, [validCart]);

  useEffect(() => {
    if (!dialogRef.current) return;
    if (selectedItem || selectedCookItem) dialogRef.current.showModal();
    else dialogRef.current.close();
  }, [selectedItem, selectedCookItem]);

  const categories = uniqueSorted(items.map((item) => item.category));
  const dietaryTags = uniqueSorted(items.flatMap((item) => item.dietary_tags));
  const allergens = uniqueSorted(items.flatMap((item) => item.allergens));
  const cuisines = uniqueSorted(items.map((item) => item.cook_cuisine_type ?? ""));
  const spices = uniqueSorted(items.map((item) => item.spice_level ?? ""));
  const cooks = uniqueSorted(items.map((item) => `${item.cook_display_name}::${item.cook_id}`));

  const updateFilter = <K extends keyof MenuFilters>(key: K, value: MenuFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const closeDialog = () => {
    setSelectedItem(null);
    setSelectedCook(null);
  };

  const subtotal = getSubtotalCents(validCart, itemsById);

  return (
    <section className="customer-menu-shell" aria-label="Available menu items">
      <aside className="filter-panel" aria-labelledby="menu-filter-title">
        <div className="filter-panel__heading">
          <h2 id="menu-filter-title">Search and filters</h2>
          <button
            className="text-button"
            type="button"
            onClick={() => setFilters(emptyMenuFilters)}
          >
            Reset
          </button>
        </div>
        <label className="form-field">
          <span>Search menu</span>
          <input
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            type="search"
            placeholder="Dish, cook, cuisine, ingredient"
          />
        </label>
        <FilterSelect
          label="Category"
          value={filters.category}
          options={categories}
          onChange={(value) => updateFilter("category", value)}
        />
        <FilterSelect
          label="Dietary tag"
          value={filters.dietary}
          options={dietaryTags}
          onChange={(value) => updateFilter("dietary", value)}
        />
        <FilterSelect
          label="Exclude allergen"
          value={filters.allergen}
          options={allergens}
          onChange={(value) => updateFilter("allergen", value)}
        />
        <FilterSelect
          label="Cuisine"
          value={filters.cuisine}
          options={cuisines}
          onChange={(value) => updateFilter("cuisine", value)}
        />
        <FilterSelect
          label="Spice level"
          value={filters.spice}
          options={spices}
          onChange={(value) => updateFilter("spice", value)}
        />
        <label className="form-field">
          <span>Cook</span>
          <select
            value={filters.cook}
            onChange={(event) => updateFilter("cook", event.target.value)}
          >
            <option value="">All cooks</option>
            {cooks.map((cook) => {
              const [name, id] = cook.split("::");
              return (
                <option key={id} value={id}>
                  {name}
                </option>
              );
            })}
          </select>
        </label>
        <label className="form-field">
          <span>Minimum available quantity</span>
          <input
            type="number"
            min={1}
            max={10}
            step={1}
            value={filters.minQuantity}
            onChange={(event) => updateFilter("minQuantity", Number(event.target.value))}
          />
        </label>
      </aside>

      <div className="menu-results-panel">
        <div className="menu-results-toolbar" aria-live="polite">
          <p>
            {error
              ? error
              : `${visibleItems.length} available item${visibleItems.length === 1 ? "" : "s"} shown.`}
          </p>
        </div>
        <div className="menu-list">
          {visibleItems.length === 0 ? (
            <p className="empty-state">
              {items.length === 0
                ? "No menu items are available right now. Please check back soon."
                : "No menu items match these filters."}
            </p>
          ) : (
            visibleItems.map((item) => (
              <article className="menu-item" key={item.id}>
                {item.signed_image_url ? (
                  <Image src={item.signed_image_url} width={360} height={280} alt={item.name} />
                ) : (
                  <div className="menu-item__image-fallback">No image</div>
                )}
                <div className="menu-item__body">
                  <span className="status-pill">{item.quantity_available} available</span>
                  <h2>{item.name}</h2>
                  <p className="menu-item__cook-line">
                    By{" "}
                    <button
                      className="text-button menu-cook-button"
                      type="button"
                      onClick={() => setSelectedCook(item.cook_id)}
                    >
                      {item.cook_display_name}
                    </button>
                  </p>
                  <div className="menu-attribute-tags">
                    {[item.category, ...item.dietary_tags, item.spice_level]
                      .filter(Boolean)
                      .slice(0, 8)
                      .map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                  </div>
                  <p>{item.description}</p>
                  <strong className="menu-item__price">{formatCurrency(item.price_cents)}</strong>
                  <div className="menu-item__actions">
                    <button
                      className="secondary-action compact-action"
                      type="button"
                      onClick={() => setSelectedItem(item)}
                    >
                      View details
                    </button>
                    <button
                      className="primary-action compact-action"
                      type="button"
                      onClick={() => setCart((current) => addCartItem(current, item))}
                    >
                      Add to cart
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      <aside className="cart-panel" aria-labelledby="cart-title">
        <div className="cart-panel__heading">
          <h2 id="cart-title">Cart</h2>
          {validCart.length > 0 ? (
            <button className="text-button" type="button" onClick={() => setCart([])}>
              Clear
            </button>
          ) : null}
        </div>
        <p className="cart-panel__note">
          Checkout must revalidate price, stock, cook status, and totals server-side.
        </p>
        <div className="cart-list">
          {validCart.length === 0 ? (
            <p className="empty-state">Your cart is empty.</p>
          ) : (
            validCart.map((entry) => {
              const item = itemsById.get(entry.id);
              if (!item) return null;
              return (
                <article className="cart-item" key={entry.id}>
                  <h3>{item.name}</h3>
                  <p>
                    {item.cook_display_name} · {formatCurrency(item.price_cents)}
                  </p>
                  <div className="cart-item__quantity">
                    <button
                      type="button"
                      className="quantity-button"
                      aria-label={`Decrease ${item.name} quantity`}
                      onClick={() =>
                        setCart((current) => setCartQuantity(current, item, entry.quantity - 1))
                      }
                    >
                      −
                    </button>
                    <input
                      aria-label={`Quantity for ${item.name}`}
                      type="number"
                      min={1}
                      max={Math.min(item.quantity_available, 10)}
                      step={1}
                      value={entry.quantity}
                      onChange={(event) =>
                        setCart((current) => setCartQuantity(current, item, event.target.value))
                      }
                    />
                    <button
                      type="button"
                      className="quantity-button"
                      aria-label={`Increase ${item.name} quantity`}
                      onClick={() =>
                        setCart((current) => setCartQuantity(current, item, entry.quantity + 1))
                      }
                    >
                      +
                    </button>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => setCart((current) => removeCartItem(current, entry.id))}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
        <div className="cart-summary" aria-live="polite">
          <p>Subtotal: {formatCurrency(subtotal)}</p>
          <form action={checkoutAction} className="checkout-form">
            <input type="hidden" name="cart" value={JSON.stringify(validCart)} />
            <CheckoutButton disabled={validCart.length === 0} />
          </form>
          {checkoutState.message ? (
            <p className={checkoutState.ok ? "next-success" : "next-alert"} role="status">
              {checkoutState.message}
              {checkoutState.ok && checkoutState.orderId
                ? ` Order ${checkoutState.orderId.slice(0, 8)} was created for ${formatCurrency(
                    checkoutState.subtotalCents ?? 0,
                  )}.`
                : ""}
            </p>
          ) : null}
        </div>
      </aside>

      <dialog className="menu-item-dialog" ref={dialogRef} onCancel={closeDialog}>
        {selectedItem ? (
          <ItemDialog
            item={selectedItem}
            onClose={closeDialog}
            onCook={() => setSelectedCook(selectedItem.cook_id)}
          />
        ) : null}
        {!selectedItem && selectedCookItem ? (
          <CookDialog item={selectedCookItem} onClose={closeDialog} />
        ) : null}
      </dialog>
    </section>
  );
}

function CheckoutButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="primary-action compact-action" type="submit" disabled={disabled || pending}>
      {pending ? "Checking out…" : "Checkout securely"}
    </button>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Any</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ItemDialog({
  item,
  onClose,
  onCook,
}: {
  item: CustomerMenuItemView;
  onClose: () => void;
  onCook: () => void;
}) {
  return (
    <div className="menu-dialog__content">
      <div className="modal-heading">
        <h2>{item.name}</h2>
        <button
          className="modal-close"
          type="button"
          aria-label="Close item details"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {item.signed_image_url ? (
        <Image
          className="menu-dialog__image"
          src={item.signed_image_url}
          width={720}
          height={460}
          alt={item.name}
        />
      ) : null}
      <p>{item.description}</p>
      <dl className="menu-item-details">
        <Detail label="Price" value={formatCurrency(item.price_cents)} />
        <Detail label="Available" value={`${item.quantity_available} left`} />
        <Detail label="Cook" value={item.cook_display_name} />
        <Detail label="Category" value={item.category} />
        <Detail label="Dietary tags" value={arrayText(item.dietary_tags)} />
        <Detail label="Main ingredients" value={arrayText(item.main_ingredients)} />
        <Detail label="Allergens" value={arrayText(item.allergens)} />
        <Detail label="Portion" value={item.portion_size ?? ""} />
        <Detail label="Serves" value={item.portion_serves ? `${item.portion_serves}` : ""} />
        <Detail label="Spice" value={item.spice_level ?? ""} />
        <Detail label="Pickup note" value={item.pickup_window_note ?? ""} />
      </dl>
      <button className="secondary-action compact-action" type="button" onClick={onCook}>
        View cook profile
      </button>
    </div>
  );
}

function CookDialog({ item, onClose }: { item: CustomerMenuItemView; onClose: () => void }) {
  return (
    <div className="menu-dialog__content">
      <div className="modal-heading">
        <h2>{item.cook_display_name}</h2>
        <button
          className="modal-close"
          type="button"
          aria-label="Close cook profile"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {item.signed_cook_profile_image_url ? (
        <Image
          className="menu-dialog__avatar"
          src={item.signed_cook_profile_image_url}
          width={160}
          height={160}
          alt={item.cook_display_name}
        />
      ) : null}
      <p>{item.cook_description ?? "This cook has not added a public description yet."}</p>
      <dl className="menu-item-details">
        <Detail label="Cuisine" value={item.cook_cuisine_type ?? ""} />
        <Detail
          label="Rating"
          value={
            item.cook_review_count
              ? `${item.cook_rating} (${item.cook_review_count} reviews)`
              : "Not rated yet"
          }
        />
        <Detail label="Public menu items" value={`${item.cook_public_menu_count}`} />
        <Detail label="Pickup or order notes" value={item.cook_order_notes ?? ""} />
      </dl>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
