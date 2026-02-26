<template>
  <div
    class="canvas-toolbar"
    @pointerdown.stop
  >
    <!-- Zoom out -->
    <button
      class="toolbar-btn"
      title="Zoom out"
      :disabled="zoom <= MIN_ZOOM"
      @click="$emit('zoom-out')"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
      >
        <path
          d="M3 7h8"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
    </button>

    <!-- Zoom label (click to reset) -->
    <button
      class="toolbar-zoom-label"
      title="Reset zoom to 100%"
      @click="$emit('reset-zoom')"
    >
      {{ zoomLabel }}
    </button>

    <!-- Zoom in -->
    <button
      class="toolbar-btn"
      title="Zoom in"
      :disabled="zoom >= MAX_ZOOM"
      @click="$emit('zoom-in')"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
      >
        <path
          d="M7 3v8M3 7h8"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
    </button>

    <div class="toolbar-separator" />

    <!-- Fit to content -->
    <button
      class="toolbar-btn"
      title="Fit to content"
      @click="$emit('fit-to-content')"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
      >
        <path
          d="M1.5 5V2.5a1 1 0 0 1 1-1H5M9 1.5h2.5a1 1 0 0 1 1 1V5M12.5 9v2.5a1 1 0 0 1-1 1H9M5 12.5H2.5a1 1 0 0 1-1-1V9"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <!-- Fullscreen toggle -->
    <button
      class="toolbar-btn"
      :class="{ active: isFullscreen }"
      :title="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'"
      @click="$emit('toggle-fullscreen')"
    >
      <svg
        v-if="!isFullscreen"
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
      >
        <path
          d="M8.5 1.5H12.5V5.5M5.5 12.5H1.5V8.5"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M12.5 1.5L8 6M1.5 12.5L6 8"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
      <svg
        v-else
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
      >
        <path
          d="M12.5 5.5H8.5V1.5M1.5 8.5H5.5V12.5"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M8.5 5.5L13 1M5.5 8.5L1 13"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { MIN_ZOOM, MAX_ZOOM } from "~/composables/useCanvasInteraction";

const props = defineProps<{
  zoom: number;
  isFullscreen: boolean;
}>();

defineEmits<{
  "zoom-in": [];
  "zoom-out": [];
  "reset-zoom": [];
  "fit-to-content": [];
  "toggle-fullscreen": [];
}>();

const zoomLabel = computed(() => `${Math.round(props.zoom * 100)}%`);
</script>
