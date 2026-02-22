// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt(
  {
    ignores: [".claude/**"],
  },
  {
    rules: {
      // Enforce Number.* static methods over global equivalents
      "no-restricted-globals": ["error",
        { name: "isNaN", message: "Use Number.isNaN() instead." },
        { name: "isFinite", message: "Use Number.isFinite() instead." },
        { name: "parseInt", message: "Use Number.parseInt() instead." },
        { name: "parseFloat", message: "Use Number.parseFloat() instead." },
      ],
    },
  },
);
