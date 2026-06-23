export function safeRedirectPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const parsed = new URL(value, "https://localcokitchen.com");
    return parsed.origin === "https://localcokitchen.com"
      ? `${parsed.pathname}${parsed.search}`
      : fallback;
  } catch {
    return fallback;
  }
}

export function assertNoPrivateCookField(fieldNames: string[]): boolean {
  const forbidden = new Set([
    "legal_name",
    "phone",
    "pickup_address",
    "food_handler_certificate_url",
    "permit_or_certification_url",
    "review_notes",
    "application_status",
  ]);
  return fieldNames.every((field) => !forbidden.has(field));
}
