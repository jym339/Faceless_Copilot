import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import db from './src/db.js';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
const PORT = 3000;

// Initialize GoogleGenAI client using process.env.GEMINI_API_KEY
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

app.use(express.json());

// Helper to ensure a column exists in SQLite tables dynamically for migrations
function ensureColumnExists(tableName: string, columnName: string, columnDef: string) {
  try {
    const info = db.pragma(`table_info(${tableName})`) as any[];
    const exists = info.some((col) => col.name === columnName);
    if (!exists) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
      console.log(`Added column ${columnName} to table ${tableName}`);
    }
  } catch (err) {
    console.error(`Error adding column ${columnName} to ${tableName}:`, err);
  }
}

// Legacy migration on server start
try {
  ensureColumnExists('niches', 'user_id', "TEXT DEFAULT 'guest'");
  ensureColumnExists('notes', 'user_id', "TEXT DEFAULT 'guest'");
  ensureColumnExists('settings', 'user_id', "TEXT DEFAULT 'guest'");

  // Populate guest user_channels from channels table if empty
  const ucCount = db.prepare("SELECT count(*) as count FROM user_channels").get() as { count: number };
  if (ucCount.count === 0) {
    const activeChannels = db.prepare("SELECT id FROM channels WHERE is_on_watchlist = 1").all();
    for (const c of activeChannels as any[]) {
      db.prepare("INSERT OR IGNORE INTO user_channels (user_id, channel_id, is_on_watchlist) VALUES ('guest', ?, 1)").run(c.id);
    }
  }

  // Populate guest user_ignored_videos from videos table if empty
  const uivCount = db.prepare("SELECT count(*) as count FROM user_ignored_videos").get() as { count: number };
  if (uivCount.count === 0) {
    const ignoredVideos = db.prepare("SELECT id FROM videos WHERE is_ignored = 1").all();
    for (const v of ignoredVideos as any[]) {
      db.prepare("INSERT OR IGNORE INTO user_ignored_videos (user_id, video_id) VALUES ('guest', ?)").run(v.id);
    }
  }

  // Ensure all legacy niches have 'guest:' prefix and user_id = 'guest'
  const niches = db.prepare("SELECT * FROM niches").all();
  for (const n of niches as any[]) {
    if (!n.id.startsWith('guest:') && !n.id.includes(':')) {
      const newId = 'guest:' + n.id;
      db.prepare("INSERT OR IGNORE INTO niches (id, name, keywords, user_id) VALUES (?, ?, ?, 'guest')").run(newId, n.name, n.keywords);
      db.prepare("DELETE FROM niches WHERE id = ?").run(n.id);
    } else if (n.id.includes(':') && (!n.user_id || n.user_id === 'guest')) {
      db.prepare("UPDATE niches SET user_id = 'guest' WHERE id = ?").run(n.id);
    }
  }

  // Ensure all legacy notes have 'guest:' prefix and user_id = 'guest'
  const notes = db.prepare("SELECT * FROM notes").all();
  for (const note of notes as any[]) {
    if (!note.id.startsWith('guest:') && !note.id.includes(':')) {
      const newId = 'guest:' + note.id;
      db.prepare("INSERT OR IGNORE INTO notes (id, title, content, updated_at, user_id) VALUES (?, ?, ?, ?, 'guest')").run(newId, note.title, note.content, note.updated_at);
      db.prepare("DELETE FROM notes WHERE id = ?").run(note.id);
    } else if (note.id.includes(':') && (!note.user_id || note.user_id === 'guest')) {
      db.prepare("UPDATE notes SET user_id = 'guest' WHERE id = ?").run(note.id);
    }
  }

  // Ensure all legacy settings keys have 'guest:' prefix and user_id = 'guest'
  const settings = db.prepare("SELECT * FROM settings").all();
  for (const s of settings as any[]) {
    if (!s.key.includes(':')) {
      const newKey = 'guest:' + s.key;
      db.prepare("INSERT OR IGNORE INTO settings (key, value, user_id) VALUES (?, ?, 'guest')").run(newKey, s.value);
      db.prepare("DELETE FROM settings WHERE key = ?").run(s.key);
    } else if (s.key.includes(':') && (!s.user_id || s.user_id === 'guest')) {
      db.prepare("UPDATE settings SET user_id = 'guest' WHERE key = ?").run(s.key);
    }
  }
} catch (err) {
  console.error("Legacy migration error:", err);
}

// User-scoped settings handlers
function getUserSetting(userId: string, key: string, defaultValue = '') {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(`${userId}:${key}`) as { value: string } | undefined;
    if (row) return row.value;
  } catch (e) {}
  return defaultValue;
}

