-- create_note

CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    owner_id TEXT,
    created_at TIMESTAMP
);
