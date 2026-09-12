import 'dotenv/config';
import express from 'express';
import Database from 'better-sqlite3';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// On Render, we use a writable path for the database
const dbPath = process.env.DB_PATH || path.join(here, '../data/dashboard.sqlite');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, unique_id TEXT, game_id TEXT UNIQUE, name TEXT, first_seen_at TEXT, last_seen_at TEXT);
  CREATE TABLE IF NOT EXISTS scores (id TEXT PRIMARY KEY, game_id TEXT NOT NULL, game_type TEXT NOT NULL, score INTEGER NOT NULL, achieved_at TEXT NOT NULL);
`);

const app = express();
app.set('trust proxy', true);
const port = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

// Critical for Render: Health check
app.get('/health', (req, res) => res.status(200).send('OK'));

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

app.post('/api/devices', (req, res) => {
  const { uniqueId, gameId, name } = req.body;
  if (gameId && !/^[A-Za-z0-9]+@[0-9]{2}$/.test(gameId)) {
    return res.status(400).json({ error: 'SACRED_FORMAT_INVALID' });
  }
  try {
    const existing = uniqueId ? db.prepare('SELECT * FROM devices WHERE unique_id=?').get(uniqueId) : null;
    if (existing) {
      db.prepare('UPDATE devices SET last_seen_at=? WHERE id=?').run(now(), existing.id);
      return res.json({ id: existing.id, gameId: existing.game_id, status: "RECOGNIZED" });
    }
    const d = id();
    db.prepare('INSERT INTO devices (id, unique_id, game_id, name, first_seen_at, last_seen_at) VALUES (?,?,?,?,?,?)')
      .run(d, uniqueId || null, gameId || null, name, now(), now());
    res.status(201).json({ id: d, gameId: gameId, status: "ETCHED_IN_STONE" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/leaderboard/:gameType', (req, res) => {
  const { gameType } = req.params;
  const { search } = req.body;
  let query = `SELECT game_id, MAX(score) as high_score FROM scores WHERE game_type = ?`;
  const params = [gameType];
  if (search) { query += ` AND game_id LIKE ?`; params.push(`%${search}%`); }
  query += ` GROUP BY game_id ORDER BY high_score DESC LIMIT 15`;
  res.json(db.prepare(query).all(...params));
});

app.post('/api/scores', (req, res) => {
  const { gameId, gameType, score } = req.body;
  db.prepare('INSERT INTO scores (id, game_id, game_type, score, achieved_at) VALUES (?,?,?,?,?)')
    .run(id(), gameId, gameType, score, now());
  res.status(201).json({ ok: true });
});

app.use(express.static(path.join(here, '../../dashboard')));
app.get('*',(req,res)=>res.sendFile(path.join(here,'../../dashboard/index.html')));

app.listen(port, '0.0.0.0', () => console.log(`Server listening on port ${port}`));
