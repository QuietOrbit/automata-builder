<template>
  <header class="app-header">
    <div class="header-left">
      <h1 class="app-title">Automata Builder</h1>
      <span class="app-badge">DFA</span>
    </div>

    <div class="header-actions">
      <div class="export-wrapper">
        <button ref="exportBtnRef" class="btn btn-ghost" @click="exportMenuOpen = !exportMenuOpen" title="Export">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v7M4 6l3 3 3-3M2.5 10v1.5h9V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Export
        </button>

        <div v-if="exportMenuOpen" class="tuple-dropdown-backdrop" @click="exportMenuOpen = false" />
        <div v-if="exportMenuOpen" class="tuple-dropdown" :style="dropdownStyle">
          <div class="tuple-dropdown-item" @click="onExportJSON">
            JSON <span class="export-format-hint">Data</span>
          </div>
          <div class="tuple-dropdown-item" @click="onExportSVG">
            SVG <span class="export-format-hint">Vector</span>
          </div>
          <div class="tuple-dropdown-item" @click="onExportPNG">
            PNG <span class="export-format-hint">Image</span>
          </div>
          <div class="tuple-dropdown-item" @click="onExportJPEG">
            JPEG <span class="export-format-hint">Image</span>
          </div>
        </div>
      </div>
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
import { exportSvgBlob, exportRasterBlob, triggerDownload } from '~/utils/export'
import type { AutomatonExport } from '~/types/automaton'

const automaton = useAutomatonStore()
const selection = useSelectionStore()
const simulation = useSimulationStore()

const fileInput = ref<HTMLInputElement | null>(null)
const exportMenuOpen = ref(false)
const exportBtnRef = ref<HTMLButtonElement | null>(null)

const dropdownStyle = computed(() => {
  if (!exportBtnRef.value) return {}
  const rect = exportBtnRef.value.getBoundingClientRect()
  return {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
  }
})

function sanitizedName(): string {
  return automaton.name.replaceAll(/\s+/g, '_')
}

function getSvgElement(): SVGSVGElement | null {
  return document.querySelector('svg.svg-canvas')
}

function getPositions() {
  return automaton.states.map((s) => s.position)
}

function onExportJSON() {
  exportMenuOpen.value = false
  const data = automaton.exportJSON()
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  triggerDownload(blob, `${sanitizedName()}.json`)
}

function onExportSVG() {
  exportMenuOpen.value = false
  const svg = getSvgElement()
  if (!svg) return
  const blob = exportSvgBlob(svg, getPositions())
  if (!blob) return
  triggerDownload(blob, `${sanitizedName()}.svg`)
}

async function onExportPNG() {
  exportMenuOpen.value = false
  const svg = getSvgElement()
  if (!svg) return
  const blob = await exportRasterBlob(svg, getPositions(), 'png')
  if (!blob) return
  triggerDownload(blob, `${sanitizedName()}.png`)
}

async function onExportJPEG() {
  exportMenuOpen.value = false
  const svg = getSvgElement()
  if (!svg) return
  const blob = await exportRasterBlob(svg, getPositions(), 'jpeg')
  if (!blob) return
  triggerDownload(blob, `${sanitizedName()}.jpeg`)
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
