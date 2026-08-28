// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/api/**': {
      cors: true
    }
  },

  compatibilityDate: '2026-06-30',

  // Beispieldatensätze mit ausliefern -> im Dev-Server und im Docker-Image unter
  // http://<host>:3000/sample-data/<datei>.csv erreichbar (zum Herunterladen und
  // über den CSV-Import wieder hochladen).
  nitro: {
    // `dir` wird relativ zu nitro.srcDir (= <root>/server) aufgelöst.
    publicAssets: [
      {
        dir: '../sample-data',
        baseURL: '/sample-data',
        maxAge: 3600
      }
    ]
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
