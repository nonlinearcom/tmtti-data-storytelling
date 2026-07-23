<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import * as d3 from 'd3'
import { useStory } from '../composables/useStory'

const { events, activeIndex, select } = useStory()

const MARGIN = { top: 14, left: 16, right: 16 } // horizontal: top leaves headroom for lane-0 labels
const LANE_H = 20 // horizontal: lane height
const LANE_W = 16 // vertical: column width
const BAR = 10 // bar thickness (height when horizontal, width when vertical)
const AXIS_H = 26
const CHAR_W = 6.5 // rough average character width of the 11px label font
const V_AXIS_X = 40 // vertical: axis line x (year labels to its left)
const V_LANE_X = 48 // vertical: first bar column x

const wrap = ref(null)
const axisEl = ref(null)
const size = ref({ w: 900, h: 600 })
const collapsed = ref(false)
let ro

// Desktop gets the vertical left strip; ≤720px keeps the horizontal bottom bar
// (same breakpoint as the app column layout and the card).
const mql = window.matchMedia('(min-width: 721px)')
const vertical = ref(mql.matches)
const onMQ = (e) => (vertical.value = e.matches)

const scale = computed(() => {
  const domain = events.value.length
    ? [d3.min(events.value, (e) => e.start), d3.max(events.value, (e) => e.end)]
    : [new Date(1890, 0, 1), new Date(2000, 0, 1)]
  const range = vertical.value
    ? [16, Math.max(size.value.h - 24, 200)] // oldest at top, reading order
    : [MARGIN.left, size.value.w - MARGIN.right]
  return d3.scaleTime().domain(domain).nice(d3.timeYear.every(10)).range(range)
})

// Narrow (touch) screens get a compact, bars-only timeline: no hover, so no
// labels (the numbered markers and the event card carry identity) and tighter
// lanes. Only meaningful in horizontal mode.
const compact = computed(() => !vertical.value && size.value.w < 640)
const laneH = computed(() => (compact.value ? 16 : LANE_H))

// Events overlap in time, so they stack on lanes (rows when horizontal,
// columns when vertical): each event takes the first lane free again before it
// starts. "Free" is measured on the bar alone — labels are transient
// (hover/active only), so they reserve no space.
const bars = computed(() => {
  const laneFree = [] // time-axis position at which each lane becomes free again
  const s = scale.value
  if (vertical.value) {
    // no text labels here — the reading panel names every event; bars only
    return events.value.map((e, i) => {
      const y = s(e.start)
      const h = Math.max(s(e.end) - y, BAR) // a one-week event still gets a visible dot
      let lane = laneFree.findIndex((freeAt) => freeAt < y - 8)
      if (lane === -1) {
        laneFree.push(y + h)
        lane = laneFree.length - 1
      } else {
        laneFree[lane] = y + h
      }
      const barX = V_LANE_X + lane * LANE_W
      return {
        ...e,
        i,
        barX,
        barY: y,
        barW: BAR,
        barH: h,
        hitX: barX - 3,
        hitY: y - 6,
        hitW: LANE_W,
        hitH: h + 12,
      }
    })
  }
  return events.value.map((e, i) => {
    const x = s(e.start)
    const w = Math.max(s(e.end) - x, BAR)
    const flip = x > size.value.w * 0.55 // labels near the right edge grow leftward
    // truncate the label to the space between the bar and the edge it grows toward
    const avail = flip ? x + w - MARGIN.left : size.value.w - MARGIN.right - x
    let label = `${i + 1} · ${e.headline}`
    const maxChars = Math.max(Math.floor(avail / CHAR_W), 6)
    if (label.length > maxChars) label = label.slice(0, maxChars - 1) + '…'
    let lane = laneFree.findIndex((freeAt) => freeAt < x - 8)
    if (lane === -1) {
      laneFree.push(x + w)
      lane = laneFree.length - 1
    } else {
      laneFree[lane] = x + w
    }
    const laneTop = MARGIN.top + lane * laneH.value
    const barY = laneTop + (compact.value ? 3 : 5)
    return {
      ...e,
      i,
      barX: x,
      barY,
      barW: w,
      barH: BAR,
      hitX: x - 6,
      hitY: laneTop,
      hitW: w + 12,
      hitH: laneH.value,
      label,
      labelX: flip ? x + w : x,
      labelY: barY - 4,
      anchor: flip ? 'end' : 'start',
    }
  })
})

const axisY = computed(() => {
  // horizontal only: axis sits below the last lane (hitY is the lane top)
  if (vertical.value) return 0
  const lanes = Math.max(1, ...bars.value.map((b) => Math.round((b.hitY - MARGIN.top) / laneH.value) + 1))
  return MARGIN.top + lanes * laneH.value
})
// vertical: the strip grows with the number of overlap columns (combined
// stories stack deeper), so bars never overflow a fixed width
const svgW = computed(() => {
  if (!vertical.value) return size.value.w
  const maxX = bars.value.length ? Math.max(...bars.value.map((b) => b.barX)) : V_LANE_X
  return maxX + BAR + 8
})
const svgH = computed(() => (vertical.value ? size.value.h : axisY.value + AXIS_H))

