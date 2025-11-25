const LEAF_MAX = 512;

interface RopeLeaf {
  readonly kind: "leaf";
  readonly text: string;
  readonly length: number;
}

interface RopeBranch {
  readonly kind: "branch";
  readonly left: Rope;
  readonly right: Rope;
  readonly length: number;
  readonly depth: number;
}

export type Rope = RopeLeaf | RopeBranch;

const leaf = (text: string): RopeLeaf => ({
  kind: "leaf",
  text,
  length: text.length,
});

const branch = (left: Rope, right: Rope): RopeBranch => ({
  kind: "branch",
  left,
  right,
  length: left.length + right.length,
  depth: Math.max(depth(left), depth(right)) + 1,
});

export const empty = (): Rope => leaf("");

export const fromString = (text: string): Rope => {
  if (text.length <= LEAF_MAX) {
    return leaf(text);
  }

  const mid = Math.floor(text.length / 2);
  return concat(fromString(text.slice(0, mid)), fromString(text.slice(mid)));
};

export const length = (rope: Rope): number => rope.length;

export const depth = (rope: Rope): number =>
  rope.kind === "leaf" ? 0 : rope.depth;

export const isEmpty = (rope: Rope): boolean => rope.length === 0;

export const charAt = (rope: Rope, index: number): string => {
  if (index < 0 || index >= rope.length) return "";

  if (rope.kind === "leaf") {
    return rope.text[index];
  }

  const leftLen = rope.left.length;
  return index < leftLen
    ? charAt(rope.left, index)
    : charAt(rope.right, index - leftLen);
};

export const slice = (rope: Rope, start: number, end?: number): string => {
  const actualEnd = end ?? rope.length;

  if (start >= actualEnd || start >= rope.length) return "";
  if (start <= 0 && actualEnd >= rope.length) return toString(rope);

  if (rope.kind === "leaf") {
    return rope.text.slice(
      Math.max(0, start),
      Math.min(rope.length, actualEnd),
    );
  }

  const leftLen = rope.left.length;

  if (actualEnd <= leftLen) {
    return slice(rope.left, start, actualEnd);
  }
  if (start >= leftLen) {
    return slice(rope.right, start - leftLen, actualEnd - leftLen);
  }

  return (
    slice(rope.left, start, leftLen) + slice(rope.right, 0, actualEnd - leftLen)
  );
};

export const toString = (rope: Rope): string => {
  if (rope.kind === "leaf") return rope.text;
  return toString(rope.left) + toString(rope.right);
};

export const lineStarts = (rope: Rope): number[] => {
  const starts = [0];
  const str = toString(rope);

  for (let i = 0; i < str.length; i++) {
    if (str[i] === "\n") {
      starts.push(i + 1);
    }
  }

  return starts;
};

/** Get line count - O(n) */
export const lineCount = (rope: Rope): number => {
  let count = 1;
  const iterate = (r: Rope): void => {
    if (r.kind === "leaf") {
      for (const c of r.text) if (c === "\n") count++;
    } else {
      iterate(r.left);
      iterate(r.right);
    }
  };
  iterate(rope);
  return count;
};

/** Get line at index - O(n) for finding, O(log n + k) for extraction */
export const getLine = (rope: Rope, lineIndex: number): string => {
  const starts = lineStarts(rope);
  if (lineIndex < 0 || lineIndex >= starts.length) return "";

  const start = starts[lineIndex];
  const end =
    lineIndex + 1 < starts.length ? starts[lineIndex + 1] - 1 : rope.length;

  return slice(rope, start, end);
};

// ============================================================================
// Concatenation - O(log n)
// ============================================================================

/** Concatenate two ropes - O(log n) */
export const concat = (left: Rope, right: Rope): Rope => {
  if (left.length === 0) return right;
  if (right.length === 0) return left;

  // Merge small adjacent leaves
  if (
    left.kind === "leaf" &&
    right.kind === "leaf" &&
    left.length + right.length <= LEAF_MAX
  ) {
    return leaf(left.text + right.text);
  }

  const newRope = branch(left, right);

  // Rebalance if needed
  return shouldRebalance(newRope) ? rebalance(newRope) : newRope;
};

