<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import MapView from './components/MapView.vue'
import Timeline from './components/Timeline.vue'
import EventCard from './components/EventCard.vue'
import AboutModal from './components/AboutModal.vue'
import { useStory } from './composables/useStory'

const { title, stories, currentStoryId, load, loadStory, next, prev } = useStory()
const aboutOpen = ref(false)

function onKey(e) {
  if (e.key === 'Escape') {
    aboutOpen.value = false
    return
  }
  if (aboutOpen.value) return
  // don't fight native arrow-key behaviour inside form controls (the story select)
  if (['SELECT', 'INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return
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
      <h1>{{ title?.headline || 'TMTTI' }}</h1>
      <p>timeline × map · MICRI data-storytelling workshop</p>
      <div class="controls">
        <label class="sr-only" for="story-select">Choose a story</label>
        <select id="story-select" :value="currentStoryId" @change="loadStory($event.target.value)">
          <option v-for="s in stories" :key="s.id" :value="s.id">{{ s.title }}</option>
        </select>
        <button class="about-btn" @click="aboutOpen = true">About</button>
      </div>
    </header>
    <EventCard />
    <Timeline />
    <AboutModal :open="aboutOpen" @close="aboutOpen = false" />
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
.controls {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.controls select {
  flex: 1;
  min-width: 0;
  font: 13px var(--font);
  color: var(--text-primary);
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 5px 8px;
}
.about-btn {
  font: 13px var(--font);
  color: var(--text-secondary);
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 5px 10px;
}
.about-btn:hover {
  border-color: var(--accent);
  color: var(--accent-strong);
}
@media (max-width: 720px) {
  header {
    max-width: 240px;
  }
  header h1 {
    font-size: 15px;
  }
}
</style>
