# LocalCoKitchen Production-Readiness Audit

Audit date: 2026-06-21  
Scope: all source-controlled application files, Supabase migrations/configuration, Edge Functions, static routes, browser JavaScript, headers, assets, and tests.  
Important correction: this repository is a static HTML/CSS/JavaScript application backed by Supabase. It is not a Next.js application and has no React Server Components, server actions, Next.js middleware, SSR, hydration, or Next.js API routes.

## 1. Executive Summary

**Overall risk: Critical**

| Level | Count | Summary |
|---|---:|---|
| Critical | 1 | The promised marketplace transaction domain is absent. |
| High | 10 | Account enumeration, private media exposure, authorization invariants, concurrency, food labeling, auth configuration, auditability, production controls, and migration drift. |
| Medium | 10 | Upload lifecycle, consent, UI truthfulness, accessibility, supply chain, performance, pagination, rate limiting, malware defense, and browser QA gaps. |
| Low | 2 | Asset waste and minor operational/documentation drift. |

The implemented cook onboarding and administration surface has a defensible authorization model: exposed tables use RLS, administrator database predicates require an active database role plus AAL2, privileged functions reject non-admin callers, DOM output uses safe node construction, and no service-role credential is present in browser code. The new remediation migration closes the confirmed anonymous email enumeration endpoint, makes draft cook media private, adds audit events, enforces moderator locks in the database, serializes menu limits, and makes pickup-window replacement atomic.

The system is still **NOT READY FOR PROD**. Orders, checkout, payment confirmation, refunds, customer order history, messaging, reviews, and their associated schemas and policies do not exist. The linked database also has five migration versions absent from source control. Production migration execution, Auth settings, Storage policies, backups, recovery, rate limiting, monitoring, and cross-browser authenticated flows were not verifiable without reconciling that history and running a local Supabase stack.

## Architecture Review

### Architecture diagram

```text
Browser
 ├─ Public static routes (home, menu, marketing, auth)
 ├─ Cook routes (profile, application, my-shop)
 └─ Admin routes (AAL2 sign-in, applications, cooks, metrics)
        │ HTTPS + Supabase publishable key + user JWT
        ▼
Supabase
 ├─ Auth: users, sessions, recovery, TOTP
 ├─ PostgREST
 │   ├─ lck_identity: users, roles, admin RPCs
 │   └─ lck_marketplace: applications, profiles, limits,
 │       pickup windows, menu items
 ├─ Storage: profile images, cook documents, cook media
 ├─ Private Postgres: audit records and notification queue
 └─ Edge Function: claim review notification → Resend API

Absent: order service, payment processor/webhooks, messaging,
refunds, customer addresses/order history, cron scheduler, observability.
```

### Data flow and trust boundaries

```text
[Untrusted browser input]
  → browser validation (usability only)
  → [Internet boundary]
  → Auth/JWT verification
  → [PostgREST/RLS boundary]
  → ownership/admin/approval policies + constraints/triggers
  → Postgres or Storage

[Admin browser]
  → password auth (AAL1)
  → TOTP challenge (AAL2)
  → active role lookup in lck_identity.user_roles
  → privileged RPC
  → immutable private audit insert

[Edge Function]
  → verified bearer JWT + admin/AAL2 RPC
  → [service-role boundary]
  → private notification queue
  → [third-party boundary]
  → Resend
```

Trust boundaries are the browser, Supabase Auth, Data API/RLS, private database schema, service-role Edge Function, Storage, email provider, and deployment/CDN. Client-side route guards are presentation controls only; database policy and RPC checks are the authorization boundary.

### Attack surface

- 21 static routes and 13 browser JavaScript modules.
- Supabase email/password, recovery, refresh sessions, and TOTP enrollment.
- Seven exposed application tables, public/admin RPCs, and one Edge Function.
- Four Storage buckets and signed URL generation.
- Cook application, profile, pickup schedule, menu, and admin moderation inputs.
- EmailJS waitlist and Resend review notifications.
- Third-party CDN scripts, Google Analytics on the public site, and hosted fonts.
- No implemented order/payment/message APIs to enumerate.

