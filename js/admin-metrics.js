(function () {
  const config = window.LOCALCOKITCHEN_SUPABASE_CONFIG || {};
  const hasConfig =
    config.url &&
    config.publishableKey &&
    !config.url.includes("YOUR_PROJECT_REF") &&
    !config.publishableKey.includes("YOUR_SUPABASE");
  const client = window.supabase && hasConfig
    ? window.supabase.createClient(config.url, config.publishableKey)
    : null;
  const identityDb = client?.schema("lck_identity");
  const status = document.querySelector("[data-status]");

  const setStatus = (message) => {
    if (status) status.textContent = message;
  };

  const deny = async () => {
    await client?.auth.signOut();
    window.location.replace("/admin/signin/?next=/admin/metrics/");
  };

  const renderMetrics = (metrics) => {
    document.querySelectorAll("[data-metric]").forEach((element) => {
      const value = Number(metrics[element.dataset.metric] ?? 0);
      element.textContent = value.toLocaleString();
    });

    const generatedAt = document.querySelector("[data-metrics-generated-at]");
    if (generatedAt) {
      const date = new Date(metrics.generated_at);
      generatedAt.dateTime = date.toISOString();
      generatedAt.textContent = date.toLocaleString();
    }
  };

  const load = async () => {
    if (!client) return deny();

    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) return deny();

    const { data: isAdmin, error: adminError } = await identityDb.rpc("current_user_is_admin");
    if (adminError || isAdmin !== true) return deny();

    document.querySelector("[data-auth-required]").hidden = false;
    const { data, error } = await identityDb.rpc("get_admin_metrics");

    if (error || !Array.isArray(data) || !data[0]) {
      setStatus("Metrics could not be loaded. Try again later.");
      return;
    }

    renderMetrics(data[0]);
    document.querySelector("[data-admin-metrics]").hidden = false;
    setStatus("");
  };

  document.querySelector("[data-admin-signout]")?.addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    await client?.auth.signOut();
    window.location.replace("/admin/signin/");
  });

  load();
})();
