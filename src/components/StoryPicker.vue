<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useStory } from '../composables/useStory'

const { stories, selectedIds, selectedStories, toggleStory } = useStory()

const open = ref(false)
const root = ref(null)

const label = computed(() =>
  selectedIds.value.length === 1
    ? selectedStories.value[0]?.title
    : `${selectedIds.value.length} stories`
)

function onDocClick(e) {
  if (open.value && root.value && !root.value.contains(e.target)) open.value = false
}
function onDocKey(e) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onDocKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onDocKey)
})
</script>

<template>
  <div ref="root" class="picker">
    <button class="toggle" :aria-expanded="open" @click="open = !open">
      <!-- the dots double as a permanent mini-legend of the checked stories -->
      <span class="dots">
        <span v-for="s in selectedStories" :key="s.id" class="dot" :style="{ background: s.color }" />
      </span>
      <span class="lbl">{{ label }}</span>
      <span class="chev" aria-hidden="true">▾</span>
    </button>

    <div v-if="open" class="panel" role="group" aria-label="Stories to show">
      <label v-for="s in stories" :key="s.id" class="row">
        <input
          type="checkbox"
          :checked="selectedIds.includes(s.id)"
          :disabled="selectedIds.includes(s.id) && selectedIds.length === 1"
          @change="toggleStory(s.id)"
        />
        <span class="dot" :style="{ background: s.color }" />
        <span class="name">{{ s.title }}</span>
      </label>
    </div>
  </div>
</template>

<style scoped>
.picker {
  position: relative;
  flex: 1;
  min-width: 0;
}
.toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  font: 13px var(--font);
  color: var(--text-primary);
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 5px 8px;
}
.toggle:hover {
  border-color: var(--accent);
}
.dots {
  display: inline-flex;
  gap: 3px;
  flex: none;
}
.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: none;
}
.lbl {
  flex: 1;
  min-width: 0;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chev {
  color: var(--text-muted);
  font-size: 10px;
}
.panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 30;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: var(--shadow);
  padding: 4px;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
}
.row:hover {
  background: rgba(11, 11, 11, 0.04);
}
.row input {
  accent-color: var(--accent);
}
.row input:disabled {
  cursor: default;
}
.name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
