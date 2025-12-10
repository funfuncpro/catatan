# Catatan

A real-time collaborative note-taking application with CRDT-powered conflict-free synchronization using the YATA algorithm.

## Overview

Catatan enables multiple users to edit the same document simultaneously without conflicts. Built as a functional programming showcase with an Elixir/Phoenix backend and SolidJS frontend.

**Key Features:**

- Real-time multiplayer collaboration
- Conflict-free synchronization via YATA CRDT
- Custom canvas-based text editor
- Live cursor presence

## Architecture

This monorepo contains three main packages:

### Backend

**`packages/catatan_backend`** - Phoenix API with WebSocket channels and CRDT persistence

- Elixir 1.15+ / Phoenix 1.8
- YATA CRDT implementation
- Cassandra storage
- AWS SQS email

[→ Backend Documentation](./packages/catatan_backend/README.md)

### Frontend

**`packages/catatan_frontend`** - SolidJS web application

- SolidJS + TanStack Start
- Custom canvas text editor
- Client-side CRDT sync
- Real-time WebSocket connection

[→ Frontend Documentation](./packages/catatan_frontend/README.md)

### Auth Service

**`packages/auth`** - OpenAuth authentication service

- Bun runtime
- OpenAuth with DynamoDB storage
- Password provider with email verification

## Development

```bash
bun run dev          # Start all packages
bun run build        # Build all packages
bun run lint         # Lint all packages
bun run check-types  # Type-check TypeScript packages
```

## Deployment

Deployment configurations are in `infra/`:

- `infra/auth/` - Fly.io config for auth service
- `infra/backend/` - Fly.io config for backend
- `infra/frontend/` - Fly.io config for frontend

## Project Structure

```
catatan/
├── packages/
│   ├── catatan_backend/    # Phoenix API server
│   ├── catatan_frontend/   # SolidJS web app
│   └── auth/               # OpenAuth service
├── infra/                  # Deployment configs
├── package.json            # Root workspace config
└── turbo.json              # Turborepo configuration
```
