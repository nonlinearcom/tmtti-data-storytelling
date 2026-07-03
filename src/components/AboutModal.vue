<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['close'])

const closeBtn = ref(null)
watch(
  () => props.open,
  async (open) => {
    if (open) {
      await nextTick()
      closeBtn.value?.focus()
    }
  }
)
</script>

<template>
  <!-- Teleported to body so no app stacking context can paint over it -->
  <Teleport to="body">
    <Transition name="about">
      <div v-if="open" class="backdrop" @click.self="emit('close')">
      <aside class="panel" role="dialog" aria-modal="true" aria-label="About this project">
        <button ref="closeBtn" class="close" aria-label="Close" @click="emit('close')">×</button>
        <h2>About</h2>
        <p>
          These interactive stories were made in <strong>Data storytelling with maps, timelines,
          and vibe-coding</strong>, a workshop of the Master's in Communication for International
          Relations (MICRI) at IULM University, June 2026.
        </p>
        <p>
          Each team follows one technology past its shiny version — to the labour, power, and
          places the usual story skips. The method has two rules: every event names its source,
          and every story shows its gap: what the proud, official version leaves out.
        </p>
        <p>
          Research starts as no-code
          <a href="https://timeline.knightlab.com/" target="_blank" rel="noopener">TimelineJS</a> and
          <a href="https://storymap.knightlab.com/" target="_blank" rel="noopener">StoryMapJS</a>
          spreadsheets, then become this custom app: the same spreadsheet, extended with
          coordinates and sources, drawn with
          <a href="https://vuejs.org/" target="_blank" rel="noopener">Vue</a>,
          <a href="https://maplibre.org/" target="_blank" rel="noopener">MapLibre GL</a> and
          <a href="https://d3js.org/" target="_blank" rel="noopener">D3</a>.</p>
        <p>
          GitHub: <a href="https://github.com/nonlinearcom/tmtti-data-storytelling" target="_blank" rel="noopener">https://github.com/nonlinearcom/tmtti-data-storytelling</a>
        </p>
        <dl class="credits">
          <dt>Instructor</dt>
          <dd>Manuel Ehrenfeld</dd>
          <dt>Assistant</dt>
          <dd>Francesco Luzzana</dd>
          <dt>Students</dt>
          <dd>
            Sofia Dioli, Maria Vittoria Visentin, Chiara De Virgiliis, Giulia Mereu, Alessandra
            Gallo, Elisa Gorga, Laura Asllani, Chiara Chierico, Angelica Berardi, Alessia
            Giovinazzo, Andrea G Coari, Marco Are, Eleonora Mascia, Alice Antonini, Alex Meynier,
            Giulia Bellisari, Alice Malago, Chiara Lazzaroni, Elisa Miotto, Sandro Burgio
          </dd>
        </dl>
        <p class="fine">
          Basemap © <a href="https://carto.com/" target="_blank" rel="noopener">CARTO</a> ·
          © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>
          contributors
        </p>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(11, 11, 11, 0.35);
}
.panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(420px, 100%);
  background: var(--surface-1);
  box-shadow: -4px 0 24px rgba(11, 11, 11, 0.2);
  padding: 24px 28px;
  overflow-y: auto;
}
.close {
  position: absolute;
  top: 12px;
  right: 14px;
  border: none;
  background: none;
  font-size: 26px;
  line-height: 1;
  color: var(--text-muted);
  padding: 4px 8px;
}
.close:hover {
  color: var(--text-primary);
}
h2 {
  margin: 0 0 14px;
  font-size: 22px;
}
p {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin: 0 0 12px;
}
a {
  color: var(--accent-strong);
}
.credits {
  border-top: 1px solid var(--gridline);
  margin: 18px 0 12px;
  padding-top: 12px;
  font-size: 13px;
  line-height: 1.6;
}
.credits dt {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin-top: 10px;
}
.credits dt:first-of-type {
  margin-top: 0;
}
.credits dd {
  margin: 0;
  color: var(--text-secondary);
}
.fine {
  font-size: 12px;
  color: var(--text-muted);
}

/* backdrop fades, panel slides in from the right */
.about-enter-active,
.about-leave-active {
  transition: opacity 0.25s ease;
}
.about-enter-active .panel,
.about-leave-active .panel {
  transition: transform 0.25s ease;
}
.about-enter-from,
.about-leave-to {
  opacity: 0;
}
.about-enter-from .panel,
.about-leave-to .panel {
  transform: translateX(100%);
}
</style>
