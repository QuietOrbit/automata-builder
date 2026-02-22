<template>
  <div
    v-if="automaton.type === AutomatonType.DFA"
    class="minimization-panel"
  >
    <h3 class="panel-title">
      Minimization
    </h3>

    <button
      class="btn btn-ghost btn-full"
      :disabled="!canMinimize"
      title="Minimize DFA using the table-filling (Myhill-Nerode) algorithm"
      @click="handleMinimize"
    >
      Minimize
    </button>

    <p
      v-if="errorMessage"
      class="conversion-error"
    >
      {{ errorMessage }}
    </p>

    <ul
      v-if="mergeMessages.length > 0"
      class="merge-summary"
    >
      <li
        v-for="(msg, i) in mergeMessages"
        :key="i"
      >
        {{ msg }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useAutomatonStore } from "~/stores/automaton";
import { useSimulationStore } from "~/stores/simulation";
import { AutomatonType } from "~/types/automaton";
import { minimizeDfa } from "~/utils/minimization";

const automaton = useAutomatonStore();
const simulation = useSimulationStore();
const errorMessage = ref("");
const mergeMessages = ref<string[]>([]);

const isSimulating = computed(() => simulation.isRunning || simulation.isFinished);

const canMinimize = computed(() =>
  !isSimulating.value
  && automaton.states.length >= 2,
);

function handleMinimize() {
  errorMessage.value = "";
  mergeMessages.value = [];

  if (!automaton.startState) {
    errorMessage.value = "Cannot minimize: no start state defined.";
    return;
  }

  try {
    const result = minimizeDfa(automaton.states, automaton.transitions);
    automaton.buildFromTuple(result.tuple);
    simulation.reset();
    mergeMessages.value = result.merges;
  }
  catch (e) {
    errorMessage.value = e instanceof Error ? e.message : "Minimization failed.";
  }
}
</script>
