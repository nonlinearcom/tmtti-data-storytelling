import { ref, computed } from 'vue'
import * as d3 from 'd3'
import { storyColor } from '../storyColors'

// Module-level state: every component calling useStory() shares the same view.
const stories = ref([]) // manifest entries: {id, title, file, color}
const selectedIds = ref([]) // checked stories, kept in manifest order
const activeIndex = ref(-1) // -1 = overview (no event selected yet)
const error = ref(null)

const cache = new Map() // story id -> { title, events } after first fetch
const loadedTick = ref(0) // bumped when a fetch lands, so computeds see the cache

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

function parseRow(row, i, story) {
  const startLabel = fmt(row.Year, row.Month, row.Day)
  const endLabel = fmt(row['End Year'], row['End Month'], row['End Day'])
  return {
    id: `${story.id}:${i}`,
    storyId: story.id,
    storyTitle: story.title,
    color: story.color,
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

async function ensureLoaded(story) {
  if (cache.has(story.id)) return
  const rows = await d3.csv(`${import.meta.env.BASE_URL}data/${story.file}`)
  const parsed = rows.map((row, i) => parseRow(row, i, story))
  cache.set(story.id, {
    title: parsed.find((d) => d.type === 'title') ?? null,
    events: parsed.filter((d) => d.type !== 'title' && d.start),
  })
  loadedTick.value++
}

function idsFromHash() {
  return decodeURIComponent(window.location.hash.replace(/^#\/?/, ''))
    .split('+')
    .filter(Boolean)
}

function syncHashAndTitle() {
  window.location.hash = selectedIds.value.join('+')
  const names = stories.value
    .filter((s) => selectedIds.value.includes(s.id))
    .map((s) => s.title)
  document.title = `${names.join(' × ')} — TMTTI`
}

// Resolve a set of story ids: load what's missing, keep manifest order, ≥1 story.
async function applyIds(ids) {
  const known = ids.filter((id) => stories.value.some((s) => s.id === id))
  const target = known.length ? known : stories.value.length ? [stories.value[0].id] : []
  try {
    await Promise.all(target.map((id) => ensureLoaded(stories.value.find((s) => s.id === id))))
  } catch (e) {
    error.value = e
    console.error('Could not load stories:', e)
    return
  }
  selectedIds.value = stories.value.map((s) => s.id).filter((id) => target.includes(id))
  activeIndex.value = -1
  syncHashAndTitle()
}

function onHashChange() {
  const ids = idsFromHash()
  if (ids.join('+') === selectedIds.value.join('+')) return // our own write
  applyIds(ids)
}

async function load() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/stories.json`)
    const list = await res.json()
    stories.value = list.map((s, i) => ({ ...s, color: storyColor(i) }))
    window.addEventListener('hashchange', onHashChange)
    await applyIds(idsFromHash())
  } catch (e) {
    error.value = e
    console.error('Could not load stories manifest:', e)
  }
}

// Show exactly one story (the picker's "click a name" shortcut).
async function soloStory(id) {
  if (selectedIds.value.length === 1 && selectedIds.value[0] === id) return // already solo — keep position
  const story = stories.value.find((s) => s.id === id)
  if (!story) return
  try {
    await ensureLoaded(story)
  } catch (e) {
    error.value = e
    console.error(`Could not load story "${id}":`, e)
    return
  }
  selectedIds.value = [id]
  activeIndex.value = -1
  syncHashAndTitle()
}

async function toggleStory(id) {
  const story = stories.value.find((s) => s.id === id)
  if (!story) return
  if (selectedIds.value.includes(id)) {
    if (selectedIds.value.length === 1) return // always keep one story
    selectedIds.value = selectedIds.value.filter((x) => x !== id)
  } else {
    try {
      await ensureLoaded(story)
    } catch (e) {
      error.value = e
      console.error(`Could not load story "${id}":`, e)
      return
    }
    selectedIds.value = stories.value
      .map((s) => s.id)
      .filter((sid) => sid === id || selectedIds.value.includes(sid))
  }
  activeIndex.value = -1
  syncHashAndTitle()
}

export function useStory() {
  // All checked stories' events, merged into one chronology.
  const events = computed(() => {
    loadedTick.value // re-run when a story finishes loading
    return selectedIds.value
      .flatMap((id) => cache.get(id)?.events ?? [])
      .sort((a, b) => a.start - b.start)
  })

  const selectedStories = computed(() => {
    loadedTick.value
    return stories.value
      .filter((s) => selectedIds.value.includes(s.id))
      .map((s) => ({ ...s, count: cache.get(s.id)?.events.length ?? 0 }))
  })

  const title = computed(() => {
    if (selectedIds.value.length === 1) return cache.get(selectedIds.value[0])?.title ?? null
    if (selectedIds.value.length > 1)
      return { headline: `${selectedIds.value.length} stories, one timeline`, text: '' }
    return null
  })

  const activeEvent = computed(() => events.value[activeIndex.value] ?? null)

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
    selectedIds,
    selectedStories,
    title,
    events,
    activeIndex,
    activeEvent,
    error,
    load,
    toggleStory,
    soloStory,
    select,
    next,
    prev,
  }
}
