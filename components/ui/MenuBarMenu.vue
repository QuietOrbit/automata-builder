<template>
  <div class="menu-bar-menu">
    <button
      ref="triggerRef"
      :class="['btn', 'btn-ghost', 'menu-bar-trigger', { 'menu-bar-trigger-open': open }]"
      @click="toggle"
    >
      {{ label }}
    </button>

    <div
      v-if="open"
      class="tuple-dropdown-backdrop"
      @click="closeAll"
    />

    <div
      v-if="open"
      class="menu-bar-dropdown"
      :style="dropdownStyle"
    >
      <div
        v-for="(group, gi) in groups"
        :key="gi"
        class="menu-bar-group-label"
        @pointerenter="onGroupEnter(gi, $event)"
        @pointerleave="onGroupLeave"
      >
        <span>{{ group.label }}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
        >
          <path
            d="M3.5 2L7 5L3.5 8"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
    </div>

    <div
      v-if="open && activeGroup !== null"
      class="menu-bar-submenu"
      :style="submenuStyle"
      @pointerenter="onSubmenuEnter"
      @pointerleave="onGroupLeave"
    >
      <div
        v-for="item in groups[activeGroup].items"
        :key="item.id"
        class="menu-bar-submenu-item"
        @click="onItemClick(item.id)"
      >
        <span class="menu-bar-item-name">{{ item.name }}</span>
        <span class="menu-bar-item-desc">{{ item.description }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/** A single selectable item within a menu group. */
export interface MenuItem {
  /** Unique identifier emitted on selection. */
  id: string;
  /** Display name shown in the submenu. */
  name: string;
  /** Secondary description (e.g. formal language notation). */
  description: string;
}

/** A group of related menu items with a shared label. */
export interface MenuGroup {
  /** Group header text shown in the dropdown. */
  label: string;
  /** Items in this group. */
  items: MenuItem[];
}

defineProps<{
  /** Trigger button text. */
  label: string;
  /** Grouped items to display. */
  groups: MenuGroup[];
}>();

const emit = defineEmits<{
  select: [itemId: string];
}>();

const triggerRef = ref<HTMLButtonElement | null>(null);
const open = ref(false);
const activeGroup = ref<number | null>(null);

/** Timer ID for the 100ms hover delay. */
let hoverTimer: ReturnType<typeof setTimeout> | null = null;

/** Pixel position of the dropdown (below trigger). */
const dropdownPos = ref({ top: 0, left: 0 });

/** Pixel position of the hovered group row (for submenu alignment). */
const groupRowTop = ref(0);

/** Right edge of the dropdown (for submenu left position). */
const dropdownRight = ref(0);

const dropdownStyle = computed(() => ({
  top: `${dropdownPos.value.top}px`,
  left: `${dropdownPos.value.left}px`,
}));

const submenuStyle = computed(() => ({
  top: `${groupRowTop.value}px`,
  left: `${dropdownRight.value}px`,
}));

function toggle() {
  if (open.value) {
    closeAll();
  }
  else {
    openDropdown();
  }
}

function openDropdown() {
  if (!triggerRef.value) return;
  const rect = triggerRef.value.getBoundingClientRect();
  dropdownPos.value = { top: rect.bottom + 4, left: rect.left };
  open.value = true;
  activeGroup.value = null;
}

function closeAll() {
  clearTimer();
  open.value = false;
  activeGroup.value = null;
}

function clearTimer() {
  if (hoverTimer !== null) {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }
}

function onGroupEnter(index: number, event: PointerEvent) {
  clearTimer();
  activeGroup.value = index;

  const target = event.currentTarget as HTMLElement;
  const rowRect = target.getBoundingClientRect();
  groupRowTop.value = rowRect.top;

  const parent = target.parentElement;
  if (parent) {
    const parentRect = parent.getBoundingClientRect();
    dropdownRight.value = parentRect.right;
  }
}

function onGroupLeave() {
  clearTimer();
  hoverTimer = setTimeout(() => {
    activeGroup.value = null;
  }, 100);
}

function onSubmenuEnter() {
  clearTimer();
}

function onItemClick(itemId: string) {
  emit("select", itemId);
  closeAll();
}

// Close on Escape key at the document level
function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && open.value) {
    closeAll();
  }
}

onMounted(() => {
  document.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  document.removeEventListener("keydown", onKeydown);
  clearTimer();
});
</script>
