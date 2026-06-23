(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }

  root.LocalCoKitchenMenu = api;
  api.init(root);
})(typeof window !== "undefined" ? window : globalThis, function () {
  const CART_STORAGE_KEY = "localcokitchen.cart.v1";
  const CART_ITEM_LIMIT = 10;
  const PAGE_SIZE = 48;
  const SIGNED_URL_SECONDS = 3600;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const normalizeText = (value) =>
    String(value || "")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const isUuid = (value) => UUID_RE.test(String(value || ""));

  const asArray = (value) => (Array.isArray(value) ? value.filter((item) => String(item || "").trim()) : []);

  const asPositiveInteger = (value, fallback = 1) => {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) return fallback;
    return parsed;
  };

  const getMaxCartQuantity = (item) => {
    const available = asPositiveInteger(item?.quantity_available, 0);
    return Math.max(0, Math.min(available, CART_ITEM_LIMIT));
  };

  const clampCartQuantity = (value, item) => {
    const max = getMaxCartQuantity(item);
    if (max <= 0) return 0;
    const integer = asPositiveInteger(value, 1);
    return Math.max(1, Math.min(integer, max));
  };

  const isCustomerVisibleItem = (item) =>
    Boolean(
      item &&
        isUuid(item.id) &&
        isUuid(item.cook_id) &&
        item.is_active !== false &&
        item.is_sold_out !== true &&
        asPositiveInteger(item.quantity_available, 0) > 0,
    );

  const normalizeCartEntries = (value, itemsById = new Map()) => {
    const rows = Array.isArray(value) ? value : [];
    const normalized = [];
    const seen = new Set();

    rows.forEach((row) => {
      const id = String(row?.id || "").trim();
      if (!isUuid(id) || seen.has(id)) return;

      const item = itemsById.get(id);
      if (itemsById.size && !isCustomerVisibleItem(item)) return;

      const quantity = item
        ? clampCartQuantity(row?.quantity, item)
        : Math.max(1, Math.min(asPositiveInteger(row?.quantity, 1), CART_ITEM_LIMIT));

      if (quantity > 0) {
        seen.add(id);
        normalized.push({ id, quantity });
      }
    });

    return normalized;
  };

  const parseStoredCart = (storage) => {
    try {
      const parsed = JSON.parse(storage?.getItem(CART_STORAGE_KEY) || "[]");
      return normalizeCartEntries(parsed);
    } catch (_error) {
      return [];
    }
  };

  const writeStoredCart = (storage, cart) => {
    try {
      storage?.setItem(CART_STORAGE_KEY, JSON.stringify(normalizeCartEntries(cart)));
    } catch (_error) {
      // Storage can fail in private browsing or strict privacy modes. The in-memory
      // cart still works for the current page session.
    }
  };

  const formatCurrency = (priceCents) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Math.max(0, asPositiveInteger(priceCents, 0)) / 100);

  const getCartSubtotalCents = (cart, itemsById) =>
    normalizeCartEntries(cart, itemsById).reduce((total, row) => {
      const item = itemsById.get(row.id);
      return total + asPositiveInteger(item?.price_cents, 0) * row.quantity;
    }, 0);

  const itemMatchesFilters = (item, filters) => {
    const search = normalizeText(filters.search);
    const haystack = normalizeText(
      [
        item.name,
        item.description,
        item.category,
        item.cook_display_name,
        item.cook_cuisine_type,
        ...asArray(item.dietary_tags),
        ...asArray(item.main_ingredients),
      ].join(" "),
    );

    if (search && !search.split(" ").every((term) => haystack.includes(term))) return false;
    if (filters.category && normalizeText(item.category) !== normalizeText(filters.category)) return false;
    if (filters.dietary && !asArray(item.dietary_tags).map(normalizeText).includes(normalizeText(filters.dietary))) return false;
    if (filters.allergen && asArray(item.allergens).map(normalizeText).includes(normalizeText(filters.allergen))) return false;
    if (filters.cuisine && normalizeText(item.cook_cuisine_type) !== normalizeText(filters.cuisine)) return false;
    if (filters.spice && normalizeText(item.spice_level) !== normalizeText(filters.spice)) return false;
    if (filters.cook && item.cook_id !== filters.cook) return false;
    if (asPositiveInteger(item.quantity_available, 0) < asPositiveInteger(filters.minQuantity, 1)) return false;
    return true;
  };

  const addOrUpdateCartItem = (cart, item, requestedQuantity) => {
    if (!isCustomerVisibleItem(item)) return normalizeCartEntries(cart);

    const rows = normalizeCartEntries(cart);
    const existing = rows.find((row) => row.id === item.id);
    const nextQuantity = existing
      ? existing.quantity + asPositiveInteger(requestedQuantity, 1)
      : asPositiveInteger(requestedQuantity, 1);
    const clamped = clampCartQuantity(nextQuantity, item);

    if (existing) {
      existing.quantity = clamped;
      return rows;
    }

    rows.push({ id: item.id, quantity: clamped });
    return rows;
  };

  const setCartItemQuantity = (cart, item, requestedQuantity) => {
    if (!isCustomerVisibleItem(item)) return normalizeCartEntries(cart);
    if (!Number.isSafeInteger(Number(requestedQuantity)) || Number(requestedQuantity) < 1) {
      return normalizeCartEntries(cart).filter((row) => row.id !== item.id);
    }
    const quantity = clampCartQuantity(requestedQuantity, item);
    const rows = normalizeCartEntries(cart).filter((row) => row.id !== item.id);
    if (quantity > 0) rows.push({ id: item.id, quantity });
    return rows;
  };

  const removeCartItem = (cart, itemId) => normalizeCartEntries(cart).filter((row) => row.id !== itemId);

  const createEl = (documentRef, tag, className, text) => {
    const element = documentRef.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  };

  const clearChildren = (element) => {
    while (element?.firstChild) element.firstChild.remove();
  };

  const appendDetail = (documentRef, list, label, value) => {
    const text = Array.isArray(value) ? value.filter(Boolean).join(", ") : String(value || "").trim();
    if (!text) return;

    const row = documentRef.createElement("div");
    row.append(createEl(documentRef, "dt", "", label), createEl(documentRef, "dd", "", text));
    list.append(row);
  };

  const appendTagRow = (documentRef, parent, tags) => {
    const tagRow = createEl(documentRef, "div", "menu-attribute-tags");
    asArray(tags)
      .slice(0, 10)
      .forEach((tag) => tagRow.append(createEl(documentRef, "span", "", tag)));
    if (tagRow.childElementCount) parent.append(tagRow);
  };

  const getStoragePath = (value, bucketName) => {
    const source = String(value || "").trim();
    if (!source) return "";
    if (!source.includes("://")) return source.replace(/^\/+/, "");
    const marker = `/storage/v1/object/public/${bucketName}/`;
    const markerIndex = source.indexOf(marker);
    return markerIndex === -1
      ? ""
      : decodeURIComponent(source.slice(markerIndex + marker.length).split("?")[0]);
  };

  const buildRpcArgs = (state) => ({
    p_search: normalizeText(state.search) || null,
    p_categories: state.filters.category ? [state.filters.category] : [],
    p_dietary_tags: state.filters.dietary ? [state.filters.dietary] : [],
    p_excluded_allergens: state.filters.allergen ? [state.filters.allergen] : [],
    p_cuisine_types: state.filters.cuisine ? [state.filters.cuisine] : [],
    p_spice_levels: state.filters.spice ? [state.filters.spice] : [],
    p_cook_ids: isUuid(state.filters.cook) ? [state.filters.cook] : [],
    p_item_ids: [],
    p_min_quantity: asPositiveInteger(state.filters.minQuantity, 1),
    p_limit: PAGE_SIZE,
    p_offset: state.offset,
  });

  const getSelectValue = (documentRef, selector) => documentRef.querySelector(selector)?.value || "";

  const readFilters = (documentRef) => ({
    category: getSelectValue(documentRef, '[data-menu-filter="category"]'),
    dietary: getSelectValue(documentRef, '[data-menu-filter="dietary"]'),
    allergen: getSelectValue(documentRef, '[data-menu-filter="allergen"]'),
    cuisine: getSelectValue(documentRef, '[data-menu-filter="cuisine"]'),
    spice: getSelectValue(documentRef, '[data-menu-filter="spice"]'),
    cook: getSelectValue(documentRef, '[data-menu-filter="cook"]'),
    minQuantity: asPositiveInteger(documentRef.querySelector("[data-menu-min-quantity]")?.value, 1),
  });

  const uniqueSorted = (values) =>
    [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );

  const replaceOptions = (select, options, placeholder, selectedValue) => {
    if (!select) return;
    clearChildren(select);
    const placeholderOption = select.ownerDocument.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = placeholder;
    select.append(placeholderOption);

    options.forEach((option) => {
      const element = select.ownerDocument.createElement("option");
      element.value = option.value;
      element.textContent = option.label;
      select.append(element);
    });

    select.value = options.some((option) => option.value === selectedValue) ? selectedValue : "";
  };

  const updateFilterOptions = (documentRef, items, filters) => {
    replaceOptions(
      documentRef.querySelector('[data-menu-filter="category"]'),
      uniqueSorted(items.map((item) => item.category)).map((value) => ({ value, label: value })),
      "All categories",
      filters.category,
    );
    replaceOptions(
      documentRef.querySelector('[data-menu-filter="dietary"]'),
      uniqueSorted(items.flatMap((item) => asArray(item.dietary_tags))).map((value) => ({ value, label: value })),
      "Any dietary tag",
      filters.dietary,
    );
    replaceOptions(
      documentRef.querySelector('[data-menu-filter="allergen"]'),
      uniqueSorted(items.flatMap((item) => asArray(item.allergens))).map((value) => ({ value, label: value })),
      "No allergen filter",
      filters.allergen,
    );
    replaceOptions(
      documentRef.querySelector('[data-menu-filter="cuisine"]'),
      uniqueSorted(items.map((item) => item.cook_cuisine_type)).map((value) => ({ value, label: value })),
      "All cuisines",
      filters.cuisine,
    );
    replaceOptions(
      documentRef.querySelector('[data-menu-filter="spice"]'),
      uniqueSorted(items.map((item) => item.spice_level)).map((value) => ({ value, label: value })),
      "Any spice level",
      filters.spice,
    );
    replaceOptions(
      documentRef.querySelector('[data-menu-filter="cook"]'),
      items
        .filter((item) => isUuid(item.cook_id))
        .map((item) => ({ value: item.cook_id, label: item.cook_display_name || "Local cook" }))
        .filter((option, index, list) => list.findIndex((candidate) => candidate.value === option.value) === index)
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" })),
      "All cooks",
      filters.cook,
    );
  };

  const hydrateImages = async (client, items, imageCache) => {
    await Promise.all(
      items.flatMap((item) => [
        hydrateImage(client, imageCache, "cook-menu-images", item.image_url),
        hydrateImage(client, imageCache, "cook-profile-images", item.cook_profile_image_url),
      ]),
    );
  };

  const hydrateImage = async (client, imageCache, bucketName, value) => {
    const path = getStoragePath(value, bucketName);
    if (!path || imageCache.has(`${bucketName}:${path}`)) return;

    try {
      const { data, error } = await client.storage.from(bucketName).createSignedUrl(path, SIGNED_URL_SECONDS);
      imageCache.set(`${bucketName}:${path}`, error ? "" : data?.signedUrl || "");
    } catch (_error) {
      imageCache.set(`${bucketName}:${path}`, "");
    }
  };

  const readImageUrl = (imageCache, bucketName, value) => {
    const path = getStoragePath(value, bucketName);
    return path ? imageCache.get(`${bucketName}:${path}`) || "" : "";
  };

  const renderMenuItem = (documentRef, item, state, actions) => {
    const article = createEl(documentRef, "article", "menu-item");
    article.dataset.itemId = item.id;

    const imageUrl = readImageUrl(state.imageCache, "cook-menu-images", item.image_url);
    if (imageUrl) {
      const image = documentRef.createElement("img");
      image.src = imageUrl;
      image.alt = item.name || "Menu item";
      image.loading = "lazy";
      image.width = 360;
      image.height = 280;
      image.addEventListener("error", () => {
        image.hidden = true;
      });
      article.append(image);
    } else {
      article.append(createEl(documentRef, "div", "menu-item__image-fallback", "No image"));
    }

    const body = createEl(documentRef, "div", "menu-item__body");
    body.append(createEl(documentRef, "span", "status-pill", `${item.quantity_available} available`));
    body.append(createEl(documentRef, "h2", "", item.name || "Menu item"));
    body.append(createEl(documentRef, "p", "menu-item__cook-line", "By "));
    const cookButton = createEl(documentRef, "button", "text-button menu-cook-button", item.cook_display_name || "Local cook");
    cookButton.type = "button";
    cookButton.addEventListener("click", () => actions.openCook(item.cook_id, cookButton));
    body.querySelector(".menu-item__cook-line").append(cookButton);

    appendTagRow(documentRef, body, [
      item.category,
      ...asArray(item.dietary_tags),
      item.spice_level,
    ]);

    const description = createEl(documentRef, "p", "", item.description || "");
    body.append(description);
    body.append(createEl(documentRef, "strong", "menu-item__price", formatCurrency(item.price_cents)));

    const controls = createEl(documentRef, "div", "menu-item__actions");
    const details = createEl(documentRef, "button", "secondary-action compact-action", "View details");
    details.type = "button";
    details.addEventListener("click", () => actions.openItem(item.id, details));

    const add = createEl(documentRef, "button", "primary-action compact-action", "Add to cart");
    add.type = "button";
    add.disabled = getMaxCartQuantity(item) <= 0;
    add.addEventListener("click", () => actions.addToCart(item.id));
    controls.append(details, add);
    body.append(controls);

    article.append(body);
    return article;
  };

  const renderList = (documentRef, state, actions) => {
    clearChildren(state.elements.container);
    const visibleItems = state.items.filter((item) => itemMatchesFilters(item, { search: "", ...state.filters }));

    if (!visibleItems.length) {
      const empty = createEl(
        documentRef,
        "div",
        "empty-state",
        state.items.length
          ? "No menu items match these filters. Clear filters or try a broader search."
          : "No menu items are available right now. Please check back soon.",
      );
      state.elements.container.append(empty);
      return;
    }

    const fragment = documentRef.createDocumentFragment();
    visibleItems.forEach((item) => fragment.append(renderMenuItem(documentRef, item, state, actions)));
    state.elements.container.append(fragment);
  };

  const renderCart = (documentRef, state, actions) => {
    const list = state.elements.cartItems;
    const summary = state.elements.cartSummary;
    clearChildren(list);
    clearChildren(summary);

    const normalized = normalizeCartEntries(state.cart, state.itemsById);
    state.cart = normalized;
    writeStoredCart(state.storage, state.cart);

    if (!normalized.length) {
      list.append(createEl(documentRef, "p", "empty-state", "Your cart is empty."));
      state.elements.clearCart.hidden = true;
      summary.append(createEl(documentRef, "p", "", "Subtotal: $0.00"));
      return;
    }

    state.elements.clearCart.hidden = false;
    normalized.forEach((row) => {
      const item = state.itemsById.get(row.id);
      if (!item) return;

      const card = createEl(documentRef, "article", "cart-item");
      card.append(createEl(documentRef, "h3", "", item.name || "Menu item"));
      card.append(createEl(documentRef, "p", "", `${item.cook_display_name || "Local cook"} · ${formatCurrency(item.price_cents)}`));

      const quantityGroup = createEl(documentRef, "div", "cart-item__quantity");
      const decrement = createEl(documentRef, "button", "quantity-button", "−");
      decrement.type = "button";
      decrement.setAttribute("aria-label", `Decrease ${item.name || "item"} quantity`);
      decrement.addEventListener("click", () => actions.setQuantity(item.id, row.quantity - 1));

      const input = documentRef.createElement("input");
      input.type = "number";
      input.min = "1";
      input.max = String(getMaxCartQuantity(item));
      input.step = "1";
      input.value = String(row.quantity);
      input.setAttribute("aria-label", `Quantity for ${item.name || "item"}`);
      input.addEventListener("change", () => actions.setQuantity(item.id, input.value));

      const increment = createEl(documentRef, "button", "quantity-button", "+");
      increment.type = "button";
      increment.setAttribute("aria-label", `Increase ${item.name || "item"} quantity`);
      increment.disabled = row.quantity >= getMaxCartQuantity(item);
      increment.addEventListener("click", () => actions.setQuantity(item.id, row.quantity + 1));

      const remove = createEl(documentRef, "button", "text-button", "Remove");
      remove.type = "button";
      remove.addEventListener("click", () => actions.removeFromCart(item.id));

      quantityGroup.append(decrement, input, increment, remove);
      card.append(quantityGroup);
      list.append(card);
    });

    summary.append(createEl(documentRef, "p", "", `Subtotal: ${formatCurrency(getCartSubtotalCents(state.cart, state.itemsById))}`));
    summary.append(createEl(documentRef, "p", "cart-summary__warning", "Final checkout totals must be verified by the server."));
  };

  const createDialog = (documentRef, id, className, labelledBy) => {
    let dialog = documentRef.getElementById(id);
    if (dialog) return dialog;

    dialog = documentRef.createElement("dialog");
    dialog.id = id;
    dialog.className = className;
    dialog.setAttribute("aria-labelledby", labelledBy);
    documentRef.body.append(dialog);
    return dialog;
  };

  const openDialog = (dialog, opener) => {
    dialog.dataset.openerWas = opener ? "true" : "false";
    dialog.__lckOpener = opener || null;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "open");
    const firstClose = dialog.querySelector("[data-dialog-close]");
    if (firstClose) firstClose.focus();
  };

  const closeDialog = (dialog) => {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    if (dialog.__lckOpener && typeof dialog.__lckOpener.focus === "function") {
      dialog.__lckOpener.focus();
    }
  };

  const renderDialogShell = (documentRef, dialog, titleId, title) => {
    clearChildren(dialog);
    const wrapper = createEl(documentRef, "div", "menu-dialog__content");
    const heading = createEl(documentRef, "div", "modal-heading");
    heading.append(createEl(documentRef, "h2", "", title));
    heading.querySelector("h2").id = titleId;
    const close = createEl(documentRef, "button", "modal-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close dialog");
    close.dataset.dialogClose = "true";
    close.addEventListener("click", () => closeDialog(dialog));
    heading.append(close);
    wrapper.append(heading);
    dialog.append(wrapper);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeDialog(dialog);
    }, { once: true });
    return wrapper;
  };

  const openItemDetails = (documentRef, state, itemId, opener) => {
    const item = state.itemsById.get(itemId);
    if (!item) return;

    const dialog = createDialog(documentRef, "menu-item-detail-dialog", "menu-item-dialog", "menu-item-detail-title");
    const wrapper = renderDialogShell(documentRef, dialog, "menu-item-detail-title", item.name || "Menu item details");

    const imageUrl = readImageUrl(state.imageCache, "cook-menu-images", item.image_url);
    if (imageUrl) {
      const image = documentRef.createElement("img");
      image.className = "menu-dialog__image";
      image.src = imageUrl;
      image.alt = item.name || "Menu item";
      image.width = 720;
      image.height = 460;
      wrapper.append(image);
    }

    wrapper.append(createEl(documentRef, "p", "", item.description || ""));
    appendTagRow(documentRef, wrapper, [item.category, ...asArray(item.dietary_tags), item.spice_level]);

    const details = createEl(documentRef, "dl", "menu-item-details");
    appendDetail(documentRef, details, "Price", formatCurrency(item.price_cents));
    appendDetail(documentRef, details, "Available", `${item.quantity_available} left`);
    appendDetail(documentRef, details, "Cook", item.cook_display_name);
    appendDetail(documentRef, details, "Rating", item.cook_review_count ? `${item.cook_rating || 0} (${item.cook_review_count} reviews)` : "Not rated yet");
    appendDetail(documentRef, details, "Category", item.category);
    appendDetail(documentRef, details, "Main ingredients", item.main_ingredients);
    appendDetail(documentRef, details, "Allergens", item.allergens);
    appendDetail(documentRef, details, "Portion size", item.portion_size);
    appendDetail(documentRef, details, "Serves", item.portion_serves ? `${item.portion_serves} people` : "");
    appendDetail(documentRef, details, "Spice level", item.spice_level);
    appendDetail(documentRef, details, "Pickup note", item.pickup_window_note);
    appendDetail(documentRef, details, "Cook note", item.cook_order_notes);
    wrapper.append(details);

    const actions = createEl(documentRef, "div", "menu-item__actions");
    const cook = createEl(documentRef, "button", "secondary-action compact-action", "View cook profile");
    cook.type = "button";
    cook.addEventListener("click", () => {
      closeDialog(dialog);
      openCookProfile(documentRef, state, item.cook_id, opener);
    });
    const add = createEl(documentRef, "button", "primary-action compact-action", "Add to cart");
    add.type = "button";
    add.addEventListener("click", () => {
      state.actions.addToCart(item.id);
      closeDialog(dialog);
    });
    actions.append(cook, add);
    wrapper.append(actions);
    openDialog(dialog, opener);
  };

  const openCookProfile = (documentRef, state, cookId, opener) => {
    if (!isUuid(cookId)) return;
    const item = state.items.find((candidate) => candidate.cook_id === cookId);
    if (!item) return;

    const dialog = createDialog(documentRef, "cook-profile-dialog", "menu-item-dialog", "cook-profile-title");
    const wrapper = renderDialogShell(documentRef, dialog, "cook-profile-title", item.cook_display_name || "Cook profile");

    const imageUrl = readImageUrl(state.imageCache, "cook-profile-images", item.cook_profile_image_url);
    if (imageUrl) {
      const image = documentRef.createElement("img");
      image.className = "menu-dialog__avatar";
      image.src = imageUrl;
      image.alt = item.cook_display_name || "Cook profile";
      image.width = 160;
      image.height = 160;
      wrapper.append(image);
    }

    wrapper.append(createEl(documentRef, "p", "", item.cook_description || "This cook has not added a public description yet."));

    const details = createEl(documentRef, "dl", "menu-item-details");
    appendDetail(documentRef, details, "Cuisine", item.cook_cuisine_type);
    appendDetail(documentRef, details, "Rating", item.cook_review_count ? `${item.cook_rating || 0} (${item.cook_review_count} reviews)` : "Not rated yet");
    appendDetail(documentRef, details, "Public menu items", item.cook_public_menu_count);
    appendDetail(documentRef, details, "Pickup or order notes", item.cook_order_notes);
    wrapper.append(details);

    openDialog(dialog, opener);
  };

  const setStatus = (state, message) => {
    if (state.elements.status) state.elements.status.textContent = message;
  };

  const validateItems = (items) => items.filter(isCustomerVisibleItem);

  const fetchItems = async (state, append = false) => {
    const requestId = ++state.requestId;
    state.loading = true;
    setStatus(state, append ? "Loading more items..." : "Loading available items...");
    if (!append) state.offset = 0;

    const { data, error } = await state.marketplaceDb.rpc("get_customer_menu_items", buildRpcArgs(state));
    if (requestId !== state.requestId) return;
    state.loading = false;

    if (error) {
      setStatus(state, "Available items could not be loaded. Please try again later.");
      if (!append) {
        state.items = [];
        state.itemsById = new Map();
        renderList(state.document, state, state.actions);
      }
      return;
    }

    const nextItems = validateItems(data || []);
    await hydrateImages(state.client, nextItems, state.imageCache);

    const merged = append ? [...state.items, ...nextItems] : nextItems;
    state.items = merged.filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index);
    state.itemsById = new Map(state.items.map((item) => [item.id, item]));
    state.offset += nextItems.length;
    state.elements.loadMore.hidden = nextItems.length < PAGE_SIZE;
    updateFilterOptions(state.document, state.items, state.filters);
    setStatus(state, `${state.items.length} available item${state.items.length === 1 ? "" : "s"} shown.`);
    renderList(state.document, state, state.actions);
    await refreshCartItems(state);
    renderCart(state.document, state, state.actions);
  };

  const refreshCartItems = async (state) => {
    const missingIds = normalizeCartEntries(state.cart)
      .map((row) => row.id)
      .filter((id) => !state.itemsById.has(id));
    if (!missingIds.length) {
      state.cart = normalizeCartEntries(state.cart, state.itemsById);
      return;
    }

    try {
      const { data, error } = await state.marketplaceDb.rpc("get_customer_menu_items", {
        p_search: null,
        p_categories: [],
        p_dietary_tags: [],
        p_excluded_allergens: [],
        p_cuisine_types: [],
        p_spice_levels: [],
        p_cook_ids: [],
        p_item_ids: missingIds,
        p_min_quantity: 1,
        p_limit: Math.min(missingIds.length, PAGE_SIZE),
        p_offset: 0,
      });
      if (error) throw error;
      const items = validateItems(data || []);
      await hydrateImages(state.client, items, state.imageCache);
      items.forEach((item) => state.itemsById.set(item.id, item));
      state.cart = normalizeCartEntries(state.cart, state.itemsById);
    } catch (_error) {
      state.cart = normalizeCartEntries(state.cart, state.itemsById);
    }
  };

  const debounce = (callback, delay) => {
    let timer = 0;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => callback(...args), delay);
    };
  };

  const bindEvents = (windowRef, state) => {
    const documentRef = state.document;
    const refetch = () => {
      state.filters = readFilters(documentRef);
      fetchItems(state, false);
    };
    const debouncedSearch = debounce(() => {
      state.search = documentRef.querySelector("[data-menu-search]")?.value || "";
      fetchItems(state, false);
    }, 250);

    documentRef.querySelector("[data-menu-search]")?.addEventListener("input", debouncedSearch);
    documentRef.querySelectorAll("[data-menu-filter]").forEach((select) => select.addEventListener("change", refetch));
    documentRef.querySelector("[data-menu-min-quantity]")?.addEventListener("change", refetch);
    documentRef.querySelector("[data-menu-reset-filters]")?.addEventListener("click", () => {
      const search = documentRef.querySelector("[data-menu-search]");
      if (search) search.value = "";
      documentRef.querySelectorAll("[data-menu-filter]").forEach((select) => {
        select.value = "";
      });
      const minQuantity = documentRef.querySelector("[data-menu-min-quantity]");
      if (minQuantity) minQuantity.value = "1";
      state.search = "";
      state.filters = readFilters(documentRef);
      fetchItems(state, false);
    });
    state.elements.loadMore?.addEventListener("click", () => fetchItems(state, true));
    state.elements.clearCart?.addEventListener("click", () => {
      state.cart = [];
      writeStoredCart(state.storage, state.cart);
      renderCart(documentRef, state, state.actions);
    });
    windowRef.addEventListener("storage", (event) => {
      if (event.key !== CART_STORAGE_KEY) return;
      state.cart = parseStoredCart(state.storage);
      renderCart(documentRef, state, state.actions);
    });
  };

  const init = (windowRef) => {
    const documentRef = windowRef.document;
    const container = documentRef.querySelector("[data-public-menu-items]");
    if (!container) return null;

    const config = windowRef.LOCALCOKITCHEN_SUPABASE_CONFIG || {};
    const hasConfig =
      config.url &&
      config.publishableKey &&
      !config.url.includes("YOUR_PROJECT_REF") &&
      !config.publishableKey.includes("YOUR_SUPABASE");

    const elements = {
      container,
      status: documentRef.querySelector("[data-menu-status]"),
      loadMore: documentRef.querySelector("[data-menu-load-more]"),
      cartItems: documentRef.querySelector("[data-cart-items]"),
      cartSummary: documentRef.querySelector("[data-cart-summary]"),
      clearCart: documentRef.querySelector("[data-cart-clear]"),
    };

    if (!windowRef.supabase || !hasConfig) {
      setStatus({ elements }, "Menu browsing is unavailable until Supabase is configured.");
      return null;
    }

    const client = windowRef.supabase.createClient(config.url, config.publishableKey);
    const state = {
      window: windowRef,
      document: documentRef,
      storage: windowRef.localStorage,
      client,
      marketplaceDb: client.schema("lck_marketplace"),
      elements,
      items: [],
      itemsById: new Map(),
      imageCache: new Map(),
      cart: parseStoredCart(windowRef.localStorage),
      filters: readFilters(documentRef),
      search: "",
      offset: 0,
      requestId: 0,
      loading: false,
      actions: null,
    };

    state.actions = {
      addToCart: (itemId) => {
        const item = state.itemsById.get(itemId);
        state.cart = addOrUpdateCartItem(state.cart, item, 1);
        writeStoredCart(state.storage, state.cart);
        renderCart(documentRef, state, state.actions);
      },
      setQuantity: (itemId, quantity) => {
        const item = state.itemsById.get(itemId);
        if (asPositiveInteger(quantity, 0) <= 0) state.cart = removeCartItem(state.cart, itemId);
        else state.cart = setCartItemQuantity(state.cart, item, quantity);
        writeStoredCart(state.storage, state.cart);
        renderCart(documentRef, state, state.actions);
      },
      removeFromCart: (itemId) => {
        state.cart = removeCartItem(state.cart, itemId);
        writeStoredCart(state.storage, state.cart);
        renderCart(documentRef, state, state.actions);
      },
      openItem: (itemId, opener) => openItemDetails(documentRef, state, itemId, opener),
      openCook: (cookId, opener) => openCookProfile(documentRef, state, cookId, opener),
    };

    bindEvents(windowRef, state);
    renderCart(documentRef, state, state.actions);
    fetchItems(state, false);
    return state;
  };

  return {
    CART_ITEM_LIMIT,
    CART_STORAGE_KEY,
    PAGE_SIZE,
    addOrUpdateCartItem,
    clampCartQuantity,
    formatCurrency,
    getCartSubtotalCents,
    getMaxCartQuantity,
    isCustomerVisibleItem,
    isUuid,
    itemMatchesFilters,
    normalizeCartEntries,
    normalizeText,
    parseStoredCart,
    removeCartItem,
    setCartItemQuantity,
    init,
  };
});
