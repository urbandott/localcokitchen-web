(function () {
  const authLinks = document.querySelectorAll("[data-auth-nav]");
  const config = window.LOCALCOKITCHEN_SUPABASE_CONFIG || {};
  const hasConfig =
    config.url &&
    config.publishableKey &&
    !config.url.includes("YOUR_PROJECT_REF") &&
    !config.publishableKey.includes("YOUR_SUPABASE");

  if (!authLinks.length || !window.supabase || !hasConfig) {
    authLinks.forEach((link) => {
      link.classList.remove("is-auth-loading");
    });
    return;
  }

  const client = window.supabase.createClient(config.url, config.publishableKey);
  const identityDb = client.schema("lck_identity");
  const marketplaceDb = client.schema("lck_marketplace");
  let sessionUser = null;

  const clearAuthLoading = () => {
    authLinks.forEach((link) => {
      link.classList.remove("is-auth-loading");
    });
  };

  const closeOpenDropdowns = (except) => {
    document.querySelectorAll(".nav-more.is-open, .nav-profile.is-open").forEach((menu) => {
      if (menu !== except) {
        menu.classList.remove("is-open");
        menu
          .querySelector(".nav-more__button, .nav-profile__button")
          ?.setAttribute("aria-expanded", "false");
      }
    });
  };

  const setupDropdownToggles = () => {
    document.querySelectorAll(".nav-more__button, .nav-profile__button").forEach((button) => {
      if (button.dataset.dropdownReady) {
        return;
      }

      button.dataset.dropdownReady = "true";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const menuRoot = button.closest(".nav-more, .nav-profile");

        if (!menuRoot) {
          return;
        }

        const shouldOpen = !menuRoot.classList.contains("is-open");
        closeOpenDropdowns(menuRoot);
        menuRoot.classList.toggle("is-open", shouldOpen);
        button.setAttribute("aria-expanded", String(shouldOpen));
      });
    });
  };

  const getHasShopAccess = async (userId) => {
    if (!userId) {
      return false;
    }

    const { data, error } = await marketplaceDb
      .from("cook_applications")
      .select("status")
      .eq("user_id", userId)
      .in("status", ["submitted", "approved"])
      .maybeSingle();

    return !error && Boolean(data);
  };

  const getIsAdmin = async () => {
    const { data, error } = await identityDb.rpc("current_user_is_admin");
    return !error && data === true;
  };

  const getInitials = (user) => {
    const fullName = String(user?.user_metadata?.full_name || "").trim();
    const email = String(user?.email || "").trim();
    const source = fullName || email;

    return source
      .split(/\s+|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "LC";
  };

  const renderSignedOut = () => {
    authLinks.forEach((link) => {
      const existingMenu = link.parentElement?.querySelector("[data-profile-menu]");
      existingMenu?.remove();
      link.hidden = false;
      link.classList.remove("is-auth-loading");
      link.classList.remove("is-auth-hidden");
      link.textContent = "Sign in";
      link.setAttribute("aria-label", "Sign in");
      link.setAttribute("href", "/signin/");
      link.removeAttribute("aria-disabled");
    });
  };

  const renderSignedIn = async (user) => {
    const [hasShopAccess, isAdmin] = await Promise.all([getHasShopAccess(user?.id), getIsAdmin()]);

    authLinks.forEach((link) => {
      const parent = link.parentElement;

      if (!parent) {
        return;
      }

      link.hidden = true;
      link.classList.remove("is-auth-loading");
      link.classList.add("is-auth-hidden");
      parent.querySelector("[data-profile-menu]")?.remove();

      const profileMenu = document.createElement("div");
      profileMenu.className = "nav-profile";
      profileMenu.dataset.profileMenu = "";

      const button = document.createElement("button");
      button.className = "nav-profile__button";
      button.type = "button";
      button.setAttribute("aria-haspopup", "true");
      button.setAttribute("aria-label", "Account menu");

      if (user?.user_metadata?.avatar_url) {
        const image = document.createElement("img");
        image.src = user.user_metadata.avatar_url;
        image.alt = "";
        button.append(image);
      } else {
        button.textContent = getInitials(user);
      }

      const menu = document.createElement("div");
      menu.className = "nav-profile__menu";
      menu.setAttribute("role", "menu");

      const profileLink = document.createElement("a");
      profileLink.href = "/profile/";
      profileLink.setAttribute("role", "menuitem");
      profileLink.textContent = "My profile";
      menu.append(profileLink);

      if (hasShopAccess) {
        const shopLink = document.createElement("a");
        shopLink.href = "/my-shop/";
        shopLink.setAttribute("role", "menuitem");
        shopLink.textContent = "My shop";
        menu.append(shopLink);
      }

      if (isAdmin) {
        const adminLink = document.createElement("a");
        adminLink.href = "/admin/cook-applications/";
        adminLink.setAttribute("role", "menuitem");
        adminLink.textContent = "Admin";
        menu.append(adminLink);
      }

      const signOutButton = document.createElement("button");
      signOutButton.type = "button";
      signOutButton.setAttribute("role", "menuitem");
      signOutButton.textContent = "Sign out";
      signOutButton.addEventListener("click", async () => {
        signOutButton.disabled = true;
        await client.auth.signOut();
        window.location.assign("/");
      });
      menu.append(signOutButton);

      profileMenu.append(button, menu);
      parent.insertBefore(profileMenu, link.nextSibling);
    });

    setupDropdownToggles();
  };

  const setSignedInState = async (user) => {
    sessionUser = user;

    if (!sessionUser) {
      renderSignedOut();
      return;
    }

    await renderSignedIn(sessionUser);
  };

  client.auth.getSession().then(({ data }) => {
    setSignedInState(data.session?.user || null);
  }).catch(() => {
    clearAuthLoading();
  });

  client.auth.onAuthStateChange((_event, session) => {
    setSignedInState(session?.user || null);
  });

  window.addEventListener("localcokitchen:cook-status-changed", () => {
    if (sessionUser) {
      setSignedInState(sessionUser);
    }
  });

  window.addEventListener("localcokitchen:profile-updated", async () => {
    const { data } = await client.auth.getUser();
    setSignedInState(data.user || sessionUser);
  });

  setupDropdownToggles();

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".nav-more, .nav-profile")) {
      closeOpenDropdowns();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeOpenDropdowns();
    }
  });
})();
