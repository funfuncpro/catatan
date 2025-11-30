/**
 * Predefined cursor colors with 50% opacity.
 * Format: #RRGGBBAA (hex with alpha)
 */
const CURSOR_COLORS = [
  "#E53E3E80", // red
  "#DD6B2080", // orange
  "#D69E2E80", // yellow
  "#38A16980", // green
  "#31979580", // teal
  "#3182CE80", // blue
  "#805AD580", // purple
  "#D53F8C80", // pink
  "#2B6CB080", // dark blue
  "#C0562180", // dark orange
  "#27674980", // dark green
  "#6B46C180", // dark purple
] as const;

/**
 * Generate a random cursor color from the predefined palette.
 */
export function generateColor(): string {
  const index = Math.floor(Math.random() * CURSOR_COLORS.length);
  return CURSOR_COLORS[index];
}

/**
 * Generate a deterministic color based on a string (e.g., writer ID).
 * Same writer always gets the same color.
 */
export function generateColorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const index = Math.abs(hash) % CURSOR_COLORS.length;
  return CURSOR_COLORS[index];
}
