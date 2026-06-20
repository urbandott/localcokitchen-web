(function () {
  const config = window.LOCALCOKITCHEN_SUPABASE_CONFIG || {};
  const client = window.supabase?.createClient(config.url, config.publishableKey);
  const identityDb = client?.schema("lck_identity");

  const deny = async () => {
    await client?.auth.signOut();
    window.location.replace("/admin/signin/?next=/admin/");
  };

  const load = async () => {
    if (!client) return deny();
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) return deny();
    const { data: isAdmin, error } = await identityDb.rpc("current_user_is_admin");
    if (error || isAdmin !== true) return deny();
    document.querySelector("[data-auth-required]").hidden = false;
    document.querySelector("[data-admin-dashboard]").hidden = false;
  };

  document.querySelector("[data-admin-signout]")?.addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    await client?.auth.signOut();
    window.location.replace("/admin/signin/");
  });

  load();
})();
