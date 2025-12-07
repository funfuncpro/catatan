-- create_users

CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    email TEXT,
    external_id TEXT,
    created_at BIGINT,
    updated_at BIGINT
);