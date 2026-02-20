<template>
  <div v-if="state" class="state-editor">
    <div class="editor-header">
      <h3 class="editor-title">Edit State</h3>
      <button class="btn btn-ghost" @click="selection.clearSelection()" title="Close">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <!-- Name -->
    <div class="field">
      <label class="field-label">Name</label>
      <input
        class="input input-mono"
        :value="state.name"
        @input="onNameInput"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />
    </div>

    <!-- Toggles -->
    <div class="field-row">
      <div class="toggle-field" @click="toggleStart">
        <span class="field-label">Start State</span>
        <div class="toggle" :class="{ active: state.isStart }"></div>
      </div>
      <div class="toggle-field" @click="toggleAccept">
        <span class="field-label">Accept State</span>
        <div class="toggle" :class="{ active: state.isAccept }"></div>
      </div>
    </div>

    <!-- Transitions -->
    <div class="field">
      <div class="transitions-header">
        <label class="field-label">Transitions</label>
        <button class="btn btn-primary btn-sm" @click="addTransition">+ Add</button>
      </div>

      <div v-if="transitions.length === 0" class="transitions-empty">
        No transitions from this state.
      </div>

      <div class="transitions-list">
        <TransitionEditor
          v-for="t in transitions"
          :key="t.id"
          :transition="t"
          @remove="automaton.removeTransition(t.id)"
        />
      </div>
    </div>

    <!-- Delete -->
    <div class="field">
      <button class="btn btn-danger btn-full" @click="deleteState">
        Delete State
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAutomatonStore } from '~/stores/automaton'
import { useSelectionStore } from '~/stores/selection'

const automaton = useAutomatonStore()
const selection = useSelectionStore()

const state = computed(() => {
  if (!selection.selectedStateId) return null
  return automaton.getState(selection.selectedStateId)
})

const transitions = computed(() => {
  if (!selection.selectedStateId) return []
  return automaton.getTransitionsFrom(selection.selectedStateId)
})

function onNameInput(event: Event) {
  if (!selection.selectedStateId) return
  const name = (event.target as HTMLInputElement).value
  automaton.updateState(selection.selectedStateId, { name })
}

function toggleStart() {
  if (!state.value || state.value.isStart) return
  automaton.setStartState(state.value.id)
}

function toggleAccept() {
  if (!state.value || !selection.selectedStateId) return
  automaton.updateState(selection.selectedStateId, { isAccept: !state.value.isAccept })
}

function addTransition() {
  if (!selection.selectedStateId) return
  const sourceId = selection.selectedStateId
  // Pick the first state that doesn't already have a transition from this source
  const existingTargetIds = new Set(transitions.value.map(t => t.targetId))
  const available = automaton.states.find(s => !existingTargetIds.has(s.id))
  if (!available) return // all states already have transitions from this source
  automaton.addTransition(sourceId, available.id, [])
}

function deleteState() {
  if (!selection.selectedStateId) return
  automaton.removeState(selection.selectedStateId)
  selection.clearSelection()
}
</script>

<style scoped>
.state-editor {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  border-bottom: 1px solid var(--color-panel-border);
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.editor-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.field-row {
  display: flex;
  gap: 16px;
}

.toggle-field {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.transitions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.transitions-empty {
  font-size: 12px;
  color: var(--color-text-secondary);
  padding: 8px 0;
}

.transitions-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.btn-sm {
  font-size: 11px;
  padding: 3px 8px;
}

.btn-full {
  width: 100%;
}
</style>