## 2. Findings Table

| ID | Severity | Category | File(s) | Description | Exploit scenario | Recommendation/status |
|---|---|---|---|---|---|---|
| F-01 | Critical | Product/security architecture | migrations, routes | Orders, payments, refunds, messaging, customer addresses, and reviews are absent. | A production launch cannot enforce totals, payment state, ownership, or privacy for the core marketplace. | Implement as server-authoritative domains before launch. Open. |
| F-02 | High | Privacy/auth | foundation migration, auth.js | Anonymous security-definer RPC disclosed whether an email was active. Confirmed against the linked project. | Attacker enumerates customer/admin emails for phishing or credential stuffing. | RPC dropped and client pre-check removed. Fixed in pending migration. |
| F-03 | High | Storage/privacy | foundation and hardening migrations, cook.js, menu.js | Draft/unapproved cook media was in public buckets. | Guessed/leaked object URLs expose private kitchen/menu media. | Private buckets, conditional read policies, signed URLs. Fixed in pending migration. |
| F-04 | High | Broken access control | cook profile trigger | Direct Data API writes could publish an unapproved kitchen or undo moderation intent. | Cook bypasses the UI and sets `is_public=true`. | Database trigger binds owner, approval, and moderator lock. Fixed. |
| F-05 | High | Race condition | menu limit trigger | Count-then-insert was not serialized. | Concurrent inserts both pass the menu cap. | Per-cook transaction advisory lock. Fixed. |
| F-06 | High | Data integrity | pickup UI/schema | Sequential delete/inserts could leave a partial schedule; duplicate active weekdays were allowed. | Network failure loses some windows; concurrent writes create ambiguity. | Atomic RPC plus partial unique index. Fixed. |
| F-07 | High | Food safety/compliance | menu schema/form | Required allergen disclosure was absent and active items could omit ingredients. | Customer purchases food without required safety information. | Restored allergens and database/UI requirements. Fixed for new writes; legacy validation remains. |
| F-08 | High | Authentication | config.toml | Local/source auth policy allowed six-character passwords, no confirmation, no TOTP, and no secure password change. | Weak credentials or AAL2 unavailable for admin access. | Ten-character complexity, confirmation, session bounds, secure change, TOTP. Fixed in config; deployment verification open. |
| F-09 | High | Audit/operations | private schema, admin-auth.js | No general immutable admin/system audit stream existed. | Privileged moderation cannot be reconstructed after abuse or incident. | Private audit tables and trigger/RPC events. Fixed for current admin actions. |
| F-10 | High | Production controls | project/deployment | No proven backups, restore drill, alerting, error tracking, centralized logs, WAF/bot control, or environment separation. | An incident or deletion is undetected or unrecoverable. | Configure and test outside this repo. Open. |
| F-11 | Medium | Upload security | cook.js, Storage policies | User filenames determined extensions; failures/replacements left orphaned objects; no malware scanning. | MIME spoofing or abandoned sensitive files accumulate. | MIME allowlist, canonical extension, UUID name, rollback/delete. Malware scanning remains open. |
| F-12 | Medium | Consent/privacy | signup and identity schema | Marketing opt-in defaulted true and was preselected. | Users are subscribed without affirmative consent. | Default and UI changed to false/unchecked. Fixed. |
| F-13 | Medium | UI integrity | menu route/menu.js | Fake sample food remained visible when data failed or was empty. | Customers interpret mock inventory as available food. | Explicit loading, empty, and failure states. Fixed. |
| F-14 | Medium | Accessibility | navigation HTML/CSS/JS | ARIA menu roles lacked application-menu keyboard behavior; Escape was defeated by `:focus-within`. | Keyboard/screen-reader users cannot predictably operate navigation. | Native link semantics, explicit state, Escape focus behavior. Fixed; manual AT QA open. |
| F-15 | Medium | Privacy | admin application page | Google Analytics loaded on a privileged PII page. | Admin navigation/metadata can be sent to a third party. | Analytics removed from admin page. Fixed. |
| F-16 | Medium | Supply chain | all HTML, Edge imports | Browser CDN dependencies use floating major versions and no SRI; one Deno import remains ranged. | Upstream compromise or incompatible release executes in trusted origin. | Pin browser assets with verified SRI/self-host; Supabase Edge imports pinned. Browser pinning open. |
| F-17 | Medium | Rate limiting/abuse | Auth, Edge Function, waitlist | No application-level throttles or CAPTCHA are defined. | Automated signup/login/reset/waitlist abuse or admin endpoint pressure. | Supabase limits plus gateway/WAF/CAPTCHA and alerts. Open. |
| F-18 | Medium | Performance | images, styles.css, JS | Images total 5.2 MB; hero frames are about 1.1 MB; global CSS is 79 KB. | Slow mobile load and excess transfer/parse cost. | Responsive AVIF/WebP, preload only LCP, lazy-load below fold, split CSS/JS. Open. |
| F-19 | Medium | QA/reliability | tests/deployment | No authenticated browser E2E, multi-browser, screen-reader, live migration, or failure-injection suite exists. | Client/database integration regressions escape static tests. | Add seeded local Supabase and Playwright matrix. Open. |
| F-20 | Medium | Admin scalability | admin review RPC/UI | Review history is unbounded and administration roles share broad access. | Large history degrades UI; support role can access more PII than needed. | Cursor pagination and role-specific RPC authorization. Open. |
| F-21 | Low | Documentation | README/docs/auth | Documentation still describes a waitlist-only app, old schemas, removed script, and outdated role behavior. | Operators follow incorrect deployment/testing steps. | Rewrite after architecture is finalized. Open. |
| F-22 | Low | Asset hygiene | images | Unused raster logo variants add repository/deploy weight. | Larger artifacts and cache waste. | Remove unused assets after usage confirmation. Open. |
| F-23 | High | Deployment integrity | remote migration history, migrations | Five remote migration versions are absent from this repository, so the dry-run refuses to proceed. | A repair/push based on incomplete history can silently omit or overwrite intended database behavior. | Recover the exact historical migrations and reconcile in staging before any push. Open. |

