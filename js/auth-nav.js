(function () {
  const authLinks = document.querySelectorAll("[data-auth-nav]");
  const config = window.LOCALCOKITCHEN_SUPABASE_CONFIG || {};
  const hasConfig =
    config.url &&
    config.publishableKey &&
    !config.url.includes("YOUR_PROJECT_REF") &&
    !config.publishableKey.includes("YOUR_SUPABASE");

  if (!authLinks.length || !window.supabase || !hasConfig) {
    return;
  }

  const client = window.supabase.createClient(config.url, config.publishableKey);
  let isSignedIn = false;

  const setSignedInState = (signedIn) => {
    isSignedIn = signedIn;

    authLinks.forEach((link) => {
      link.textContent = signedIn ? "Sign out" : "Sign in";
      link.setAttribute("aria-label", signedIn ? "Sign out" : "Sign in");

      if (signedIn) {
        link.setAttribute("href", "#signout");
      } else {
        link.setAttribute("href", "/signin/");
      }
    });
  };

  client.auth.getSession().then(({ data }) => {
    setSignedInState(Boolean(data.session));
  });

  client.auth.onAuthStateChange((_event, session) => {
    setSignedInState(Boolean(session));
  });

  authLinks.forEach((link) => {
    link.addEventListener("click", async (event) => {
      if (!isSignedIn) {
        return;
      }

      event.preventDefault();
      link.setAttribute("aria-disabled", "true");

      const { error } = await client.auth.signOut({ scope: "local" });

      if (!error) {
        setSignedInState(false);
      }

      link.removeAttribute("aria-disabled");
    });
  });
})();
