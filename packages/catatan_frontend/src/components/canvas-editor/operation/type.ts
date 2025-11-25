// Key binding configuration
export interface KeyBinding<T = unknown> {
  readonly key: string;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly shiftKey?: boolean;
  readonly preventDefault?: boolean;
  readonly operation: (state: T) => T;
}

// For text measurement (canvas rendering)
export type MeasureTextFn = (text: string) => number;

// Key matcher helper
export const matchesKey = <T>(
  event: KeyboardEvent,
  binding: KeyBinding<T>,
): boolean =>
  event.key === binding.key &&
  !!event.metaKey === !!binding.metaKey &&
  !!event.altKey === !!binding.altKey &&
  !!event.ctrlKey === !!binding.ctrlKey &&
  !!event.shiftKey === !!binding.shiftKey;
