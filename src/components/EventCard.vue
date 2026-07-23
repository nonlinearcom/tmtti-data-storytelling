<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useStory } from '../composables/useStory'
import StoryPicker from './StoryPicker.vue'

const emit = defineEmits(['about'])
const { title, events, activeIndex, selectedIds, selectedStories, select } = useStory()

// The feed drives activeIndex by scroll position (scrollytelling), and
// activeIndex drives the feed when the change comes from the timeline, the
// map markers or the arrow keys. Two guards stop the loop:
// - ioIndex remembers where the feed's own scroll already points, so
//   scroll-driven selects don't scroll the feed again;
// - suppress mutes the observer while a programmatic smooth scroll flies
//   past intermediate cards (refreshed by the scroll listener until settled).
const feed = ref(null)
let io
let suppress = 0
let ioIndex = -1
const intersecting = new Map() // index -> entry top, for picking the band's topmost card

function setupObserver() {
  io?.disconnect()
  intersecting.clear()
  if (!feed.value) return
  io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        const idx = Number(en.target.dataset.index)
        if (en.isIntersecting) intersecting.set(idx, en.boundingClientRect.top)
        else intersecting.delete(idx)
      }
      if (Date.now() < suppress || !intersecting.size) return
      const idx = [...intersecting.entries()].sort((a, b) => a[1] - b[1])[0][0]
      ioIndex = idx
      if (idx !== activeIndex.value) select(idx)
    },
    // only a band in the upper part of the panel counts as "being read"
    { root: feed.value, rootMargin: '-20% 0px -65% 0px', threshold: 0 }
  )
  feed.value.querySelectorAll('.entry').forEach((el) => io.observe(el))
}

function onFeedScroll() {
  if (Date.now() < suppress) suppress = Date.now() + 300
}

onMounted(() => {
  setupObserver()
  feed.value?.addEventListener('scroll', onFeedScroll, { passive: true })
})
watch(events, () => nextTick(setupObserver))
onBeforeUnmount(() => {
  io?.disconnect()
  feed.value?.removeEventListener('scroll', onFeedScroll)
})

watch(activeIndex, (i) => {
  if (i === ioIndex) return // the change came from our own scroll
  const el = feed.value?.querySelector(`[data-index="${i}"]`)
  if (!el) return
  suppress = Date.now() + 900
  ioIndex = i
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
})
</script>

<template>
  <aside class="card">
    <div class="toolbar">
      <StoryPicker />
      <button class="about-btn" @click="emit('about')">About</button>
    </div>

    <div ref="feed" class="feed">
      <section class="entry" data-index="-1">
        <p class="kicker">timeline × map · MICRI data-storytelling workshop</p>
        <h2>{{ title?.headline || 'TMTTI' }}</h2>
        <div class="body">
          <div v-if="selectedIds.length > 1" class="story-list">
            <p v-for="s in selectedStories" :key="s.id">
              <span class="chip" :style="{ background: s.color }" />{{ s.title }} ·
              {{ s.count }} events
            </p>
          </div>
          <div v-else-if="title?.text" v-html="title.text"></div>
          <p>
            Scroll this panel — or press <kbd>→</kbd> — to move through the
            {{ selectedIds.length > 1 ? 'combined chronology' : 'story' }}. Each event keeps its
            date range, its place, and its source.
          </p>
        </div>
      </section>

      <section
        v-for="(e, i) in events"
        :key="e.id"
        class="entry"
        :data-index="i"
        :aria-current="activeIndex === i ? 'true' : undefined"
      >
        <p class="kicker">
          <template v-if="selectedIds.length > 1">
            <span class="chip" :style="{ background: e.color }" />{{ e.storyTitle }} ·
          </template>
          {{ i + 1 }} / {{ events.length }} · {{ e.displayDate }}
        </p>
        <h2>{{ e.headline }}</h2>
        <figure v-if="e.media">
          <img :src="e.media.url" :alt="e.media.alt || e.media.caption" loading="lazy" />
          <figcaption>
            {{ e.media.caption }}
            <span v-if="e.media.credit" class="credit">— {{ e.media.credit }}</span>
          </figcaption>
        </figure>
        <div class="body" v-html="e.text"></div>
        <p v-if="e.source" class="source">
          Source:
          <a v-if="e.source.url" :href="e.source.url" target="_blank" rel="noopener">{{
            e.source.label
          }}</a>
          <span v-else>{{ e.source.label }}</span>
        </p>
      </section>
    </div>
  </aside>
</template>

<style scoped>
/* the third sheet of the stack: full height, flush to the right edge, lying
   on the map with a soft left shadow (the About panel stacks above it) */
.card {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 10;
  width: 33.33vw;
  min-width: 360px;
  max-width: calc(100vw - 32px);
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--surface-1);
  box-shadow: -8px 0 20px rgba(11, 11, 11, 0.14);
}
.toolbar {
  flex: none;
  display: flex;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--gridline);
}
.about-btn {
  font-size: 13px;
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
/* the reading feed: one entry per event, soft-snapping to entry tops */
.feed {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  scroll-snap-type: y proximity;
  scroll-padding-top: 8px;
}
/* room after the last entry so short final cards can still reach the
   observer's reading band at the top of the panel */
.feed::after {
  content: '';
  display: block;
  height: 40vh;
}
.entry {
  padding: 14px 20px 16px;
  border-bottom: 1px solid var(--gridline);
  scroll-snap-align: start;
}
.kicker {
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin: 0 0 6px;
}
.chip {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 5px;
  vertical-align: baseline;
}
.story-list p {
  margin: 0 0 6px;
}
h2 {
  font-size: 20px;
  line-height: 1.25;
  margin: 0 0 10px;
}
figure {
  margin: 0 0 12px;
}
img {
  width: 100%;
  border-radius: 4px;
  display: block;
}
figcaption {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
}
.credit {
  font-style: italic;
}
.body {
  font-size: 14px;
  line-height: 1.55;
  color: var(--text-secondary);
}
.body :deep(p) {
  margin: 0 0 8px;
}
.body :deep(div) {
  margin: 0 0 8px;
}
.source {
  font-size: 12px;
  color: var(--text-muted);
  border-top: 1px solid var(--gridline);
  padding-top: 10px;
  margin: 12px 0 0;
}
.source a {
  color: var(--accent-strong);
}
kbd {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0 5px;
  font-family: var(--font);
  font-size: 12px;
  background: #fff;
}
@media (max-width: 720px) {
  /* joins the app's flex column between map and timeline */
  .card {
    position: static;
    width: auto;
    min-width: 0;
    max-width: none;
    height: auto;
    max-height: 42vh;
    border-radius: 0;
    border-left: none;
    border-right: none;
    box-shadow: none;
  }
  .toolbar {
    padding: 8px 12px;
  }
  .entry {
    padding: 12px 16px 14px;
  }
}
</style>
