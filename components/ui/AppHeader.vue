<template>
  <header class="app-header">
    <div class="header-left">
      <h1 class="app-title">
        Automata Builder
      </h1>
      <span class="app-badge">{{ automaton.type }}</span>
    </div>

    <div class="header-actions">
      <div class="export-wrapper">
        <button
          ref="exportBtnRef"
          class="btn btn-ghost"
          title="Export"
          @click="exportMenuOpen = !exportMenuOpen"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
          >
            <path
              d="M7 2v7M4 6l3 3 3-3M2.5 10v1.5h9V10"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          Export
        </button>

        <div
          v-if="exportMenuOpen"
          class="tuple-dropdown-backdrop"
          @click="exportMenuOpen = false"
        />
        <div
          v-if="exportMenuOpen"
          class="tuple-dropdown"
          :style="dropdownStyle"
        >
          <div
            class="tuple-dropdown-item"
            @click="onExportJSON"
          >
            JSON <span class="export-format-hint">Data</span>
          </div>
          <div
            class="tuple-dropdown-item"
            @click="onExportSVG"
          >
            SVG <span class="export-format-hint">Vector</span>
          </div>
          <div
            class="tuple-dropdown-item"
            @click="onExportPNG"
          >
            PNG <span class="export-format-hint">Image</span>
          </div>
          <div
            class="tuple-dropdown-item"
            @click="onExportJPEG"
          >
            JPEG <span class="export-format-hint">Image</span>
          </div>
        </div>
      </div>
      <button
        class="btn btn-ghost"
        title="Import JSON"
        @click="triggerImport"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
        >
          <path
            d="M7 9V2M4 5l3-3 3 3M2.5 10v1.5h9V10"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        Import
      </button>
      <button
        class="btn btn-ghost"
        title="Clear all"
        @click="onClear"
      >
        Clear
      </button>
      <a
        href="https://github.com/QuietOrbit/automata-builder"
        target="_blank"
        rel="noopener noreferrer"
        class="btn btn-ghost"
        title="View source on GitHub"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
      </a>
      <ThemeToggle />
    </div>

    <input
      ref="fileInput"
      type="file"
      accept=".json"
      style="display: none"
      @change="onImport"
    >
  </header>
</template>

<script setup lang="ts">
import { useAutomatonStore } from "~/stores/automaton";
import { useSelectionStore } from "~/stores/selection";
import { useSimulationStore } from "~/stores/simulation";
import { exportSvgBlob, exportRasterBlob, triggerDownload } from "~/utils/export";
import type { AutomatonExport } from "~/types/automaton";

const automaton = useAutomatonStore();
const selection = useSelectionStore();
const simulation = useSimulationStore();

const fileInput = ref<HTMLInputElement | null>(null);
const exportMenuOpen = ref(false);
const exportBtnRef = ref<HTMLButtonElement | null>(null);

const dropdownStyle = computed(() => {
  if (!exportBtnRef.value) return {};
  const rect = exportBtnRef.value.getBoundingClientRect();
  return {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
  };
});

function sanitizedName(): string {
  return automaton.name.replaceAll(/\s+/g, "_");
}

function getSvgElement(): SVGSVGElement | null {
  return document.querySelector("svg.svg-canvas");
}

function getPositions() {
  return automaton.states.map(s => s.position);
}

function onExportJSON() {
  exportMenuOpen.value = false;
  const data = automaton.exportJSON();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  triggerDownload(blob, `${sanitizedName()}.json`);
}

function onExportSVG() {
  exportMenuOpen.value = false;
  const svg = getSvgElement();
  if (!svg) return;
  const blob = exportSvgBlob(svg, getPositions());
  if (!blob) return;
  triggerDownload(blob, `${sanitizedName()}.svg`);
}

async function onExportPNG() {
  exportMenuOpen.value = false;
  const svg = getSvgElement();
  if (!svg) return;
  const blob = await exportRasterBlob(svg, getPositions(), "png");
  if (!blob) return;
  triggerDownload(blob, `${sanitizedName()}.png`);
}

async function onExportJPEG() {
  exportMenuOpen.value = false;
  const svg = getSvgElement();
  if (!svg) return;
  const blob = await exportRasterBlob(svg, getPositions(), "jpeg");
  if (!blob) return;
  triggerDownload(blob, `${sanitizedName()}.jpeg`);
}

function triggerImport() {
  fileInput.value?.click();
}

async function onImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text) as AutomatonExport;
    selection.clearSelection();
    simulation.setInput("");
    automaton.importJSON(data);
  }
  catch (e) {
    console.error("Failed to import automaton:", e);
  }

  // Reset file input so the same file can be imported again
  ;(event.target as HTMLInputElement).value = "";
}

function onClear() {
  selection.clearSelection();
  simulation.setInput("");
  automaton.clear();
}
</script>
