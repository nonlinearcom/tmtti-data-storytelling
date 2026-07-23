<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import MapView from './components/MapView.vue'
import Timeline from './components/Timeline.vue'
import EventCard from './components/EventCard.vue'
import AboutModal from './components/AboutModal.vue'
import { useStory } from './composables/useStory'

const { load, next, prev } = useStory()
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
    <EventCard @about="aboutOpen = true" />
    <Timeline />
    <AboutModal :open="aboutOpen" @close="aboutOpen = false" />
  </div>
</template>

<style scoped>
.app {
  position: fixed;
  inset: 0;
  display: flex;
  /* desktop: the map is the only in-flow child (timeline and card float
     above it); mobile stacks map / card / timeline as a column */
  flex-direction: row;
  overflow: hidden;
}
@media (max-width: 720px) {
  .app {
    flex-direction: column;
  }
}
</style>