## 3. Detailed Findings

### F-01 — Missing transaction domains

- **Root cause:** the repository implements discovery/onboarding but none of the PRD's order, payment, refund, messaging, review, or customer-address data models.
- **Reproduction:** enumerate routes, migrations, RPCs, and functions; no checkout endpoint, order table, immutable price snapshot, payment intent/webhook, idempotency key, state machine, or ownership policy exists.
- **Security impact:** price manipulation, replay, double-spend, refund, order-state, and cross-customer tests cannot be passed because no secure implementation exists.
- **Business impact:** the primary revenue flow cannot operate safely or correctly.

### F-02 — Anonymous account enumeration

- **Root cause:** `public.lck_get_signup_account_status(text)` was a security-definer anonymous RPC returning `active` or `available`.
- **Reproduction:** anonymous POSTs to the linked project's REST RPC returned `"active"` for the bootstrap address and `"available"` for a random address.
- **Security impact:** targeted phishing and credential attacks.
- **Business impact:** privacy breach and user trust loss.

### F-03 through F-10 — High-risk platform findings

- **Root causes:** public Storage flags; UI-dependent authorization; non-serialized constraints; multi-request schedule writes; missing labeling constraints; weak/unapplied Auth configuration; incomplete privileged audit coverage; and absent production operations.
- **Reproduction:** use direct PostgREST/Storage requests instead of UI, issue concurrent mutations, interrupt schedule saving, insert active food with empty arrays, inspect source Auth config, inspect private tables/triggers, and inspect deployment artifacts.
- **Security impact:** unauthorized publication/media access, invariant bypass, weak admin protection, missing forensic evidence, and unrecoverable incidents.
- **Business impact:** privacy exposure, unsafe food listings, inconsistent kitchens, moderation failure, and outage/data-loss risk.

