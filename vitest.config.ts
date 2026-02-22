import { defineVitestConfig } from "@nuxt/test-utils/config";

export default defineVitestConfig({
  test: {
    environment: "nuxt",
    coverage: {
      provider: "v8",
      include: ["utils/**", "stores/**", "composables/**", "types/**"],
      exclude: ["**/*.test.ts"],
    },
  },
});
