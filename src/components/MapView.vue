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

// Keep the camera target clear of the header and the event card.
function pad() {
  const w = container.value?.clientWidth ?? 1000
  return { top: 90, bottom: 40, left: 40, right: w > 760 ? 420 : 40 }
}

function overview(animate = true) {
  const b = new maplibregl.LngLatBounds()
  events.value.forEach((e) => b.extend([e.lon, e.lat]))
  // symmetric padding: the globe sits centered in the viewport, even if the
  // event card overlaps its right edge
  const opts = { padding: 60, duration: animate ? 1400 : 0, maxZoom: 5 }
  const cam = map.cameraForBounds(b, opts)
  if (!cam) return map.fitBounds(b, opts)
  // keep the zoom fitBounds would pick, but turn the globe to where the story
  // begins — events are chronological, so [0] is each story's first chapter
  const first = events.value[0]
  map.flyTo({ ...cam, center: [first.lon, first.lat], ...opts, essential: true })
}

function buildStoryLayer() {
  map.addSource('story-line', {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: events.value.map((e) => [e.lon, e.lat]),
      },
    },
  })
  map.addLayer({
    id: 'story-line',
    type: 'line',
    source: 'story-line',
    paint: {
      'line-color': '#898781',
      'line-width': 1.5,
      'line-dasharray': [1.5, 2.5],
      'line-opacity': 0.9,
    },
  })

  events.value.forEach((e, i) => {
    const el = document.createElement('button')
    el.className = 'story-marker'
    el.type = 'button'
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
  for (const id of ['story-line', 'story-shape-fill', 'story-shape-line']) {
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
        fs.forEach((f) => features.push({ ...f, properties: { ...f.properties, eventIndex: i } }))
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
  map.addLayer(
    {
      id: 'story-shape-fill',
      type: 'fill',
      source: 'story-shapes',
      filter,
      paint: { 'fill-color': '#2a78d6', 'fill-opacity': 0.12 },
    },
    'story-line' // areas sit beneath the dashed story line
  )
  map.addLayer(
    {
      id: 'story-shape-line',
      type: 'line',
      source: 'story-shapes',
      filter,
      paint: { 'line-color': '#2a78d6', 'line-width': 1.5, 'line-opacity': 0.6 },
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
  }
  const e = events.value[i]
  if (!e) {
    overview()
    return
  }
  const box = shapeBoxes[i]
  if (box) {
    // an event with an area frames the whole area, not just its marker
    map.fitBounds(box, { padding: pad(), maxZoom: e.zoom ?? 12, duration: 2200, essential: true })
  } else {
    map.flyTo({
      center: [e.lon, e.lat],
      zoom: Math.min(e.zoom ?? 10, 12),
      padding: pad(),
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
  color: var(--accent-strong);
  border: 2px solid var(--accent);
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
  background: var(--accent);
  color: #fff;
  border-color: var(--accent-strong);
  transform: scale(1.18);
}
</style>
