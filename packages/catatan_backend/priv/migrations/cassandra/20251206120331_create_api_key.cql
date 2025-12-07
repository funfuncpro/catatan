-- create_api_key

CREATE TABLE IF NOT EXISTS api_key (
    id TEXT PRIMARY KEY,
    key TEXT,
    created_at BIGINT,
    updated_at BIGINT
);