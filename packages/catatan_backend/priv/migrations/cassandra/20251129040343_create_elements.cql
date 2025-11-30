-- create_elements

CREATE TABLE IF NOT EXISTS notes_elements (
    note_id TEXT,
    element_id TEXT,
    origin_id TEXT,
    right_origin_id TEXT,
    content TEXT,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP,
    PRIMARY KEY (note_id, element_id)
);
