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
  const identityDb = client?.schema("lck_identity");
  const marketplaceDb = client?.schema("lck_marketplace");

  const setText = (selector, text) => {
    const el = document.querySelector(selector);

    if (el) {
      el.textContent = text;
    }

    if (selector === "[data-status]" && text) {
      window.LocalCoKitchenToast?.show(text);
    }
  };

  const clearChildren = (element) => {
    while (element.firstChild) {
      element.firstChild.remove();
    }
  };

  const createEl = (tag, className, text) => {
    const el = document.createElement(tag);

    if (className) {
      el.className = className;
    }

    if (text) {
      el.textContent = text;
    }

    return el;
  };

  const getSignedDocumentUrl = async (path) => {
    if (!path) {
      return "";
    }

    const { data, error } = await client.storage
      .from("cook-documents")
      .createSignedUrl(path, 300);

    if (error) {
      throw error;
    }

    return data.signedUrl;
  };

  const renderApplication = async (container, application, sessionUserId) => {
    const card = createEl("article", "admin-review-card");
    const header = createEl("div", "admin-review-card__header");
    const title = createEl("div");
    title.append(
      createEl("h2", "", application.legal_name),
      createEl("p", "", `Status: ${application.status}`)
    );
    header.append(title);
    card.append(header);

    const details = createEl("dl", "admin-detail-list");
    [
      ["User ID", application.user_id],
      ["Phone", application.phone || "Not provided"],
      ["Pickup zip", application.pickup_zip_code],
      ["Pickup address", application.pickup_address || "Not provided"],
      ["Submitted", new Date(application.submitted_at).toLocaleString()],
    ].forEach(([label, value]) => {
      const dt = createEl("dt", "", label);
      const dd = createEl("dd", "", value);
      details.append(dt, dd);
    });
    card.append(details);

    const documents = createEl("div", "admin-document-row");
    const proofUrl = await getSignedDocumentUrl(application.food_handler_certificate_url);
    const proofLink = createEl("a", "secondary-action", "Open food handler proof");
    proofLink.href = proofUrl;
    proofLink.target = "_blank";
    proofLink.rel = "noopener";
    documents.append(proofLink);

    if (application.permit_or_certification_url) {
      const permitUrl = await getSignedDocumentUrl(application.permit_or_certification_url);
      const permitLink = createEl("a", "secondary-action", "Open permit/certification");
      permitLink.href = permitUrl;
      permitLink.target = "_blank";
      permitLink.rel = "noopener";
      documents.append(permitLink);
    }
    card.append(documents);

    const form = createEl("form", "admin-review-actions");
    form.dataset.applicationId = application.user_id;
    const notesLabel = createEl("label", "field-stack");
    const notesText = createEl("span", "", "Review notes");
    const notesInput = document.createElement("textarea");
    notesInput.name = "review_notes";
    notesInput.rows = 3;
    notesInput.maxLength = 1000;
    notesInput.value = application.review_notes || "";
    notesLabel.append(notesText, notesInput);

    const buttons = createEl("div", "button-row");
    const approve = createEl("button", "auth-submit", "Approve cook");
    approve.type = "submit";
    approve.name = "status";
    approve.value = "approved";
    const reject = createEl("button", "secondary-action", "Reject");
    reject.type = "submit";
    reject.name = "status";
    reject.value = "rejected";
    buttons.append(approve, reject);
    form.append(notesLabel, buttons);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitter = event.submitter;
      const status = submitter?.value;

      if (!["approved", "rejected"].includes(status)) {
        return;
      }

      submitter.disabled = true;
      setText("[data-status]", `${status === "approved" ? "Approving" : "Rejecting"} application...`);

      const { error } = await marketplaceDb
        .from("cook_applications")
        .update({
          status,
          review_notes: notesInput.value.trim() || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: sessionUserId,
        })
        .eq("user_id", application.user_id);

      if (error) {
        setText("[data-status]", error.message);
        submitter.disabled = false;
        return;
      }

      setText("[data-status]", `Application ${status}.`);
      await loadApplications();
    });

    card.append(form);
    container.append(card);
  };

  const loadApplications = async () => {
    const container = document.querySelector("[data-admin-cook-applications]");

    if (!container) {
      return;
    }

    if (!client) {
      setText("[data-status]", "Supabase is not configured yet.");
      return;
    }

    const { data: sessionData } = await client.auth.getSession();

    if (!sessionData.session) {
      clearChildren(container);
      setText("[data-status]", "Sign in as an admin to review cook applications.");
      return;
    }

    const { data: isAdmin, error: adminError } = await identityDb.rpc("current_user_is_admin");

    if (adminError || isAdmin !== true) {
      clearChildren(container);
      setText("[data-status]", "You do not have admin access.");
      return;
    }

    const { data, error } = await marketplaceDb
      .from("cook_applications")
      .select("*")
      .order("submitted_at", { ascending: false });

    if (error) {
      setText("[data-status]", error.message);
      return;
    }

    clearChildren(container);

    if (!data.length) {
      container.append(createEl("p", "", "No cook applications yet."));
      return;
    }

    for (const application of data) {
      await renderApplication(container, application, sessionData.session.user.id);
    }
  };

  loadApplications();
})();
