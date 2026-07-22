<script setup>
import { useStory } from '../composables/useStory'
import StoryPicker from './StoryPicker.vue'

const emit = defineEmits(['about'])
const { title, events, activeIndex, activeEvent, selectedIds, selectedStories, next, prev } =
  useStory()
</script>

<template>
  <aside class="card">
    <div class="toolbar">
      <StoryPicker />
      <button class="about-btn" @click="emit('about')">About</button>
    </div>

    <div class="scroll" aria-live="polite">
    <template v-if="activeEvent">
      <p class="kicker">
        <template v-if="selectedIds.length > 1">
          <span class="chip" :style="{ background: activeEvent.color }" />{{ activeEvent.storyTitle }} ·
        </template>
        {{ activeIndex + 1 }} / {{ events.length }} · {{ activeEvent.displayDate }}
      </p>
      <h2>{{ activeEvent.headline }}</h2>
      <figure v-if="activeEvent.media">
        <img
          :src="activeEvent.media.url"
          :alt="activeEvent.media.alt || activeEvent.media.caption"
          loading="lazy"
        />
        <figcaption>
          {{ activeEvent.media.caption }}
          <span v-if="activeEvent.media.credit" class="credit">— {{ activeEvent.media.credit }}</span>
        </figcaption>
      </figure>
      <div class="body" v-html="activeEvent.text"></div>
      <p v-if="activeEvent.source" class="source">
        Source:
        <a
          v-if="activeEvent.source.url"
          :href="activeEvent.source.url"
          target="_blank"
          rel="noopener"
          >{{ activeEvent.source.label }}</a
        >
        <span v-else>{{ activeEvent.source.label }}</span>
      </p>
    </template>

    <template v-else>
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
          Click a bar on the timeline — or press <kbd>→</kbd> — to move through the
          {{ selectedIds.length > 1 ? 'combined chronology' : 'story' }}. Each event keeps its
          date range, its place, and its source.
        </p>
      </div>
    </template>
    </div>

    <nav v-if="events.length">
      <button v-if="activeIndex > -1" @click="prev">← Back</button>
      <button v-if="activeIndex < events.length - 1" class="primary" @click="next">
        {{ activeIndex === -1 ? 'Start' : 'Next →' }}
      </button>
    </nav>
  </aside>
</template>

<style scoped>
.card {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  width: 33.33vw;
  min-width: 360px;
  max-width: calc(100vw - 32px);
  max-height: calc(100% - 180px);
  display: flex;
  flex-direction: column;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
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
/* only the reading area scrolls; toolbar and nav stay put */
.scroll {
  min-height: 0;
  overflow-y: auto;
  padding: 14px 20px 2px;
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
nav {
  flex: none;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 20px 14px;
}
/* Next/Start keeps its right-edge position even when Back is hidden */
nav .primary {
  margin-left: auto;
}
button {
  border: 1px solid var(--border);
  background: var(--surface-1);
  border-radius: 6px;
  padding: 7px 12px;
  font-size: 13px;
  color: var(--text-primary);
}
button:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent-strong);
}
button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
button.primary:hover:not(:disabled) {
  background: var(--accent-strong);
  color: #fff;
}
button:disabled {
  opacity: 0.4;
  cursor: default;
}
@media (max-width: 720px) {
  /* joins the app's flex column between map and timeline */
  .card {
    position: static;
    width: auto;
    min-width: 0;
    max-width: none;
    max-height: 42vh;
    border-radius: 0;
    border-left: none;
    border-right: none;
    box-shadow: none;
  }
  .toolbar {
    padding: 8px 12px;
  }
  .scroll {
    padding: 12px 16px 2px;
  }
  nav {
    padding: 10px 16px 12px;
  }
}
</style>
