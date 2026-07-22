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

// students' sheets mid-edit often lack coordinates — those events live on the
// timeline only and are skipped by every map layer
const located = () => events.value.filter((e) => e.lat != null && e.lon != null)

function overview(animate = true) {
  const locs = located()
  if (!locs.length) return
  const b = new maplibregl.LngLatBounds()
  locs.forEach((e) => b.extend([e.lon, e.lat]))
  // cameraForBounds only supplies the zoom (with a 60px margin); the globe is
  // centered in the viewport — the card may overlap its right edge, by design.
  const cam = map.cameraForBounds(b, { padding: 60, maxZoom: 5 })
  // turn the globe to where the story begins — events are chronological, so
  // the first located event is the story's first mappable chapter
  const first = locs[0]
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
  located().forEach((e) => {
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
    if (e.lat == null || e.lon == null) {
      markers.push(null) // keep markers[] aligned with event indices
      return
    }
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
  markers.forEach((m) => m?.remove())
  markers = []
  for (const id of ['story-line', 'story-shape-fill', 'story-shape-line', 'story-shape-point', 'story-shape-label']) {
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
  // fill layers auto-close and fill LineStrings too — restrict to real polygons
  const fillFilter = ['all', ['==', ['geometry-type'], 'Polygon'], filter]
  map.addLayer(
    {
      id: 'story-shape-fill',
      type: 'fill',
      source: 'story-shapes',
      filter: fillFilter,
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.12 },
    },
    'story-line' // areas sit beneath the dashed story line
  )
  // solid and heavier than the 1.5px dashed story route, so shape lines read as
  // geography (a cable, a border) rather than as another leg of the route
  map.addLayer(
    {
      id: 'story-shape-line',
      type: 'line',
      source: 'story-shapes',
      filter,
      paint: { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-opacity': 0.85 },
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
        'circle-radius': 7,
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.85,
        'circle-stroke-color': '#fcfcfb',
        'circle-stroke-width': 2,
      },
    },
    'story-line'
  )
  // ...and say what they are: a dot without its "name" property rendered is
  // decoration, not data. Borrow a font the basemap's glyph server serves.
  const styleFont = map.getStyle().layers.find((l) => l.layout?.['text-font'])?.layout['text-font']
  map.addLayer({
    id: 'story-shape-label',
    type: 'symbol',
    source: 'story-shapes',
    filter: pointFilter,
    layout: {
      'text-field': ['get', 'name'],
      ...(styleFont ? { 'text-font': styleFont } : {}),
      'text-size': 12,
      'text-anchor': 'top',
      'text-offset': [0, 0.8],
      // these labels ARE the data — never let a basemap label out-compete them
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': ['get', 'color'],
      'text-halo-color': '#fcfcfb',
      'text-halo-width': 2,
    },
  })
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
  markers.forEach((m, idx) => m?.getElement().classList.toggle('active', idx === i))
  if (map.getLayer('story-shape-fill')) {
    const filter = ['==', ['get', 'eventIndex'], i]
    map.setFilter('story-shape-fill', ['all', ['==', ['geometry-type'], 'Polygon'], filter])
    map.setFilter('story-shape-line', filter)
    const pointFilter = ['all', ['==', ['geometry-type'], 'Point'], filter]
    map.setFilter('story-shape-point', pointFilter)
    map.setFilter('story-shape-label', pointFilter)
  }
  const e = events.value[i]
  if (!e) {
    overview()
    return
  }
  if (e.lat == null || e.lon == null) return // unlocated: timeline/card only, camera stays
  const box = shapeBoxes[i]
  if (box && box[1][0] - box[0][0] > 150) {
    // Planet-spanning shapes (the smartphone supply chain) can never fit in a
    // globe viewport — cameraForBounds has no answer. Show the fullest
    // hemisphere instead and let people spin the globe for the rest.
    map.flyTo({
      center: [(box[0][0] + box[1][0]) / 2, (box[0][1] + box[1][1]) / 2],
      zoom: 1.05,
      offset: cardOffset(),
      duration: 2200,
      essential: true,
    })
  } else if (box) {
    // An event with an area frames the whole area, not just its marker.
    // Instead of cardOffset's fixed nudge, reserve the card's real footprint
    // (33.33vw, min 360px — keep in sync with EventCard.vue) as right padding,
    // so wide shapes like the TAT-8 cable aren't half-hidden under the card.
    const w = container.value?.clientWidth ?? 1000
    const padding =
      w > 760 ? { top: 48, bottom: 48, left: 48, right: Math.max(360, w / 3) + 48 } : 40
    const cam = map.cameraForBounds(box, { padding, maxZoom: e.zoom ?? 12 })
    map.flyTo({
      center: cam?.center ?? [e.lon, e.lat],
      zoom: cam?.zoom ?? 5,
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
