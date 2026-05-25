import { createClient, type User } from "jsr:@supabase/supabase-js@2";

type VerifiedUserResult =
  | {
      error: null;
      user: User;
    }
  | {
      error: Response;
      user: null;
    };

export async function getVerifiedUser(req: Request): Promise<VerifiedUserResult> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return {
      error: new Response(JSON.stringify({ error: "Missing bearer token." }), {
        headers: { "Content-Type": "application/json" },
        status: 401,
      }),
      user: null,
    };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      error: new Response(JSON.stringify({ error: "Invalid or expired session." }), {
        headers: { "Content-Type": "application/json" },
        status: 401,
      }),
      user: null,
    };
  }

  return { error: null, user };
}