function setUserSetting(userId: string, key: string, value: string) {
  db.prepare(`
    INSERT INTO settings (key, value, user_id) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(`${userId}:${key}`, value, userId);
}

// Helper to get active YouTube API Key (prioritizes database value, falls back to process.env)
function getApiKey(userId: string) {
  const userKey = getUserSetting(userId, 'youtube_api_key');
  return userKey || process.env.YOUTUBE_API_KEY || '';
}

// Quota usage tracker
function getUserQuota(userId: string) {
  const val = getUserSetting(userId, 'quota_used', '0');
  return parseInt(val, 10);
}

function incrementUserQuota(userId: string, cost: number) {
  try {
    const current = getUserQuota(userId);
    setUserSetting(userId, 'quota_used', (current + cost).toString());
  } catch (e) {
    console.error('Error tracking quota:', e);
  }
}

function parseIsoDuration(duration: string) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = parseInt(match[3] || '0', 10);
  return h * 3600 + m * 60 + s;
}

// Merge guest data into authenticated user space
function mergeGuestDataIntoUser(userId: string) {
  try {
    // 1. Niches
    const guestNiches = db.prepare("SELECT * FROM niches WHERE user_id = 'guest'").all();
    for (const n of guestNiches as any[]) {
      const parts = n.id.split(':');
      const baseId = parts.length > 1 ? parts[1] : n.id;
      const newId = `${userId}:${baseId}`;
      db.prepare(`
        INSERT INTO niches (id, name, keywords, user_id)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          keywords = excluded.keywords
      `).run(newId, n.name, n.keywords, userId);
    }

    // 2. Notes
    const guestNotes = db.prepare("SELECT * FROM notes WHERE user_id = 'guest'").all();
    for (const note of guestNotes as any[]) {
      const parts = note.id.split(':');
      const baseId = parts.length > 1 ? parts[1] : note.id;
      const newId = `${userId}:${baseId}`;
      db.prepare(`
        INSERT INTO notes (id, title, content, updated_at, user_id)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          content = excluded.content,
          updated_at = excluded.updated_at
      `).run(newId, note.title, note.content, note.updated_at, userId);
    }

    // 3. Settings
    const guestSettings = db.prepare("SELECT * FROM settings WHERE user_id = 'guest'").all();
    for (const s of guestSettings as any[]) {
      const parts = s.key.split(':');
      const baseKey = parts.length > 1 ? parts[1] : s.key;
      const newKey = `${userId}:${baseKey}`;
      db.prepare(`
        INSERT INTO settings (key, value, user_id)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value
      `).run(newKey, s.value, userId);
    }

    // 4. Watchlist channels
    const guestChannels = db.prepare("SELECT * FROM user_channels WHERE user_id = 'guest'").all();
    for (const c of guestChannels as any[]) {
      db.prepare(`
        INSERT INTO user_channels (user_id, channel_id, is_on_watchlist)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, channel_id) DO UPDATE SET
          is_on_watchlist = excluded.is_on_watchlist
      `).run(userId, c.channel_id, c.is_on_watchlist);
    }

    // 5. Ignored videos
    const guestIgnored = db.prepare("SELECT * FROM user_ignored_videos WHERE user_id = 'guest'").all();
    for (const v of guestIgnored as any[]) {
      db.prepare(`
        INSERT INTO user_ignored_videos (user_id, video_id)
        VALUES (?, ?)
        ON CONFLICT(user_id, video_id) DO NOTHING
      `).run(userId, v.video_id);
    }
  } catch (err) {
    console.error("Error merging guest data:", err);
  }
}

// Session authentication middleware
app.use((req: any, res, next) => {
  const authHeader = req.headers.authorization;
  let userId = 'guest';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const session = db.prepare('SELECT user_id FROM sessions WHERE token = ? AND datetime(expires_at) > datetime("now")').get(token) as { user_id: string } | undefined;
      if (session) {
        userId = session.user_id;
      }
    } catch (e) {
      console.error('Session authentication error:', e);
    }
  }
  req.userId = userId;
  next();
});


// ----------------------------------------------------
// API: Settings
// ----------------------------------------------------
app.get('/api/settings', (req: any, res) => {
  res.json({
    youtube_api_key: getApiKey(req.userId),
    quota_used: getUserQuota(req.userId)
  });
});

app.post('/api/settings', (req: any, res) => {
  const { youtube_api_key } = req.body;
  try {
    setUserSetting(req.userId, 'youtube_api_key', youtube_api_key || '');
    res.json({ success: true, youtube_api_key: getApiKey(req.userId) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// API: Videos Feed
// ----------------------------------------------------
app.get('/api/videos', (req: any, res) => {
  const { format, window, sort, search } = req.query;
  
  let query = `
    SELECT 
      videos.*, 
      channels.title as channel_name, 
      channels.avatar_url, 
      channels.subscriber_count 
    FROM videos 
    JOIN channels ON videos.channel_id = channels.id 
    JOIN user_channels uc ON channels.id = uc.channel_id
    LEFT JOIN user_ignored_videos uiv ON videos.id = uiv.video_id AND uiv.user_id = ?
    WHERE uc.user_id = ? AND uc.is_on_watchlist = 1 AND uiv.video_id IS NULL
  `;
  const params: any[] = [req.userId, req.userId];
  
  if (format && format !== 'all') {
    query += ' AND videos.format = ?';
    params.push(format);
  }
  
  if (window) {
    let days = 90;
    if (window === '7d') days = 7;
    if (window === '28d') days = 28;
    query += " AND videos.published_at >= date('now', '-' || ? || ' days')";
    params.push(days);
  }

  if (search) {
    query += ' AND (videos.title LIKE ? OR channels.title LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  // Handle dynamic sorting:
  // - 'outlier': highest multiplier
  // - 'date': newest published videos
  // - 'views': highest view count
  // - 'subs': largest channel size
  if (sort === 'date') {
    query += ' ORDER BY videos.published_at DESC';
  } else if (sort === 'views') {
    query += ' ORDER BY videos.view_count DESC';
  } else if (sort === 'subs') {
    query += ' ORDER BY channels.subscriber_count DESC';
  } else {
    query += ' ORDER BY videos.outlier_multiplier DESC';
  }

  query += ' LIMIT 30'; // Show 20-30 videos at a time as requested!
  
  try {
    const videos = db.prepare(query).all(...params);
    res.json(videos);
  } catch (error: any) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Database error', details: error.message });
  }
});

app.post('/api/videos/:id/ignore', (req: any, res) => {
  const { id } = req.params;
  try {
    db.prepare(`
      INSERT INTO user_ignored_videos (user_id, video_id)
      VALUES (?, ?)
      ON CONFLICT DO NOTHING
    `).run(req.userId, id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ----------------------------------------------------
// API: Watchlist
// ----------------------------------------------------
app.get('/api/watchlist', (req: any, res) => {
  try {
    const channels = db.prepare(`
      SELECT c.* FROM channels c
      JOIN user_channels uc ON c.id = uc.channel_id
      WHERE uc.user_id = ? AND uc.is_on_watchlist = 1
    `).all(req.userId);
    res.json(channels);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/watchlist', async (req: any, res) => {
  const { identifier } = req.body;
  const key = getApiKey(req.userId);
  if (!key) return res.status(400).json({ error: 'YouTube API Key is not configured. Go to Settings page to add it.' });
  
  try {
    let channelId = identifier.trim();
    
    // Parse handles, URLs, and IDs
    if (channelId.includes('youtube.com/')) {
      const match = channelId.match(/youtube\.com\/(c\/|channel\/|@)?([^/?]+)/);
      if (match) channelId = match[1] === '@' ? '@' + match[2] : match[2];
    }

    let ytResponse;
    if (channelId.startsWith('@')) {

      ytResponse = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
        params: { part: 'snippet,statistics', forHandle: channelId, key }
      });
    } else {
      ytResponse = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
        params: { part: 'snippet,statistics', id: channelId, key }
      });
    }
    incrementUserQuota(req.userId, 1);

    if (!ytResponse.data.items || ytResponse.data.items.length === 0) {
      // Try using search to find the channel
      const searchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: { part: 'snippet', q: channelId, type: 'channel', maxResults: 1, key }
      });
      incrementUserQuota(req.userId, 100);

      const items = searchRes.data.items || [];
      if (items.length === 0) {
        return res.status(404).json({ error: 'Channel not found. Please try channel ID directly.' });
      }
      
      const foundChannelId = items[0].id.channelId;
      ytResponse = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
        params: { part: 'snippet,statistics', id: foundChannelId, key }
      });
      incrementUserQuota(req.userId, 1);
    }

    if (!ytResponse.data.items || ytResponse.data.items.length === 0) {
      return res.status(404).json({ error: 'Channel not found.' });
    }

    const channelData = ytResponse.data.items[0];
    const id = channelData.id;
    const title = channelData.snippet.title;
    const handle = channelData.snippet.customUrl || '';
    const avatar_url = channelData.snippet.thumbnails?.default?.url || '';
    const subscriber_count = parseInt(channelData.statistics.subscriberCount || '0', 10);
    const created_at = channelData.snippet.publishedAt;
    
    db.prepare(`
      INSERT INTO channels (id, title, handle, avatar_url, subscriber_count, created_at, is_on_watchlist)
      VALUES (?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        avatar_url = excluded.avatar_url,
        subscriber_count = excluded.subscriber_count,
        is_on_watchlist = 1
    `).run(id, title, handle, avatar_url, subscriber_count, created_at);

    db.prepare(`
      INSERT INTO user_channels (user_id, channel_id, is_on_watchlist)
      VALUES (?, ?, 1)
      ON CONFLICT(user_id, channel_id) DO UPDATE SET is_on_watchlist = 1
    `).run(req.userId, id);

    // Initial fetch of videos for baseline calculation
    await fetchChannelVideos(id, req.userId);

    res.json({ success: true, channel: { id, title, handle, avatar_url, subscriber_count } });
  } catch (error: any) {
    console.error('Error in watchlist POST:', error.response ? JSON.stringify(error.response.data) : error.message);
    res.status(500).json({ error: error.response?.data?.error?.message || 'Error communicating with YouTube API' });
  }
});

// A background function to fetch channel videos and compute averages
async function fetchChannelVideos(channelId: string, userId: string = 'guest') {
  const key = getApiKey(userId);
  if (!key) return;
  try {
    // 1. Get Uploads playlist ID
    const channelRes = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: { part: 'contentDetails', id: channelId, key }
    });
    incrementUserQuota(userId, 1);
    
    const uploadsPlaylistId = channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) return;

    // 2. Fetch last 50 items from uploads
    const playlistRes = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
      params: { part: 'snippet,contentDetails', playlistId: uploadsPlaylistId, maxResults: 50, key }
    });
    incrementUserQuota(userId, 1);
    
    const items = playlistRes.data.items || [];
    if (items.length === 0) return;
    
    const videoIds = items
      .map((item: any) => item.contentDetails?.videoId || item.snippet?.resourceId?.videoId)
      .filter((id: string | undefined) => !!id);
    
    if (videoIds.length === 0) {
      console.log(`No valid video IDs found for channel ${channelId}`);
      return;
    }
    
    // 3. Fetch video details (duration, views)
    const videosRes = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: { part: 'snippet,statistics,contentDetails', id: videoIds.join(','), key }
    });
    incrementUserQuota(userId, 1);
    
    const videos = videosRes.data.items || [];
    
    let longViews = 0, longCount = 0;
    let shortViews = 0, shortCount = 0;
    
    const processedVideos = videos.map((v: any) => {
      const dur = parseIsoDuration(v.contentDetails.duration);
      const format = dur >= 60 ? 'long' : 'short';
      const views = parseInt(v.statistics.viewCount || '0', 10);
      
      if (format === 'long') {
        longViews += views;
        longCount++;
      } else {
        shortViews += views;
        shortCount++;
      }
      
      return {
        id: v.id,
        channel_id: channelId,
        title: v.snippet.title,
        thumbnail_url: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url || '',
        published_at: v.snippet.publishedAt,
        duration_seconds: dur,
        format,
        view_count: views,
        discovered_at: new Date().toISOString()
      };
    });
    
    const avgLong = longCount > 0 ? Math.floor(longViews / longCount) : 0;
    const avgShort = shortCount > 0 ? Math.floor(shortViews / shortCount) : 0;
    
    // Update channel averages
    db.prepare(`
      UPDATE channels SET avg_views_longform = ?, avg_views_shorts = ?, last_checked_at = ? WHERE id = ?
    `).run(avgLong, avgShort, new Date().toISOString(), channelId);
    
    // Insert videos
    const insertVideo = db.prepare(`
      INSERT INTO videos (id, channel_id, title, thumbnail_url, published_at, duration_seconds, format, view_count, outlier_multiplier, discovered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        view_count = excluded.view_count,
        outlier_multiplier = excluded.outlier_multiplier
    `);
    
    // Fetch alerts for this user and channel
    const alert = db.prepare('SELECT * FROM alerts WHERE user_id = ? AND channel_id = ?').get(userId, channelId) as any;

    const tx = db.transaction((videos: any[]) => {
      for (const v of videos) {
        let mult = 1.0;
        if (v.format === 'long' && avgLong > 0) mult = v.view_count / avgLong;
        if (v.format === 'short' && avgShort > 0) mult = v.view_count / avgShort;
        
        const existing = db.prepare('SELECT id FROM videos WHERE id = ?').get(v.id);
        
        insertVideo.run(v.id, v.channel_id, v.title, v.thumbnail_url, v.published_at, v.duration_seconds, v.format, v.view_count, mult, v.discovered_at);

        if (alert && !existing && mult >= alert.outlier_threshold) {
          console.log(`[ALERT] Channel ${channelId} uploaded outlier video: ${v.title} (${mult.toFixed(1)}x)`);
          const alertLogId = `${v.id}:${userId}`;
          db.prepare(`
            INSERT OR IGNORE INTO alert_logs (id, user_id, channel_id, video_id, outlier_multiplier, message, created_at, is_read)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0)
          `).run(alertLogId, userId, channelId, v.id, mult, `New outlier video (${mult.toFixed(1)}x): ${v.title}`, new Date().toISOString());
        }
      }
    });
    
    tx(processedVideos);
    console.log(`Updated videos for ${channelId}`);
  } catch (error: any) {
    console.error('Error fetching videos:', error.response ? JSON.stringify(error.response.data) : error.message);
  }
}

app.post('/api/refresh', async (req: any, res) => {
  try {
    const channels = db.prepare(`
      SELECT c.id FROM channels c
      JOIN user_channels uc ON c.id = uc.channel_id
      WHERE uc.user_id = ? AND uc.is_on_watchlist = 1
    `).all(req.userId) as {id: string}[];
    for (const c of channels) {
      await fetchChannelVideos(c.id, req.userId);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error refreshing data' });
  }
});

// ----------------------------------------------------
// API: Alerts
// ----------------------------------------------------
app.get('/api/alerts', (req: any, res) => {
  try {
    const alerts = db.prepare('SELECT * FROM alerts WHERE user_id = ?').all(req.userId);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/alerts', (req: any, res) => {
  const { channel_id, outlier_threshold } = req.body;
  const id = `${req.userId}:${channel_id}`;
  try {
    db.prepare(`
      INSERT INTO alerts (id, user_id, channel_id, outlier_threshold, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        outlier_threshold = excluded.outlier_threshold
    `).run(id, req.userId, channel_id, outlier_threshold || 1.5, new Date().toISOString());
    res.json({ success: true, alert: { id, channel_id, outlier_threshold } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/alerts/:channelId', (req: any, res) => {
  const { channelId } = req.params;
  const id = `${req.userId}:${channelId}`;
  try {
    db.prepare('DELETE FROM alerts WHERE id = ? AND user_id = ?').run(id, req.userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/alert-logs', (req: any, res) => {
  try {
    const logs = db.prepare(`
      SELECT l.*, c.title as channel_name, c.avatar_url, v.thumbnail_url 
      FROM alert_logs l
      JOIN channels c ON l.channel_id = c.id
      JOIN videos v ON l.video_id = v.id
      WHERE l.user_id = ?
      ORDER BY l.created_at DESC LIMIT 50
    `).all(req.userId);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/alert-logs/read', (req: any, res) => {
  try {
    db.prepare('UPDATE alert_logs SET is_read = 1 WHERE user_id = ?').run(req.userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// API: Niches Management
// ----------------------------------------------------
app.get('/api/niches', (req: any, res) => {
  try {
    const niches = db.prepare('SELECT * FROM niches WHERE user_id = ?').all(req.userId);
    res.json(niches.map((n: any) => ({
      ...n,
      keywords: n.keywords ? JSON.parse(n.keywords) : []
    })));
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/niches', (req: any, res) => {
  const { name, keywords } = req.body;
  const id = req.userId + ':' + name.toLowerCase().replace(/\s+/g, '-');
  try {
    db.prepare(`
      INSERT INTO niches (id, name, keywords, user_id)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        keywords = excluded.keywords
    `).run(id, name, JSON.stringify(keywords || []), req.userId);
    res.json({ success: true, niche: { id, name, keywords } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/niches/:id', (req: any, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM niches WHERE id = ? AND user_id = ?').run(id, req.userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// API: New Channels (Discovery Engine)
// ----------------------------------------------------
app.get('/api/new_channels', (req: any, res) => {
  try {
    // Return competitor channels ordered by creation date (newest first)
    const channels = db.prepare(`
      SELECT c.*, 
        (SELECT title FROM videos WHERE channel_id = c.id ORDER BY view_count DESC LIMIT 1) as best_video_title,
        (SELECT view_count FROM videos WHERE channel_id = c.id ORDER BY view_count DESC LIMIT 1) as best_video_views,
        (SELECT outlier_multiplier FROM videos WHERE channel_id = c.id ORDER BY view_count DESC LIMIT 1) as best_video_outlier
      FROM channels c
      JOIN user_channels uc ON c.id = uc.channel_id
      WHERE uc.user_id = ? AND uc.is_on_watchlist = 1
      ORDER BY datetime(c.created_at) DESC
      LIMIT 30
    `).all(req.userId);
    res.json(channels);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// API: Notes (Brainstorm Ideas)
// ----------------------------------------------------
app.get('/api/notes', (req: any, res) => {
  try {
    const notes = db.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY datetime(updated_at) DESC').all(req.userId);
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/notes', (req: any, res) => {
  const { id, title, content } = req.body;
  const noteId = id ? (id.includes(':') ? id : `${req.userId}:${id}`) : `${req.userId}:${Math.random().toString(36).substr(2, 9)}`;
  const updatedAt = new Date().toISOString();
  try {
    db.prepare(`
      INSERT INTO notes (id, title, content, updated_at, user_id)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        updated_at = excluded.updated_at
    `).run(noteId, title, content, updatedAt, req.userId);
    res.json({ success: true, note: { id: noteId, title, content, updated_at: updatedAt } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/notes/:id', (req: any, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(id, req.userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// API: Ideas Management (Brainstorm Ideas)
// ----------------------------------------------------
app.get('/api/ideas', (req: any, res) => {
  try {
    const ideas = db.prepare('SELECT * FROM ideas WHERE user_id = ? ORDER BY datetime(created_at) DESC').all(req.userId);
    res.json(ideas);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ideas', (req: any, res) => {
  const { id, title, description, niche_id } = req.body;
  const ideaId = id || `${req.userId}:${Math.random().toString(36).substr(2, 9)}`;
  const createdAt = new Date().toISOString();
  try {
    db.prepare(`
      INSERT INTO ideas (id, title, description, niche_id, created_at, user_id)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        niche_id = excluded.niche_id
    `).run(ideaId, title, description, niche_id || '', createdAt, req.userId);
    res.json({ success: true, idea: { id: ideaId, title, description, niche_id, created_at: createdAt } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/ideas/:id', (req: any, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM ideas WHERE id = ? AND user_id = ?').run(id, req.userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ideas/generate', async (req: any, res) => {
  try {
    const niches = db.prepare('SELECT * FROM niches WHERE user_id = ?').all(req.userId) as any[];
    if (niches.length === 0) {
      return res.status(400).json({ error: 'Please set up at least one Niche under "Proven Ideas" tab first.' });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is not configured on server.' });
    }

    const nicheContext = niches.map(n => {
      const kw = n.keywords ? JSON.parse(n.keywords) : [];
      return `- Niche: "${n.name}", Target Keywords: [${kw.join(', ')}]`;
    }).join('\n');

    const prompt = `You are an elite, high-conviction YouTube growth strategist and channel owner. 
Your goal is to generate 5 highly clickable, innovative, and specific video ideas based on the user's targeted niches and keywords.

Here are the user's current targeted niches:
${nicheContext}

For each of the 5 video ideas, generate:
1. A highly compelling, low-barrier, or pattern-disrupting Title.
2. A brief 2-3 sentence concept Description detailing the hook, target audience appeal, and why this video is likely to become an outlier.
3. The associated Niche Name.

Return the response STRICTLY as a JSON array of objects with the following format. Do NOT wrap it in any other markdown explanation, just the plain JSON array (no markdown block backticks):
[
  {
    "title": "Title of the video idea",
    "description": "Short explanation of the concept, hook, and strategy",
    "niche_name": "Name of the associated niche"
  }
]`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text || '';
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedIdeas = JSON.parse(cleanText);

    res.json(parsedIdeas);
  } catch (err: any) {
    console.error('Error generating ideas:', err);
    res.status(500).json({ error: 'Failed to generate ideas with Gemini', details: err.message });
  }
});

// Helper: Extract a clean topic from a video title
const getCleanTopic = (title: string): string => {
  let t = title.trim();
  
  // Strip emojis and special character symbols
  t = t.replace(/[\u1F600-\u1F64F\u1F300-\u1F5FF\u1F680-\u1F6FF\u2600-\u26FF\u2700-\u27BF\u1F900-\u1F9FF]/g, '');

  // Remove bracketed/parenthesized content
  t = t.replace(/\[[^\]]*\]/g, '').replace(/\([^)]*\)/g, '');

  // Clean common prefixes case-insensitively
  const prefixesToRemove = [
    /^the best\s+/i,
    /^best\s+/i,
    /^homemade\s+/i,
    /^how to make\s+/i,
    /^how to\s+/i,
    /^how i\s+/i,
    /^secret of\s+/i,
    /^ultimate\s+/i,
    /^classic\s+/i,
    /^delicious\s+/i,
    /^traditional\s+/i,
    /^quick\s+/i,
    /^diy\s+/i,
    /^simple\s+/i,
    /^easy\s+/i,
    /^the\s+/i,
  ];
  
  let changed = true;
  while (changed) {
    changed = false;
    for (const regex of prefixesToRemove) {
      if (regex.test(t)) {
        t = t.replace(regex, '');
        changed = true;
      }
    }
  }

  // Split on common dividers: "...", "|", " — ", " – ", " - ", ":", ",", ";"
  const separators = [/\.\.\./, /\|/, /\s*[\u2014\u2013-]\s*/, /:/, /,/, /;/];
  for (const sep of separators) {
    const parts = t.split(sep);
    if (parts.length > 0 && parts[0].trim().length >= 3) {
      t = parts[0];
    }
  }

  // Trim and clean up non-alphanumeric trailing/leading characters except spaces
  t = t.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim();

  // Split into words and truncate if needed
  const words = t.split(/\s+/);
  const stopWords = [
    'nearly', 'almost', 'always', 'every', 'all', 'year', 'round', 
    'in', 'with', 'of', 'on', 'for', 'at', 'by', 'from', 'about', 'to', 'using', 'without',
    'you', 'your', 'my', 'their', 'our', 'he', 'she', 'it', 'they',
    'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must',
    'the', 'a', 'an', 'this', 'that', 'these', 'those',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'how', 'why', 'what', 'who', 'where', 'when'
  ];

  const stopIndex = words.findIndex((w, idx) => idx > 0 && stopWords.includes(w.toLowerCase()));
  if (stopIndex !== -1 && stopIndex <= 4) {
    t = words.slice(0, stopIndex).join(' ');
  } else if (words.length > 4) {
    t = words.slice(0, 3).join(' ');
  }

  if (t.length < 3) {
    t = title.slice(0, 30).trim();
  }

  // Capitalize first letter of each word to look polished
  return t.split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Helper: Get smart initial titles based on keywords (for zero-latency page loads)
const getSmartInitialAngles = (title: string, channelName: string) => {
  const cleanName = channelName || 'History';
  const lower = title.toLowerCase();
  const topic = getCleanTopic(title);
  
  if (lower.includes('crash') || lower.includes('air') || lower.includes('flight') || lower.includes('aviation')) {
    return [
      `🚨 URGENT: The Critical Cockpit Mistake YouTube Deleted hours before the ${topic} Accident`,
      `How 3 Flight Crews Solved the Same Fatal ${topic} Glitch`,
      `The Secret Black Box Audio Investigators Tried to Hide on ${topic}`,
      `The Terrifying Reason Pilots Fear This ${topic} Route`,
      `What Shocked Aviation Experts About the ${topic} Incident`
    ];
  }
  
  if (lower.includes('war') || lower.includes('battle') || lower.includes('military') || lower.includes('empire') || lower.includes('history')) {
    return [
      `What Shocked Commanders About the ${topic} Tactics`,
      `🚨 URGENT: TOTAL Collapse in Military Strategy during ${topic}`,
      `The Critical Command Mistake That Ended the ${topic}`,
      `How 5 Secret Decisions during the ${topic} Changed the Outcome`,
      `What Shocked Strategists About this Forgotten ${topic} History`
    ];
  }

  const isCooking = cleanName.toLowerCase().includes('cooking') || 
                    cleanName.toLowerCase().includes('food') || 
                    cleanName.toLowerCase().includes('kitchen') || 
                    cleanName.toLowerCase().includes('recipe') || 
                    lower.includes('recipe') || 
                    lower.includes('cook') || 
                    lower.includes('bake') || 
                    lower.includes('food') || 
                    lower.includes('kitchen') || 
                    lower.includes('taste') || 
                    lower.includes('chicken') || 
                    lower.includes('cream') || 
                    lower.includes('dumpling') || 
                    lower.includes('butter');
                    
  if (isCooking) {
    return [
      `How 5 Secret Decisions Saved the Forgotten Recipe for ${topic}`,
      `🚨 URGENT: The Tragic Reality Behind Modern ${topic} That Chefs Hide`,
      `The Critical Cooking Mistake That Ruined the 100-Year Legacy of ${topic}`,
      `What Shocked Culinary Experts About This Traditional ${topic} Technique`,
      `The Unspoken Method That Revived This Historic ${topic} Recipe`
    ];
  }

  // Default versatile angles
  return [
    `How 5 Secret Decisions hours before the crisis changed the outcome of ${topic}`,
    `🚨 URGENT: The Real Danger Behind Modern ${topic} They Aren't Telling You`,
    `The Critical Mistake That Ended the 100-Year Dominance of ${topic}`,
    `What Shocked Industry Experts About This ${topic} Technique`,
    `The Unspoken Method That Saved 50,000 People from ${topic}`
  ];
};

app.post('/api/ideas/generate-angles', async (req: any, res) => {
  const { videoTitle, channelName } = req.body;
  if (!videoTitle) {
    return res.status(400).json({ error: 'videoTitle is required.' });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const fallbackAngles = getSmartInitialAngles(videoTitle, channelName || '');
    return res.json({ angles: fallbackAngles });
  }

  try {
    const topic = getCleanTopic(videoTitle);
    const prompt = `You are a world-class YouTube thumbnail and title copywriter who has grown multiple faceless 7-figure channels.
Your specialty is "Angle Reframing": taking a successful viral video title, analyzing its core psychological trigger, and brainstorming 5 alternative "pattern-disrupting" angles/titles for that same video's target audience.

Original video title: "${videoTitle}"
Extracted topic/niche idea: "${topic}"
Niche/Channel Name: "${channelName || 'Faceless Content'}"

Instructions:
1. Generate exactly 5 alternative, highly clickable, pattern-disrupting video titles/angles based on the original video concept or the extracted topic.
2. DO NOT repeat the original title verbatim or insert the extremely long original title inside a boilerplate sentence. Instead, integrate the short topic ("${topic}") naturally or create a fully original title concept that covers the same appeal.
3. Make them dramatic, curiosity-inducing, and extremely appealing to viewers of this niche.
4. Ensure the titles are natural, fluent, and highly click-worthy. Never include any generic bracketed placeholders or instructions (e.g. NEVER include "[Tell Claude]" or similar instructions).
5. All generated titles should be unique and distinct from each other.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            angles: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of exactly 5 highly clickable reframed video titles/angles"
            }
          },
          required: ["angles"]
        }
      }
    });

    const text = response.text || '';
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);
    res.json(parsed);
  } catch (err: any) {
    console.error('Error generating angles:', err);
    const fallbackAngles = getSmartInitialAngles(videoTitle, channelName || '');
    res.json({ angles: fallbackAngles });
  }
});

app.post('/api/ideas/generate-script', async (req: any, res) => {
  const { angle, originalTitle, channelName } = req.body;
  if (!angle) {
    return res.status(400).json({ error: 'angle is required.' });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const fallbackMarkdown = `### AI Script Outline & Copywriter Strategy
**Target Angle**: "${angle}"
**Category**: High-Retention Faceless Storytelling

---

#### 🚨 1. THE HOOK (0:00 - 0:30)
* **Visual**: Dynamic archival footage or historical maps with zoom in effects. Focus on the main characters or crisis points.
* **Voiceover (Voice: Deep, Serious, Pace: Slow/Deliberate)**:
  > *"When the battle lines were drawn, everything seemed certain. But what happened hours before changed the course of history forever. A single decision so shocking, it was hidden for decades..."*
* **Retention Strategy**: Introduce a massive open loop. "But they made one critical mistake..."

#### 🔍 2. THE INTRODUCTION (0:30 - 1:30)
* **Visual**: Motion-graphics diagram showing the layout of the event, introducing key military or historical figures.
* **Voiceover**:
  > *"To understand this collapse, we have to go back to the original plans for ${channelName || 'this event'}. The commanders were confident. They had the numbers, the intel, and the power. But they completely overlooked one hidden variable."*

#### ⚔️ 3. THE GAP / CONTRAST (1:30 - 4:00)
* **Visual**: Split screen comparing the "expected plan" vs "what actually happened". Staggered zoom-ins to highlight key structural failures.
* **Voiceover**:
  > *"This is where the strategy fell apart. As ${angle} reveals, the troop morale / defenses didn't just fail—they were actively dismantled by internal confusion. Let's look at the black box transcripts..."*

#### 💡 4. THE OUTRO & CALL TO ACTION (4:00 - 5:00)
* **Visual**: End-card layout displaying recommended videos, with a smooth cinematic fade.
* **Voiceover**:
  > *"This tactical disaster reshaped the field. But there's another story of survival you won't believe. Click here to find out how they survived the next wave..."*
* **Pacing Advice**: Upbeat dramatic orchestral music swells, prompt subscriber count.`;
    return res.json({ script: fallbackMarkdown });
  }

  try {
    const prompt = `You are an expert YouTube copywriter and faceless channel scriptwriter.
Generate a comprehensive, high-retention script outline and video production strategy for the following video idea/angle:
Video Angle: "${angle}"
Context (Original Video Inspiration): "${originalTitle || ''}"
Niche/Channel Name: "${channelName || ''}"

Format the output in clean, highly structured Markdown. Include:
1. **Target Audience Trigger & Pacing**: A brief explanation of the visual pacing, mood (e.g., mysterious, urgent), and target audience appeal.
2. **THE HOOK (0:00 - 0:30)**: Step-by-step visual suggestions and a compelling voiceover script (with brackets for pacing, like [Pause], [Dreadful sound effect]).
3. **THE INTRODUCTION (0:30 - 1:30)**: How to set up the open loop and introduce the core subject.
4. **THE CORE STORY (1:30 - 4:30)**: Divide into 2 interesting visual sequences or points with concrete suggestions.
5. **THE CLIMAX & LESSON (4:30 - 5:30)**: The ultimate takeaway or revelation.
6. **OUTRO / NEXT LOOP (5:30 - 6:00)**: Directing them to click the next video for high session-time.

Make the tone intense, cinematic, and professional. Return ONLY the Markdown, no extra text around it.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt
    });

    res.json({ script: response.text || '' });
  } catch (err: any) {
    console.error('Error generating script outline:', err);
    res.status(500).json({ error: 'Failed to generate script with Gemini', details: err.message });
  }
});