### F-11 through F-17 — Medium security/privacy findings

- **Root causes:** trusting client filenames, incomplete object cleanup, opt-out marketing, placeholder production content, incorrect ARIA semantics, third-party tracking on admin pages, floating dependencies, and no abuse-control layer.
- **Reproduction:** upload a misleading extension, fail after upload, submit signup unchanged, force menu query failure, navigate menus by keyboard, inspect admin network dependencies, resolve CDN URLs at different times, and automate public forms.
- **Security impact:** file handling risk, privacy noncompliance, misleading UI, accessibility denial, supply-chain exposure, and automated abuse.
- **Business impact:** storage cost, regulatory complaints, conversion loss, admin privacy leakage, and service degradation.

### F-18 through F-23 — Quality and operational findings

- **Root causes:** unoptimized raster assets, monolithic static assets, minimal tests, unbounded review history, broad admin role equivalence, stale docs/assets, and database changes not preserved in the current migration chain.
- **Reproduction:** measure repository assets, review test inventory, query all review history, compare role predicates, follow README instructions, and run `supabase db push --linked --dry-run`. The CLI reports missing remote versions `202605240001`, `20260526014506`, `20260526202250`, `20260526210427`, and `20260526232914`.
- **Security impact:** weaker regression confidence and least privilege; database drift prevents a trustworthy security deployment.
- **Business impact:** poorer mobile experience, slower administration, deployment mistakes, and unsafe or blocked releases.

## 4. Remediation

All repository-safe high-risk fixes for implemented functionality are included in `20260622001814_production_readiness_hardening.sql` and associated frontend changes. Representative patches:

### Account enumeration

Before:

```sql
grant execute on function public.lck_get_signup_account_status(text) to anon;
```

After:

```sql
revoke all on function public.lck_get_signup_account_status(text)
  from public, anon, authenticated;
drop function if exists public.lck_get_signup_account_status(text);
```

The existence oracle is removed; signup and recovery retain generic responses.

### Moderator-enforced kitchen lock

Before:

```sql
new.cook_id := auth.uid();
return new;
```

After:

```sql
new.moderator_disabled_at := old.moderator_disabled_at;
new.moderator_disabled_by := old.moderator_disabled_by;
if old.moderator_disabled_at is not null and new.is_public then
  raise exception using message =
    'The moderator has disabled this kitchen. Please reach out to us at info@localcokitchen.com for more information.';
end if;
```

Enforcement occurs below the UI, so direct API calls cannot clear or bypass the lock.

### Private cook media

Before:

```sql
insert into storage.buckets (...) values ('cook-menu-images', ..., true, ...);
create policy "Anyone reads menu images" ... using (bucket_id = 'cook-menu-images');
```

After:

```sql
update storage.buckets set public = false
where id in ('cook-profile-images', 'cook-menu-images');
-- SELECT requires ownership, admin, or an approved public kitchen/active item.
```

The browser stores paths and requests one-hour signed URLs; draft objects are no longer public by URL.

### Concurrency and atomic schedules

Before:

```sql
select count(*) into active_count from cook_menu_items where cook_id = new.cook_id;
```

After:

```sql
perform pg_advisory_xact_lock(
  hashtextextended('cook-menu-limit:' || new.cook_id::text, 0)
);
```

Pickup windows are replaced in one security-invoker transaction and protected by a unique active cook/day index. Concurrent or interrupted requests cannot create partial accepted state.

### Upload safety

Before:

```js
const extension = file.name.split(".").pop();
```

After:

```js
const extension = fileExtensions.get(file.type);
const path = `${userId}/${crypto.randomUUID()}.${extension}`;
```

