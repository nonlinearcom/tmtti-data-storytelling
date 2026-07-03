<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useStory } from '../composables/useStory'

const { events, activeIndex, select } = useStory()

const container = ref(null)
const mapReady = ref(false)
let map
let markers = []

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

// Shift the camera target left/down so it stays clear of the event card.
// A per-call offset, deliberately NOT camera padding: MapLibre keeps padding as
// sticky state (and strands it mid-value on interrupted flights), which was
// leaving the overview globe off-center after visiting an event.
function cardOffset() {
  const w = container.value?.clientWidth ?? 1000
  return w > 760 ? [-190, 25] : [0, 0]
}

function overview(animate = true) {
  const b = new maplibregl.LngLatBounds()
  events.value.forEach((e) => b.extend([e.lon, e.lat]))
  // cameraForBounds only supplies the zoom (with a 60px margin); the globe is
  // centered in the viewport — the card may overlap its right edge, by design.
  const cam = map.cameraForBounds(b, { padding: 60, maxZoom: 5 })
  // turn the globe to where the story begins — events are chronological, so
  // [0] is each story's first chapter
  const first = events.value[0]
  map.flyTo({
    center: [first.lon, first.lat],
    zoom: cam?.zoom ?? 1.4,
    duration: animate ? 1400 : 0,
    essential: true,
  })
}

function buildStoryLayer() {
  // one dashed route per story, in that story's color
  const byStory = new Map()
  events.value.forEach((e) => {
    if (!byStory.has(e.storyId)) byStory.set(e.storyId, { color: e.color, coords: [] })
    byStory.get(e.storyId).coords.push([e.lon, e.lat])
  })
  map.addSource('story-line', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [...byStory.values()].map((s) => ({
        type: 'Feature',
        properties: { color: s.color },
        geometry: { type: 'LineString', coordinates: s.coords },
      })),
    },
  })
  map.addLayer({
    id: 'story-line',
    type: 'line',
    source: 'story-line',
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 1.5,
      'line-dasharray': [1.5, 2.5],
      'line-opacity': 0.7,
    },
  })

  events.value.forEach((e, i) => {
    const el = document.createElement('button')
    el.className = 'story-marker'
    el.type = 'button'
    el.style.setProperty('--story-color', e.color)
    el.setAttribute('aria-label', `${e.headline} (${e.displayDate})`)
    const dot = document.createElement('span')
    dot.className = 'dot'
    dot.textContent = String(i + 1)
    el.appendChild(dot)
    el.addEventListener('click', (ev) => {
      ev.stopPropagation()
      select(i)
    })
    markers.push(
      new maplibregl.Marker({ element: el, opacityWhenCovered: '0' }) // fully hide far-side markers
        .setLngLat([e.lon, e.lat])
        .addTo(map)
    )
  })
}

function clearStory() {
  markers.forEach((m) => m.remove())
  markers = []
  for (const id of ['story-line', 'story-shape-fill', 'story-shape-line', 'story-shape-point']) {
    if (map.getLayer(id)) map.removeLayer(id)
  }
  for (const id of ['story-line', 'story-shapes']) {
    if (map.getSource(id)) map.removeSource(id)
  }
  shapeBoxes = {}
}

// Optional per-event areas: the CSV's Shape column names a GeoJSON file in
// public/data/shapes/. All shapes go into one source, tagged with their event
// index; a filter shows only the active event's area.
let shapeBoxes = {} // eventIndex → [[w, s], [e, n]], for fitBounds
let buildToken = 0 // invalidates in-flight shape fetches on story switch

function bboxOf(features) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      minX = Math.min(minX, c[0])
      minY = Math.min(minY, c[1])
      maxX = Math.max(maxX, c[0])
      maxY = Math.max(maxY, c[1])
    } else c.forEach(walk)
  }
  features.forEach((f) => f.geometry && walk(f.geometry.coordinates))
  return [
    [minX, minY],
    [maxX, maxY],
  ]
}

