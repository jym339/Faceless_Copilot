import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const isVercel = !!process.env.VERCEL;
const dataDir = isVercel ? '/tmp' : path.join(process.cwd(), 'data');
if (!isVercel && !fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const db = new Database(path.join(dataDir, 'app.db'));

// PRAGMA foreign_keys = ON;
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    title TEXT,
    handle TEXT,
    avatar_url TEXT,
    subscriber_count INTEGER,
    created_at TEXT,
    avg_views_longform INTEGER,
    avg_views_shorts INTEGER,
    is_on_watchlist INTEGER DEFAULT 1,
    niche_id TEXT,
    first_video_published_at TEXT,
    last_checked_at TEXT
  );

  CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    channel_id TEXT,
    title TEXT,
    thumbnail_url TEXT,
    published_at TEXT,
    duration_seconds INTEGER,
    format TEXT,
    view_count INTEGER,
    outlier_multiplier REAL,
    discovered_at TEXT,
    is_ignored INTEGER DEFAULT 0,
    FOREIGN KEY(channel_id) REFERENCES channels(id)
  );

  CREATE TABLE IF NOT EXISTS niches (
    id TEXT PRIMARY KEY,
    name TEXT,
    keywords TEXT
  );

  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT,
    content TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    channel_id TEXT,
    outlier_threshold REAL,
    created_at TEXT,
    FOREIGN KEY(channel_id) REFERENCES channels(id)
  );

  CREATE TABLE IF NOT EXISTS alert_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    channel_id TEXT,
    video_id TEXT,
    outlier_multiplier REAL,
    message TEXT,
    created_at TEXT,
    is_read INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS ideas (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    niche_id TEXT,
    created_at TEXT,
    user_id TEXT DEFAULT 'guest'
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    name TEXT,
    avatar_url TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT,
    expires_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_channels (
    user_id TEXT,
    channel_id TEXT,
    is_on_watchlist INTEGER DEFAULT 1,
    PRIMARY KEY(user_id, channel_id),
    FOREIGN KEY(channel_id) REFERENCES channels(id)
  );

  CREATE TABLE IF NOT EXISTS user_ignored_videos (
    user_id TEXT,
    video_id TEXT,
    PRIMARY KEY(user_id, video_id),
    FOREIGN KEY(video_id) REFERENCES videos(id)
  );

  CREATE TABLE IF NOT EXISTS user_credentials (
    email TEXT PRIMARY KEY,
    password_hash TEXT,
    user_id TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

export default db;
