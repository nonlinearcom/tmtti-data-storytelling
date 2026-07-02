<script setup>
import { useStory } from '../composables/useStory'

const { title, events, activeIndex, activeEvent, next, prev } = useStory()
</script>

<template>
  <aside class="card" aria-live="polite">
    <template v-if="activeEvent">
      <p class="kicker">{{ activeIndex + 1 }} / {{ events.length }} · {{ activeEvent.displayDate }}</p>
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
    </template>

    <template v-else>
      <p class="kicker">MICRI data-storytelling workshop · demo</p>
      <h2>{{ title?.headline || 'The Digital Border' }}</h2>
      <div class="body">
        <p>
          Five moments in how borders learned to read people as data — from the photo ID to the
          punch card. Rebuilt from a student TimelineJS + StoryMapJS spreadsheet.
        </p>
        <p>
          Click a bar on the timeline — or press <kbd>→</kbd> — to move through the story. Each
          event keeps its date range and its place.
        </p>
      </div>
    </template>

    <nav>
      <button :disabled="activeIndex === -1" @click="prev">← Back</button>
      <button class="primary" :disabled="activeIndex === events.length - 1" @click="next">
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
  width: 360px;
  max-width: calc(100vw - 32px);
  max-height: calc(100% - 200px);
  overflow-y: auto;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 18px 20px;
}
.kicker {
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
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
kbd {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0 5px;
  font-family: var(--font);
  font-size: 12px;
  background: #fff;
}
nav {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 14px;
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
    max-height: 36vh;
    border-radius: 0;
    border-left: none;
    border-right: none;
    box-shadow: none;
    padding: 14px 16px;
  }
}
</style>