Only allowlisted MIME types determine canonical extensions. Database failures remove newly uploaded objects and successful replacements delete superseded objects.

### Edge Function origin and dependency controls

Before:

```ts
"Access-Control-Allow-Origin": "*"
import { createClient } from "jsr:@supabase/supabase-js@2";
```

After:

```ts
...(allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {})
import { createClient } from "jsr:@supabase/supabase-js@2.106.2";
```

Bearer verification and admin/AAL2 checks remain mandatory; browser cross-origin access is limited to known origins.

Other completed fixes include stronger Auth settings, TOTP, explicit marketing consent, food allergen/ingredient enforcement, safe signed media rendering, removal of fake menu inventory, removal of admin analytics, security headers, admin login/moderation audit records, corrected native navigation semantics, and upload rollback.

## 5. New Tests

Added:

- `test/security-regression.test.js`: executable DOM sink/secret scan, Auth policy, RLS presence, migration invariants, headers, upload extension handling, signed private media.
- `test/static-routes.test.js`: route structure, unique IDs, label targets, internal asset/link resolution, inline-handler and ARIA-role regression, truthful menu states.

Verification results:

```text
npm test                 18 passed, 0 failed
node --check js/*.js     passed
git diff --check         passed
HTTP route smoke test    21/21 returned 200
```

Not executable in this environment:

- Supabase migration dry-run: connected but stopped safely because five remote migration versions are missing locally; no changes were applied.
- Local database/security integration: Docker unavailable.
- Browser automation: the browser execution capability was unavailable.
- Authenticated cross-browser and assistive-technology testing: requires seeded users and browser/device infrastructure.

Required next test layer:

- Playwright projects for Chromium, Firefox, WebKit, and mobile viewports.
- Seeded customer/cook/admin/AAL1/AAL2 users against local Supabase.
- Negative RLS tests for every table and Storage bucket.
- Concurrency tests for menu caps and pickup schedules.
- Auth recovery, confirmation, MFA, moderation-lock, signed URL expiry, notification retry, and network-failure flows.
- When transaction domains are built: immutable price snapshot, idempotent checkout/webhooks/refunds, ownership, impossible state transitions, replay, and double-spend tests.

## 6. Remaining Risks

1. Recover or pull the five missing historical migrations, compare their SQL with the current schema, and reconcile the migration ledger in staging. Do not run `migration repair` or push the hardening migration until this is reviewed. Then apply the pending migration/configuration and run Supabase advisors and negative-role integration tests. The confirmed deployed enumeration remains live until deployment.
2. Build orders/payments/refunds/messages/reviews/addresses with server-authoritative totals, idempotency, explicit state machines, RLS, audit logs, and payment-provider webhooks. Never store raw card data.
3. Configure rate limits, CAPTCHA/bot defense, monitoring, alerting, centralized redacted logs, backup retention, point-in-time recovery, restore drills, secret rotation, and separate staging/production projects.
4. Add malware scanning/quarantine for regulatory documents; MIME/size restrictions alone do not detect malicious content.
5. Pin/self-host browser CDN dependencies with verified SRI and remove unnecessary third parties.
6. Validate legacy rows, then change all new `NOT VALID` constraints to validated constraints.
7. Define data retention, deletion/export, incident response, privacy vendor inventory, and PCI scope. Supabase/Resend/EmailJS/analytics processing must be reflected in legal and operational controls.
8. Add role-specific admin permissions and paginate review history.
9. Optimize images and complete manual WCAG 2.2 AA and multi-browser testing.
10. Update operational documentation after the production architecture is finalized.

## 7. Final Production Verdict

# NOT READY FOR PROD

The implemented cook/admin slice is materially safer after these patches, but the core marketplace transaction system and required production controls are missing. A staging deployment of the migration, authenticated security tests, observability/backup validation, and implementation of the transaction domains are release blockers.
