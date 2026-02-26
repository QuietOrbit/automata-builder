<template>
  <div class="regex-panel">
    <div class="regex-input-group">
      <div class="regex-input-wrapper">
        <input
          ref="inputRef"
          v-model="regexInput"
          type="text"
          class="regex-input"
          placeholder="(a ∪ b)*abb"
          @input="validate"
          @keydown="handleKeydown"
        >
        <button
          v-if="regexInput.length > 0"
          class="btn btn-icon regex-clear-btn"
          title="Clear input"
          @click="clearInput"
        >
          ×
        </button>
      </div>
      <div class="regex-button-grid">
        <div class="regex-button-group">
          <span class="regex-group-label">Operators</span>
          <div class="regex-group-buttons">
            <button
              class="btn regex-calc-btn"
              title="Union"
              @click="insertChar('∪')"
            >
              ∪
            </button>
            <button
              class="btn regex-calc-btn"
              title="Kleene star"
              @click="insertChar('*')"
            >
              *
            </button>
            <button
              class="btn regex-calc-btn"
              title="Epsilon (empty string)"
              @click="insertChar('ε')"
            >
              ε
            </button>
            <button
              class="btn regex-calc-btn"
              title="Empty set"
              @click="insertChar('∅')"
            >
              ∅
            </button>
          </div>
        </div>

        <div class="regex-button-separator" />

        <div class="regex-button-group">
          <span class="regex-group-label">Parens</span>
          <div class="regex-group-buttons">
            <button
              class="btn regex-calc-btn"
              title="Open parenthesis"
              @click="insertChar('(')"
            >
              (
            </button>
            <button
              class="btn regex-calc-btn"
              title="Close parenthesis"
              @click="insertChar(')')"
            >
              )
            </button>
          </div>
        </div>

        <div class="regex-button-separator" />

        <div class="regex-button-group">
          <span class="regex-group-label">Edit</span>
          <div class="regex-group-buttons">
            <button
              class="btn regex-calc-btn"
              title="Delete"
              @click="handleBackspace"
            >
              ⌫
            </button>
          </div>
        </div>
      </div>
      <div class="regex-button-group regex-alphabet-group">
        <span class="regex-group-label">Alphabet</span>
        <div class="regex-group-buttons regex-alphabet-buttons">
          <button
            v-for="letter in alphabetLetters"
            :key="letter"
            class="btn regex-calc-btn"
            :title="`Insert ${letter}`"
            @click="insertChar(letter)"
          >
            {{ letter }}
          </button>
          <button
            v-if="alphabetLetters.length < 26"
            class="btn regex-calc-btn regex-add-letter-btn"
            title="Add next letter"
            @click="addNextLetter"
          >
            +
          </button>
        </div>
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

const alphabetLetters = ref<string[]>(["a", "b"]);

function addNextLetter() {
  const allLetters = "abcdefghijklmnopqrstuvwxyz";
  const existing = new Set(alphabetLetters.value);
  const next = [...allLetters].find(ch => !existing.has(ch));
  if (next) {
    alphabetLetters.value.push(next);
  }
}

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

function clearInput() {
  regexInput.value = "";
  alphabetLetters.value = ["a", "b"];
  validate();
  inputRef.value?.focus();
}

/** Map uppercase keys to special regex symbols. */
const KEY_ALIASES: Record<string, string> = {
  U: "∪",
  E: "ε",
  O: "∅",
};

function handleKeydown(event: KeyboardEvent) {
  const alias = KEY_ALIASES[event.key];
  if (alias) {
    event.preventDefault();
    insertChar(alias);
  }
}

function handleBackspace() {
  const input = inputRef.value;
  if (!input) return;

  const start = input.selectionStart ?? regexInput.value.length;
  const end = input.selectionEnd ?? start;

  if (start !== end) {
    regexInput.value = regexInput.value.slice(0, start) + regexInput.value.slice(end);
    nextTick(() => {
      input.setSelectionRange(start, start);
      input.focus();
    });
  }
  else if (start > 0) {
    regexInput.value = regexInput.value.slice(0, start - 1) + regexInput.value.slice(start);
    nextTick(() => {
      input.setSelectionRange(start - 1, start - 1);
      input.focus();
    });
  }

  validate();
}

function handleBuild() {
  errorMessage.value = "";

  if (automaton.states.length > 0) {
    const confirmed = globalThis.confirm(
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
