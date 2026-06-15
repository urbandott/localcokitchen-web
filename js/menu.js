(function () {
  const container = document.querySelector("[data-public-menu-items]");
  const config = window.LOCALCOKITCHEN_SUPABASE_CONFIG || {};
  const hasConfig =
    config.url &&
    config.publishableKey &&
    !config.url.includes("YOUR_PROJECT_REF") &&
    !config.publishableKey.includes("YOUR_SUPABASE");

  if (!container || !window.supabase || !hasConfig) {
    return;
  }

  const client = window.supabase.createClient(config.url, config.publishableKey);
  const marketplaceDb = client.schema("lck_marketplace");
  const clearChildren = (element) => {
    while (element.firstChild) {
      element.firstChild.remove();
    }
  };

  const createEl = (tag, className, text) => {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text) {
      element.textContent = text;
    }

    return element;
  };

  const appendDetail = (list, label, value) => {
    const text = Array.isArray(value) ? value.filter(Boolean).join(", ") : String(value || "").trim();

    if (!text) {
      return;
    }

    const row = document.createElement("div");
    row.append(createEl("dt", "", label), createEl("dd", "", text));
    list.append(row);
  };

  const renderMenuItem = (item) => {
    const article = createEl("article", "menu-item");

    const image = document.createElement("img");
    image.src = item.image_url;
    image.alt = "";
    article.append(image);

    const body = document.createElement("div");
    body.className = "menu-item__body";
    body.append(createEl("span", "status-pill", item.is_sold_out ? "Sold out" : `${item.quantity_available} left`));
    body.append(createEl("h2", "", item.name));

    const tagRow = createEl("div", "menu-attribute-tags");
    [
      ...(item.category_tags?.length ? item.category_tags : item.category ? [item.category] : []),
      ...(item.dietary_tags || []),
      item.spice_level || "",
    ]
      .filter(Boolean)
      .slice(0, 8)
      .forEach((tag) => {
        tagRow.append(createEl("span", "", tag));
      });

    if (tagRow.childElementCount) {
      body.append(tagRow);
    }

    body.append(createEl("p", "", item.description));

    const details = createEl("dl", "menu-item-details");
    appendDetail(details, "Serves", item.portion_serves ? `${item.portion_serves} people` : "");
    appendDetail(details, "Main ingredients", item.main_ingredients);

    if (details.childElementCount) {
      body.append(details);
    }

    body.append(createEl("strong", "", `$${(item.price_cents / 100).toFixed(2)}`));
    article.append(body);

    return article;
  };

  marketplaceDb
    .from("cook_menu_items")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(24)
    .then(({ data, error }) => {
      if (error || !data?.length) {
        return;
      }

      clearChildren(container);
      data.forEach((item) => {
        container.append(renderMenuItem(item));
      });
    });
})();
