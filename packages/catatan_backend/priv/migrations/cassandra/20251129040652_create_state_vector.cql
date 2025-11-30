-- create_state_vector

CREATE TABLE IF NOT EXISTS notes_state_vectors (
    note_id TEXT,
    writer_id TEXT,
    clock BIGINT,
    updated_at TIMESTAMP,
    PRIMARY KEY (note_id, writer_id)
);
