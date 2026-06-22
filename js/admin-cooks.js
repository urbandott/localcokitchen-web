(function () {
  const config = window.LOCALCOKITCHEN_SUPABASE_CONFIG || {};
  const hasConfig = config.url && config.publishableKey
    && !config.url.includes("YOUR_PROJECT_REF")
    && !config.publishableKey.includes("YOUR_SUPABASE");
  const client = window.supabase && hasConfig
    ? window.supabase.createClient(config.url, config.publishableKey)
    : null;
  const identityDb = client?.schema("lck_identity");
  const form = document.querySelector("[data-cook-filters]");
  const rows = document.querySelector("[data-cook-rows]");
  const dialog = document.querySelector("[data-cook-dialog]");
  const detail = document.querySelector("[data-cook-detail]");
  const pageSize = 25;
  let page = 0;
  let total = 0;
  let requestNumber = 0;

  const setStatus = (message) => {
    const status = document.querySelector("[data-status]");
    if (status) status.textContent = message;
  };

  const createEl = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  };

  const clear = (element) => {
    while (element?.firstChild) element.firstChild.remove();
  };

  const displayValue = (value) => {
    if (value === true) return "Yes";
    if (value === false) return "No";
    if (value === null || value === undefined || value === "") return "Not provided";
    return String(value);
  };

  const formatDate = (value) => value ? new Date(value).toLocaleString() : "Not provided";
  const formatStatus = (value) => String(value || "unknown").replaceAll("_", " ");

  const deny = async () => {
    await client?.auth.signOut();
    const next = encodeURIComponent(window.location.pathname);
    window.location.replace(`/admin/signin/?next=${next}`);
  };

  const addBadge = (container, label, modifier) => {
    container.append(createEl("span", `admin-cook-badge admin-cook-badge--${modifier}`, label));
  };

  const addDetailList = (container, title, items) => {
    const section = createEl("section", "admin-cook-detail-section");
    section.append(createEl("h3", "", title));
    const list = createEl("dl", "admin-detail-list");
    items.forEach(([label, value]) => {
      list.append(createEl("dt", "", label), createEl("dd", "", displayValue(value)));
    });
    section.append(list);
    container.append(section);
  };

  const addDocuments = async (container, cook) => {
    const paths = [
      ["Food handler proof", cook.food_handler_certificate_url],
      ["Permit or certification", cook.permit_or_certification_url],
    ].filter(([, path]) => path);
    if (!paths.length) return;

    const section = createEl("section", "admin-cook-detail-section");
    section.append(createEl("h3", "", "Documents"));
    const links = createEl("div", "admin-document-row");
    for (const [label, path] of paths) {
      const { data, error } = await client.storage.from("cook-documents").createSignedUrl(path, 300);
      if (!error && data?.signedUrl) {
        const link = createEl("a", "secondary-action", label);
        link.href = data.signedUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        links.append(link);
      }
    }
    if (links.childElementCount) {
      section.append(links);
      container.append(section);
    }
  };

  const addMenu = (container, items) => {
    const section = createEl("section", "admin-cook-detail-section");
    section.append(createEl("h3", "", `Menu items (${items.length})`));
    if (!items.length) {
      section.append(createEl("p", "", "No menu items."));
    } else {
      const list = createEl("ul", "admin-cook-detail-cards");
      items.forEach((item) => {
        const entry = createEl("li");
        entry.append(
          createEl("strong", "", item.name),
          createEl("span", "", `${item.category} · $${(Number(item.price_cents) / 100).toFixed(2)}`),
          createEl("span", "", `${item.is_active ? "Active" : "Inactive"} · ${item.is_sold_out ? "Sold out" : `${item.quantity_available} available`}`)
        );
        list.append(entry);
      });
      section.append(list);
    }
    container.append(section);
  };

  const addPickupWindows = (container, windows) => {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const section = createEl("section", "admin-cook-detail-section");
    section.append(createEl("h3", "", `Pickup windows (${windows.length})`));
    if (!windows.length) {
      section.append(createEl("p", "", "No pickup windows."));
    } else {
      const list = createEl("ul", "admin-cook-detail-cards");
      windows.forEach((window) => {
        const entry = createEl("li");
        entry.append(
          createEl("strong", "", dayNames[window.day_of_week] || "Unknown day"),
          createEl("span", "", `${window.start_time}–${window.end_time}`),
          createEl("span", "", window.is_active ? "Active" : "Inactive")
        );
        list.append(entry);
      });
      section.append(list);
    }
    container.append(section);
  };

  const addModerationControls = (container, cook) => {
    const section = createEl("section", "admin-cook-detail-section admin-cook-moderation");
    section.append(createEl("h3", "", "Kitchen moderation"));

    if (cook.display_name === null) {
      section.append(createEl("p", "", "This cook does not have a kitchen profile yet."));
      container.append(section);
      return;
    }

    const isDisabled = Boolean(cook.moderator_disabled_at);
    section.append(createEl(
      "p",
      "",
      isDisabled
        ? `Disabled by a moderator on ${formatDate(cook.moderator_disabled_at)}. The cook cannot make this kitchen public.`
        : "This kitchen is not restricted by a moderator."
    ));

    const button = createEl(
      "button",
      isDisabled ? "secondary-action" : "admin-danger-action",
      isDisabled ? "Remove moderator restriction" : "Disable kitchen"
    );
    button.type = "button";
    button.addEventListener("click", async () => {
      const nextDisabled = !isDisabled;
      const confirmation = nextDisabled
        ? "Disable this kitchen? It will immediately be hidden from customers and the cook will not be able to republish it."
        : "Remove the moderator restriction? The kitchen will remain private until the cook publishes it again.";
      if (!window.confirm(confirmation)) return;

      button.disabled = true;
      const { error } = await identityDb.rpc("set_admin_cook_kitchen_disabled", {
        p_cook_id: cook.cook_id,
        p_disabled: nextDisabled,
      });
      if (error) {
        button.disabled = false;
        section.append(createEl("p", "auth-message", "The kitchen moderation setting could not be changed."));
        return;
      }

      window.LocalCoKitchenToast?.show(
        nextDisabled ? "Kitchen disabled by moderator." : "Moderator restriction removed."
      );
      await loadCooks();
      await openCook(cook.cook_id);
    });
    section.append(button);
    container.append(section);
  };

  const openCook = async (cookId) => {
    clear(detail);
    detail.append(createEl("p", "", "Loading cook details..."));
    if (!dialog.open) dialog.showModal();

    const { data, error } = await identityDb.rpc("get_admin_cook_detail", { p_cook_id: cookId });
    if (error || !Array.isArray(data) || !data[0]) {
      clear(detail);
      detail.append(createEl("p", "auth-message", "Cook details could not be loaded."));
      return;
    }

    const cook = data[0];
    document.querySelector("[data-detail-title]").textContent = cook.display_name || cook.legal_name || cook.full_name || "Cook";
    clear(detail);
    const summary = createEl("div", "admin-cook-detail-summary");
    addBadge(summary, formatStatus(cook.application_status), cook.application_status === "approved" ? "positive" : "neutral");
    addBadge(summary, cook.is_public && cook.application_status === "approved" ? "Live kitchen" : "Not live", cook.is_public && cook.application_status === "approved" ? "positive" : "neutral");
    addBadge(summary, cook.is_active_cook ? "Active access" : "Inactive access", cook.is_active_cook ? "positive" : "warning");
    detail.append(summary);

    addDetailList(detail, "Account", [
      ["Cook ID", cook.cook_id], ["Email", cook.email], ["First name", cook.first_name],
      ["Last name", cook.last_name], ["Full name", cook.full_name], ["Account created", formatDate(cook.account_created_at)],
    ]);
    addDetailList(detail, "Application", [
      ["Legal name", cook.legal_name], ["Phone", cook.phone], ["Pickup address", cook.pickup_address],
      ["Pickup zip", cook.pickup_zip_code], ["Training completed", cook.food_handler_training_completed],
      ["Status", formatStatus(cook.application_status)], ["Submitted", formatDate(cook.submitted_at)],
      ["Reviewed", formatDate(cook.reviewed_at)], ["Review notes", cook.review_notes],
    ]);
    addDetailList(detail, "Kitchen profile", [
      ["Display name", cook.display_name], ["Cuisine", cook.cuisine_type], ["Description", cook.description],
      ["Public", cook.is_public], ["Preorder cutoff", cook.preorder_cutoff_hours ? `${cook.preorder_cutoff_hours} hours` : null],
      ["Order notes", cook.order_notes], ["Rating", cook.rating], ["Review count", cook.review_count],
      ["Membership", cook.membership_tier], ["Menu item limit", cook.menu_item_limit],
    ]);
    addModerationControls(detail, cook);
    await addDocuments(detail, cook);
    addMenu(detail, Array.isArray(cook.menu_items) ? cook.menu_items : []);
    addPickupWindows(detail, Array.isArray(cook.pickup_windows) ? cook.pickup_windows : []);
  };

  const renderRows = (cooks) => {
    clear(rows);
    cooks.forEach((cook) => {
      const row = document.createElement("tr");
      const identity = document.createElement("td");
      identity.append(createEl("strong", "", cook.display_name || cook.legal_name || cook.full_name || "Unnamed cook"), createEl("span", "", cook.email));

      const application = document.createElement("td");
      addBadge(application, formatStatus(cook.application_status), cook.application_status === "approved" ? "positive" : "neutral");
      const kitchen = document.createElement("td");
      addBadge(kitchen, cook.is_live_kitchen ? "Live" : "Not live", cook.is_live_kitchen ? "positive" : "neutral");
      const access = document.createElement("td");
      addBadge(access, cook.is_active_cook ? "Active" : "Inactive", cook.is_active_cook ? "positive" : "warning");
      const menu = createEl("td", "", `${cook.menu_item_count} items`);
      const actionCell = document.createElement("td");
      const action = createEl("button", "secondary-action admin-cook-view", "View details");
      action.type = "button";
      action.addEventListener("click", () => openCook(cook.cook_id));
      actionCell.append(action);
      row.append(identity, application, kitchen, access, menu, actionCell);
      rows.append(row);
    });
  };

  const updatePagination = () => {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    document.querySelector("[data-page-status]").textContent = `Page ${page + 1} of ${pages}`;
    document.querySelector("[data-page-previous]").disabled = page === 0;
    document.querySelector("[data-page-next]").disabled = (page + 1) * pageSize >= total;
    document.querySelector("[data-cook-count]").textContent = `${total.toLocaleString()} ${total === 1 ? "cook" : "cooks"}`;
  };

  const loadCooks = async () => {
    const currentRequest = ++requestNumber;
    const formData = new FormData(form);
    setStatus("Loading cooks...");
    const { data, error } = await identityDb.rpc("list_admin_cooks", {
      p_search: String(formData.get("search") || "").trim(),
      p_application_status: formData.get("application_status"),
      p_kitchen_visibility: formData.get("kitchen_visibility"),
      p_account_state: formData.get("account_state"),
      p_limit: pageSize,
      p_offset: page * pageSize,
    });
    if (currentRequest !== requestNumber) return;
    if (error || !Array.isArray(data)) {
      setStatus("The cook directory could not be loaded. Try again later.");
      return;
    }
    total = Number(data[0]?.total_count || 0);
    renderRows(data);
    updatePagination();
    document.querySelector("[data-cook-empty]").hidden = data.length !== 0;
    setStatus("");
  };

  const initialize = async () => {
    if (!client) return deny();
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) return deny();
    const { data: isAdmin, error: adminError } = await identityDb.rpc("current_user_is_admin");
    if (adminError || isAdmin !== true) return deny();
    document.querySelector("[data-auth-required]").hidden = false;
    document.querySelector("[data-cook-directory]").hidden = false;
    await loadCooks();
  };

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    page = 0;
    loadCooks();
  });
  form?.addEventListener("reset", () => {
    page = 0;
    window.setTimeout(loadCooks, 0);
  });
  document.querySelector("[data-page-previous]")?.addEventListener("click", () => {
    if (page > 0) { page -= 1; loadCooks(); }
  });
  document.querySelector("[data-page-next]")?.addEventListener("click", () => {
    if ((page + 1) * pageSize < total) { page += 1; loadCooks(); }
  });
  document.querySelector("[data-close-dialog]")?.addEventListener("click", () => dialog.close());
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  document.querySelector("[data-admin-signout]")?.addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    await client?.auth.signOut();
    window.location.replace("/admin/signin/");
  });

  initialize();
})();
