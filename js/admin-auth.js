(function () {
  const config = window.LOCALCOKITCHEN_SUPABASE_CONFIG || {};
  const client = window.supabase?.createClient(config.url, config.publishableKey);
  const identityDb = client?.schema("lck_identity");
  const passwordForm = document.querySelector("[data-admin-password-form]");
  const mfaForm = document.querySelector("[data-admin-mfa-form]");
  const qrPanel = document.querySelector("[data-admin-mfa-enrollment]");
  const qrImage = document.querySelector("[data-admin-mfa-qr]");
  const status = document.querySelector("[data-admin-auth-status]");
  let factorId = "";
  let enrollment = false;

  const setStatus = (message) => {
    status.textContent = message;
  };

  const getDestination = () => {
    const requested = new URLSearchParams(window.location.search).get("next") || "/admin/";
    const destination = new URL(requested, window.location.origin);
    return destination.origin === window.location.origin && destination.pathname.startsWith("/admin/")
      ? destination.pathname
      : "/admin/";
  };

  const failClosed = async () => {
    await client?.auth.signOut();
    passwordForm.hidden = false;
    mfaForm.hidden = true;
    qrPanel.hidden = true;
    setStatus("Unable to sign in with those credentials.");
  };

  const verifyAdminRole = async () => {
    const { data, error } = await identityDb.rpc("current_user_can_start_admin_mfa");
    return !error && data === true;
  };

  const finishAdminSignIn = async () => {
    const { error } = await identityDb.rpc("record_admin_login");
    if (error) throw error;
    window.location.replace(getDestination());
  };

  const beginMfa = async () => {
    const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error) throw assurance.error;

    if (assurance.data.currentLevel === "aal2") {
      await finishAdminSignIn();
      return;
    }

    const factors = await client.auth.mfa.listFactors();
    if (factors.error) throw factors.error;
    const verifiedFactor = factors.data.totp.find((factor) => factor.status === "verified");

    if (verifiedFactor) {
      factorId = verifiedFactor.id;
      enrollment = false;
      setStatus("Enter the code from your authenticator app.");
    } else {
      const enrolled = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "LocalCoKitchen Admin",
      });
      if (enrolled.error) throw enrolled.error;
      factorId = enrolled.data.id;
      enrollment = true;
      qrImage.src = enrolled.data.totp.qr_code;
      qrPanel.hidden = false;
      setStatus("Scan the QR code, then enter the six-digit code.");
    }

    passwordForm.hidden = true;
    mfaForm.hidden = false;
    mfaForm.querySelector("input").focus();
  };

  passwordForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = passwordForm.querySelector("button");
    const values = new FormData(passwordForm);
    submit.disabled = true;
    setStatus("Verifying access...");

    try {
      const { error } = await client.auth.signInWithPassword({
        email: String(values.get("email") || "").trim().toLowerCase(),
        password: String(values.get("password") || ""),
      });
      if (error || !(await verifyAdminRole())) {
        await failClosed();
        return;
      }
      await beginMfa();
    } catch (_error) {
      await failClosed();
    } finally {
      submit.disabled = false;
    }
  });

  mfaForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = mfaForm.querySelector("button");
    const code = String(new FormData(mfaForm).get("code") || "").replace(/\D/g, "");
    submit.disabled = true;
    setStatus("Verifying code...");

    try {
      const challenge = await client.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;
      const verified = await client.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code,
      });
      if (verified.error) throw verified.error;
      const { data: isAdmin, error } = await identityDb.rpc("current_user_is_admin");
      if (error || isAdmin !== true) throw error || new Error("Access denied");
      await finishAdminSignIn();
    } catch (_error) {
      setStatus(enrollment
        ? "That code was not accepted. Check the authenticator app and try again."
        : "That code was not accepted. Try again.");
      submit.disabled = false;
    }
  });

  client?.auth.getUser().then(async ({ data }) => {
    if (!data.user) return;
    if (!(await verifyAdminRole())) {
      await failClosed();
      return;
    }
    await beginMfa();
  }).catch(failClosed);
})();