// ----------------------------------------------------
// API: My Channel Tracking
// ----------------------------------------------------
app.get('/api/my_channel', (req: any, res) => {
  try {
    const channelId = getUserSetting(req.userId, 'my_channel_id');
    if (!channelId) {
      return res.json({ set: false });
    }

    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId) as any;
    if (!channel) {
      return res.json({ set: true, channelId, found: false });
    }

    const videos = db.prepare('SELECT * FROM videos WHERE channel_id = ? ORDER BY datetime(published_at) DESC LIMIT 10').all(channelId);

    res.json({
      set: true,
      found: true,
      channel,
      videos
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/my_channel', async (req: any, res) => {
  const { identifier } = req.body;
  const key = getApiKey(req.userId);
  if (!key) return res.status(400).json({ error: 'YouTube API Key is not configured. Go to Settings page to add it.' });

  try {
    let channelId = identifier.trim();

    if (channelId.includes('youtube.com/') || channelId.includes('youtu.be/')) {
      if (channelId.includes('/channel/')) {
        channelId = channelId.split('/channel/')[1].split('/')[0].split('?')[0];
      } else if (channelId.includes('/c/')) {
        channelId = channelId.split('/c/')[1].split('/')[0].split('?')[0];
      } else if (channelId.includes('/@')) {
        channelId = '@' + channelId.split('/@')[1].split('/')[0].split('?')[0];
      }
    }

    let ytResponse;
    if (channelId.startsWith('@') || !channelId.startsWith('UC')) {
      const searchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: { part: 'snippet', q: channelId, type: 'channel', maxResults: 1, key }
      });
      incrementUserQuota(req.userId, 100);
      const items = searchRes.data.items || [];
      if (items.length === 0) {
        return res.status(400).json({ error: 'Channel not found. Please verify the ID or handle.' });
      }
      channelId = items[0].snippet.channelId;
    }

    ytResponse = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: { part: 'snippet,statistics', id: channelId, key }
    });
    incrementUserQuota(req.userId, 1);

    if (!ytResponse.data.items || ytResponse.data.items.length === 0) {
      return res.status(404).json({ error: 'Channel not found.' });
    }

    const chInfo = ytResponse.data.items[0];
    const { title, customUrl } = chInfo.snippet;
    const handle = customUrl || '';
    const avatar_url = chInfo.snippet.thumbnails?.default?.url || '';
    const subscriber_count = parseInt(chInfo.statistics.subscriberCount || '0', 10);
    const created_at = chInfo.snippet.publishedAt;

    db.prepare(`
      INSERT INTO channels (id, title, handle, avatar_url, subscriber_count, created_at, avg_views_longform, avg_views_shorts, is_on_watchlist)
      VALUES (?, ?, ?, ?, ?, ?, 1000, 1000, 0)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        handle = excluded.handle,
        avatar_url = excluded.avatar_url,
        subscriber_count = excluded.subscriber_count
    `).run(channelId, title, handle, avatar_url, subscriber_count, created_at);

    setUserSetting(req.userId, 'my_channel_id', channelId);

    await fetchChannelVideos(channelId, req.userId);

    res.json({ success: true, channel: { id: channelId, title, handle, avatar_url, subscriber_count } });
  } catch (error: any) {
    console.error('Error adding my channel:', error.response ? JSON.stringify(error.response.data) : error.message);
    res.status(500).json({ error: error.response?.data?.error?.message || error.message });
  }
});

