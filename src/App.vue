<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import MapView from './components/MapView.vue'
import Timeline from './components/Timeline.vue'
import EventCard from './components/EventCard.vue'
import { useStory } from './composables/useStory'

const { title, load, next, prev } = useStory()

function onKey(e) {
  if (e.key === 'ArrowRight') next()
  else if (e.key === 'ArrowLeft') prev()
}

onMounted(() => {
  load()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="app">
    <MapView />
    <header>
      <h1>{{ title?.headline || 'The Digital Border' }}</h1>
      <p>timeline × map · MICRI data-storytelling workshop</p>
    </header>
    <EventCard />
    <Timeline />
  </div>
</template>

<style scoped>
.app {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
header {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
  background: var(--surface-veil);
  backdrop-filter: blur(6px);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 10px 14px;
  max-width: 320px;
}
header h1 {
  font-size: 18px;
  margin: 0;
}
header p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}
@media (max-width: 720px) {
  header {
    max-width: 220px;
  }
  header h1 {
    font-size: 15px;
  }
}
</style>
