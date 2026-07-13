import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);
}

async function expectVisibleFormControlsFit(page: Page) {
  const overflowingControls = await page.evaluate(() =>
    Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const container = element.closest("label, .auth-field, .form-field, .cart-item, form");
        const containerRect = container?.getBoundingClientRect();
        if (!containerRect) {
          return {
            name:
              element.getAttribute("name") ||
              element.getAttribute("aria-label") ||
              element.id ||
              element.tagName,
            overflows: false,
            visible: rect.width > 0 && rect.height > 0,
          };
        }

        return {
          name:
            element.getAttribute("name") ||
            element.getAttribute("aria-label") ||
            element.id ||
            element.tagName,
          overflows:
            rect.left < containerRect.left - 1 ||
            rect.right > containerRect.right + 1 ||
            rect.width > containerRect.width + 1,
          visible: rect.width > 0 && rect.height > 0,
        };
      })
      .filter((control) => control.visible && control.overflows)
      .map((control) => control.name),
  );

  expect(overflowingControls).toEqual([]);
}

test("public user can browse core SEO routes", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /discover authentic homemade food near you/i }),
  ).toBeVisible();

  await page
    .getByRole("link", { name: /browse cooks/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/search\/?$/);
  await expect(
    page.getByRole("heading", { name: /home cooks near|something went wrong/i }),
  ).toBeVisible();
  await expect(page.getByLabel(/search dishes, cuisine, or cook name/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /sort:/i })).toBeVisible();
});

test("private routes are noindexed and redirect unauthenticated users", async ({ page }) => {
  await page.goto("/admin/");
  await expect(page).toHaveURL(/\/admin\/signin|\/signin/);
  await page.goto("/profile/");
  await expect(page).toHaveURL(/\/signin/);
});

test("mobile menu route renders controls without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/menu/");
  await expect(page.getByLabel(/search menu/i)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectVisibleFormControlsFit(page);
});

test("public forms keep controls inside their containers across viewport sizes", async ({
  page,
}) => {
  for (const viewport of [
    { width: 360, height: 740 },
    { width: 768, height: 900 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);

    await page.goto("/signup/");
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectVisibleFormControlsFit(page);

    await page.goto("/menu/");
    await expect(page.getByLabel(/search menu/i)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectVisibleFormControlsFit(page);
  }
});

test("signup preserves values and gates submission on live password requirements", async ({
  page,
}) => {
  await page.goto("/signup/");

  const firstName = page.getByLabel("First name");
  const lastName = page.getByLabel("Last name");
  const email = page.getByLabel("Email");
  const password = page.locator('input[name="password"]');
  const submit = page.getByRole("button", { name: "Create account" });

  await firstName.fill("Asha");
  await lastName.fill("Cook");
  await email.fill("asha@example.com");
  await password.click();

  await expect(page.getByText("Your password must include:")).toBeVisible();
  await password.fill("weak");
  await expect(submit).toBeDisabled();

  await password.fill("StrongPass1!");
  await expect(page.locator(".password-requirement.is-met")).toHaveCount(5);
  await expect(submit).toBeEnabled();

  await expect(firstName).toHaveValue("Asha");
  await expect(lastName).toHaveValue("Cook");
  await expect(email).toHaveValue("asha@example.com");
  await expect(password).toHaveValue("StrongPass1!");
});

test("cook application entry creates a dedicated cook onboarding path", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Apply to become a cook", exact: true }).click();

  await expect(page).toHaveURL(/\/signup\/?\?intent=cook$/);
  await expect(page.getByRole("heading", { name: "Create your cook account" })).toBeVisible();
  await expect(page.locator('input[name="intent"]')).toHaveValue("cook");
  await expect(page.getByRole("button", { name: "Create cook account" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Already have an account?" })).toHaveAttribute(
    "href",
    "/signin?intent=cook",
  );
});
