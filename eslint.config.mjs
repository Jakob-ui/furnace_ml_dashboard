// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    'vue/no-multiple-template-root': 'off',
    'vue/max-attributes-per-line': ['error', { singleline: 3 }],
    // Unovis-Komponenten deklarieren keine Props -> camelCase-Attribute müssen
    // wörtlich durchgereicht werden (kebab-case käme bei Unovis nicht an).
    'vue/attribute-hyphenation': ['warn', 'always', { ignore: ['visibilityThreshold'] }]
  }
})
