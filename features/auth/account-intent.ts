export type AccountIntent = "customer" | "cook";

export function parseAccountIntent(value: unknown): AccountIntent {
  return value === "cook" ? "cook" : "customer";
}

export function postSignInDestination({
  hasCookWorkspace,
  isAdmin,
  requestedAdmin,
}: {
  hasCookWorkspace: boolean;
  isAdmin: boolean;
  requestedAdmin: boolean;
}): "/" | "/admin/" | "/my-shop/" {
  if (requestedAdmin && isAdmin) return "/admin/";
  return hasCookWorkspace ? "/my-shop/" : "/";
}
