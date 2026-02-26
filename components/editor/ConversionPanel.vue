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
import { buildTupleData, ensureCompleteDfa, renameStatesSequentially, subsetConstruction, tupleToArrays } from "~/utils/conversion";
import { minimizeDfa } from "~/utils/minimization";
import { simplifyNfa } from "~/utils/regex/simplify";

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
    const tuple = buildTupleData(automaton.states, automaton.transitions);
    const simplified = simplifyNfa(tuple);
    automaton.buildFromTuple(simplified);
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
    // Step 1: Simplify NFA-ε → clean NFA (if epsilon transitions present)
    let nfaStates = automaton.states;
    let nfaTransitions = automaton.transitions;
    let nfaAlphabet = automaton.alphabet;

    if (automaton.hasEpsilonTransitions) {
      const tuple = buildTupleData(nfaStates, nfaTransitions);
      const cleanNfa = simplifyNfa(tuple);
      const arrays = tupleToArrays(cleanNfa);
      nfaStates = arrays.states;
      nfaTransitions = arrays.transitions;
      nfaAlphabet = cleanNfa.alphabet;
    }

    // Step 2: Subset construction (NFA → DFA)
    const dfaTuple = subsetConstruction(nfaStates, nfaTransitions, nfaAlphabet);

    // Step 3: Minimize DFA
    const dfaArrays = tupleToArrays(dfaTuple);
    const { tuple: minimized } = minimizeDfa(dfaArrays.states, dfaArrays.transitions);

    // Step 4: Rename states sequentially (q0, q1, ...)
    const renamed = renameStatesSequentially(minimized);

    // Step 5: Add trap state for missing transitions (DFA totality)
    const complete = ensureCompleteDfa(renamed);
    automaton.buildFromTuple(complete);
    simulation.reset();
  }
  catch (e) {
    errorMessage.value = e instanceof Error ? e.message : "Conversion failed.";
  }
}
</script>
