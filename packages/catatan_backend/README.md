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
│   │   ├── open_auth_client.ex         # OpenAuth JWT verification
│   │   ├── generate.ex                 # ID generation utilities
│   │   ├── cursor.ex                   # Cursor position in CRDT documents
│   │   ├── mailer.ex                   # Mailer configuration
│   │   ├── migrator.ex                 # Database migration runner
│   │   │
│   │   ├── notes.ex                    # Notes context public API
│   │   ├── notes/
│   │   │   ├── store.ex                # Notes persistence layer
│   │   │   └── crdt/
│   │   │       ├── yata.ex             # YATA CRDT implementation
│   │   │       ├── element.ex          # CRDT element structure
│   │   │       ├── state_vector.ex     # Version vector tracking
│   │   │       ├── sync.ex             # Delta synchronization
│   │   │       └── store.ex            # CRDT persistence
│   │   │
│   │   ├── users.ex                    # Users context public API
│   │   ├── users/
│   │   │   ├── create.ex               # User creation/upsert
│   │   │   └── get.ex                  # User retrieval
│   │   │
│   │   ├── shares.ex                   # Shares context public API
│   │   ├── shares/
│   │   │   ├── create.ex               # Share link creation
│   │   │   └── get.ex                  # Share link retrieval
│   │   │
│   │   ├── api_key.ex                  # API Key context
│   │   ├── api_key/                    # API Key logic (generate, parse, store)
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
│       ├── sockets/
│       │   └── notes.ex                # WebSocket authentication
│       ├── plugs/                      # Request middleware (Auth, API Key)
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

---

## Functional Programming Concepts

This codebase utilizes core functional programming paradigms:

### 1. Immutability

All data structures are immutable. State changes create new structures rather than modifying existing ones in place, effectively eliminating shared mutable state issues.

```elixir
# From notes/crdt/yata.ex
def increment_clock(%__MODULE__{} = yata) do
  %{yata | clock: yata.clock + 1}  # Returns a NEW struct; original is untouched
end
```

### 2. Pure Functions

Core logic, particularly the CRDT conflict resolution, is implemented as pure functions. They rely solely on their inputs and produce no side effects, making the synchronization logic deterministic and testable.

```elixir
# From notes/crdt/state_vector.ex
# Merges two state vectors purely, without external dependencies or side effects.
@spec merge(t, t) :: t
def merge(sv1, sv2) do
  Map.merge(sv1, sv2, fn _k, v1, v2 -> max(v1, v2) end)
end
```

### 3. Higher-Order Functions

Functions that take other functions as arguments are used extensively for data transformation and abstraction. The **Reduce (Fold)** operation is used as the primary mechanism for state accumulation.

```elixir
# From notes/crdt/yata.ex
# Using 'reduce' (Fold) to process a list of IDs and accumulate
# updated state, deleted items, and missing items in a single pass.
Enum.reduce(element_ids, {yata.elements, [], []}, fn element_id, acc ->
  # ... logic to transform accumulator ...
  {updated_map, deleted_list, missing_list}
end)
```

### 4. Recursion

Tail recursion is used for traversing complex graph structures (like the YATA conflict graph) where standard iteration functions do not provide sufficient control over the flow.

```elixir
# From notes/crdt/yata.ex
# Recursive traversal of the conflict graph.
defp build_sorted_list([element | rest], origin_map, all_elements, acc) do
  children = Map.get(origin_map, element.id, [])
  sorted_children = sort_conflicting(children, all_elements)
  # Tail call
  build_sorted_list(sorted_children ++ rest, origin_map, all_elements, [element | acc])
end
```

### 5. Pattern Matching

Used for control flow and destructuring. It allows functions to be polymorphic based on the *shape* of the data rather than its type, replacing complex `if/else` logic.

```elixir
# From notes/lww.ex
# Guard clauses and pattern matching handle the "Last-Write-Wins" logic explicitly.
def assign(%{clock: p_clock, replica_id: p_id}, replica_id, clock, _)
    when replica_id == p_id and clock <= p_clock do
  {:error, :clock_regression}
end

def assign(%{}, replica_id, clock, content) do
  {:ok, %__MODULE__{content: content, clock: clock}}
end
```

### 6. Function Composition

The code emphasizes composing small, focused functions into larger pipelines to transform data. In Elixir, this is semantically achieved via the pipe operator (`|>`).

```elixir
# From notes/crdt/yata.ex
def to_text(%__MODULE__{} = yata) do
  yata
  |> to_list()                 # Transform struct to list
  |> Enum.map(& &1.content)    # Extract content
  |> Enum.join()               # Join into string
end
```

---

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
