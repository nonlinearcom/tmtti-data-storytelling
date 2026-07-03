import { ref, computed } from 'vue'
import * as d3 from 'd3'

// Module-level state: every component calling useStory() shares the same story.
const stories = ref([])
const currentStoryId = ref(null)
const title = ref(null)
const events = ref([])
const activeIndex = ref(-1) // -1 = overview (no event selected yet)
const error = ref(null)

const fmtFull = d3.timeFormat('%b %-d, %Y')
const fmtMonth = d3.timeFormat('%b %Y')

function toDate(year, month, day) {
  if (!year) return null
  return new Date(+year, month ? +month - 1 : 0, day ? +day : 1)
}

// date precision follows the data: 1932 → "1932", 1989/3 → "Mar 1989", full → "May 5, 1892"
function fmt(year, month, day) {
  if (!year) return ''
  if (!month) return String(year)
  if (!day) return fmtMonth(toDate(year, month, day))
  return fmtFull(toDate(year, month, day))
}

// TimelineJS sheets often carry pasted-in HTML; drop the empty wrappers.
function cleanHtml(html = '') {
  return html
    .replace(/<div>\s*(?:<br\s*\/?>)*\s*<\/div>/gi, '')
    .replace(/(?:<br\s*\/?>\s*)+$/gi, '')
    .trim()
}

function parseRow(row, i) {
  const startLabel = fmt(row.Year, row.Month, row.Day)
  const endLabel = fmt(row['End Year'], row['End Month'], row['End Day'])
  return {
    id: i,
    type: (row.Type || '').trim().toLowerCase(),
    headline: (row.Headline || '').trim(),
    text: cleanHtml(row.Text),
    start: toDate(row.Year, row.Month, row.Day),
    end: toDate(row['End Year'], row['End Month'], row['End Day']) || toDate(row.Year, row.Month, row.Day),
    displayDate:
      row['Display Date'] ||
      (endLabel && endLabel !== startLabel ? `${startLabel} – ${endLabel}` : startLabel),
    media: row.Media
      ? {
          url: row.Media,
          credit: row['Media Credit'],
          caption: row['Media Caption'],
          alt: row['Alt Text'],
        }
      : null,
    source:
      row.Source || row['Source URL']
        ? { label: row.Source || row['Source URL'], url: row['Source URL'] || null }
        : null,
    shape: (row.Shape || '').trim() || null, // GeoJSON filename in public/data/shapes/
    lat: row.Lat ? +row.Lat : null,
    lon: row.Lon ? +row.Lon : null,
    zoom: row.Zoom ? +row.Zoom : 4,
  }
}

function storyIdFromHash() {
  return decodeURIComponent(window.location.hash.replace(/^#\/?/, ''))
}

async function loadStory(id) {
  const story = stories.value.find((s) => s.id === id)
  if (!story || currentStoryId.value === id) return
  currentStoryId.value = id
  try {
    const rows = await d3.csv(`${import.meta.env.BASE_URL}data/${story.file}`)
    if (currentStoryId.value !== id) return // a newer switch won the race
    const parsed = rows.map(parseRow)
    title.value = parsed.find((d) => d.type === 'title') ?? null
    events.value = parsed
      .filter((d) => d.type !== 'title' && d.start)
      .sort((a, b) => a.start - b.start)
    activeIndex.value = -1
    window.location.hash = id
    document.title = `${story.title} — TMTTI`
  } catch (e) {
    error.value = e
    console.error(`Could not load story "${id}":`, e)
  }
}

async function load() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/stories.json`)
    stories.value = await res.json()
    window.addEventListener('hashchange', () => {
      const id = storyIdFromHash()
      if (stories.value.some((s) => s.id === id)) loadStory(id)
    })
    const initial = stories.value.find((s) => s.id === storyIdFromHash()) ?? stories.value[0]
    if (initial) await loadStory(initial.id)
  } catch (e) {
    error.value = e
    console.error('Could not load stories manifest:', e)
  }
}

export function useStory() {
  const activeEvent = computed(() => events.value[activeIndex.value] ?? null)
  const currentStory = computed(
    () => stories.value.find((s) => s.id === currentStoryId.value) ?? null
  )

  function select(i) {
    activeIndex.value = i
  }
  function next() {
    if (activeIndex.value < events.value.length - 1) activeIndex.value++
  }
  function prev() {
    if (activeIndex.value > -1) activeIndex.value-- // one step past the first event = overview
  }

  return {
    stories,
    currentStoryId,
    currentStory,
    title,
    events,
    activeIndex,
    activeEvent,
    error,
    load,
    loadStory,
    select,
    next,
    prev,
  }
}
