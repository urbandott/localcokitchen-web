import type { Metadata } from "next";
import { reviewCookApplicationAction } from "@/features/admin/actions";
import { listSubmittedCookApplicationsForReview } from "@/features/admin/admin-data";
import { requireAdmin } from "@/lib/auth/session";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Cook Applications",
  description: "Review LocalCoKitchen cook applications.",
  path: "/admin/cook-applications/",
  noIndex: true,
});

export default async function AdminApplicationsPage() {
  await requireAdmin();
  const { applications, error } = await listSubmittedCookApplicationsForReview();
  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Admin</p>
        <h1>Cook applications</h1>
      </section>
      {error ? <p className="next-alert">{error}</p> : null}
      {applications.length === 0 ? (
        <p className="empty-state">No submitted cook applications need review.</p>
      ) : null}
      <section className="next-section">
        {applications.map(({ application, documents, user }) => (
          <article className="next-card admin-application-card" key={application.user_id}>
            <h2>{application.legal_name}</h2>
            <p>
              {user?.email ?? "No email found"} · {application.phone} ·{" "}
              {application.pickup_zip_code}
            </p>
            <p className="next-muted">
              Submitted{" "}
              {application.submitted_at
                ? new Intl.DateTimeFormat("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(application.submitted_at))
                : "recently"}
            </p>
            <dl className="admin-application-details">
              <div>
                <dt>Applicant profile</dt>
                <dd>
                  {user?.full_name ?? [user?.first_name, user?.last_name].filter(Boolean).join(" ")}
                </dd>
              </div>
              <div>
                <dt>Private pickup address</dt>
                <dd>{application.pickup_address}</dd>
              </div>
              <div>
                <dt>Food handler training</dt>
                <dd>
                  {application.food_handler_training_completed ? "Completed" : "Not confirmed"}
                </dd>
              </div>
            </dl>
            <div className="admin-document-list" aria-label={`${application.legal_name} documents`}>
              {documents.map((document) => (
                <div className="admin-document-row" key={document.label}>
                  <span>{document.label}</span>
                  {document.signedUrl ? (
                    <a
                      className="secondary-action compact-action"
                      href={document.signedUrl}
                      rel="noreferrer noopener"
                      target="_blank"
                    >
                      Open secure link
                    </a>
                  ) : (
                    <span className="next-muted">Unavailable</span>
                  )}
                </div>
              ))}
            </div>
            <p className="next-muted">Document links expire after 5 minutes.</p>
            <div className="admin-review-actions">
              <form action={reviewCookApplicationAction}>
                <input type="hidden" name="cookId" value={application.user_id} />
                <input type="hidden" name="decision" value="approved" />
                <input type="hidden" name="reviewNotes" value="" />
                <button className="primary-action compact-action" type="submit">
                  Approve application
                </button>
              </form>
              <form action={reviewCookApplicationAction} className="admin-reject-form">
                <input type="hidden" name="cookId" value={application.user_id} />
                <input type="hidden" name="decision" value="rejected" />
                <label>
                  <span>Rejection note</span>
                  <textarea
                    name="reviewNotes"
                    maxLength={1000}
                    minLength={5}
                    required
                    placeholder="Explain what the cook needs to fix before resubmitting."
                  />
                </label>
                <button className="secondary-action compact-action" type="submit">
                  Reject application
                </button>
              </form>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
