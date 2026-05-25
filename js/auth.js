(function () {
  const statusEl = document.querySelector("#auth-status");
  const form = document.querySelector("[data-auth-form]");
  const resetButton = document.querySelector('[data-auth-action="reset-password"]');
  const passwordRules = {
    length: (value) => value.length >= 10,
    lowercase: (value) => /[a-z]/.test(value),
    uppercase: (value) => /[A-Z]/.test(value),
    digit: (value) => /\d/.test(value),
    symbol: (value) => /[^A-Za-z0-9]/.test(value),
  };

  const setStatus = (message) => {
    if (statusEl) {
      statusEl.textContent = message;
    }
  };

  const getRedirectUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "/";
    return new URL(next, window.location.origin).toString();
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
    const ruleResults = Object.entries(passwordRules).reduce(
      (results, [rule, test]) => ({
        ...results,
        [rule]: test(password),
      }),
      {}
    );
    const allRulesMet = Object.values(ruleResults).every(Boolean);
    const passwordsMatch = password.length > 0 && password === confirm;

    return {
      allRulesMet,
      confirm,
      isValid: allRulesMet && passwordsMatch,
      password,
      passwordsMatch,
      ruleResults,
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
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const submitButton = form.querySelector('button[type="submit"]');

    if (submitButton) {
      submitButton.disabled = true;
    }

    setStatus(mode === "signup" ? "Creating your account..." : "Signing you in...");

    try {
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

        const role = String(formData.get("role") || "customer");
        const { error } = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getEmailRedirectUrl(),
            data: {
              full_name: String(formData.get("full_name") || "").trim(),
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

  resetButton?.addEventListener("click", async () => {
    const email = window.prompt("Enter the email address for your account.");

    if (!email) {
      return;
    }

    if (!client) {
      setStatus(
        "Supabase is not configured yet. Add your project URL and publishable key in /js/supabase-config.js."
      );
      return;
    }

    setStatus("Sending password reset email...");
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getPasswordResetRedirectUrl(),
    });

    setStatus(
      error
        ? error.message || "Could not send a reset email."
        : "Password reset email sent."
    );
  });
})();
