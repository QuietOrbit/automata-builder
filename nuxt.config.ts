// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: true },

  experimental: {
    appManifest: false,
  },

  app: {
    baseURL: '/automata-builder/',
    head: {
      title: 'Automata Builder',
      meta: [
        { name: 'description', content: 'Visual DFA builder and tester' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap',
        },
      ],
    },
  },

  router: {
    options: { hashMode: true },
  },

  modules: ['@pinia/nuxt', '@nuxtjs/color-mode'],

  colorMode: {
    classSuffix: '',
    preference: 'system',
    fallback: 'light',
  },

  components: [
    { path: '~/components', pathPrefix: false },
  ],

  css: ['~/assets/css/main.css'],

  compatibilityDate: '2025-07-15',
})