/** Concatenate multiple ropes - O(m log n) */
export const concatMany = (...ropes: Rope[]): Rope =>
  ropes.reduce(concat, empty());

// ============================================================================
// Split - O(log n)
// ============================================================================

/** Split rope at index - O(log n) */
export const split = (rope: Rope, index: number): [Rope, Rope] => {
  if (index <= 0) return [empty(), rope];
  if (index >= rope.length) return [rope, empty()];

  if (rope.kind === "leaf") {
    return [leaf(rope.text.slice(0, index)), leaf(rope.text.slice(index))];
  }

  const leftLen = rope.left.length;

  if (index === leftLen) {
    return [rope.left, rope.right];
  }

  if (index < leftLen) {
    const [ll, lr] = split(rope.left, index);
    return [ll, concat(lr, rope.right)];
  }

  const [rl, rr] = split(rope.right, index - leftLen);
  return [concat(rope.left, rl), rr];
};

export const insert = (rope: Rope, index: number, text: string): Rope => {
  if (text.length === 0) return rope;

  const [left, right] = split(rope, index);
  return concat(concat(left, fromString(text)), right);
};

export const prepend = (rope: Rope, text: string): Rope =>
  insert(rope, 0, text);

export const append = (rope: Rope, text: string): Rope =>
  insert(rope, rope.length, text);

export const remove = (rope: Rope, start: number, end: number): Rope => {
  if (start >= end || start >= rope.length) return rope;

  const [left, rest] = split(rope, start);
  const [_, right] = split(rest, end - start);

  return concat(left, right);
};

export const removeAt = (rope: Rope, index: number): Rope =>
  remove(rope, index, index + 1);

export const replace = (
  rope: Rope,
  start: number,
  end: number,
  text: string,
): Rope => {
  const [left, rest] = split(rope, start);
  const [_, right] = split(rest, end - start);
  return concat(concat(left, fromString(text)), right);
};

const shouldRebalance = (rope: Rope): boolean => {
  if (rope.kind === "leaf") return false;

  const depthDiff = Math.abs(depth(rope.left) - depth(rope.right));
  return depthDiff > 2;
};

const rebalance = (rope: Rope): Rope => {
  const leaves: string[] = [];
  const collect = (r: Rope): void => {
    if (r.kind === "leaf") {
      if (r.text.length > 0) leaves.push(r.text);
    } else {
      collect(r.left);
      collect(r.right);
    }
  };
  collect(rope);

  const buildBalanced = (texts: string[]): Rope => {
    if (texts.length === 0) return empty();
    if (texts.length === 1) return leaf(texts[0]);

    const mid = Math.floor(texts.length / 2);
    return branch(
      buildBalanced(texts.slice(0, mid)),
      buildBalanced(texts.slice(mid)),
    );
  };

  return buildBalanced(leaves);
};

export function* chars(rope: Rope): Generator<string> {
  if (rope.kind === "leaf") {
    for (const c of rope.text) yield c;
  } else {
    yield* chars(rope.left);
    yield* chars(rope.right);
  }
}

export function* lines(rope: Rope): Generator<string> {
  let current = "";

  for (const c of chars(rope)) {
    if (c === "\n") {
      yield current;
      current = "";
    } else {
      current += c;
    }
  }

  if (current.length > 0 || rope.length === 0) {
    yield current;
  }
}

export const mapLines = (
  rope: Rope,
  fn: (line: string, i: number) => string,
): Rope => {
  const result: string[] = [];
  let i = 0;

  for (const line of lines(rope)) {
    result.push(fn(line, i++));
  }

  return fromString(result.join("\n"));
};

export const indexOf = (rope: Rope, search: string, start = 0): number => {
  const str = toString(rope);
  return str.indexOf(search, start);
};

export const indicesOf = (rope: Rope, search: string): number[] => {
  const indices: number[] = [];
  const str = toString(rope);
  let pos = 0;

  while ((pos = str.indexOf(search, pos)) !== -1) {
    indices.push(pos);
    pos += 1;
  }

  return indices;
};
