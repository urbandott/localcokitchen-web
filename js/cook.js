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
  const marketplaceDb = client?.schema("lck_marketplace");
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

  const clearChildren = (element) => {
    while (element.firstChild) {
      element.firstChild.remove();
    }
  };

  const getInitials = (user) => {
    const metadata = user?.user_metadata || {};
    const fullName = String(
      metadata.full_name ||
        [metadata.first_name, metadata.last_name].filter(Boolean).join(" ")
    ).trim();
    const email = String(user?.email || "").trim();
    const source = fullName || email;

    return (
      source
        .split(/\s+|@/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "LC"
    );
  };

  const getAvatarUrl = (user) => {
    const avatarUrl = String(user?.user_metadata?.avatar_url || "").trim();

    if (!avatarUrl || avatarUrl === "null" || avatarUrl === "undefined") {
      return "";
    }

    return avatarUrl;
  };

  const renderProfileAvatar = (avatar, user, avatarUrl) => {
    if (!avatar) {
      return;
    }

    clearChildren(avatar);
    avatar.classList.toggle("has-image", Boolean(avatarUrl));

    if (avatarUrl) {
      const image = document.createElement("img");
      image.src = avatarUrl;
      image.alt = "";
      avatar.append(image);
      return;
    }

    avatar.textContent = getInitials(user);
  };

  const getProfileImagePath = (user) => {
    const metadata = user?.user_metadata || {};

    if (metadata.avatar_path) {
      return metadata.avatar_path;
    }

    const avatarUrl = String(metadata.avatar_url || "");
    const marker = "/storage/v1/object/public/profile-images/";
    const markerIndex = avatarUrl.indexOf(marker);

    if (markerIndex === -1) {
      return "";
    }

    return decodeURIComponent(avatarUrl.slice(markerIndex + marker.length));
  };

  const removeProfileImageObject = async (path) => {
    if (!path) {
      return;
    }

    const { error } = await client.storage.from("profile-images").remove([path]);

    if (error) {
      throw error;
    }
  };

  const formatUsPhone = (value) => {
    const digits = String(value || "")
      .replace(/\D/g, "")
      .replace(/^1/, "")
      .slice(0, 10);
    const area = digits.slice(0, 3);
    const prefix = digits.slice(3, 6);
    const line = digits.slice(6, 10);

    if (digits.length <= 3) {
      return `+1 ${area}`.trimEnd();
    }

    if (digits.length <= 6) {
      return `+1 ${area}-${prefix}`;
    }

    return `+1 ${area}-${prefix}-${line}`;
  };

  const setupCookApplicationFormatting = (form) => {
    const phoneInput = form.elements.phone;
    const zipInput = form.elements.pickup_zip_code;

    if (phoneInput) {
      phoneInput.value = formatUsPhone(phoneInput.value || "+1 ");
      phoneInput.addEventListener("input", () => {
        phoneInput.value = formatUsPhone(phoneInput.value);
      });
      phoneInput.addEventListener("focus", () => {
        if (!phoneInput.value) {
          phoneInput.value = "+1 ";
        }
      });
    }

    if (zipInput) {
      zipInput.addEventListener("input", () => {
        zipInput.value = String(zipInput.value || "")
          .replace(/\D/g, "")
          .slice(0, 5);
      });
    }
  };

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

  const getCookApplication = async (userId) => {
    const { data, error } = await marketplaceDb
      .from("cook_applications")
      .select("status, submitted_at, reviewed_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
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

    const { data: application } = await marketplaceDb
      .from("cook_applications")
      .select("status, submitted_at")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (application) {
      setText(
        "[data-status]",
        application.status === "approved"
          ? "Cook application approved. My shop is available from the account menu."
          : `Cook application ${application.status}. An admin must review your details and uploaded files before your shop opens.`
      );
      form.hidden = true;
      return;
    }

    setupCookApplicationFormatting(form);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const button = form.querySelector('button[type="submit"]');
      const proof = formData.get("food_handler_certificate");
      const permit = formData.get("permit_or_certification");
      const legalName = clean(formData.get("legal_name"), 120);
      const phone = formatUsPhone(formData.get("phone"));
      const pickupAddress = clean(formData.get("pickup_address"), 240);
      const pickupZipCode = clean(formData.get("pickup_zip_code"), 5);

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      if (
        legalName.length < 2 ||
        !/^\+1 [0-9]{3}-[0-9]{3}-[0-9]{4}$/.test(phone) ||
        pickupAddress.length < 8 ||
        !/^[0-9]{5}$/.test(pickupZipCode)
      ) {
        setText("[data-status]", "Check the highlighted fields and try again.");
        return;
      }

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

        const { error } = await marketplaceDb.from("cook_applications").insert({
          user_id: session.user.id,
          legal_name: legalName,
          phone,
          pickup_address: pickupAddress,
          pickup_zip_code: pickupZipCode,
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

        setText("[data-status]", "Cook application submitted for admin review.");
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
    const profilePictureInput = form.elements.profile_picture;
    let currentAvatarUrl = getAvatarUrl(session.user);
    let currentAvatarPath = getProfileImagePath(session.user);

    form.elements.email.value = session.user.email || "";
    form.elements.first_name.value = session.user.user_metadata?.first_name || "";
    form.elements.last_name.value = session.user.user_metadata?.last_name || "";

    renderProfileAvatar(avatar, session.user, currentAvatarUrl);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const image = formData.get("profile_picture");

      if (!(image instanceof File) || !image.size) {
        setText("[data-status]", "Choose a profile picture to upload.");
        return;
      }

      try {
        const avatarPath = filePath(session.user.id, "account-profile", image);
        const avatarUrl = await uploadFile({
          bucket: "profile-images",
          file: image,
          maxBytes: maxProfileImageBytes,
          path: avatarPath,
          types: imageTypes,
        });
        const { error } = await client.auth.updateUser({
          data: {
            avatar_path: avatarPath,
            avatar_url: avatarUrl,
          },
        });

        if (error) {
          throw error;
        }

        if (currentAvatarPath) {
          await removeProfileImageObject(currentAvatarPath);
        }

        currentAvatarUrl = avatarUrl;
        currentAvatarPath = avatarPath;
        renderProfileAvatar(avatar, session.user, currentAvatarUrl);

        if (profilePictureInput) {
          profilePictureInput.value = "";
        }

        window.dispatchEvent(new CustomEvent("localcokitchen:profile-updated"));
        setText("[data-status]", "Profile picture updated.");
      } catch (error) {
        setText("[data-status]", error.message || "Could not update profile picture.");
      }
    });

    form
      .querySelector("[data-remove-profile-picture]")
      ?.addEventListener("click", async () => {
        try {
          await removeProfileImageObject(currentAvatarPath);
        } catch (error) {
          setText("[data-status]", error.message || "Could not delete profile picture from storage.");
          return;
        }

        const { error } = await client.auth.updateUser({
          data: {
            avatar_path: null,
            avatar_url: null,
          },
        });

        if (error) {
          setText("[data-status]", error.message);
          return;
        }

        currentAvatarUrl = "";
        currentAvatarPath = "";
        renderProfileAvatar(avatar, session.user, "");
        window.dispatchEvent(new CustomEvent("localcokitchen:profile-updated"));
        setText("[data-status]", "Profile picture removed.");
      });
  };

  const loadShop = async (session) => {
    const [{ data: application }, { data: profile }, { data: limit }, { data: items }, { data: windows }] =
      await Promise.all([
        marketplaceDb
          .from("cook_applications")
          .select("status, submitted_at, reviewed_at")
          .eq("user_id", session.user.id)
          .maybeSingle(),
        marketplaceDb.from("cook_profiles").select("*").eq("cook_id", session.user.id).maybeSingle(),
        marketplaceDb
          .from("cook_account_limits")
          .select("menu_item_limit, membership_tier")
          .eq("cook_id", session.user.id)
          .maybeSingle(),
        marketplaceDb
          .from("cook_menu_items")
          .select("*")
          .eq("cook_id", session.user.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        marketplaceDb
          .from("cook_pickup_windows")
          .select("*")
          .eq("cook_id", session.user.id)
          .eq("is_active", true)
          .order("day_of_week", { ascending: true }),
      ]);

    return {
      application,
      items: items || [],
      limit: limit || { menu_item_limit: 10, membership_tier: "starter" },
      profile,
      windows: windows || [],
    };
  };

  const renderShop = ({ application, items, limit, profile, windows }) => {
    const profileForm = document.querySelector("[data-shop-profile-form]");
    const itemsList = document.querySelector("[data-menu-items]");
    const windowsList = document.querySelector("[data-pickup-windows]");
    const reviewNotice = document.querySelector("[data-shop-review-notice]");

    if (reviewNotice) {
      reviewNotice.hidden = application?.status === "approved";
    }

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

    if (profileForm) {
      const isPublicInput = profileForm.elements.is_public;
      if (isPublicInput) {
        const isApproved = application?.status === "approved";
        isPublicInput.disabled = !isApproved;
        if (!isApproved) {
          isPublicInput.checked = false;
        }
      }
    }

    if (itemsList) {
      clearChildren(itemsList);

      if (!items.length) {
        const empty = document.createElement("p");
        empty.textContent = "No menu items yet.";
        itemsList.append(empty);
      }

      items.forEach((item) => {
        const article = document.createElement("article");
        article.className = "shop-list-item";

        const image = document.createElement("img");
        image.src = item.image_url;
        image.alt = "";

        const body = document.createElement("div");
        const title = document.createElement("h3");
        title.textContent = item.name;
        const description = document.createElement("p");
        description.textContent = item.description;
        const price = document.createElement("strong");
        price.textContent = `$${(item.price_cents / 100).toFixed(2)}`;
        const quantity = document.createElement("span");
        quantity.textContent = `${item.quantity_available} available${item.is_sold_out ? " - sold out" : ""}`;
        body.append(title, description, price, quantity);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.dataset.deleteItem = item.id;
        remove.textContent = "Remove";

        article.append(image, body, remove);
        itemsList.append(article);
      });
    }

    if (windowsList) {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      clearChildren(windowsList);

      if (!windows.length) {
        const empty = document.createElement("p");
        empty.textContent = "No pickup windows yet.";
        windowsList.append(empty);
      }

      windows.forEach((windowRow) => {
        const article = document.createElement("article");
        article.className = "pickup-window-row";
        const day = document.createElement("span");
        day.textContent = dayNames[windowRow.day_of_week];
        const time = document.createElement("strong");
        time.textContent = `${windowRow.start_time.slice(0, 5)} - ${windowRow.end_time.slice(0, 5)}`;
        article.append(day, time);
        windowsList.append(article);
      });
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

    let application;

    try {
      application = await getCookApplication(session.user.id);
    } catch (error) {
      shopPage.hidden = true;
      setText("[data-status]", error.message || "Could not load cook application status.");
      return;
    }

    if (!application || !["submitted", "approved"].includes(application.status)) {
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

        const { error } = await marketplaceDb.from("cook_profiles").upsert({
          cook_id: session.user.id,
          display_name: clean(formData.get("display_name"), 120),
          profile_image_url: imageUrl || null,
          description,
          cuisine_type: clean(formData.get("cuisine_type"), 80),
          pickup_zip_code: clean(formData.get("pickup_zip_code"), 12),
          preorder_cutoff_hours: Number(formData.get("preorder_cutoff_hours") || 24),
          order_notes: clean(formData.get("order_notes"), 800),
          is_public:
            application?.status === "approved" && formData.get("is_public") === "yes",
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
        const { error } = await marketplaceDb.from("cook_menu_items").insert({
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
      const { error } = await marketplaceDb.from("cook_pickup_windows").insert({
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

      const { error } = await marketplaceDb
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
