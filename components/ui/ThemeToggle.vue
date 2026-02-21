<template>
  <button
    class="theme-toggle"
    :title="`Switch to ${nextMode} mode`"
    @click="toggle"
  >
    <!-- Sun icon (shown in dark mode) -->
    <svg
      v-if="colorMode.value === 'dark'"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
    >
      <circle
        cx="9"
        cy="9"
        r="3.5"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <path
        d="M9 2v1.5M9 14.5V16M16 9h-1.5M3.5 9H2M13.95 4.05l-1.06 1.06M5.11 12.89l-1.06 1.06M13.95 13.95l-1.06-1.06M5.11 5.11L4.05 4.05"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </svg>
    <!-- Moon icon (shown in light mode) -->
    <svg
      v-else
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
    >
      <path
        d="M15.5 9.84a6.5 6.5 0 01-7.34-7.34A6.5 6.5 0 109.84 15.5a6.5 6.5 0 005.66-5.66z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </button>
</template>

<script setup lang="ts">
const colorMode = useColorMode();

const nextMode = computed(() => (colorMode.value === "dark" ? "light" : "dark"));

function toggle() {
  colorMode.preference = nextMode.value;
}
</script>