// ----------------------------------------------------
// API: James Verdict Engine
// ----------------------------------------------------
app.get('/api/verdict', async (req: any, res) => {
  try {
    const cached = getUserSetting(req.userId, 'verdict_cache');
    const timestamp = getUserSetting(req.userId, 'verdict_cache_time');
    
    const myChannelId = getUserSetting(req.userId, 'my_channel_id');
    if (!myChannelId) {
      return res.json({ set: false });
    }
    
    const myChannel = db.prepare('SELECT * FROM channels WHERE id = ?').get(myChannelId) as any;
    
    res.json({
      set: true,
      hasCache: !!cached,
      cache: cached ? JSON.parse(cached) : null,
      timestamp,
      myChannel
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/verdict/generate', async (req: any, res) => {
  try {
    const myChannelId = getUserSetting(req.userId, 'my_channel_id');
    if (!myChannelId) {
      return res.status(400).json({ error: 'Please set your Channel in the "My Channel" tab first.' });
    }

    const myChannel = db.prepare('SELECT * FROM channels WHERE id = ?').get(myChannelId) as any;
    if (!myChannel) {
      return res.status(400).json({ error: 'My channel data is missing. Please re-save it in "My Channel".' });
    }

    const competitors = db.prepare(`
      SELECT c.* FROM channels c
      JOIN user_channels uc ON c.id = uc.channel_id
      WHERE uc.user_id = ? AND uc.is_on_watchlist = 1
    `).all(req.userId) as any[];

    const niches = db.prepare('SELECT * FROM niches WHERE user_id = ?').all(req.userId) as any[];

    const outliers = db.prepare(`
      SELECT v.*, c.title as channel_name FROM videos v
      JOIN channels c ON v.channel_id = c.id
      JOIN user_channels uc ON c.id = uc.channel_id
      WHERE uc.user_id = ? AND uc.is_on_watchlist = 1 AND v.outlier_multiplier >= 1.5
      ORDER BY v.outlier_multiplier DESC
      LIMIT 10
    `).all(req.userId) as any[];

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is not configured.' });
    }

    const compText = competitors.map(c => `- ${c.title} (${c.subscriber_count} subs, Avg long-form: ${c.avg_views_longform}, Avg shorts: ${c.avg_views_shorts})`).join('\n') || 'None';
    const nicheText = niches.map(n => `- ${n.name}: [${JSON.parse(n.keywords).join(', ')}]`).join('\n') || 'None';
    const outlierText = outliers.map(v => `- "${v.title}" by ${v.channel_name} (${v.outlier_multiplier.toFixed(1)}x views multiplier, format: ${v.format})`).join('\n') || 'None';

    const prompt = `You are an elite YouTube Growth Consultant and Channel Strategist. Analyze the following channel context and deliver an honest, high-conviction, and professional "James Verdict" audit report.

CHANNEL UNDER AUDIT:
- Title: "${myChannel.title}"
- Subscribers: ${myChannel.subscriber_count}
- Avg Long-form Views: ${myChannel.avg_views_longform}
- Avg Shorts Views: ${myChannel.avg_views_shorts}

TARGET NICHES & KEYWORDS:
${nicheText}

MONITORED COMPETITORS:
${compText}

TOP COMPETITOR OUTLIER VIDEOS (Winning Outlier Patterns):
${outlierText}

Provide an audit verdict report structured into 4 sections:
1. "Strategic positioning audit": Critique their current stance against the competitor field. How is the subscriber-to-view ratio, and are they in high-demand pockets?
2. "Competitor Gap & Outlier Analysis": Point out exact patterns from the listed top outlier videos that they must adopt (e.g. framing, titles, formats).
3. "SWOT Breakdown": Standard SWOT matrix formatted nicely.
4. "The 30-Day Growth Verdict (High-Conviction Roadmap)": Clear, weekly execution roadmap.

Return the response STRICTLY as a JSON object with the following format. Do NOT wrap it in markdown backticks, explanations, or formatting, just plain JSON:
{
  "positioning": "Strategic positioning analysis text...",
  "gap_analysis": "Competitor outlier gap analysis...",
  "swot": {
    "strengths": ["...", "..."],
    "weaknesses": ["...", "..."],
    "opportunities": ["...", "..."],
    "threats": ["...", "..."]
  },
  "roadmap": [
    { "phase": "Week 1: Foundations & Outlier Study", "action": "Exact steps..." },
    { "phase": "Week 2: Clickable Thumbnail & Title Drafting", "action": "Exact steps..." },
    { "phase": "Week 3: Pattern Disruption Video Production", "action": "Exact steps..." },
    { "phase": "Week 4: Analysis & Optimization Loop", "action": "Exact steps..." }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text || '';
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const verdictData = JSON.parse(cleanText);

    setUserSetting(req.userId, 'verdict_cache', JSON.stringify(verdictData));
    setUserSetting(req.userId, 'verdict_cache_time', new Date().toISOString());

    res.json({ success: true, verdict: verdictData });
  } catch (err: any) {
    console.error('Error generating verdict:', err);
    res.status(500).json({ error: 'Failed to generate audit verdict with Gemini', details: err.message });
  }
});

app.delete('/api/notes/:id', (req: any, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(id, req.userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ----------------------------------------------------
// API: Keyword Research / Competitive Intelligence API
// ----------------------------------------------------
// Store next page tokens for each search query to allow endless fresh pagination on Refresh Results
const queryPageTokens = new Map<string, string>();

app.post('/api/research', async (req: any, res) => {
  const { query, refresh } = req.body;
  const key = getApiKey(req.userId);
  if (!key) return res.status(400).json({ error: 'YouTube API Key is not configured. Configure it in Settings.' });
  if (!query) return res.status(400).json({ error: 'Query parameter is required' });

  try {
    // 1. Search videos by keyword - Fetch up to 100 items by querying 2 pages of 50 each
    let items: any[] = [];
    let nextPageToken: string | undefined = undefined;

    // Retrieve or clear stored page token based on refresh flag
    let startPageToken: string | undefined = undefined;
    if (refresh) {
      startPageToken = queryPageTokens.get(query);
    } else {
      queryPageTokens.delete(query);
    }

    // Page 1
    const searchParams1: any = {
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: 50,
      key
    };
    if (startPageToken) {
      searchParams1.pageToken = startPageToken;
    }

    const searchRes1 = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: searchParams1
    });
    incrementUserQuota(req.userId, 100);
    if (searchRes1.data.items) {
      items = [...searchRes1.data.items];
      nextPageToken = searchRes1.data.nextPageToken;
    }

    let finalNextPageToken = nextPageToken;

    // Page 2 (if available)
    if (nextPageToken && items.length < 100) {
      try {
        const searchRes2 = await axios.get('https://www.googleapis.com/youtube/v3/search', {
          params: {
            part: 'snippet',
            q: query,
            type: 'video',
            maxResults: 50,
            pageToken: nextPageToken,
            key
          }
        });
        incrementUserQuota(req.userId, 100);
        if (searchRes2.data.items) {
          items = [...items, ...searchRes2.data.items];
          if (searchRes2.data.nextPageToken) {
            finalNextPageToken = searchRes2.data.nextPageToken;
          }
        }
      } catch (err2) {
        console.error('Error fetching second page of research search results:', err2);
      }
    }

    // Store the next page token for subsequent refreshes of this query
    if (finalNextPageToken) {
      queryPageTokens.set(query, finalNextPageToken);
    } else {
      // If we ran out of pages, clear it so next refresh starts over
      queryPageTokens.delete(query);
    }

    if (items.length === 0) return res.json([]);

    const rawVideoIds = items.map((item: any) => item.id?.videoId).filter(Boolean);
    const videoIds = Array.from(new Set(rawVideoIds));
    if (videoIds.length === 0) return res.json([]);

    // 2. Fetch full details (duration, viewCount) - Chunked in sizes of 50 to meet YouTube API limitations
    const videoChunks: string[][] = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      videoChunks.push(videoIds.slice(i, i + 50));
    }

    let videosList: any[] = [];
    for (const chunk of videoChunks) {
      try {
        const videosRes = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
          params: {
            part: 'snippet,statistics,contentDetails',
            id: chunk.join(','),
            key
          }
        });
        incrementUserQuota(req.userId, 1);
        if (videosRes.data.items) {
          videosList = [...videosList, ...videosRes.data.items];
        }
      } catch (err) {
        console.error('Error fetching video details chunk:', err);
      }
    }

    if (videosList.length === 0) return res.json([]);

    // 3. Batch resolve channel information to optimize quota consumption and prevent DB roundtrips
    const uniqueChannelIds = Array.from(new Set(videosList.map((v: any) => v.snippet?.channelId).filter(Boolean))) as string[];
    const channelMap = new Map<string, any>();

    // Load existing channels from the DB
    if (uniqueChannelIds.length > 0) {
      const placeholders = uniqueChannelIds.map(() => '?').join(',');
      try {
        const existingChannels = db.prepare(`
          SELECT id, title, subscriber_count, avatar_url, avg_views_longform, avg_views_shorts 
          FROM channels 
          WHERE id IN (${placeholders})
        `).all(...uniqueChannelIds) as any[];

        for (const ch of existingChannels) {
          channelMap.set(ch.id, ch);
        }
      } catch (err) {
        console.error('Error checking existing channels in DB:', err);
      }
    }

    const missingChannelIds = uniqueChannelIds.filter(id => !channelMap.has(id));

    // Batch query missing channels in chunks of 50
    const channelChunkSize = 50;
    for (let i = 0; i < missingChannelIds.length; i += channelChunkSize) {
      const chunk = missingChannelIds.slice(i, i + channelChunkSize);
      try {
        const chRes = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
          params: {
            part: 'snippet,statistics',
            id: chunk.join(','),
            key
          }
        });
        incrementUserQuota(req.userId, 1);

        const chItems = chRes.data.items || [];
        for (const chInfo of chItems) {
          const chId = chInfo.id;
          const subscriberCount = parseInt(chInfo.statistics?.subscriberCount || '0', 10);
          const defaultAvg = Math.floor(subscriberCount * 0.1) || 1000;
          const customUrl = chInfo.snippet?.customUrl || '';
          const avatarUrl = chInfo.snippet?.thumbnails?.default?.url || '';
          const publishedAt = chInfo.snippet?.publishedAt || '';
          const chTitle = chInfo.snippet?.title || '';

          try {
            db.prepare(`
              INSERT OR REPLACE INTO channels (id, title, handle, avatar_url, subscriber_count, created_at, avg_views_longform, avg_views_shorts, is_on_watchlist)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT is_on_watchlist FROM channels WHERE id = ?), 0))
            `).run(
              chId,
              chTitle,
              customUrl,
              avatarUrl,
              subscriberCount,
              publishedAt,
              defaultAvg,
              defaultAvg,
              chId
            );
          } catch (insertErr) {
            console.error('Error inserting channel info:', insertErr);
          }

          channelMap.set(chId, {
            id: chId,
            title: chTitle,
            subscriber_count: subscriberCount,
            avatar_url: avatarUrl,
            avg_views_longform: defaultAvg,
            avg_views_shorts: defaultAvg
          });
        }
      } catch (err) {
        console.error('Error batch fetching channels details:', err);
      }
    }

    // 4. Construct final payload
    const results = [];
    for (const v of videosList) {
      const channelId = v.snippet?.channelId;
      const channelTitle = v.snippet?.channelTitle || 'Unknown';
      const dur = parseIsoDuration(v.contentDetails?.duration);
      const views = parseInt(v.statistics?.viewCount || '0', 10);
      const format = dur >= 60 ? 'long' : 'short';

      const channelInDb = channelId ? channelMap.get(channelId) : null;
      const avgViews = channelInDb 
        ? (format === 'long' ? channelInDb.avg_views_longform : channelInDb.avg_views_shorts)
        : 1000;

      const multiplier = avgViews > 0 ? (views / avgViews) : 1.0;

      results.push({
        id: v.id,
        channel_id: channelId,
        channel_name: channelTitle,
        avatar_url: channelInDb?.avatar_url || '',
        subscriber_count: channelInDb?.subscriber_count || 0,
        title: v.snippet?.title || 'Unknown Title',
        thumbnail_url: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || '',
        published_at: v.snippet?.publishedAt || '',
        duration_seconds: dur,
        format,
        view_count: views,
        outlier_multiplier: multiplier,
        discovered_at: new Date().toISOString()
      });
    }

    res.json(results);
  } catch (error: any) {
    console.error('Research query error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error?.message || 'Error executing YouTube keyword research query' });
  }
});

// ----------------------------------------------------
// API: Authentication & Google Sign-In
// ----------------------------------------------------
const getClientId = () => {
  let fallbackClientId = '';
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.oAuthClientId) {
        fallbackClientId = config.oAuthClientId;
      }
    }
  } catch (err) {
    console.error('Error reading firebase-applet-config.json for client ID:', err);
  }
  return process.env.CLIENT_ID || process.env.OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || fallbackClientId || '';
};

const getClientSecret = () => process.env.CLIENT_SECRET || process.env.OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';

app.get('/api/auth/url', (req, res) => {
  const { redirectUri } = req.query;
  if (!redirectUri) {
    return res.status(400).json({ error: 'redirectUri query parameter is required' });
  }
  
  const clientId = getClientId();
  const clientSecret = getClientSecret();

  // Log all keys in process.env that might be relevant for debugging
  const envKeys = Object.keys(process.env).filter(k => 
    k.includes('CLIENT') || k.includes('OAUTH') || k.includes('GOOGLE') || k.includes('SECRET')
  );
  console.log('OAuth Environment Keys:', envKeys);
  console.log('CLIENT_ID length:', clientId ? clientId.length : 0);
  console.log('CLIENT_SECRET length:', clientSecret ? clientSecret.length : 0);
  console.log('Using CLIENT_ID:', clientId);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri as string,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email openid',
    access_type: 'offline',
    prompt: 'consent',
    state: redirectUri as string
  });
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.json({ url });
});

app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
  const { code, state } = req.query;
  const redirectUri = (state as string) || `${req.protocol}://${req.get('host')}/auth/callback`;

  if (!code) {
    return res.status(400).send('Authorization code is missing.');
  }

  try {
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });

    const { access_token } = tokenResponse.data;

    const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const profile = userResponse.data;
    const { id, email, name, picture } = profile;

    // Save/update user
    db.prepare(`
      INSERT INTO users (id, email, name, avatar_url, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        name = excluded.name,
        avatar_url = excluded.avatar_url
    `).run(id, email, name, picture, new Date().toISOString());

    // Generate session token
    const crypto = await import('crypto');
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES (?, ?, ?)
    `).run(sessionToken, id, expiresAt);

    // Merge history
    mergeGuestDataIntoUser(id);

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'OAUTH_AUTH_SUCCESS',
                token: '${sessionToken}',
                user: ${JSON.stringify({ id, email, name, picture })}
              }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error('Google OAuth callback error:', err.response?.data || err.message);
    res.status(500).send(`Authentication failed: ${err.response?.data?.error_description || err.message}`);
  }
});

app.get('/api/auth/me', (req: any, res) => {
  if (req.userId && req.userId !== 'guest') {
    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
      res.json({ loggedIn: true, user });
    } catch (e) {
      res.json({ loggedIn: false });
    }
  } else {
    res.json({ loggedIn: false });
  }
});

app.post('/api/auth/email/signup', async (req, res) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json({ error: 'Email, name, and password are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Check if user exists in credentials
    const existingCred = db.prepare('SELECT email FROM user_credentials WHERE email = ?').get(normalizedEmail);
    if (existingCred) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const crypto = await import('crypto');
    const userId = 'email_user_' + crypto.randomBytes(8).toString('hex');
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    // Create user in users table
    const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
    
    db.prepare(`
      INSERT INTO users (id, email, name, avatar_url, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, normalizedEmail, name, avatarUrl, new Date().toISOString());

    // Create credentials
    db.prepare(`
      INSERT INTO user_credentials (email, password_hash, user_id)
      VALUES (?, ?, ?)
    `).run(normalizedEmail, passwordHash, userId);

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES (?, ?, ?)
    `).run(sessionToken, userId, expiresAt);

    // Merge guest data
    mergeGuestDataIntoUser(userId);

    res.json({
      token: sessionToken,
      user: {
        id: userId,
        email: normalizedEmail,
        name,
        picture: avatarUrl
      }
    });
  } catch (err: any) {
    console.error('Email signup error:', err);
    res.status(500).json({ error: 'Failed to register user: ' + err.message });
  }
});

app.post('/api/auth/email/signin', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const crypto = await import('crypto');
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    const cred = db.prepare('SELECT * FROM user_credentials WHERE email = ? AND password_hash = ?').get(normalizedEmail, passwordHash) as { user_id: string } | undefined;
    if (!cred) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const userId = cred.user_id;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as { email: string; name: string; avatar_url: string } | undefined;
    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES (?, ?, ?)
    `).run(sessionToken, userId, expiresAt);

    // Merge guest data
    mergeGuestDataIntoUser(userId);

    res.json({
      token: sessionToken,
      user: {
        id: userId,
        email: user.email,
        name: user.name,
        picture: user.avatar_url
      }
    });
  } catch (err: any) {
    console.error('Email signin error:', err);
    res.status(500).json({ error: 'Failed to sign in: ' + err.message });
  }
});


