# The Digital Border — map × timeline demo

A small custom rebuild of a student TimelineJS + StoryMapJS project, for the MICRI
data-storytelling workshop. Not a TimelineJS clone — a dataviz / creative-coding
exercise: a full-screen map ([MapLibre GL](https://maplibre.org/)) driven by a
timeline strip drawn with [D3](https://d3js.org/), built with Vue 3 + Vite.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # static site in dist/ — host it anywhere
```

## How it works

- [public/data/the-digital-border.csv](public/data/the-digital-border.csv) — the data.
  It's the TimelineJS spreadsheet export **plus three extra columns: `Lat`, `Lon`, `Zoom`**
  (merged in from the StoryMapJS export). That's the whole trick: your timeline
  spreadsheet becomes a map dataset by adding three columns.
- [src/composables/useStory.js](src/composables/useStory.js) — loads the CSV with `d3.csv`,
  parses dates and media, and holds the one piece of shared state: `activeIndex`,
  which event is selected.
- [src/components/Timeline.vue](src/components/Timeline.vue) — the D3 exercise. A time
  scale, an axis, and one range bar per event; overlapping events stack onto lanes.
  Clicking a bar sets `activeIndex`.
- [src/components/MapView.vue](src/components/MapView.vue) — numbered markers, a dashed
  line through the story in date order, and a `flyTo` whenever `activeIndex` changes.
- [src/components/EventCard.vue](src/components/EventCard.vue) — headline, date range,
  text, media and credit for the selected event, plus back/next.

Arrow keys (← →) also step through the story. Going back past the first event
returns to the overview.

## Use your own data

1. Export your TimelineJS Google Sheet as CSV.
2. Add `Lat`, `Lon`, `Zoom` columns and fill them for every event
   (right-click a spot on [OpenStreetMap](https://www.openstreetmap.org) → "Show address"
   to get coordinates).
3. Replace the file in `public/data/` and point the filename in
   `src/composables/useStory.js` at it.

## Teaching notes

- The raw student exports are untouched in [data/](data/): the TimelineJS CSV and the
  StoryMapJS JSON. Compare them with the merged file — merging *is* a data-cleaning lesson.
- One event had no location in the StoryMapJS export (the Apartheid "Dompas"); it was
  filled in as Johannesburg during the merge. And the "Paris Conference" pin sits in
  **Geneva** (the League of Nations HQ) — is that a mistake or a choice? Every map takes
  sides; even a demo dataset has a gap to find.
