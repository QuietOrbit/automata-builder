<template>
  <div class="sidebar-section">
    <div
      class="sidebar-section-header"
      @click="sidebar.toggleSection(sectionId)"
    >
      <span class="sidebar-section-title">{{ title }}</span>
      <svg
        class="sidebar-section-chevron"
        :class="{ expanded: !isCollapsed }"
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
      >
        <path
          d="M5 3l4 4-4 4"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
    <div v-show="!isCollapsed">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSidebarStore } from "~/stores/sidebar";

const props = defineProps<{
  sectionId: string;
  title: string;
}>();

const sidebar = useSidebarStore();

const isCollapsed = computed(() => sidebar.isSectionCollapsed(props.sectionId));
</script>
