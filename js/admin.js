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
  };

  const clearStatus = () => {
    setText("[data-status]", "");
  };

  const showToast = (message) => {
    clearStatus();
    window.LocalCoKitchenToast?.show(message);
  };

  const redirectToAdminSignIn = () => {
    const next = encodeURIComponent(window.location.pathname);
    window.location.replace(`/admin/signin/?next=${next}`);
  };

  const revealAuthRequiredPage = () => {
    document.querySelector("[data-auth-required]")?.removeAttribute("hidden");
  };

  const clearChildren = (element) => {
    while (element.firstChild) {
      element.firstChild.remove();
    }
  };

  const updatePendingSummary = (applications) => {
    const summary = document.querySelector("[data-pending-summary]");
    const count = applications.filter((application) => application.status === "submitted").length;

    if (!summary) {
      return;
    }

    setText("[data-pending-application-count]", String(count));
    summary.hidden = false;
  };

  const deliverPendingReviewNotifications = async () => {
    if (!client) {
      return false;
    }

    const { data: sessionData, error: sessionError } = await client.auth.getSession();

    if (sessionError || !sessionData.session?.access_token) {
      return false;
    }

    const { data, error } = await client.functions.invoke("send-cook-review-notifications", {
      body: {},
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
    });
    return !error && Number(data?.failed || 0) === 0;
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

  const renderApplication = async (container, application, reviews, sessionUserId) => {
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

    const history = createEl("details", "admin-review-history");
    const historySummary = createEl(
      "summary",
      "",
      `Review history (${reviews.length})`
    );
    history.append(historySummary);

    if (!reviews.length) {
      history.append(createEl("p", "", "No previous decisions recorded."));
    } else {
      const historyList = createEl("ol", "admin-review-history__list");
      reviews.forEach((review) => {
        const item = createEl("li");
        item.append(
          createEl("strong", "", review.decision === "approved" ? "Approved" : "Rejected"),
          createEl(
            "span",
            "",
            `${new Date(review.reviewed_at).toLocaleString()} by ${review.reviewer_name}`
          )
        );

        if (review.review_notes) {
          item.append(createEl("p", "", review.review_notes));
        }

        item.append(
          createEl(
            "small",
            "",
            `Email: ${review.notification_status}`
          )
        );
        historyList.append(item);
      });
      history.append(historyList);
    }
    card.append(history);

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

      const actionLabel = status === "approved" ? "Approve" : "Reject";
      const consequence = status === "approved"
        ? "This grants cook access. The kitchen remains private until the cook publishes it."
        : "This removes active cook access but preserves all kitchen data for possible reconsideration.";

      if (!window.confirm(`${actionLabel} ${application.legal_name}?\n\n${consequence}`)) {
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

      const notificationDelivered = await deliverPendingReviewNotifications();
      showToast(`Application ${status}.`);

      if (!notificationDelivered) {
        setText(
          "[data-status]",
          "The decision was saved. Its email notification is queued and will be retried."
        );
      }
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
      revealAuthRequiredPage();
      setText("[data-status]", "Supabase is not configured yet.");
      return;
    }

    const { data: userData, error: userError } = await client.auth.getUser();

    if (userError || !userData.user) {
      redirectToAdminSignIn();
      return;
    }

    revealAuthRequiredPage();

    const { data: isAdmin, error: adminError } = await identityDb.rpc("current_user_is_admin");

    if (adminError || isAdmin !== true) {
      await client.auth.signOut();
      redirectToAdminSignIn();
      return;
    }

    const [applicationsResult, reviewsResult] = await Promise.all([
      marketplaceDb
        .from("cook_applications")
        .select("*")
        .order("submitted_at", { ascending: false }),
      identityDb.rpc("get_cook_application_review_history"),
    ]);
    const { data, error } = applicationsResult;

    if (error || reviewsResult.error) {
      setText("[data-status]", error?.message || reviewsResult.error.message);
      return;
    }

    deliverPendingReviewNotifications().catch(() => {
      // Delivery stays queued in the database for the next admin visit.
    });

    clearChildren(container);
    container.hidden = false;
    updatePendingSummary(data);

    if (!data.length) {
      container.append(createEl("p", "", "No cook applications yet."));
      return;
    }

    for (const application of data) {
      const applicationReviews = (reviewsResult.data || []).filter(
        (review) => review.user_id === application.user_id
      );
      await renderApplication(container, application, applicationReviews, userData.user.id);
    }
  };

  loadApplications();
})();