const chev = computed(() =>
  vertical.value ? (collapsed.value ? '▸' : '◂') : (collapsed.value ? '▴' : '▾')
)

function renderAxis() {
  if (!axisEl.value) return
  const sel = d3.select(axisEl.value)
  sel.selectAll('*').remove() // orientation switches leave stale ticks otherwise
  if (vertical.value) {
    const step = size.value.h < 700 ? 20 : 10
    sel.call(
      d3
        .axisLeft(scale.value)
        .ticks(d3.timeYear.every(step))
        .tickFormat(d3.timeFormat('%Y'))
        .tickSize(4)
        .tickSizeOuter(0)
    )
  } else {
    const step = size.value.w < 640 ? 20 : 10
    sel.call(
      d3
        .axisBottom(scale.value)
        .ticks(d3.timeYear.every(step))
        .tickFormat(d3.timeFormat('%Y'))
        .tickSize(4)
        .tickSizeOuter(0)
    )
  }
}

onMounted(() => {
  ro = new ResizeObserver((entries) => {
    const r = entries[0].contentRect
    size.value = { w: r.width, h: r.height }
  })
  ro.observe(wrap.value)
  mql.addEventListener('change', onMQ)
  renderAxis()
})
onBeforeUnmount(() => {
  ro?.disconnect()
  mql.removeEventListener('change', onMQ)
})
watch(scale, renderAxis, { flush: 'post' })
</script>

<template>
  <div
    ref="wrap"
    class="timeline"
    :class="{ collapsed, vertical }"
    :style="vertical && !collapsed ? { width: svgW + 'px' } : null"
    role="group"
    aria-label="Timeline of events"
  >
    <button
      class="toggle"
      :aria-expanded="!collapsed"
      :aria-label="collapsed ? 'Expand timeline' : 'Collapse timeline'"
      :title="collapsed ? 'Expand timeline' : 'Collapse timeline'"
      @click="collapsed = !collapsed"
    >
      {{ vertical && !collapsed ? chev : `Timeline ${chev}` }}
    </button>
    <svg v-show="!collapsed" :width="svgW" :height="svgH">
      <g ref="axisEl" class="axis" :transform="vertical ? `translate(${V_AXIS_X}, 0)` : `translate(0, ${axisY})`" />
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
        <rect class="hit" :x="b.hitX" :y="b.hitY" :width="b.hitW" :height="b.hitH" />
        <text
          v-if="!compact && !vertical"
          class="label"
          :x="b.labelX"
          :y="b.labelY"
          :text-anchor="b.anchor"
        >
          {{ b.label }}
        </text>
        <rect class="mark" :x="b.barX" :y="b.barY" :width="b.barW" :height="b.barH" rx="4" :fill="b.color" />
      </g>
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
  white-space: nowrap; /* a zero-width collapsed strip must not wrap the label */
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
/* desktop: the bottom sheet of the paper stack — its own left column, with
   the map sheet lying on top and casting a shadow onto the strip's edge */
@media (min-width: 721px) {
  .timeline {
    order: -1;
    flex: none;
    padding: 0;
    border: none;
    background: var(--surface-1);
    box-shadow: inset -12px 0 12px -8px rgba(11, 11, 11, 0.18);
    z-index: 5; /* only so the toggle floats over the map's edge */
  }
  .timeline.collapsed {
    width: 0;
  }
  svg {
    overflow: visible;
  }
  /* a tiny round button, same 26px circle language as the map markers */
  .toggle {
    pointer-events: auto;
    top: 12px;
    left: 100%;
    margin-left: 6px;
    transform: none;
    width: 26px;
    height: 26px;
    padding: 0;
    display: grid;
    place-items: center;
    border-radius: 50%;
    font-size: 12px;
    letter-spacing: 0;
  }
  /* collapsed: back to a labeled pill, so it's clear what would expand */
  .timeline.collapsed .toggle {
    width: auto;
    height: auto;
    padding: 4px 10px;
    border-radius: 6px;
    letter-spacing: 0.04em;
    font-size: 11px;
  }
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
/* horizontal mode only: labels appear for the hovered/active bar; a
   surface-colored halo (paint-order) keeps them readable when they cross
   neighboring bars */
.label {
  font-size: 11px;
  fill: var(--text-secondary);
  opacity: 0;
  paint-order: stroke;
  stroke: var(--surface-1);
  stroke-width: 3px;
  stroke-linejoin: round;
  pointer-events: none;
  transition: opacity 0.12s;
}
.bar:hover .label,
.bar:focus-visible .label,
.bar.active .label {
  opacity: 1;
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
