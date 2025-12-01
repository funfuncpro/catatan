# Catatan Backend

A real-time collaborative note-taking backend built with **Elixir** and **Phoenix Framework**. This application implements **CRDT (Conflict-free Replicated Data Types)** for real-time synchronization using the **YATA (Yet Another Transformation Approach)** algorithm, enabling seamless multi-user collaboration.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Understanding the Architecture](#understanding-the-architecture)
- [Functional Programming Concepts](#functional-programming-concepts)
- [Key Modules Deep Dive](#key-modules-deep-dive)
- [API Reference](#api-reference)

---

## Overview

Catatan Backend is a Phoenix-based API server that provides:

- **Real-time collaborative editing** via WebSocket channels
- **CRDT-based conflict resolution** using YATA algorithm
- **Session management** for anonymous note-taking
- **Shareable links** with configurable permissions
- **Asynchronous email processing** via AWS SQS and GenStage

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Elixir 1.15+** | Primary language - functional, concurrent |
| **Phoenix 1.8** | Web framework with channels for WebSocket |
| **Xandra** | Cassandra database driver |
| **GenStage** | Back-pressure aware data processing |
| **Swoosh** | Email composition and delivery |
| **AWS SQS** | Message queue for async email processing |
| **Bandit** | HTTP server adapter |

---

## Project Structure

```
catatan_backend/
├── lib/
│   ├── catatan_backend.ex              # Main application module
│   ├── catatan_backend_web.ex          # Phoenix web module macros
│   │
│   ├── catatan_backend/                # Business logic (contexts)
│   │   ├── application.ex              # OTP Application supervision tree
│   │   ├── cassandra_client.ex         # Database client wrapper
│   │   ├── generate.ex                 # ID generation utilities
│   │   ├── cursor.ex                   # Cursor position in CRDT documents
│   │   │
│   │   ├── notes.ex                    # Notes context public API
│   │   ├── notes/
│   │   │   ├── store.ex                # Notes persistence layer
│   │   │   ├── crdt.ex                 # CRDT representation
│   │   │   ├── lww.ex                  # Last-Write-Wins register
│   │   │   └── crdt/
│   │   │       ├── yata.ex             # YATA CRDT implementation
│   │   │       ├── element.ex          # CRDT element structure
│   │   │       ├── state_vector.ex     # Version vector tracking
│   │   │       ├── sync.ex             # Delta synchronization
│   │   │       └── store/              # CRDT persistence
│   │   │
│   │   ├── sessions.ex                 # Sessions context public API
│   │   ├── sessions/
│   │   │   ├── create.ex               # Session creation
│   │   │   └── get.ex                  # Session retrieval
│   │   │
│   │   ├── shares.ex                   # Shares context public API
│   │   ├── shares/
│   │   │   ├── create.ex               # Share link creation
│   │   │   └── get.ex                  # Share link retrieval
│   │   │
│   │   ├── server/                     # GenServers for stateful processes
│   │   │   ├── notes_session.ex        # Tracks writers/cursors per note
│   │   │   ├── notes_new.ex            # CRDT state management
│   │   │   └── notes_persistence.ex    # Async persistence worker
│   │   │
│   │   ├── actor/
│   │   │   └── writer.ex               # Writer/user representation
│   │   │
│   │   └── email/                      # Email processing pipeline
│   │       ├── producer.ex             # SQS message producer
│   │       ├── sqs_poller.ex           # GenStage producer (polling)
│   │       ├── process.ex              # GenStage consumer (sending)
│   │       └── templates.ex            # Email templates
│   │
│   └── catatan_backend_web/            # Web layer
│       ├── endpoint.ex                 # Phoenix endpoint
│       ├── router.ex                   # Route definitions
│       ├── controllers/                # REST API controllers
│       ├── channels/
│       │   └── notes.ex                # WebSocket channel for real-time
│       ├── plugs/                      # Request middleware
│       └── validators/                 # Input validation
│
├── config/                             # Environment configurations
├── priv/
│   ├── cassandra/                      # Cassandra schemas
│   └── migrations/                     # Database migrations
└── test/                               # Test suites
```

---

## Getting Started

### Prerequisites

- Elixir 1.15 or higher
- Erlang/OTP 26+
- Cassandra database
- AWS credentials (for SQS email queue)

### Installation

1. **Install dependencies:**
   ```bash
   mix deps.get
   ```

2. **Configure environment:**
   Create a `.env` file or set environment variables:
   ```bash
   # Cassandra
   CASSANDRA_HOST=localhost
   CASSANDRA_PORT=9042
   
   # AWS SQS
   AWS_ACCESS_KEY_ID=your_key
   AWS_SECRET_ACCESS_KEY=your_secret
   SQS_QUEUE_URL=your_queue_url
   
   # Application
   SECRET_KEY_BASE=your_secret_key
   ```

3. **Start the server:**
   ```bash
   mix phx.server
   ```

   Or inside IEx:
   ```bash
   iex -S mix phx.server
   ```

### Useful Commands

```bash
# Run tests
mix test

# Format code
mix format

# Run precommit checks (compile warnings, format, tests)
mix precommit

# Start interactive shell
iex -S mix
```

---

## Understanding the Architecture

### 1. OTP Application Structure

The application follows OTP principles with a supervision tree defined in `application.ex`:

```
CatatanBackend.Supervisor
├── CatatanBackendWeb.Telemetry
├── DNSCluster
├── Phoenix.PubSub
├── Registry                          # Process registry for GenServers
├── DynamicSupervisor (NotesSessionSupervisor)
├── DynamicSupervisor (NotesCrdtSupervisor)
├── Xandra (Cassandra connection)
├── Email.Producer                    # SQS producer
├── Email.SQSPoller                   # GenStage producer
├── Email.Process                     # GenStage consumer
└── CatatanBackendWeb.Endpoint
```

### 2. Real-time Collaboration Flow

```
Client A                    Server                      Client B
   │                          │                            │
   │──── WebSocket Join ──────▶│                            │
   │                          │◀──── WebSocket Join ────────│
   │                          │                            │
   │◀─── Initial State ───────│──── Initial State ─────────▶│
   │                          │                            │
   │──── Insert Operation ────▶│                            │
   │                          │ (Apply to CRDT)            │
   │                          │ (Async persist to DB)      │
   │                          │ (Broadcast via PubSub)     │
   │                          │──── Remote Insert ─────────▶│
   │                          │                            │
   │◀─── Presence Update ─────│──── Presence Update ───────▶│
```

### 3. CRDT & YATA Algorithm

**YATA (Yet Another Transformation Approach)** ensures:
- **Convergence**: All replicas reach the same state regardless of operation order
- **Intention Preservation**: Concurrent insertions are placed deterministically

Each element stores:
- `id`: Unique identifier `{writer_id, clock}`
- `origin`: Left neighbor at insertion time
- `right_origin`: Right neighbor at insertion time
- `content`: The character/text
- `deleted_at`: Tombstone timestamp (soft delete)

---

## Functional Programming Concepts

This codebase extensively uses functional programming paradigms from Elixir:

### 1. Immutability

All data structures are immutable. State changes create new structures:

```elixir
# From notes/crdt/yata.ex
def increment_clock(%__MODULE__{} = yata) do
  %{yata | clock: yata.clock + 1}  # Returns new struct, original unchanged
end
```

### 2. Pattern Matching

Used extensively for control flow and data extraction:

```elixir
# From notes/lww.ex - Pattern matching on function heads
def assign(%__MODULE__{clock: prev_clock, replica_id: prev_replica}, replica_id, clock, _content)
    when replica_id == prev_replica and clock <= prev_clock do
  {:error, :clock_regression}
end

def assign(%__MODULE__{}, replica_id, clock, content) do
  {:ok, %__MODULE__{content: content, clock: clock, ...}}
end
```

### 3. Pure Functions

CRDT operations are pure - same input always produces same output:

```elixir
# From notes/crdt/state_vector.ex
@spec merge(t, t) :: t
def merge(sv1, sv2) do
  Map.merge(sv1, sv2, fn _k, v1, v2 -> max(v1, v2) end)
end
```

### 4. Higher-Order Functions

Functions that take or return functions:

```elixir
# From notes/crdt/yata.ex
def sort_conflicting(elements, all_elements) do
  Enum.sort(elements, fn a, b ->
    compare_conflicting(a, b, all_elements)
  end)
end
```

### 5. Pipeline Operator (`|>`)

Chaining transformations in a readable manner:

```elixir
# From notes/crdt/yata.ex
def to_text(%__MODULE__{} = yata) do
  yata
  |> to_list()
  |> Enum.map(& &1.content)
  |> Enum.join()
end
```

### 6. `with` Expressions

Elegant error handling and sequential operations:

```elixir
# From shares.ex
def create_or_get_share(%{note_id: note_id, ...}) do
  with {:ok, share_data} <- Get.by_note_id(note_id) do
    # Handle existing share
    {:ok, %{"share_id" => share_id, ...}, :ok}
  else
    {:error, :not_found} ->
      # Create new share
      with {:ok, _note} <- Notes.get_note_by_id(note_id),
           {:ok, _share} <- Create.insert_share_batch(...) do
        {:ok, %{"share_id" => new_share_id, ...}, :created}
      end
  end
end
```

### 7. Result Tuples (`{:ok, value}` / `{:error, reason}`)

Explicit error handling without exceptions:

```elixir
# From notes/crdt.ex
@spec set_body(t, term(), non_neg_integer(), String.t()) ::
        {:ok, t} | {:error, :clock_regression}
def set_body(%__MODULE__{content: reg} = note, replica_id, clock, new_content) do
  case Lww.assign(reg, replica_id, clock, new_content) do
    {:ok, updated_content} -> {:ok, %{note | content: updated_content}}
    {:error, :clock_regression} -> {:error, :clock_regression}
  end
end
```

### 8. Recursion

Used instead of loops (tail-recursive for efficiency):

```elixir
# From notes/crdt/yata.ex
defp build_sorted_list([], _origin_map, _all_elements, acc) do
  Enum.reverse(acc)  # Base case
end

defp build_sorted_list([element | rest], origin_map, all_elements, acc) do
  children = Map.get(origin_map, element.id, [])
  sorted_children = sort_conflicting(children, all_elements)
  build_sorted_list(sorted_children ++ rest, origin_map, all_elements, [element | acc])
end
```

### 9. Reduce Pattern

Accumulating results over collections:

```elixir
# From notes/crdt/yata.ex
def delete_batch(%__MODULE__{} = yata, element_ids) do
  deleted_at = DateTime.utc_now() |> DateTime.to_iso8601()

  {updated_elements, deleted, not_found} =
    Enum.reduce(element_ids, {yata.elements, [], []}, fn element_id, {elements, deleted_acc, not_found_acc} ->
      case Map.get(elements, element_id) do
        nil -> {elements, deleted_acc, [element_id | not_found_acc]}
        element -> 
          updated = %{element | deleted_at: deleted_at}
          {Map.put(elements, element_id, updated), [updated | deleted_acc], not_found_acc}
      end
    end)
  
  {:ok, %{yata | elements: updated_elements}, Enum.reverse(deleted), Enum.reverse(not_found)}
end
```

### 10. Behaviours and Protocols

Defining contracts for modules:

```elixir
# GenServer behaviour implementation
defmodule CatatanBackend.Server.NotesSession do
  use GenServer  # Implements GenServer behaviour
  
  @impl true  # Marks behaviour callback
  def init(note_id) do
    {:ok, %{note_id: note_id, writers: %{}, dirty: false}}
  end
  
  @impl true
  def handle_call({:join, user_profile}, _from, state) do
    # ...
  end
end
```

### 11. Type Specifications

Static typing hints for documentation and dialyzer:

```elixir
# From actor/writer.ex
@type permission :: %{required(:write) => boolean()}

@type user_profile :: %{
        required(:id) => String.t(),
        required(:name) => String.t(),
        required(:permission) => permission()
      }

@spec initialize_actor(user_profile()) :: t()
def initialize_actor(%{id: id, name: name, permission: permission}) do
  # ...
end
```

### 12. GenStage for Back-Pressure

Producer-consumer pipeline with demand-based flow:

```elixir
# Producer: email/sqs_poller.ex
def handle_demand(incoming_demand, state) do
  # Only fetch as many messages as demanded
  dispatch_events(state.queue_url, state.buffer, state.demand + incoming_demand, state.backoff)
end

# Consumer: email/process.ex
def init(opts) do
  {:consumer, opts,
   subscribe_to: [{CatatanBackend.Email.SQSPoller, max_demand: 10, min_demand: 1}]}
end
```

---

## Key Modules Deep Dive

### NotesSession GenServer

Manages real-time presence and cursor tracking:

```elixir
# Tracks writers per note with tick-based broadcasting
state = %{
  note_id: "abc123",
  writers: %{"user1" => %Writer{...}, "user2" => %Writer{...}},
  dirty: false  # Only broadcast when state changes
}
```

### NotesNew GenServer

Manages CRDT state for collaborative editing:

- Handles insert/delete operations
- Integrates remote operations
- Broadcasts changes via PubSub
- Delegates persistence to NotesPersistence (fire-and-forget)

### YATA CRDT

Core collaborative editing algorithm:

```elixir
# Insert: O(n) worst case, typically O(1)
{updated_yata, element} = Yata.insert(yata, origin, right_origin, "a")

# Integrate remote: O(1) map insertion
updated_yata = Yata.integrate(yata, remote_element)

# Render text: O(n) tree traversal
text = Yata.to_text(yata)
```

---

## API Reference

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/notes` | Create a new note |
| `GET` | `/api/v1/notes/:id` | Get note by ID |
| `GET` | `/api/v1/sessions` | List sessions |
| `PUT` | `/api/v1/sessions/:id/activate` | Activate a session |
| `POST` | `/api/v1/shares` | Create shareable link |
| `GET` | `/api/v1/shares/:id` | Get share details |

### WebSocket Channel

Connect to `notes:{note_id}` channel for real-time collaboration:

**Events (Client → Server):**
- `insert` - Insert character/text
- `delete` - Delete element by ID
- `delete_batch` - Delete multiple elements
- `cursor_move` - Update cursor position
- `sync` - Request missing elements
- `get_text` - Get current document text

**Events (Server → Client):**
- `remote_insert` - New element from another client
- `remote_delete` - Element deleted by another client
- `presence_state` - Writers and cursor positions

---

## Learn More

- [Phoenix Framework](https://www.phoenixframework.org/)
- [Elixir Documentation](https://hexdocs.pm/elixir)
- [YATA Algorithm Paper](https://www.researchgate.net/publication/310212186_Near_Real-Time_Peer-to-Peer_Shared_Editing_on_Extensible_Data_Types)
