<script setup lang="ts">
const colorMode = useColorMode()

function toggle() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <ClientOnly>
    <UButton
      :icon="colorMode.value === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun'"
      color="neutral"
      variant="ghost"
      aria-label="Hell/Dunkel umschalten"
      @click="toggle"
    />
    <template #fallback>
      <UButton
        icon="i-lucide-sun"
        color="neutral"
        variant="ghost"
        aria-label="Hell/Dunkel umschalten"
      />
    </template>
  </ClientOnly>
</template>
