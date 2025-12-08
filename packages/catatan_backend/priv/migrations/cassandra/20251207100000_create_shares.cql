-- create_shares

CREATE TABLE IF NOT EXISTS shares_by_id (
    share_id TEXT PRIMARY KEY,
    note_id TEXT,
    access_type TEXT,
    permission_level TEXT,
    allowed_emails SET<TEXT>,
    created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shares_by_note_id (
    note_id TEXT PRIMARY KEY,
    share_id TEXT,
    access_type TEXT,
    permission_level TEXT,
    allowed_emails SET<TEXT>
);
