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

// The hemisphere that shows the most markers: circular mean of the longitudes
// (a plain average breaks across the date line), simple mean of the latitudes.
function storyCenter() {
  let x = 0
  let y = 0
  let lat = 0
  events.value.forEach((e) => {
    const r = (e.lon * Math.PI) / 180
    x += Math.cos(r)
    y += Math.sin(r)
    lat += e.lat
  })
  return [(Math.atan2(y, x) * 180) / Math.PI, lat / events.value.length]
}

function overview(animate = true) {
  const b = new maplibregl.LngLatBounds()
  events.value.forEach((e) => b.extend([e.lon, e.lat]))
  // symmetric padding: the globe sits centered in the viewport, even if the
  // event card overlaps its right edge
  const opts = { padding: 60, duration: animate ? 1400 : 0, maxZoom: 5 }
  const cam = map.cameraForBounds(b, opts)
  if (!cam) return map.fitBounds(b, opts)
  // keep the zoom fitBounds would pick, but centre the globe on the story's
  // "busiest" hemisphere — a story spanning >180° can't show every marker anyway
  map.flyTo({ ...cam, center: storyCenter(), ...opts, essential: true })
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
  if (map.getLayer('story-line')) map.removeLayer('story-line')
  if (map.getSource('story-line')) map.removeSource('story-line')
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
  clearStory()
  buildStoryLayer()
  overview(isSwitch) // first story: jump straight there; switch: fly over
})

watch(activeIndex, (i) => {
  if (!map || !markers.length) return
  markers.forEach((m, idx) => m.getElement().classList.toggle('active', idx === i))
  const e = events.value[i]
  if (!e) {
    overview()
    return
  }
  map.flyTo({
    center: [e.lon, e.lat],
    zoom: Math.min(e.zoom ?? 10, 12),
    padding: pad(),
    speed: 0.8,
    essential: true,
  })
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
