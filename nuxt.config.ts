// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: ["@pinia/nuxt", "@nuxtjs/color-mode", "@nuxt/eslint"],
  ssr: false,

  components: [
    { path: "~/components", pathPrefix: false },
  ],
  devtools: { enabled: true },

  app: {
    baseURL: "/automata-builder/",
    head: {
      title: "Automata Builder",
      meta: [
        { name: "description", content: "Visual DFA builder and tester" },
      ],
      link: [
        { rel: "icon", type: "image/svg+xml", href: "/automata-builder/favicon.svg" },
        { rel: "icon", type: "image/x-icon", href: "/automata-builder/favicon.ico" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
        },
      ],
    },
  },

  css: ["~/assets/css/main.css"],

  router: {
    options: { hashMode: true },
  },

  colorMode: {
    classSuffix: "",
    preference: "system",
    fallback: "light",
  },

  experimental: {
    appManifest: false,
  },

  compatibilityDate: "2025-07-15",

  eslint: {
    config: {
      stylistic: {
        quotes: "double",
        semi: true,
        indent: 2,
        commaDangle: "always-multiline",
      },
    },
  },
});
