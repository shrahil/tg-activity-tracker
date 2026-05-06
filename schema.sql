DROP TABLE IF EXISTS daily_activity;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS chats;

CREATE TABLE chats (
    id INTEGER PRIMARY KEY,
    title TEXT,
    type TEXT, -- 'private', 'group', 'supergroup', 'channel'
    first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE daily_activity (
    chat_id INTEGER,
    user_id INTEGER,
    date TEXT, -- YYYY-MM-DD format
    message_count INTEGER DEFAULT 0,
    PRIMARY KEY (chat_id, user_id, date),
    FOREIGN KEY (chat_id) REFERENCES chats(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
