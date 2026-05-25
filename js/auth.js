(function () {
  const statusEl = document.querySelector("#auth-status");
  const form = document.querySelector("[data-auth-form]");
  const passwordPolicy = window.LocalCoKitchenPasswordPolicy;
  const allowedSignupRoles = new Set(["customer", "cook", "both"]);

  const cleanTextValue = (value, maxLength = 120) =>
    String(value || "")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, maxLength);

  const setStatus = (message) => {
    if (statusEl) {
      statusEl.textContent = message;
    }
  };

  const getRedirectUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "/";
    const redirectUrl = new URL(next, window.location.origin);

    return redirectUrl.origin === window.location.origin
      ? redirectUrl.toString()
      : window.location.origin;
  };

  const getEmailRedirectUrl = () =>
    new URL("/signin/?verified=1", window.location.origin).toString();

  const getPasswordResetRedirectUrl = () =>
    new URL("/reset-password/", window.location.origin).toString();

  const setupPasswordToggles = () => {
    document.querySelectorAll("[data-password-toggle]").forEach((button) => {
      const input = document.getElementById(button.dataset.passwordToggle);

      if (!input) {
        return;
      }

      button.addEventListener("click", () => {
        const shouldShow = input.type === "password";
        input.type = shouldShow ? "text" : "password";
        button.textContent = shouldShow ? "Hide" : "Show";
      });
    });
  };

  const getSignupPasswordState = () => {
    if (!form || form.dataset.authForm !== "signup") {
      return { isValid: true };
    }

    const password = form.querySelector('input[name="password"]')?.value || "";
    const confirm = form.querySelector('input[name="password_confirm"]')?.value || "";
    const validation = passwordPolicy.validatePassword(password, confirm);

    return {
      allRulesMet: validation.allRulesMet,
      confirm,
      isValid: validation.isValid,
      password,
      passwordsMatch: validation.passwordsMatch,
      ruleResults: validation.rules,
    };
  };

  const updateSignupPasswordUi = () => {
    const state = getSignupPasswordState();

    if (!state.ruleResults) {
      return;
    }

    Object.entries(state.ruleResults).forEach(([rule, isMet]) => {
      const item = form.querySelector(`[data-password-rule="${rule}"]`);
      item?.classList.toggle("is-met", isMet);
    });

    const matchEl = form.querySelector("[data-password-match]");
    const confirmInput = form.querySelector('input[name="password_confirm"]');
    const hasConfirmValue = state.confirm.length > 0;

    matchEl?.classList.toggle("is-met", state.passwordsMatch);
    matchEl?.classList.toggle("is-invalid", hasConfirmValue && !state.passwordsMatch);

    if (confirmInput) {
      confirmInput.setCustomValidity(
        !hasConfirmValue || state.passwordsMatch ? "" : "Passwords must match."
      );
    }
  };

  setupPasswordToggles();

  if (form?.dataset.authForm === "signup") {
    form
      .querySelectorAll('input[name="password"], input[name="password_confirm"]')
      .forEach((input) => {
        input.addEventListener("input", updateSignupPasswordUi);
      });
    updateSignupPasswordUi();
  }

  const config = window.LOCALCOKITCHEN_SUPABASE_CONFIG || {};
  const hasConfig =
    config.url &&
    config.publishableKey &&
    !config.url.includes("YOUR_PROJECT_REF") &&
    !config.publishableKey.includes("YOUR_SUPABASE");

  if (!window.supabase || !hasConfig) {
    setStatus(
      "Supabase is not configured yet. Add your project URL and publishable key in /js/supabase-config.js."
    );
  }

  const client =
    window.supabase && hasConfig
      ? window.supabase.createClient(config.url, config.publishableKey)
      : null;

  client?.auth.getSession().then(({ data }) => {
    if (data.session && window.location.pathname.startsWith("/signin")) {
      setStatus("You are signed in. Redirecting...");
      window.location.assign(getRedirectUrl());
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const mode = form.dataset.authForm;
    const formData = new FormData(form);
    const email = cleanTextValue(formData.get("email"), 254).toLowerCase();
    const password = String(formData.get("password") || "");
    const submitButton = form.querySelector('button[type="submit"]');
    const emailInput = form.querySelector('input[name="email"]');

    if (emailInput && !emailInput.validity.valid) {
      setStatus("Please enter a valid email address.");
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
    }

    setStatus(
      mode === "signup"
        ? "Creating your account..."
        : mode === "forgot-password"
          ? "Sending password reset email..."
          : "Signing you in..."
    );

    try {
      if (mode === "forgot-password") {
        if (!client) {
          setStatus(
            "Supabase is not configured yet. Add your project URL and publishable key in /js/supabase-config.js."
          );
          return;
        }

        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: getPasswordResetRedirectUrl(),
        });

        if (error) {
          throw error;
        }

        setStatus("If an account exists for that email, a reset link has been sent.");
        form.reset();
        return;
      }

      if (mode === "reset-password") {
        if (!client) {
          setStatus(
            "Supabase is not configured yet. Add your project URL and publishable key in /js/supabase-config.js."
          );
          return;
        }

        const { error } = await client.auth.updateUser({ password });

        if (error) {
          throw error;
        }

        setStatus("Password updated. Redirecting to sign in...");
        window.location.assign("/signin/");
        return;
      }

      if (mode === "signup") {
        const passwordState = getSignupPasswordState();

        updateSignupPasswordUi();

        if (!passwordState.allRulesMet) {
          setStatus("Password must meet every listed requirement.");
          return;
        }

        if (!passwordState.passwordsMatch) {
          setStatus("Passwords must match.");
          return;
        }

        if (!client) {
          setStatus(
            "Supabase is not configured yet. Add your project URL and publishable key in /js/supabase-config.js."
          );
          return;
        }

        const requestedRole = cleanTextValue(formData.get("role"), 20);
        const role = allowedSignupRoles.has(requestedRole) ? requestedRole : "customer";
        const { error } = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getEmailRedirectUrl(),
            data: {
              full_name: cleanTextValue(formData.get("full_name")),
              signup_role: role,
            },
          },
        });

        if (error) {
          throw error;
        }

        setStatus("Check your email to confirm your account before signing in.");
        form.reset();
        return;
      }

      if (!client) {
        setStatus(
          "Supabase is not configured yet. Add your project URL and publishable key in /js/supabase-config.js."
        );
        return;
      }

      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      setStatus("Signed in. Redirecting...");
      window.location.assign(getRedirectUrl());
    } catch (error) {
      setStatus(error.message || "Authentication failed. Please try again.");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
})();
