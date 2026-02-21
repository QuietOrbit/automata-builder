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
      <span class="field-label">Transitions</span>

      <div class="transitions-list">
        <!-- DFA mode: one fixed row per state -->
        <template v-if="isDFA">
          <TransitionEditor
            v-for="row in dfaRows"
            :key="row.targetId"
            :source-id="state.id"
            :transitions="row.transitions"
            :fixed-target="row.targetId"
          />
        </template>

        <!-- NFA mode: grouped rows + new row -->
        <template v-else>
          <TransitionEditor
            v-for="group in transitionGroups"
            :key="group.targetId"
            :source-id="state.id"
            :transitions="group.transitions"
          />
          <TransitionEditor
            :key="'new-' + transitionGroups.length"
            :source-id="state.id"
            :transitions="[]"
          />
        </template>
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
import { AutomatonType } from '~/types/automaton'

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

const isDFA = computed(() => automaton.type === AutomatonType.DFA)

// DFA mode: one row per state in the automaton
const dfaRows = computed(() => {
  if (!selection.selectedStateId) return []
  return automaton.states.map(targetState => ({
    targetId: targetState.id,
    transitions: transitions.value.filter(t => t.targetId === targetState.id),
  }))
})

// NFA mode: group existing transitions by target
const transitionGroups = computed(() => {
  const groupMap = new Map<string, typeof transitions.value>()
  for (const t of transitions.value) {
    const existing = groupMap.get(t.targetId)
    if (existing) {
      existing.push(t)
    } else {
      groupMap.set(t.targetId, [t])
    }
  }
  return Array.from(groupMap.entries()).map(([targetId, transitions]) => ({
    targetId,
    transitions,
  }))
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

function deleteState() {
  if (!selection.selectedStateId) return
  automaton.removeState(selection.selectedStateId)
  selection.clearSelection()
}
</script>
