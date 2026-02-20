<template>
  <header class="app-header">
    <div class="header-left">
      <h1 class="app-title">Automata Builder</h1>
      <span class="app-badge">DFA</span>
    </div>

    <div class="header-actions">
      <button class="btn btn-ghost" @click="onExport" title="Export JSON">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 2v7M4 6l3 3 3-3M2.5 10v1.5h9V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Export
      </button>
      <button class="btn btn-ghost" @click="triggerImport" title="Import JSON">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 9V2M4 5l3-3 3 3M2.5 10v1.5h9V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Import
      </button>
      <button class="btn btn-ghost" @click="onClear" title="Clear all">
        Clear
      </button>
      <ThemeToggle />
    </div>

    <input
      ref="fileInput"
      type="file"
      accept=".json"
      style="display: none"
      @change="onImport"
    />
  </header>
</template>

<script setup lang="ts">
import { useAutomatonStore } from '~/stores/automaton'
import { useSelectionStore } from '~/stores/selection'
import { useSimulationStore } from '~/stores/simulation'
import type { AutomatonExport } from '~/types/automaton'

const automaton = useAutomatonStore()
const selection = useSelectionStore()
const simulation = useSimulationStore()

const fileInput = ref<HTMLInputElement | null>(null)

function onExport() {
  const data = automaton.exportJSON()
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${automaton.name.replaceAll(/\s+/g, '_')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function triggerImport() {
  fileInput.value?.click()
}

async function onImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const data = JSON.parse(text) as AutomatonExport
    automaton.importJSON(data)
    selection.clearSelection()
    simulation.setInput('')
  } catch (e) {
    console.error('Failed to import automaton:', e)
  }

  // Reset file input so the same file can be imported again
  ;(event.target as HTMLInputElement).value = ''
}

function onClear() {
  automaton.clear()
  selection.clearSelection()
  simulation.setInput('')
}
</script>
