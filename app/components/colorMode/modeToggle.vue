<script setup lang="ts">
const toggleColorMode = () => {
    const colorMode = useColorMode()
    colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
    <UButton icon="i-heroicons-moon" :icon-active="false" color="neutral" variant="ghost" aria-label="Toggle dark mode"
        @click="toggleColorMode" />
</template>