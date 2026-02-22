<template>
  <div
    v-if="automaton.type === AutomatonType.NFA"
    class="conversion-panel"
  >
    <h3 class="panel-title">
      Conversions
    </h3>

    <div class="conversion-buttons">
      <button
        class="btn btn-ghost btn-full"
        :disabled="!canRemoveEpsilon"
        title="Remove all ε-transitions, producing an equivalent NFA"
        @click="handleRemoveEpsilon"
      >
        Remove ε-transitions
      </button>
      <button
        class="btn btn-ghost btn-full"
        :disabled="!canConvertToDfa"
        title="Convert NFA to equivalent DFA via subset construction"
        @click="handleConvertToDfa"
      >
        Convert to DFA
      </button>
    </div>

    <p
      v-if="errorMessage"
      class="conversion-error"
    >
      {{ errorMessage }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useAutomatonStore } from "~/stores/automaton";
import { useSimulationStore } from "~/stores/simulation";
import { AutomatonType } from "~/types/automaton";
import { removeEpsilonTransitions, subsetConstruction } from "~/utils/conversion";

const automaton = useAutomatonStore();
const simulation = useSimulationStore();
const errorMessage = ref("");

const isSimulating = computed(() => simulation.isRunning || simulation.isFinished);

const canRemoveEpsilon = computed(() =>
  !isSimulating.value
  && automaton.hasEpsilonTransitions,
);

const canConvertToDfa = computed(() =>
  !isSimulating.value,
);

function clearError() {
  errorMessage.value = "";
}

function handleRemoveEpsilon() {
  clearError();

  if (!automaton.startState) {
    errorMessage.value = "Cannot convert: no start state defined.";
    return;
  }

  try {
    const result = removeEpsilonTransitions(automaton.states, automaton.transitions);
    automaton.buildFromTuple(result);
    simulation.reset();
  }
  catch (e) {
    errorMessage.value = e instanceof Error ? e.message : "Conversion failed.";
  }
}

function handleConvertToDfa() {
  clearError();

  if (!automaton.startState) {
    errorMessage.value = "Cannot convert: no start state defined.";
    return;
  }

  try {
    const result = subsetConstruction(automaton.states, automaton.transitions, automaton.alphabet);
    automaton.buildFromTuple(result);
    simulation.reset();
  }
  catch (e) {
    errorMessage.value = e instanceof Error ? e.message : "Conversion failed.";
  }
}
</script>
