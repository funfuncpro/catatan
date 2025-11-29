-- create_state_vector

CREATE TABLE IF NOT EXISTS note_state_vectors (
    note_id TEXT,
    site_id TEXT,
    clock BIGINT,
    updated_at TIMESTAMP,
    PRIMARY KEY (note_id, site_id)
);
