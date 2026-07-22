<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import * as d3 from 'd3'
import { useStory } from '../composables/useStory'

const { events, activeIndex, select } = useStory()

const MARGIN = { top: 8, left: 16, right: 16 }
const LANE_H = 32
const BAR_H = 10
const AXIS_H = 26
const CHAR_W = 6.5 // rough average character width of the 11px label font

const wrap = ref(null)
const axisEl = ref(null)
const width = ref(900)
const collapsed = ref(false)
let ro

const scale = computed(() => {
  const domain = events.value.length
    ? [d3.min(events.value, (e) => e.start), d3.max(events.value, (e) => e.end)]
    : [new Date(1890, 0, 1), new Date(2000, 0, 1)]
  return d3
    .scaleTime()
    .domain(domain)
    .nice(d3.timeYear.every(10))
    .range([MARGIN.left, width.value - MARGIN.right])
})

// Narrow screens — and big merged chronologies — get a compact, bars-only
// timeline: no labels (the numbered markers and the event card carry identity)
// and tighter lanes. Labeled lanes with 20+ events would swallow the viewport.
const compact = computed(() => width.value < 640 || events.value.length > 18)
const laneH = computed(() => (compact.value ? 16 : LANE_H))

// Events overlap in time, so they stack on lanes: each event takes the first
// lane that is free again before it starts. "Free" is measured in pixels, not
// dates — an event occupies its bar AND its label, whichever reaches further.
const bars = computed(() => {
  const laneFree = [] // x at which each lane becomes free again
  return events.value.map((e, i) => {
    const x = scale.value(e.start)
    const w = Math.max(scale.value(e.end) - x, BAR_H) // a one-week event still gets a visible dot
    const flip = x > width.value * 0.55 // labels near the right edge grow leftward
    // truncate the label to the space between the bar and the edge it grows toward
    const avail = flip ? x + w - MARGIN.left : width.value - MARGIN.right - x
    let label = `${i + 1} · ${e.headline}`
    const maxChars = Math.max(Math.floor(avail / CHAR_W), 6)
    if (label.length > maxChars) label = label.slice(0, maxChars - 1) + '…'
    const labelW = compact.value ? 0 : label.length * CHAR_W
    const left = flip ? Math.min(x, x + w - labelW) : x
    const right = flip ? x + w : x + Math.max(w, labelW)
    let lane = laneFree.findIndex((freeAt) => freeAt < left - 16)
    if (lane === -1) {
      laneFree.push(right)
      lane = laneFree.length - 1
    } else {
      laneFree[lane] = right
    }
    const laneTop = MARGIN.top + lane * laneH.value
    return {
      ...e,
      i,
      lane,
      x,
      w,
      label,
      left, // full horizontal extent: bar + label, for the hit target
      right,
      laneTop,
      barY: laneTop + (compact.value ? 3 : 17),
      labelX: flip ? x + w : x,
      anchor: flip ? 'end' : 'start',
    }
  })
})

const laneCount = computed(() => Math.max(1, ...bars.value.map((b) => b.lane + 1)))
const axisY = computed(() => MARGIN.top + laneCount.value * laneH.value)
const height = computed(() => axisY.value + AXIS_H)

function renderAxis() {
  if (!axisEl.value) return
  const step = width.value < 640 ? 20 : 10
  d3.select(axisEl.value).call(
    d3
      .axisBottom(scale.value)
      .ticks(d3.timeYear.every(step))
      .tickFormat(d3.timeFormat('%Y'))
      .tickSize(4)
      .tickSizeOuter(0)
  )
}

onMounted(() => {
  ro = new ResizeObserver((entries) => {
    width.value = entries[0].contentRect.width
  })
  ro.observe(wrap.value)
  renderAxis()
})
onBeforeUnmount(() => ro?.disconnect())
watch(scale, renderAxis, { flush: 'post' })
</script>

<template>
  <div ref="wrap" class="timeline" :class="{ collapsed }" role="group" aria-label="Timeline of events">
    <button
      class="toggle"
      :aria-expanded="!collapsed"
      :aria-label="collapsed ? 'Expand timeline' : 'Collapse timeline'"
      @click="collapsed = !collapsed"
    >
      Timeline {{ collapsed ? '▴' : '▾' }}
    </button>
    <svg v-show="!collapsed" :width="width" :height="height">
      <g
        v-for="b in bars"
        :key="b.id"
        class="bar"
        :class="{ active: b.i === activeIndex }"
        role="button"
        tabindex="0"
        :aria-label="`${b.headline}, ${b.displayDate}`"
        @click="select(b.i)"
        @keydown.enter.prevent="select(b.i)"
        @keydown.space.prevent="select(b.i)"
      >
        <title>{{ b.headline }} · {{ b.displayDate }}</title>
        <rect class="hit" :x="b.left - 6" :y="b.laneTop" :width="b.right - b.left + 12" :height="laneH" />
        <text v-if="!compact" class="label" :x="b.labelX" :y="b.laneTop + 12" :text-anchor="b.anchor">
          {{ b.label }}
        </text>
        <rect class="mark" :x="b.x" :y="b.barY" :width="b.w" :height="BAR_H" rx="4" :fill="b.color" />
      </g>
      <g ref="axisEl" class="axis" :transform="`translate(0, ${axisY})`" />
    </svg>
  </div>
</template>

<style scoped>
.timeline {
  position: relative;
  flex: 0 0 auto;
  background: var(--surface-1);
  border-top: 1px solid var(--border);
  padding: 6px 0 4px;
}
.timeline.collapsed {
  padding: 0;
  border-top: none;
  background: none;
}
/* floats above the strip, over the map — a drawer handle */
.toggle {
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  font: 11px var(--font);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-secondary);
  background: var(--surface-veil);
  backdrop-filter: blur(6px);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 10px;
  box-shadow: var(--shadow);
}
.toggle:hover {
  border-color: var(--accent);
  color: var(--accent-strong);
}
svg {
  display: block;
}
.bar {
  cursor: pointer;
  outline: none;
}
.hit {
  fill: transparent;
}
/* the fill is the story's identity color; state is carried by opacity */
.mark {
  opacity: 0.5;
  transition: opacity 0.15s;
}
.bar:hover .mark,
.bar.active .mark {
  opacity: 1;
}
.bar:focus-visible .mark {
  stroke: var(--accent-strong);
  stroke-width: 2;
}
.label {
  font-size: 11px;
  fill: var(--text-secondary);
}
.bar.active .label {
  fill: var(--text-primary);
  font-weight: 600;
}
.axis :deep(text) {
  fill: var(--text-muted);
  font-size: 10px;
  font-family: var(--font);
}
.axis :deep(line),
.axis :deep(path) {
  stroke: var(--baseline);
}
</style>
