<template>
  <!-- Trigger button -->
  <button
    class="target-select-trigger mono"
    :class="{ disabled, compact, narrow }"
    :disabled="disabled"
    @click="toggle"
  >
    <span class="target-select-label">{{ selectedLabel }}</span>
    <svg
      v-if="!compact"
      class="target-select-chevron"
      :class="{ open: isOpen }"
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
    >
      <path
        d="M2.5 4L5 6.5L7.5 4"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </button>

  <!-- Backdrop -->
  <div
    v-if="isOpen"
    class="tuple-dropdown-backdrop"
    @click="close"
  />

  <!-- Dropdown list -->
  <div
    v-if="isOpen"
    class="tuple-dropdown"
    :style="{ top: dropdownY + 'px', left: dropdownX + 'px', minWidth: dropdownWidth + 'px' }"
  >
    <!-- Clear option -->
    <div
      v-if="allowClear"
      class="tuple-dropdown-item mono"
      :class="{ 'is-selected': !modelValue }"
      @click="select('')"
    >
      -
    </div>

    <div
      v-for="option in options"
      :key="option.id"
      class="tuple-dropdown-item mono"
      :class="{ 'is-selected': option.id === modelValue }"
      @pointerenter="hoverStore.setHoveredState(option.id)"
      @pointerleave="hoverStore.clearHoveredState()"
      @click="select(option.id)"
    >
      {{ option.name }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useHoverStore } from "~/stores/hover";

const props = withDefaults(defineProps<{
  modelValue: string;
  options: { id: string; name: string }[];
  disabled?: boolean;
  placeholder?: string;
  compact?: boolean;
  narrow?: boolean;
  allowClear?: boolean;
}>(), {
  disabled: false,
  placeholder: "Target...",
  compact: false,
  narrow: false,
  allowClear: false,
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const hoverStore = useHoverStore();

const isOpen = ref(false);
const dropdownX = ref(0);
const dropdownY = ref(0);
const dropdownWidth = ref(0);

const selectedLabel = computed(() => {
  const match = props.options.find(o => o.id === props.modelValue);
  return match?.name ?? props.placeholder;
});

function toggle(event: MouseEvent) {
  if (props.disabled) return;
  if (isOpen.value) {
    close();
    return;
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  dropdownX.value = rect.left;
  dropdownY.value = rect.bottom + 2;
  dropdownWidth.value = rect.width;
  isOpen.value = true;
}

function select(id: string) {
  emit("update:modelValue", id);
  close();
}

function close() {
  isOpen.value = false;
  hoverStore.clearHoveredState();
}
</script>
