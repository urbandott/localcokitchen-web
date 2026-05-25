# Testing

This repo currently uses static HTML/CSS/JS, so unit tests are intentionally
framework-independent. The current setup uses Node's built-in test runner and
does not require installed npm dependencies.

## Run Unit Tests

```sh
npm test
```

Watch mode:

```sh
npm run test:watch
```

## Current Test Coverage

The first tested unit is the signup password policy in:

```text
js/password-policy.js
```

Tests live in:

```text
test/password-policy.test.js
```

The password policy is separated from DOM code so it can be reused from:

- Current static pages through `window.LocalCoKitchenPasswordPolicy`
- Future Next.js components or server actions through imports
- Unit tests through `require()`

## Next.js Testing Path

When this project moves to Next.js, keep pure logic tests like the password
policy tests and add component tests for React UI.

Recommended structure:

```text
app/
components/
lib/
test/
```

Move framework-independent logic into `lib/`, for example:

```text
lib/password-policy.ts
```

Then test it with the same assertions used today.

For React component tests in Next.js, add Vitest and React Testing Library:

```sh
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

Example future component test:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SignUpPage from "@/app/signup/page";

describe("SignUpPage", () => {
  it("shows password requirements", () => {
    render(<SignUpPage />);

    expect(screen.getByText("At least 10 characters")).toBeInTheDocument();
    expect(screen.getByText("One lowercase letter")).toBeInTheDocument();
    expect(screen.getByText("One uppercase letter")).toBeInTheDocument();
    expect(screen.getByText("One digit")).toBeInTheDocument();
    expect(screen.getByText("One symbol")).toBeInTheDocument();
  });
});
```

Use Playwright later for end-to-end auth flows such as signing up, requesting a
password reset, and following the recovery redirect.
