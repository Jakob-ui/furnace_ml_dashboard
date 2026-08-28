<script setup lang="ts">
const colorMode = useColorMode()

const color = computed(() => (colorMode.value === 'dark' ? '#1b1718' : 'white'))

useHead({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: color }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'de'
  }
})

const title = 'Anomalieanalyse'
const description
  = 'Prozesssignale eines Sechs-Zonen-Stoßofens im Zeitverlauf ansehen und, sobald '
    + 'Modellergebnisse vorliegen, erkannte Anomalien nachvollziehen.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
})
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
