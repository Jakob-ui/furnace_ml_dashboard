<script setup lang="ts">
import Header from '~/components/header/header.vue';

</script>


<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="Home">
        <template #left>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <Header />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <HomeChart />
    </template>
  </UDashboardPanel>
</template>
