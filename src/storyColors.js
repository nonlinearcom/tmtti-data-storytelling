// Categorical palette (light-mode set from the validated dataviz reference).
// The ORDER is the colorblind-safety mechanism — don't reorder it.
// A story's color comes from its position in stories.json, so it is stable
// no matter which stories are checked: color follows the story, not the rank.
export const STORY_COLORS = [
  '#2a78d6', // blue
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
  '#e87ba4', // magenta
  '#eb6834', // orange
]

export function storyColor(manifestIndex) {
  return STORY_COLORS[manifestIndex % STORY_COLORS.length]
}
