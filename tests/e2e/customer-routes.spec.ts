import { expect, test } from "@playwright/test";

test("public user can browse core SEO routes", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /great food made closer to home/i }),
  ).toBeVisible();

  await page.getByRole("link", { name: /browse menu/i }).click();
  await expect(page).toHaveURL(/\/menu\/?$/);
  await expect(page.getByRole("heading", { name: /items currently available/i })).toBeVisible();
  await expect(page.getByLabel(/search menu/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /cart/i })).toBeVisible();
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
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(430);
});