// ----------------------------------------------------
// API: Art of YouTube AI Coach (Niche Finder Challenge)
// ----------------------------------------------------
app.get('/api/coach/profile', (req: any, res) => {
  try {
    const profile = {
      subjects: getUserSetting(req.userId, 'coach_subjects', ''),
      budget: getUserSetting(req.userId, 'coach_budget', '$50'),
      loved_channels: getUserSetting(req.userId, 'coach_loved_channels', ''),
      format: getUserSetting(req.userId, 'coach_format', 'long'),
      visual_style: getUserSetting(req.userId, 'coach_visual_style', 'AI-made visuals'),
      background: getUserSetting(req.userId, 'coach_background', ''),
      chosen_niche: getUserSetting(req.userId, 'coach_chosen_niche', '')
    };
    res.json({ success: true, profile });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/coach/profile', (req: any, res) => {
  const { profile } = req.body;
  if (!profile) {
    return res.status(400).json({ error: 'Profile data is required' });
  }
  try {
    if (profile.subjects !== undefined) setUserSetting(req.userId, 'coach_subjects', profile.subjects);
    if (profile.budget !== undefined) setUserSetting(req.userId, 'coach_budget', profile.budget);
    if (profile.loved_channels !== undefined) setUserSetting(req.userId, 'coach_loved_channels', profile.loved_channels);
    if (profile.format !== undefined) setUserSetting(req.userId, 'coach_format', profile.format);
    if (profile.visual_style !== undefined) setUserSetting(req.userId, 'coach_visual_style', profile.visual_style);
    if (profile.background !== undefined) setUserSetting(req.userId, 'coach_background', profile.background);
    if (profile.chosen_niche !== undefined) setUserSetting(req.userId, 'coach_chosen_niche', profile.chosen_niche);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/coach/ask-tim', (req: any, res) => {
  res.json({
    success: true,
    rules: [
      "Proof of Demand: Find outlier videos on smaller channels (under 50k subscribers) that get >10x baseline views. This is the ultimate proof that an audience is actively craving this topic.",
      "The Gap (Visual/Audio/Story): Analyze existing top channels and find where they cut corners. Look for robotic AI text-to-speech, bad editing, or lazy copy-paste visuals, and exploit those gaps with superior production values.",
      "Room to Win: Verify that views and subscriber gains are split across multiple mid-sized creators, showing YouTube's recommendation engine is eager to feed more creators rather than locked by a single giant monopolist.",
      "The 100+ Ideas Brain-Dump Test: Write down 100 highly compelling, distinct video ideas for this niche immediately. If you run out of fuel before 30, you will burn out within 3 months.",
      "The Human Angle: Combine your specific background, career skills, or personal hobbies with the topic to make your voice and insights irreplaceable by pure AI automation slop."
    ]
  });
});

app.post('/api/coach/hunt', async (req: any, res) => {
  const { topic, budget, isDeepScan } = req.body;
  
  const prompt = `
You are the Art of YouTube AI Coach. I am looking for a YouTube channel niche.
Interests/Subjects: ${topic}
Budget context: ${budget}
Deep scan flag: ${isDeepScan ? 'YES (drill down deeper on selected channels)' : 'NO (broad explore)'}

Based on Tim's strict YouTube Niche Selection Criteria (Proof of Demand, The Gap, Room to Win, 100+ Ideas, and Human Angle), generate a customized Niche Hunt Report.
Generate exactly 2 proven niches and exactly 3 competitor channels that fit this topic.
Be realistic, specific, and creative.

Return a JSON object matching this schema:
{
  "topic": "${topic}",
  "budget": "${budget}",
  "provenNiches": [
    {
      "name": "Niche Name (specific and exciting)",
      "description": "2-3 sentences explaining the core concept, the gap found, and how to win.",
      "winningChannels": ["@exampleChannel1", "@exampleChannel2"]
    }
  ],
  "competitors": [
    {
      "channelName": "Name of competitor channel",
      "handle": "@handle",
      "subscribers": "e.g. 14.5K or 82K",
      "relevance": 85, // integer 50 to 100
      "score": "HIGH" // HIGH or MEDIUM
    }
  ]
}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
            budget: { type: Type.STRING },
            provenNiches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  winningChannels: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['name', 'description', 'winningChannels']
              }
            },
            competitors: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  channelName: { type: Type.STRING },
                  handle: { type: Type.STRING },
                  subscribers: { type: Type.STRING },
                  relevance: { type: Type.INTEGER },
                  score: { type: Type.STRING }
                },
                required: ['channelName', 'handle', 'subscribers', 'relevance', 'score']
              }
            }
          },
          required: ['topic', 'budget', 'provenNiches', 'competitors']
        }
      }
    });

    const reportText = response.text || '{}';
    const report = JSON.parse(reportText);
    res.json({ success: true, report });
  } catch (err: any) {
    console.error("Niche hunt generation error:", err);
    res.json({
      success: true,
      report: {
        topic: topic || 'General',
        budget: budget || '$50',
        provenNiches: [
          {
            name: `${topic} Deconstructed`,
            description: "High CTR faceless content focusing on curated visual stories. Low-cost editing tools can produce premium outputs that exploit lazy competitors.",
            winningChannels: ["@AmishGardening", "@EpicGains"]
          }
        ],
        competitors: [
          {
            channelName: "AOY Garden Cult",
            handle: "@gardencult",
            subscribers: "34K",
            relevance: 90,
            score: "HIGH"
          }
        ]
      }
    });
  }
});

app.post('/api/coach/find-channel', (req: any, res) => {
  const { name } = req.body;
  if (!name) return res.json({ query: '' });
  try {
    const existing = db.prepare("SELECT handle FROM channels WHERE title LIKE ? LIMIT 1").get(`%${name}%`) as { handle: string } | undefined;
    if (existing) {
      return res.json({ query: existing.handle });
    }
    const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    res.json({ query: `@${clean || 'channel'}` });
  } catch (err) {
    res.json({ query: `@${name.toLowerCase().replace(/\s+/g, '')}` });
  }
});

app.post('/api/coach/save-niche', (req: any, res) => {
  const { chosen_niche } = req.body;
  if (!chosen_niche) {
    return res.status(400).json({ error: 'Chosen niche is required' });
  }
  try {
    setUserSetting(req.userId, 'coach_chosen_niche', chosen_niche);
    
    // Create configured niche topic in niches table
    const id = `niche_${Math.random().toString(36).substr(2, 9)}`;
    const keywordsArray = chosen_niche.toLowerCase()
      .split(' ')
      .filter((w: string) => w.length > 3)
      .map((w: string) => w.replace(/[^a-z0-9]/g, ''));
    
    const keywordsJson = JSON.stringify(keywordsArray.length > 0 ? keywordsArray : [chosen_niche.toLowerCase()]);
    
    db.prepare(`
      INSERT OR IGNORE INTO niches (id, name, keywords, user_id)
      VALUES (?, ?, ?, ?)
    `).run(id, chosen_niche, keywordsJson, req.userId);

    res.json({ success: true, nicheId: id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ----------------------------------------------------
// Vite SPA Fallback
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