async function loadShapes(evts, token) {
  const features = []
  await Promise.all(
    evts.map(async (e, i) => {
      if (!e.shape) return
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}data/shapes/${e.shape}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const gj = await res.json()
        const fs =
          gj.type === 'FeatureCollection'
            ? gj.features
            : gj.type === 'Feature'
              ? [gj]
              : [{ type: 'Feature', properties: {}, geometry: gj }]
        fs.forEach((f) =>
          features.push({ ...f, properties: { ...f.properties, eventIndex: i, color: e.color } })
        )
        shapeBoxes[i] = bboxOf(fs)
      } catch (err) {
        console.warn(`Shape "${e.shape}" (event ${i + 1}) could not be loaded — skipping.`, err)
      }
    })
  )
  if (token !== buildToken || !map || !features.length) return // story changed meanwhile
  map.addSource('story-shapes', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features },
  })
  const filter = ['==', ['get', 'eventIndex'], activeIndex.value]
  // circle layers draw a dot on EVERY vertex of polygons/lines too — restrict to real points
  const pointFilter = ['all', ['==', ['geometry-type'], 'Point'], filter]
  map.addLayer(
    {
      id: 'story-shape-fill',
      type: 'fill',
      source: 'story-shapes',
      filter,
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.12 },
    },
    'story-line' // areas sit beneath the dashed story line
  )
  map.addLayer(
    {
      id: 'story-shape-line',
      type: 'line',
      source: 'story-shapes',
      filter,
      paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-opacity': 0.6 },
    },
    'story-line'
  )
  // point features (a "group of cities" shape) render as dots
  map.addLayer(
    {
      id: 'story-shape-point',
      type: 'circle',
      source: 'story-shapes',
      filter: pointFilter,
      paint: {
        'circle-radius': 5,
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.85,
        'circle-stroke-color': '#fcfcfb',
        'circle-stroke-width': 1.5,
      },
    },
    'story-line'
  )
}

onMounted(() => {
  map = new maplibregl.Map({
    container: container.value,
    style: MAP_STYLE,
    center: [15, 20],
    zoom: 1.4,
    attributionControl: { compact: true },
  })
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
  if (import.meta.env.DEV) window.__map = map // poke at it in the console
  map.on('style.load', () => {
    // globe at low zooms, seamlessly flattening to mercator as you zoom in
    map.setProjection({ type: 'globe' })
  })
  map.on('load', () => {
    mapReady.value = true
  })
})

onBeforeUnmount(() => map?.remove())

// The map and the CSV load in parallel; (re)build the story layer when both
// are in — and again every time the events array is swapped by a story switch.
watch([mapReady, events], () => {
  if (!mapReady.value || !events.value.length) return
  const isSwitch = markers.length > 0
  buildToken++
  clearStory()
  buildStoryLayer()
  loadShapes(events.value, buildToken)
  overview(isSwitch) // first story: jump straight there; switch: fly over
})

watch(activeIndex, (i) => {
  if (!map || !markers.length) return
  markers.forEach((m, idx) => m.getElement().classList.toggle('active', idx === i))
  if (map.getLayer('story-shape-fill')) {
    const filter = ['==', ['get', 'eventIndex'], i]
    map.setFilter('story-shape-fill', filter)
    map.setFilter('story-shape-line', filter)
    map.setFilter('story-shape-point', ['all', ['==', ['geometry-type'], 'Point'], filter])
  }
  const e = events.value[i]
  if (!e) {
    overview()
    return
  }
  const box = shapeBoxes[i]
  if (box) {
    // an event with an area frames the whole area, not just its marker
    const cam = map.cameraForBounds(box, { padding: 40, maxZoom: e.zoom ?? 12 })
    map.flyTo({
      center: cam?.center ?? [e.lon, e.lat],
      zoom: cam?.zoom ?? 5,
      offset: cardOffset(),
      duration: 2200,
      essential: true,
    })
  } else {
    map.flyTo({
      center: [e.lon, e.lat],
      zoom: Math.min(e.zoom ?? 10, 12),
      offset: cardOffset(),
      speed: 0.8,
      essential: true,
    })
  }
})
</script>

<template>
  <div ref="container" class="map"></div>
</template>

<style scoped>
.map {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
}
</style>

<!-- Markers are created by MapLibre outside this component's template,
     so their styles cannot be scoped. -->
<style>
/* MapLibre repositions the outer element via an inline transform every frame,
   so it must carry no transform or transition of its own — visuals live on
   the inner .dot instead, or markers drift behind the map while panning. */
.story-marker {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}
.story-marker .dot {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--surface-1);
  color: var(--story-color, var(--accent-strong));
  border: 2px solid var(--story-color, var(--accent));
  font: 600 12px var(--font);
  display: grid;
  place-items: center;
  box-shadow: 0 1px 4px rgba(11, 11, 11, 0.25);
  transition: transform 0.15s, background 0.15s;
}
.story-marker:hover .dot {
  transform: scale(1.12);
}
/* a marker hidden behind the globe must not catch clicks either */
.story-marker[style*='opacity: 0;'] {
  pointer-events: none;
}
.story-marker.active {
  z-index: 2;
}
.story-marker.active .dot {
  background: var(--story-color, var(--accent));
  color: #fff;
  border-color: var(--story-color, var(--accent-strong));
  transform: scale(1.18);
}
</style>
