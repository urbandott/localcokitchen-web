import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CookApplicationForm } from "@/features/kitchen/cook-application-form";
import { getKitchenDashboard, userHasCookWorkspace } from "@/features/kitchen/kitchen-data";
import { requireUser } from "@/lib/auth/session";
import { createMetadata } from "@/lib/seo/metadata";
import type { AdminCookStatus, CookApplication } from "@/types/database";

export const metadata: Metadata = createMetadata({
  title: "Kitchen Application",
  description: "Manage your LocalCoKitchen cook application.",
  path: "/my-kitchen/application/",
  noIndex: true,
});

function applicationStatusLabel(status: AdminCookStatus | undefined): string {
  if (!status) return "Not submitted";
  const labels: Record<AdminCookStatus, string> = {
    approved: "Approved",
    draft: "Not submitted",
    rejected: "Needs changes",
    submitted: "Submitted for review",
    suspended: "Suspended",
  };
  return labels[status];
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

function ApplicationDetails({ application }: { application: CookApplication }) {
  return (
    <section className="next-card" aria-labelledby="application-details-title">
      <h2 id="application-details-title">Application details</h2>
      <dl className="kitchen-detail-list">
        <div>
          <dt>Status</dt>
          <dd>{applicationStatusLabel(application.status)}</dd>
        </div>
        <div>
          <dt>Legal name</dt>
          <dd>{application.legal_name ?? "Not added yet"}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{application.phone ?? "Not added yet"}</dd>
        </div>
        <div>
          <dt>Pickup ZIP code</dt>
          <dd>{application.pickup_zip_code ?? "Not added yet"}</dd>
        </div>
        <div>
          <dt>Food handler training</dt>
          <dd>{application.food_handler_training_completed ? "Completed" : "Not confirmed"}</dd>
        </div>
        <div>
          <dt>Submitted</dt>
          <dd>{formatDate(application.submitted_at)}</dd>
        </div>
        <div>
          <dt>Reviewed</dt>
          <dd>{formatDate(application.reviewed_at)}</dd>
        </div>
      </dl>
    </section>
  );
}

export default async function KitchenApplicationPage() {
  const user = await requireUser("/my-kitchen/application/");
  if (!(await userHasCookWorkspace(user.id))) redirect("/sell-your-food/");
  const { application, error } = await getKitchenDashboard(user.id);

  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Cook dashboard</p>
        <h1>Kitchen application</h1>
        <p className="lede">
          Submit and track the application required before your kitchen can publish menu items.
        </p>
      </section>

      <div className="section-heading-row">
        <Link className="secondary-action compact-action" href="/my-kitchen/">
          Back to kitchen
        </Link>
      </div>

      {error ? <p className="next-alert">{error}</p> : null}
      {application ? <ApplicationDetails application={application} /> : null}

      {!application || application.status === "draft" || application.status === "rejected" ? (
        <section className="next-section">
          {application?.status === "rejected" ? (
            <p className="next-alert">
              Your application needs changes before approval.
              {application.review_notes ? ` Moderator note: ${application.review_notes}` : ""}
            </p>
          ) : null}
          <CookApplicationForm application={application} />
        </section>
      ) : null}

      {application?.status === "submitted" ? (
        <p className="next-success">
          Your application is submitted. We’ll review your documents and follow up by email.
        </p>
      ) : null}

      {application?.status === "approved" ? (
        <p className="next-success">
          Your application is approved. You can now manage your public profile and menu items.
        </p>
      ) : null}

      {application?.status === "suspended" ? (
        <p className="next-alert">
          Your cook application is suspended. Please reach out to info@localcokitchen.com for more
          information.
        </p>
      ) : null}
    </div>
  );
}
