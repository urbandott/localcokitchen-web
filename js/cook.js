(function () {
  const config = window.LOCALCOKITCHEN_SUPABASE_CONFIG || {};
  const hasConfig =
    config.url &&
    config.publishableKey &&
    !config.url.includes("YOUR_PROJECT_REF") &&
    !config.publishableKey.includes("YOUR_SUPABASE");
  const client =
    window.supabase && hasConfig
      ? window.supabase.createClient(config.url, config.publishableKey)
      : null;
  const maxProofBytes = 5 * 1024 * 1024;
  const maxProfileImageBytes = 2 * 1024 * 1024;
  const maxMenuImageBytes = 3 * 1024 * 1024;
  const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  const documentTypes = new Set([...imageTypes, "application/pdf"]);

  const clean = (value, maxLength = 500) =>
    String(value || "")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, maxLength);

  const escapeHtml = (value) =>
    String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const moneyToCents = (value) => Math.round(Number(value || 0) * 100);

  const setText = (selector, text) => {
    const el = document.querySelector(selector);

    if (el) {
      el.textContent = text;
    }
  };

  const requireClient = () => {
    if (!client) {
      setText("[data-status]", "Supabase is not configured yet.");
      return false;
    }

    return true;
  };

  const getSession = async () => {
    if (!requireClient()) {
      return null;
    }

    const { data } = await client.auth.getSession();
    return data.session;
  };

  const getIsCook = async (userId) => {
    const { data, error } = await client
      .from("cook_profiles")
      .select("cook_id")
      .eq("cook_id", userId)
      .maybeSingle();

    return !error && Boolean(data);
  };

  const getPublicUrl = (bucket, path) =>
    client.storage.from(bucket).getPublicUrl(path).data.publicUrl;

  const uploadFile = async ({ bucket, file, maxBytes, path, types }) => {
    if (!file) {
      return "";
    }

    if (!types.has(file.type)) {
      throw new Error("Unsupported file type.");
    }

    if (file.size > maxBytes) {
      throw new Error("File is too large.");
    }

    const { error } = await client.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      throw error;
    }

    return bucket === "cook-documents" ? path : getPublicUrl(bucket, path);
  };

  const filePath = (userId, label, file) => {
    const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
    return `${userId}/${label}-${Date.now()}.${extension}`;
  };

  const setupCookApplication = async () => {
    const form = document.querySelector("[data-cook-application]");

    if (!form) {
      return;
    }

    const session = await getSession();

    if (!session) {
      form.hidden = true;
      setText("[data-status]", "Sign in first, then return here to apply as a cook.");
      return;
    }

    const { data: application } = await client
      .from("cook_applications")
      .select("status, submitted_at")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (application) {
      setText(
        "[data-status]",
        `Cook application ${application.status}. You can manage your shop from the account menu.`
      );
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const button = form.querySelector('button[type="submit"]');
      const proof = formData.get("food_handler_certificate");
      const permit = formData.get("permit_or_certification");

      if (!(proof instanceof File) || !proof.size) {
        setText("[data-status]", "Upload proof of food handler training.");
        return;
      }

      button.disabled = true;
      setText("[data-status]", "Submitting cook application...");

      try {
        const proofPath = await uploadFile({
          bucket: "cook-documents",
          file: proof,
          maxBytes: maxProofBytes,
          path: filePath(session.user.id, "food-handler-training", proof),
          types: documentTypes,
        });
        let permitPath = "";

        if (permit instanceof File && permit.size) {
          permitPath = await uploadFile({
            bucket: "cook-documents",
            file: permit,
            maxBytes: maxProofBytes,
            path: filePath(session.user.id, "permit", permit),
            types: documentTypes,
          });
        }

        const { error } = await client.from("cook_applications").upsert({
          user_id: session.user.id,
          legal_name: clean(formData.get("legal_name"), 160),
          phone: clean(formData.get("phone"), 40),
          pickup_address: clean(formData.get("pickup_address"), 240),
          pickup_zip_code: clean(formData.get("pickup_zip_code"), 12),
          food_handler_training_completed:
            formData.get("food_handler_training_completed") === "yes",
          food_handler_certificate_url: proofPath,
          permit_or_certification_url: permitPath || null,
          status: "submitted",
          submitted_at: new Date().toISOString(),
        });

        if (error) {
          throw error;
        }

        setText("[data-status]", "Cook application submitted. My shop is now available from the account menu.");
        window.dispatchEvent(new CustomEvent("localcokitchen:cook-status-changed"));
        form.reset();
      } catch (error) {
        setText("[data-status]", error.message || "Could not submit application.");
      } finally {
        button.disabled = false;
      }
    });
  };

  const setupProfilePage = async () => {
    const form = document.querySelector("[data-profile-form]");

    if (!form) {
      return;
    }

    const session = await getSession();

    if (!session) {
      form.hidden = true;
      setText("[data-status]", "Sign in to view your profile.");
      return;
    }

    const avatar = form.querySelector("[data-profile-avatar]");
    const currentAvatarUrl = session.user.user_metadata?.avatar_url || "/images/logo.svg";

    form.elements.email.value = session.user.email || "";
    form.elements.first_name.value = session.user.user_metadata?.first_name || "";
    form.elements.last_name.value = session.user.user_metadata?.last_name || "";

    if (avatar) {
      avatar.src = currentAvatarUrl;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const image = formData.get("profile_picture");

      if (!(image instanceof File) || !image.size) {
        setText("[data-status]", "Choose a profile picture to upload.");
        return;
      }

      try {
        const avatarUrl = await uploadFile({
          bucket: "cook-profile-images",
          file: image,
          maxBytes: maxProfileImageBytes,
          path: filePath(session.user.id, "account-profile", image),
          types: imageTypes,
        });
        const { error } = await client.auth.updateUser({
          data: {
            avatar_url: avatarUrl,
          },
        });

        if (error) {
          throw error;
        }

        if (avatar) {
          avatar.src = avatarUrl;
        }

        form.reset();
        window.dispatchEvent(new CustomEvent("localcokitchen:profile-updated"));
        setText("[data-status]", "Profile picture updated.");
      } catch (error) {
        setText("[data-status]", error.message || "Could not update profile picture.");
      }
    });

    form
      .querySelector("[data-remove-profile-picture]")
      ?.addEventListener("click", async () => {
        const { error } = await client.auth.updateUser({
          data: {
            avatar_url: null,
          },
        });

        if (error) {
          setText("[data-status]", error.message);
          return;
        }

        if (avatar) {
          avatar.src = "/images/logo.svg";
        }

        window.dispatchEvent(new CustomEvent("localcokitchen:profile-updated"));
        setText("[data-status]", "Profile picture removed.");
      });
  };

  const loadShop = async (session) => {
    const [{ data: profile }, { data: limit }, { data: items }, { data: windows }] =
      await Promise.all([
        client.from("cook_profiles").select("*").eq("cook_id", session.user.id).maybeSingle(),
        client
          .from("cook_account_limits")
          .select("menu_item_limit, membership_tier")
          .eq("cook_id", session.user.id)
          .maybeSingle(),
        client
          .from("cook_menu_items")
          .select("*")
          .eq("cook_id", session.user.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        client
          .from("cook_pickup_windows")
          .select("*")
          .eq("cook_id", session.user.id)
          .eq("is_active", true)
          .order("day_of_week", { ascending: true }),
      ]);

    return {
      items: items || [],
      limit: limit || { menu_item_limit: 10, membership_tier: "starter" },
      profile,
      windows: windows || [],
    };
  };

  const renderShop = ({ items, limit, profile, windows }) => {
    const profileForm = document.querySelector("[data-shop-profile-form]");
    const itemsList = document.querySelector("[data-menu-items]");
    const windowsList = document.querySelector("[data-pickup-windows]");

    setText(
      "[data-menu-limit]",
      `${items.length} of ${limit.menu_item_limit} active menu items used`
    );

    if (profileForm && profile) {
      profileForm.elements.display_name.value = profile.display_name || "";
      profileForm.elements.description.value = profile.description || "";
      profileForm.elements.cuisine_type.value = profile.cuisine_type || "";
      profileForm.elements.pickup_zip_code.value = profile.pickup_zip_code || "";
      profileForm.elements.preorder_cutoff_hours.value = profile.preorder_cutoff_hours || 24;
      profileForm.elements.order_notes.value = profile.order_notes || "";
      profileForm.elements.is_public.checked = Boolean(profile.is_public);
      profileForm.dataset.currentImage = profile.profile_image_url || "";
    }

    if (itemsList) {
      itemsList.innerHTML =
        items
          .map(
            (item) => `
              <article class="shop-list-item">
                <img src="${item.image_url}" alt="">
                <div>
                  <h3>${escapeHtml(item.name)}</h3>
                  <p>${escapeHtml(item.description)}</p>
                  <strong>$${(item.price_cents / 100).toFixed(2)}</strong>
                  <span>${item.quantity_available} available${item.is_sold_out ? " · sold out" : ""}</span>
                </div>
                <button type="button" data-delete-item="${item.id}">Remove</button>
              </article>
            `
          )
          .join("") || "<p>No menu items yet.</p>";
    }

    if (windowsList) {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      windowsList.innerHTML =
        windows
          .map(
            (windowRow) => `
              <article class="pickup-window-row">
                <span>${dayNames[windowRow.day_of_week]}</span>
                <strong>${windowRow.start_time.slice(0, 5)} - ${windowRow.end_time.slice(0, 5)}</strong>
              </article>
            `
          )
          .join("") || "<p>No pickup windows yet.</p>";
    }
  };

  const setupShopPage = async () => {
    const shopPage = document.querySelector("[data-shop-page]");

    if (!shopPage) {
      return;
    }

    const session = await getSession();

    if (!session) {
      shopPage.hidden = true;
      setText("[data-status]", "Sign in to manage your shop.");
      return;
    }

    if (!(await getIsCook(session.user.id))) {
      shopPage.hidden = true;
      setText("[data-status]", "Apply to sell food before opening your shop.");
      return;
    }

    const refresh = async () => renderShop(await loadShop(session));
    await refresh();

    document.querySelector("[data-shop-profile-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const formData = new FormData(form);
      const image = formData.get("profile_image");
      let imageUrl = form.dataset.currentImage || "";
      const description = clean(formData.get("description"), 3500);

      if (description.split(/\s+/).filter(Boolean).length > 500) {
        setText("[data-status]", "Shop description must be 500 words or fewer.");
        return;
      }

      try {
        if (image instanceof File && image.size) {
          imageUrl = await uploadFile({
            bucket: "cook-profile-images",
            file: image,
            maxBytes: maxProfileImageBytes,
            path: filePath(session.user.id, "profile", image),
            types: imageTypes,
          });
        }

        const { error } = await client.from("cook_profiles").upsert({
          cook_id: session.user.id,
          display_name: clean(formData.get("display_name"), 120),
          profile_image_url: imageUrl || null,
          description,
          cuisine_type: clean(formData.get("cuisine_type"), 80),
          pickup_zip_code: clean(formData.get("pickup_zip_code"), 12),
          preorder_cutoff_hours: Number(formData.get("preorder_cutoff_hours") || 24),
          order_notes: clean(formData.get("order_notes"), 800),
          is_public: formData.get("is_public") === "yes",
        });

        if (error) {
          throw error;
        }

        setText("[data-status]", "Shop profile saved.");
        await refresh();
      } catch (error) {
        setText("[data-status]", error.message || "Could not save shop profile.");
      }
    });

    document.querySelector("[data-menu-item-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const formData = new FormData(form);
      const image = formData.get("image");

      try {
        if (!(image instanceof File) || !image.size) {
          throw new Error("Upload a menu item image.");
        }

        const imageUrl = await uploadFile({
          bucket: "cook-menu-images",
          file: image,
          maxBytes: maxMenuImageBytes,
          path: filePath(session.user.id, "menu-item", image),
          types: imageTypes,
        });
        const { error } = await client.from("cook_menu_items").insert({
          cook_id: session.user.id,
          name: clean(formData.get("name"), 120),
          description: clean(formData.get("description"), 1200),
          image_url: imageUrl,
          price_cents: moneyToCents(formData.get("price")),
          quantity_available: Number(formData.get("quantity_available") || 0),
          category: clean(formData.get("category"), 80) || null,
          allergens: clean(formData.get("allergens"), 300)
            .split(",")
            .map((item) => clean(item, 40))
            .filter(Boolean),
          dietary_tags: clean(formData.get("dietary_tags"), 300)
            .split(",")
            .map((item) => clean(item, 40))
            .filter(Boolean),
          is_sold_out: formData.get("is_sold_out") === "yes",
        });

        if (error) {
          throw error;
        }

        form.reset();
        setText("[data-status]", "Menu item added.");
        await refresh();
      } catch (error) {
        setText("[data-status]", error.message || "Could not add menu item.");
      }
    });

    document.querySelector("[data-pickup-window-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const formData = new FormData(form);
      const { error } = await client.from("cook_pickup_windows").insert({
        cook_id: session.user.id,
        day_of_week: Number(formData.get("day_of_week")),
        start_time: formData.get("start_time"),
        end_time: formData.get("end_time"),
      });

      if (error) {
        setText("[data-status]", error.message);
        return;
      }

      form.reset();
      setText("[data-status]", "Pickup window added.");
      await refresh();
    });

    document.querySelector("[data-menu-items]")?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-delete-item]");

      if (!button) {
        return;
      }

      const { error } = await client
        .from("cook_menu_items")
        .update({ is_active: false })
        .eq("id", button.dataset.deleteItem)
        .eq("cook_id", session.user.id);

      setText("[data-status]", error ? error.message : "Menu item removed.");
      await refresh();
    });
  };

  setupCookApplication();
  setupProfilePage();
  setupShopPage();
})();
