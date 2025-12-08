# Catatan Frontend

A real-time collaborative text editor built with **SolidJS**, featuring a custom canvas-based rendering engine and CRDT-based synchronization for conflict-free multi-user editing.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Functional Programming Concepts](#functional-programming-concepts)
- [Key Modules](#key-modules)
- [Understanding the Codebase](#understanding-the-codebase)

---

## Overview

Catatan is a note-taking application that supports:

- **Real-time collaboration** - Multiple users can edit the same document simultaneously
- **Conflict-free synchronization** - Uses YATA CRDT algorithm for consistent merging
- **Custom canvas editor** - High-performance text rendering without DOM manipulation
- **Cursor presence** - See other collaborators' cursors in real-time
- **Rich text formatting** - Bold, italic, code, strikethrough, and more

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **SolidJS** | Reactive UI framework (fine-grained reactivity) |
| **TanStack Router** | File-based routing with SSR support |
| **TanStack Start** | Full-stack framework for SolidJS |
| **Vite** | Build tool and dev server |
| **TailwindCSS v4** | Utility-first CSS |
| **TypeScript** | Type safety |
| **WebSocket (Phoenix)** | Real-time communication |
| **YATA CRDT** | Conflict-free replicated data type |

---

## Getting Started

### Prerequisites

- Node.js 18+ or Bun runtime
- Backend server running (see `catatan_backend`)

### Installation

```bash
# Install dependencies
bun install
# or
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your API URL
```

### Development

```bash
# Start development server
bun run dev
# or
npm run dev
```

The app runs at `http://localhost:3000`.

### Build

```bash
# Type check
bun run typecheck

# Production build
bun run build
```

---

## Project Structure

```
src/
├── components/          # UI Components
│   ├── canvas-editor/   # Custom text editor (canvas-based)
│   │   ├── editor/      # Rendering, layout, viewport
│   │   └── operation/   # Text operations, document model
│   ├── layout/          # App layout (header, command palette)
│   └── ui/              # Shared UI components
├── context/             # SolidJS context providers (state management)
├── lib/                 # Core utilities and business logic
│   └── crdt/            # YATA CRDT implementation
├── routes/              # File-based routing (TanStack Router)
├── styles/              # Global styles
└── types/               # TypeScript type definitions
```

---

### Context Provider Hierarchy

The application uses nested context providers for state management:

```tsx
<NotesContextProvider>      // Note ID management
  <YataContextProvider>     // CRDT document state
    <CursorContextProvider> // Cursor position tracking
      <EditorSyncContextProvider> // Local ↔ CRDT sync
        <WriterContextProvider>   // Collaborator info
          <ConnectionContextProvider> // WebSocket handling
            <App />
          </ConnectionContextProvider>
        </WriterContextProvider>
      </EditorSyncContextProvider>
    </CursorContextProvider>
  </YataContextProvider>
</NotesContextProvider>
```

---

## Functional Programming Concepts

The codebase heavily employs functional programming principles (but not all). 
Here's all of the application of functional programming concepts in this project:

### 1. Immutability

**All data structures are immutable.** State changes create new objects rather than mutating existing ones.

```typescript
// src/components/canvas-editor/operation/document.ts

export const insertAt = (doc: Document, pos: number, str: string): Document => {
  const newText = Rope.insert(doc.text, pos, str);
  const newFormats = shiftFormats(doc.formats, pos, str.length);

  return {           // Returns a NEW document
    text: newText,
    root: textToNodes(Rope.toString(newText), newFormats),
    formats: newFormats,
  };
};
```

The `EditorState` is also immutable:

```typescript
export interface EditorState {
  readonly doc: Doc.Document;  // readonly modifier enforces immutability
  readonly cursor: number;
  readonly anchor: number | null;
}
```

### 2. Pure Functions

Functions produce the same output for the same input, with no side effects.

```typescript
// src/components/canvas-editor/operation/movement.ts

export const moveLeft = (state: EditorState): EditorState => {
  if (hasSelection(state)) {
    const { start } = getSelection(state);
    return { ...state, cursor: start, anchor: null };
  }
  return {
    ...state,
    cursor: Math.max(0, state.cursor - 1),
    anchor: null,
  };
};
```

- Takes `EditorState` → Returns new `EditorState`
- No mutations, no side effects
- Predictable and testable

### 3. Higher-Order Functions

Functions that take or return other functions.

```typescript
// src/lib/crdt/yata.ts - Factory pattern returning an object of functions

export function createYataDocument(noteId: string, writerId: string): YataDocument {
  const state: YataState = { /* internal state */ };

  // Returns an object with closures that capture the internal state
  return {
    toList: () => toListWithDeleted().filter((el) => el.deletedAt === null),
    toText: () => toList().map((el) => el.content).join(""),
    insert: (origin, rightOrigin, content) => { /* ... */ },
    // ... more methods
  };
}
```

```typescript
// src/components/canvas-editor/operation/rope.ts

export const mapLines = (
  rope: Rope,
  fn: (line: string, i: number) => string,  // Function as parameter
): Rope => {
  const result: string[] = [];
  let i = 0;
  for (const line of lines(rope)) {
    result.push(fn(line, i++));
  }
  return fromString(result.join("\n"));
};
```

### 4. Algebraic Data Types (ADTs)

Using TypeScript unions and discriminated unions for type-safe modeling.

```typescript
// src/components/canvas-editor/operation/rope.ts

interface RopeLeaf {
  readonly kind: "leaf";      // Discriminant
  readonly text: string;
  readonly length: number;
}

interface RopeBranch {
  readonly kind: "branch";    // Discriminant
  readonly left: Rope;
  readonly right: Rope;
  readonly length: number;
  readonly depth: number;
}

export type Rope = RopeLeaf | RopeBranch;  // Sum type

// Pattern matching via discriminant
export const charAt = (rope: Rope, index: number): string => {
  if (rope.kind === "leaf") {
    return rope.text[index];
  }
  // rope.kind === "branch" - TypeScript knows this
  const leftLen = rope.left.length;
  return index < leftLen
    ? charAt(rope.left, index)
    : charAt(rope.right, index - leftLen);
};
```

### 5. Recursion over Iteration

Many algorithms use recursion, especially for tree structures.

```typescript
// src/lib/crdt/yata.ts - Recursive reachability check

const isReachable = (
  elementsMap: Map<string, CRDT.Element>,
  element: CRDT.Element,
  targetId: CRDT.ElementId | null,
): boolean => {
  if (targetId === null) return false;
  if (CRDT.ElementId.equals(element.id, targetId)) return true;
  if (element.rightOrigin === null) return false;
  if (CRDT.ElementId.equals(element.rightOrigin, targetId)) return true;

  const next = elementsMap.get(CRDT.ElementId.encode(element.rightOrigin)!);
  if (!next) return false;

  return isReachable(elementsMap, next, targetId);  // Recursive call
};
```

---

## Key Modules

### 1. YATA CRDT (`src/lib/crdt/yata.ts`)

The core conflict-resolution algorithm for collaborative editing.

**Key Concepts:**
- **Element**: A single character with a unique ID `[writerId, clock]`
- **Origin**: The element this element was inserted after
- **Right Origin**: The element that was to the right at insertion time
- **State Vector**: Tracks the latest operation from each writer

```typescript
// Creating a document
const doc = createYataDocument("note-123", "writer-abc");

// Insert at position
const { origin, rightOrigin } = doc.getInsertPosition(5);
const element = doc.insert(origin, rightOrigin, "x");

// Convert to plain text
const text = doc.toText();
```

### 2. Rope Data Structure (`src/components/canvas-editor/operation/rope.ts`)

A tree-based data structure for efficient string manipulation.

**Complexity:**
- `insert(pos, str)` - O(log n)
- `delete(start, end)` - O(log n)
- `charAt(index)` - O(log n)
- `concat(rope1, rope2)` - O(log n)

```typescript
const rope = Rope.fromString("Hello, World!");
const modified = Rope.insert(rope, 7, "Beautiful ");
// Result: "Hello, Beautiful World!"
```

### 3. Document Model (`src/components/canvas-editor/operation/document.ts`)

Combines Rope (text) with a structured node tree (formatting).

```typescript
interface Document {
  readonly text: Rope.Rope;      // Raw text (efficient operations)
  readonly root: RootNode;       // AST for rendering
  readonly formats: FormatSpan[]; // Formatting ranges
}
```

### 4. WebSocket Client (`src/lib/websocket.ts`)

Phoenix-compatible WebSocket client with:
- Automatic reconnection with exponential backoff
- Heartbeat mechanism
- Channel join/leave lifecycle
- Promise-based push/reply

### 5. Canvas Editor (`src/components/canvas-editor/`)

Custom text editor rendered entirely on HTML Canvas.

**Why Canvas?**
- Full control over rendering
- Better performance for large documents
- Custom cursor and selection rendering
- No DOM reflow issues

---
## License

Private - All rights reserved.
