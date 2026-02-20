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
      <label class="field-label" for="state-name-input">Name</label>
      <input
        id="state-name-input"
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
        <span class="field-label">Transitions</span>
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
  // Default target: self, or first other state
  const targetId = automaton.states[0]?.id ?? sourceId
  automaton.addTransition(sourceId, targetId, '')
}

function deleteState() {
  if (!selection.selectedStateId) return
  automaton.removeState(selection.selectedStateId)
  selection.clearSelection()
}
</script>
