<template>
  <div class="regex-panel">
    <h3 class="panel-title">
      Regular Expression
    </h3>

    <div class="regex-input-group">
      <input
        ref="inputRef"
        v-model="regexInput"
        type="text"
        class="regex-input"
        placeholder="(a ∪ b)*abb"
        @input="validate"
      >
      <div class="regex-char-buttons">
        <button
          class="btn btn-sm btn-ghost"
          title="Insert union operator"
          @click="insertChar('∪')"
        >
          ∪
        </button>
        <button
          class="btn btn-sm btn-ghost"
          title="Insert epsilon (empty string)"
          @click="insertChar('ε')"
        >
          ε
        </button>
        <button
          class="btn btn-sm btn-ghost"
          title="Insert empty set"
          @click="insertChar('∅')"
        >
          ∅
        </button>
      </div>
    </div>

    <p
      v-if="errorMessage"
      class="conversion-error"
    >
      {{ errorMessage }}
    </p>

    <button
      class="btn btn-ghost btn-full"
      :disabled="!canBuild"
      title="Build NFA-ε from this regular expression via Thompson's construction"
      @click="handleBuild"
    >
      Build NFA
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useAutomatonStore } from "~/stores/automaton";
import { useSimulationStore } from "~/stores/simulation";
import { parseRegex } from "~/utils/regex/parser";
import { regexToNfa } from "~/utils/regex/thompson";

const automaton = useAutomatonStore();
const simulation = useSimulationStore();

const inputRef = ref<HTMLInputElement | null>(null);
const regexInput = ref("");
const errorMessage = ref("");
const isValid = ref(false);

const isSimulating = computed(() => simulation.isRunning || simulation.isFinished);

const canBuild = computed(() =>
  isValid.value
  && regexInput.value.trim().length > 0
  && !isSimulating.value,
);

function validate() {
  errorMessage.value = "";
  isValid.value = false;

  const trimmed = regexInput.value.trim();
  if (trimmed.length === 0) return;

  try {
    parseRegex(trimmed);
    isValid.value = true;
  }
  catch (e) {
    errorMessage.value = e instanceof Error ? e.message : "Invalid expression.";
  }
}

function insertChar(ch: string) {
  const input = inputRef.value;
  if (!input) return;

  const start = input.selectionStart ?? regexInput.value.length;
  const end = input.selectionEnd ?? start;
  const before = regexInput.value.slice(0, start);
  const after = regexInput.value.slice(end);
  regexInput.value = before + ch + after;

  nextTick(() => {
    const newPos = start + ch.length;
    input.setSelectionRange(newPos, newPos);
    input.focus();
  });

  validate();
}

function handleBuild() {
  errorMessage.value = "";

  if (automaton.states.length > 0) {
    const confirmed = window.confirm(
      "This will replace your current automaton. Continue?",
    );
    if (!confirmed) return;
  }

  try {
    const result = regexToNfa(regexInput.value.trim());
    automaton.buildFromTuple(result);
    simulation.reset();
  }
  catch (e) {
    errorMessage.value = e instanceof Error ? e.message : "Construction failed.";
  }
}
</script>
