// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";
// @ts-expect-error — no type declarations published for this package
import security from "eslint-plugin-security";

export default withNuxt(
  {
    ignores: [".claude/**"],
  },
  security.configs.recommended,
  {
    rules: {
      // Enforce Number.* static methods over global equivalents
      "no-restricted-globals": ["error",
        { name: "isNaN", message: "Use Number.isNaN() instead." },
        { name: "isFinite", message: "Use Number.isFinite() instead." },
        { name: "parseInt", message: "Use Number.parseInt() instead." },
        { name: "parseFloat", message: "Use Number.parseFloat() instead." },
      ],

      // Match Codacy: flag non-null assertions (Nuxt disables this by default)
      "@typescript-eslint/no-non-null-assertion": "warn",
    },
  },
);
