<template>
  <div class="sidebar-tab-bar">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      class="btn btn-sm"
      :class="modelValue === tab.value ? 'btn-primary' : 'btn-ghost'"
      @click="$emit('update:modelValue', tab.value)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { SidebarTab } from "~/stores/sidebar";

defineProps<{
  modelValue: SidebarTab;
}>();

defineEmits<{
  "update:modelValue": [tab: SidebarTab];
}>();

const tabs = [
  { value: SidebarTab.Build, label: "Build" },
  { value: SidebarTab.Transform, label: "Transform" },
  { value: SidebarTab.Simulate, label: "Simulate" },
] as const;
</script>
