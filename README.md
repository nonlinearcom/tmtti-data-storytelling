# TMTTI — map × timeline stories

Custom rebuilds of student TimelineJS + StoryMapJS projects, for the MICRI
data-storytelling workshop. Not a TimelineJS clone — a dataviz / creative-coding
exercise: a full-screen map ([MapLibre GL](https://maplibre.org/)) driven by a
timeline strip drawn with [D3](https://d3js.org/), built with Vue 3 + Vite.
The app hosts **multiple stories** (one per team) behind a checkbox dropdown in
the header — check several to overlay them on one map and timeline, each story
in its own identity color (assigned by position in `stories.json`). Views are
shareable by URL hash: one story (`#the-world-wide-web`) or a combination
(`#the-digital-border+the-world-wide-web`).

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # static site in dist/ — host it anywhere
```

## How it works

- [public/data/stories.json](public/data/stories.json) — the story registry: one
  `{ id, title, file }` entry per story CSV.
- [public/data/the-digital-border.csv](public/data/the-digital-border.csv) and
  [public/data/the-world-wide-web.csv](public/data/the-world-wide-web.csv) — the data.
  Each is a TimelineJS spreadsheet export **plus five extra columns: `Lat`, `Lon`,
  `Zoom`, `Source`, `Source URL`**. That's the whole trick: your timeline spreadsheet
  becomes a mapped, sourced dataset by adding five columns. The title row's `Text`
  is the story intro; every event's source renders as a link in its card.
- [src/composables/useStory.js](src/composables/useStory.js) — loads the registry and
  the current story's CSV with `d3.csv`, parses dates/media/sources, syncs the story
  to the URL hash, and holds the shared state: `currentStoryId` and `activeIndex`.
- [src/components/Timeline.vue](src/components/Timeline.vue) — the D3 exercise. A time
  scale, an axis, and one range bar per event; overlapping events stack onto lanes.
  Clicking a bar sets `activeIndex`.
- [src/components/MapView.vue](src/components/MapView.vue) — numbered markers, a dashed
  line through the story in date order, and a `flyTo` whenever `activeIndex` changes.
- [src/components/EventCard.vue](src/components/EventCard.vue) — headline, date range,
  text, media and credit for the selected event, plus back/next.

Arrow keys (← →) also step through the story. Going back past the first event
returns to the overview.

## Add your own story

1. Export your TimelineJS Google Sheet as CSV.
2. Add `Lat`, `Lon`, `Zoom`, `Source`, `Source URL` columns and fill them for every
   event (right-click a spot on [OpenStreetMap](https://www.openstreetmap.org) →
   "Show address" to get coordinates). Put your story intro in the title row's `Text`.
3. Drop the file in `public/data/` and add one line to
   [public/data/stories.json](public/data/stories.json). Done — it appears in the
   header switcher, at its own `#your-story-id` URL.

### Give an event an area (optional)

Some events aren't a point — a pass-law system covers a country, a supply chain
covers a region. To draw that:

1. Go to [geojson.io](https://geojson.io), draw a polygon (or drop markers for a
   group of cities), then *Save → GeoJSON*. For real country borders, use
   [geojson-maps.kyd.au](https://geojson-maps.kyd.au) (pick "low resolution").
   If the file is big, simplify it at [mapshaper.org](https://mapshaper.org).
2. Put the file in `public/data/shapes/` and write its name in the event's
   `Shape` column.

When that event is selected, its area fades in and the map frames it. See the
Apartheid "Dompas" event in The Digital Border for a working example
(`south-africa.geojson`). No file? The event just behaves as a normal point.

## Teaching notes

- The raw student exports are untouched in [data/](data/): the TimelineJS CSV and the
  StoryMapJS JSON. Compare them with the merged file — merging *is* a data-cleaning lesson.
- One event had no location in the StoryMapJS export (the Apartheid "Dompas"); it was
  filled in as Johannesburg during the merge.