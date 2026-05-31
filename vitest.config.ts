import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Vitest configuration.
 *
 * The default test environment is `node`, which is all the pure-utility tests
 * (e.g. `lib/whatsapp.test.ts`, `lib/duplicate-checks.test.ts`) need.
 *
 * Component tests that require a DOM (e.g. `app/admin/page.test.tsx`, task 8.4)
 * can opt into jsdom per-file with a docblock comment at the top of the file
 * without changing this config:
 *
 *   // @vitest-environment jsdom
 *
 * The `@/*` alias mirrors the `paths` mapping in `tsconfig.json` so tests can
 * import modules the same way the application code does (e.g. `@/lib/phone`).
 */
export default defineConfig({
  // The React plugin enables JSX/TSX transformation for component tests
  // (e.g. `app/admin/page.test.tsx`, task 8.4). Pure-utility tests are
  // unaffected and continue to run under the default `node` environment.
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    // Don't fail the run before any test files exist (they arrive in later tasks).
    passWithNoTests: true,
    // Only this project's own source dirs hold test files. Scoping the include
    // avoids scanning vendored/tooling folders (e.g. `.kilo/node_modules`).
    include: ["lib/**/*.{test,spec}.{ts,tsx}", "app/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.kilo/**",
      "**/dist/**",
    ],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
