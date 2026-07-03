import { describe, expect, it } from "vitest";
import { signUpAction } from "@/features/auth/actions";

const initialState = { ok: false, message: "" };

function signupData(email: string, password: string): FormData {
  const formData = new FormData();
  formData.set("firstName", "Asha");
  formData.set("lastName", "Cook");
  formData.set("email", email);
  formData.set("password", password);
  return formData;
}

describe("signup validation", () => {
  it("returns a password-specific error without sending form values back to the client", async () => {
    const result = await signUpAction(initialState, signupData("asha@example.com", "weak"));

    expect(result).toEqual({
      ok: false,
      message: "Please correct the highlighted fields.",
      fieldErrors: {
        password: "Password must meet all requirements shown below.",
      },
    });
    expect(JSON.stringify(result)).not.toContain("asha@example.com");
    expect(JSON.stringify(result)).not.toContain("weak");
  });

  it("returns a field-specific email error", async () => {
    const result = await signUpAction(initialState, signupData("not-an-email", "StrongPass1!"));

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.email).toBeTruthy();
    expect(result.fieldErrors?.password).toBeUndefined();
  });
});
