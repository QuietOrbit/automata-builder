<template>
  <div class="app-layout">
    <AppHeader />
    <div class="app-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
</style>
