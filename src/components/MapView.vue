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
let built = false

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

// Keep the camera target clear of the header and the event card.
function pad() {
  const w = container.value?.clientWidth ?? 1000
  return { top: 90, bottom: 40, left: 40, right: w > 760 ? 420 : 40 }
}

function overview(animate = true) {
  const b = new maplibregl.LngLatBounds()
  events.value.forEach((e) => b.extend([e.lon, e.lat]))
  map.fitBounds(b, { padding: pad(), duration: animate ? 1400 : 0, maxZoom: 5 })
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
    markers.push(new maplibregl.Marker({ element: el }).setLngLat([e.lon, e.lat]).addTo(map))
  })

  overview(false)
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
  map.on('load', () => {
    mapReady.value = true
  })
})

onBeforeUnmount(() => map?.remove())

// The map and the CSV load in parallel; build the story layer when both are in.
watch([mapReady, events], () => {
  if (mapReady.value && events.value.length && !built) {
    built = true
    buildStoryLayer()
  }
})

watch(activeIndex, (i) => {
  if (!map || !built) return
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
