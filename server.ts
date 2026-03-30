import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@libsql/client';
import crypto from 'crypto';
import path from 'path';

const db = createClient({
  url: 'libsql://fikirler-xwriter82.aws-eu-west-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ4NzAzNDgsImlkIjoiMDE5ZDNlODQtMmMwMS03MWZjLTgwMmUtNWZjZjA0MDM1ZWUwIiwicmlkIjoiNGJiNWQ4NTctZmM3ZS00ZTBjLWFhMTAtOTEwZDAwNmE0MGRiIn0.qRy-nSsovltPDTtz6KDqGNCH2Mz4xLHmGTRQXtJogT1z9cl_Wyu3kMvTq2mMH6tDlhkyUeHsgVoAR-DAhMnQAw'
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Initialize DB
  await db.execute(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE, password TEXT)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS ideas (id TEXT PRIMARY KEY, user_id TEXT, title TEXT, order_num INTEGER)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, idea_id TEXT, content TEXT, image TEXT, created_at INTEGER)`);

  // API Routes
  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
      const result = await db.execute({ sql: 'SELECT * FROM users WHERE username = ?', args: [username] });
      if (result.rows.length > 0) {
        const user = result.rows[0];
        if (user.password === password) {
          res.json({ success: true, userId: user.id, username: user.username });
        } else {
          res.status(401).json({ error: 'Hatalı şifre' });
        }
      } else {
        const id = crypto.randomUUID();
        await db.execute({ sql: 'INSERT INTO users (id, username, password) VALUES (?, ?, ?)', args: [id, username, password] });
        res.json({ success: true, userId: id, username });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/ideas', async (req, res) => {
    const userId = req.query.userId as string;
    try {
      const result = await db.execute({ sql: 'SELECT * FROM ideas WHERE user_id = ? ORDER BY order_num ASC', args: [userId] });
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/ideas', async (req, res) => {
    const { id, userId, title, orderNum } = req.body;
    try {
      await db.execute({ sql: 'INSERT INTO ideas (id, user_id, title, order_num) VALUES (?, ?, ?, ?)', args: [id, userId, title, orderNum] });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/ideas/order', async (req, res) => {
    const { updates } = req.body;
    try {
      for (const update of updates) {
        await db.execute({ sql: 'UPDATE ideas SET order_num = ? WHERE id = ?', args: [update.orderNum, update.id] });
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/ideas/:id', async (req, res) => {
    try {
      await db.execute({ sql: 'DELETE FROM ideas WHERE id = ?', args: [req.params.id] });
      await db.execute({ sql: 'DELETE FROM entries WHERE idea_id = ?', args: [req.params.id] });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/entries', async (req, res) => {
    const ideaId = req.query.ideaId as string;
    try {
      const result = await db.execute({ sql: 'SELECT * FROM entries WHERE idea_id = ? ORDER BY created_at DESC', args: [ideaId] });
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/entries', async (req, res) => {
    const { id, ideaId, content, image, createdAt } = req.body;
    try {
      await db.execute({ sql: 'INSERT INTO entries (id, idea_id, content, image, created_at) VALUES (?, ?, ?, ?, ?)', args: [id, ideaId, content, image || null, createdAt] });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/entries/:id', async (req, res) => {
    const { content } = req.body;
    try {
      await db.execute({ sql: 'UPDATE entries SET content = ? WHERE id = ?', args: [content, req.params.id] });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/entries/:id', async (req, res) => {
    try {
      await db.execute({ sql: 'DELETE FROM entries WHERE id = ?', args: [req.params.id] });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
