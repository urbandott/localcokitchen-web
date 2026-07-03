import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createContentSecurityPolicy } from "@/lib/security/content-security-policy";

const protectedPrefixes = ["/profile", "/my-shop", "/admin"];

export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const contentSecurityPolicy = createContentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === "development",
  );
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = await updateSession(request, requestHeaders);
  const path = request.nextUrl.pathname;

  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  if (protectedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/).*)"],
};
