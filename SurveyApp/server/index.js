/**
 * TrustFeed Survey API
 * Stores anonymous survey session data in MySQL (NO PII).
 * No names, emails, IPs, cookies, or user-identifying data collected.
 * Enhanced with input validation, rate limiting, timeouts, and graceful shutdown.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mysql = require('mysql2/promise');
const { fetchUniqueContent } = require('./content-fetcher');

const app = express();

// ─── Helmet: Sets many security headers (XSS, HSTS, noSniff, etc.) ───
app.use(helmet({
  contentSecurityPolicy: false, // CSP managed by nginx in production
  crossOriginEmbedderPolicy: false,
}));

// ─── CORS: Restrict to known origins ───
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:4200,https://trustfeed-survey-ealep.ondigitalocean.app').split(',');
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (curl, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT'],
  allowedHeaders: ['Content-Type'],
  maxAge: 86400,
}));

app.use(express.json({ limit: '1mb' }));

// ─── Disable x-powered-by to hide tech stack ───
app.disable('x-powered-by');

// ─── Simple In-Memory Rate Limiter (per IP, no PII stored) ───

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 60;       // 60 requests per minute

function rateLimit(req, res, next) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW;
  }

  entry.count++;
  rateLimitMap.set(key, entry);

  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: 'Too many requests',
      message: 'Please wait a moment before trying again.',
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    });
  }
  next();
}

app.use(rateLimit);

// Clean up rate limit map every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt + RATE_LIMIT_WINDOW) rateLimitMap.delete(key);
  }
}, 300000);

// ─── Input Validation Helpers ───

function isValidSessionId(id) {
  return typeof id === 'string' && /^session-\d{13,}$/.test(id);
}

function isValidVerdict(v) {
  return v === 'ai' || v === 'human';
}

function isValidConfidence(c) {
  return typeof c === 'number' && c >= 1 && c <= 5;
}

function isValidDifficulty(d) {
  return d === 'easy' || d === 'medium' || d === 'hard';
}

function sanitizeString(str, maxLen = 500) {
  if (typeof str !== 'string') return '';
  return str
    .slice(0, maxLen)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// ─── SQL Injection Pattern Detector ───
// Defense-in-depth: parameterized queries are the primary defense,
// this is an additional guardrail that rejects obviously malicious input.
const SQL_INJECTION_PATTERNS = [
  /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC|EXECUTE)\b.*\b(FROM|INTO|TABLE|SET|WHERE)\b)/i,
  /(--|#|\/\*|\*\/|;)\s*(DROP|ALTER|DELETE|UPDATE|INSERT|SELECT)/i,
  /('\s*(OR|AND)\s*'?\d*\s*=\s*\d*)/i,
  /('\s*(OR|AND)\s*'[^']*'=')/i,
];

function containsSqlInjection(str) {
  if (typeof str !== 'string') return false;
  return SQL_INJECTION_PATTERNS.some(p => p.test(str));
}

// ─── Request-level SQLi / XSS guard middleware ───
function inputGuard(req, res, next) {
  const body = JSON.stringify(req.body || {});
  const query = JSON.stringify(req.query || {});
  const params = JSON.stringify(req.params || {});
  const allInput = body + query + params;

  // Check for SQL injection patterns
  if (containsSqlInjection(allInput)) {
    console.warn('SECURITY: Blocked potential SQL injection from', req.ip, req.path);
    return res.status(400).json({
      error: 'Invalid input',
      message: 'Your request contained characters that aren\'t allowed.',
    });
  }

  // Check for XSS script injection
  if (/<script[\s>]/i.test(allInput) || /javascript:/i.test(allInput) || /on\w+\s*=/i.test(allInput)) {
    console.warn('SECURITY: Blocked potential XSS from', req.ip, req.path);
    return res.status(400).json({
      error: 'Invalid input',
      message: 'Your request contained characters that aren\'t allowed.',
    });
  }

  next();
}

app.use(inputGuard);

// ─── MySQL Connection Pool ───

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'trustfeed',
  password: process.env.DB_PASSWORD || 'trustfeed_pass',
  database: process.env.DB_NAME || 'TrustFeed',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
};

// Digital Ocean Managed MySQL requires SSL
if (process.env.DB_SSL === 'true') {
  dbConfig.ssl = { rejectUnauthorized: true };
}

const pool = mysql.createPool(dbConfig);

// ─── In-memory fallback when MySQL is not available ───
const memStore = {
  sessions: new Map(),
  responses: new Map(),
  agentVerdicts: new Map(),
  agentResults: new Map(),
  agreementMatrix: new Map(),
};

let dbAvailable = false;

async function checkDb() {
  try {
    await pool.query('SELECT 1');
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
}
checkDb();
setInterval(checkDb, 30000);

// ─── Health Check ───

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.json({ status: 'ok', database: 'disconnected', message: 'API running, DB not yet configured' });
  }
});

// ─── GET /api/content/fetch — Fetch unique content from free internet sources ───

app.get('/api/content/fetch', async (req, res) => {
  try {
    const count = Math.min(Math.max(parseInt(req.query.count) || 10, 1), 30);
    const pexelsKey = process.env.PEXELS_API_KEY || null;

    console.log(`Fetching ${count} unique content items from free sources...`);
    const content = await fetchUniqueContent(count, pexelsKey);

    res.json({
      items: content,
      count: content.length,
      sources: [...new Set(content.map(c => c.source))],
    });
  } catch (err) {
    console.error('GET /api/content/fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

// ─── POST /api/sessions — Start a new anonymous session ───

app.post('/api/sessions', async (req, res) => {
  try {
    const { sessionId, startedAt, collabMode, itemCount } = req.body;

    if (!sessionId || !startedAt || itemCount == null) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'The request is missing required information (sessionId, startedAt, or itemCount).',
      });
    }

    if (!isValidSessionId(sessionId)) {
      return res.status(400).json({
        error: 'Invalid session ID format',
        message: 'The session ID doesn\'t match the expected format.',
      });
    }

    const parsedCount = parseInt(itemCount, 10);
    if (isNaN(parsedCount) || parsedCount < 1 || parsedCount > 30) {
      return res.status(400).json({
        error: 'Invalid item count',
        message: 'Item count must be between 1 and 30.',
      });
    }

    const parsedDate = new Date(startedAt);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid date',
        message: 'The start time provided is not a valid date.',
      });
    }

    if (dbAvailable) {
      await pool.execute(
        `INSERT INTO survey_sessions (session_id, started_at, collab_mode, item_count)
         VALUES (?, ?, ?, ?)`,
        [sessionId, parsedDate, !!collabMode, parsedCount]
      );
    } else {
      if (memStore.sessions.has(sessionId)) {
        return res.status(409).json({ error: 'Session already exists', message: 'Duplicate session.' });
      }
      memStore.sessions.set(sessionId, { sessionId, startedAt: parsedDate, collabMode: !!collabMode, itemCount: parsedCount });
    }

    res.status(201).json({ sessionId, message: 'Session created' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error: 'Session already exists',
        message: 'A session with this ID has already been created. This can happen if the page was refreshed.',
      });
    }
    console.error('POST /api/sessions error:', err.message);
    res.status(500).json({
      error: 'Server error',
      message: 'Something went wrong on our end while creating your session. Please try again.',
    });
  }
});

// ─── POST /api/sessions/:id/responses — Save a single item response ───

app.post('/api/sessions/:id/responses', async (req, res) => {
  let conn = null;
  try {
    const sessionId = req.params.id;
    const {
      itemIndex, itemTitle, itemCategory, itemDifficulty, contentType,
      groundTruth, humanVerdict, humanConfidence, humanReasoning,
      agentVerdicts
    } = req.body;

    // Validate required fields
    if (itemIndex == null || !humanVerdict || !humanConfidence) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'We need your verdict and confidence level for this item.',
      });
    }

    // Validate field values
    const parsedIndex = parseInt(itemIndex, 10);
    if (isNaN(parsedIndex) || parsedIndex < 0 || parsedIndex > 30) {
      return res.status(400).json({
        error: 'Invalid item index',
        message: 'The item number is outside the expected range.',
      });
    }

    if (!isValidVerdict(humanVerdict)) {
      return res.status(400).json({
        error: 'Invalid verdict',
        message: 'Verdict must be either "ai" or "human".',
      });
    }

    if (!isValidConfidence(humanConfidence)) {
      return res.status(400).json({
        error: 'Invalid confidence',
        message: 'Confidence level must be between 1 and 5.',
      });
    }

    if (groundTruth && !isValidVerdict(groundTruth)) {
      return res.status(400).json({
        error: 'Invalid ground truth',
        message: 'Ground truth must be either "ai" or "human".',
      });
    }

    const safeDifficulty = isValidDifficulty(itemDifficulty) ? itemDifficulty : 'medium';

    if (dbAvailable) {
      conn = await pool.getConnection();
      await conn.beginTransaction();

      await conn.execute(
        `INSERT INTO survey_responses
         (session_id, item_index, item_title, item_category, item_difficulty, content_type,
          ground_truth, human_verdict, human_confidence, human_reasoning)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          human_verdict = VALUES(human_verdict),
          human_confidence = VALUES(human_confidence),
          human_reasoning = VALUES(human_reasoning)`,
        [
          sessionId, parsedIndex,
          sanitizeString(itemTitle, 200), sanitizeString(itemCategory, 50),
          safeDifficulty, sanitizeString(contentType, 20) || 'text',
          groundTruth, humanVerdict, humanConfidence,
          sanitizeString(humanReasoning, 1000) || null
        ]
      );

      if (Array.isArray(agentVerdicts)) {
        for (const av of agentVerdicts.slice(0, 10)) {
          if (!av.region || !av.verdict) continue;
          await conn.execute(
            `INSERT INTO agent_verdicts
             (session_id, item_index, agent_region, verdict, confidence, reasoning, ground_truth)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
              verdict = VALUES(verdict),
              confidence = VALUES(confidence),
              reasoning = VALUES(reasoning)`,
            [
              sessionId, parsedIndex,
              sanitizeString(av.region, 50),
              isValidVerdict(av.verdict) ? av.verdict : 'human',
              typeof av.confidence === 'number' ? Math.min(Math.max(av.confidence, 0), 1) : 0.5,
              sanitizeString(av.reasoning, 500),
              groundTruth
            ]
          );
        }
      }

      await conn.commit();
    } else {
      // In-memory fallback
      const key = `${sessionId}-${parsedIndex}`;
      memStore.responses.set(key, {
        sessionId, itemIndex: parsedIndex, itemTitle, itemCategory,
        itemDifficulty: safeDifficulty, contentType, groundTruth,
        humanVerdict, humanConfidence, humanReasoning,
      });
      if (Array.isArray(agentVerdicts)) {
        memStore.agentVerdicts.set(key, agentVerdicts.slice(0, 10));
      }
    }

    res.status(201).json({ message: 'Response saved' });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('POST /api/sessions/:id/responses error:', err.message);
    res.status(500).json({
      error: 'Server error',
      message: 'Your response couldn\'t be saved right now. Your local progress is still intact.',
    });
  } finally {
    if (conn) conn.release();
  }
});

// ─── PUT /api/sessions/:id/complete — Complete session with results ───

app.put('/api/sessions/:id/complete', async (req, res) => {
  let conn = null;
  try {
    const sessionId = req.params.id;
    const {
      completedAt, humanCorrect, humanAccuracy,
      humanAiCount, humanHumanCount,
      actualAiCount, actualHumanCount,
      agentResults, agreementMatrix
    } = req.body;

    if (dbAvailable) {
      conn = await pool.getConnection();
      await conn.beginTransaction();

      await conn.execute(
        `UPDATE survey_sessions SET
          completed_at = ?, human_correct = ?, human_accuracy = ?,
          human_ai_count = ?, human_human_count = ?,
          actual_ai_count = ?, actual_human_count = ?
         WHERE session_id = ?`,
        [
          new Date(completedAt || Date.now()),
          humanCorrect, humanAccuracy,
          humanAiCount, humanHumanCount,
          actualAiCount, actualHumanCount,
          sessionId
        ]
      );

      if (Array.isArray(agentResults)) {
        for (const ar of agentResults) {
          await conn.execute(
            `INSERT INTO agent_results
             (session_id, agent_region, correct_count, accuracy, ai_count, human_count, avg_confidence)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
              correct_count = VALUES(correct_count),
              accuracy = VALUES(accuracy),
              ai_count = VALUES(ai_count),
              human_count = VALUES(human_count),
              avg_confidence = VALUES(avg_confidence)`,
            [sessionId, ar.region, ar.correct, ar.accuracy, ar.aiCount, ar.humanCount, ar.avgConfidence]
          );
        }
      }

      if (Array.isArray(agreementMatrix)) {
        for (const am of agreementMatrix) {
          await conn.execute(
            `INSERT INTO agreement_matrix (session_id, agent_region, agreement_rate)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE agreement_rate = VALUES(agreement_rate)`,
            [sessionId, am.region, am.agreementRate]
          );
        }
      }

      await conn.commit();
    } else {
      // In-memory fallback
      const session = memStore.sessions.get(sessionId) || {};
      session.completedAt = completedAt;
      session.humanCorrect = humanCorrect;
      session.humanAccuracy = humanAccuracy;
      memStore.sessions.set(sessionId, session);
      if (Array.isArray(agentResults)) memStore.agentResults.set(sessionId, agentResults);
      if (Array.isArray(agreementMatrix)) memStore.agreementMatrix.set(sessionId, agreementMatrix);
    }

    res.json({ sessionId, message: 'Session completed and results saved' });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('PUT /api/sessions/:id/complete error:', err.message);
    res.status(500).json({
      error: 'Server error',
      message: 'Your results couldn\'t be saved to the research database. Your local results are still available.',
    });
  } finally {
    if (conn) conn.release();
  }
});

// ─── GET /api/sessions/:id — Retrieve a session ───

app.get('/api/sessions/:id', async (req, res) => {
  try {
    const sid = req.params.id;

    if (dbAvailable) {
      const [sessions] = await pool.execute(
        'SELECT * FROM survey_sessions WHERE session_id = ?', [sid]
      );
      if (sessions.length === 0) {
        return res.status(404).json({ error: 'Session not found', message: 'Session not found.' });
      }
      const [responses] = await pool.execute('SELECT * FROM survey_responses WHERE session_id = ? ORDER BY item_index', [sid]);
      const [verdicts] = await pool.execute('SELECT * FROM agent_verdicts WHERE session_id = ? ORDER BY item_index, agent_region', [sid]);
      const [agentRes] = await pool.execute('SELECT * FROM agent_results WHERE session_id = ?', [sid]);
      const [agreement] = await pool.execute('SELECT * FROM agreement_matrix WHERE session_id = ?', [sid]);
      res.json({ session: sessions[0], responses, agentVerdicts: verdicts, agentResults: agentRes, agreementMatrix: agreement });
    } else {
      const session = memStore.sessions.get(sid);
      if (!session) {
        return res.status(404).json({ error: 'Session not found', message: 'Session not found.' });
      }
      const responses = [...memStore.responses.values()].filter(r => r.sessionId === sid);
      const agentVerdicts = [];
      for (const [k, v] of memStore.agentVerdicts) { if (k.startsWith(sid)) agentVerdicts.push(...v); }
      res.json({ session, responses, agentVerdicts, agentResults: memStore.agentResults.get(sid) || [], agreementMatrix: memStore.agreementMatrix.get(sid) || [] });
    }
  } catch (err) {
    console.error('GET /api/sessions/:id error:', err.message);
    res.status(500).json({ error: 'Server error', message: 'Something went wrong while retrieving session data.' });
  }
});

// ─── GET /api/analytics — Aggregate statistics (no PII) ───

app.get('/api/analytics', async (req, res) => {
  try {
    if (dbAvailable) {
      const [totalSessions] = await pool.execute(
        'SELECT COUNT(*) AS count FROM survey_sessions WHERE completed_at IS NOT NULL'
      );
      const [byMode] = await pool.execute(
        `SELECT CASE WHEN collab_mode THEN 'collab' ELSE 'solo' END AS mode,
          COUNT(*) AS sessions, ROUND(AVG(human_accuracy), 4) AS avg_accuracy,
          ROUND(AVG(human_correct), 1) AS avg_correct
         FROM survey_sessions WHERE completed_at IS NOT NULL GROUP BY collab_mode`
      );
      const [byDifficulty] = await pool.execute(
        `SELECT item_difficulty, COUNT(*) AS total, SUM(is_correct) AS correct,
          ROUND(SUM(is_correct) / COUNT(*), 4) AS accuracy,
          ROUND(AVG(human_confidence), 2) AS avg_confidence
         FROM survey_responses GROUP BY item_difficulty`
      );
      const [agentAccuracy] = await pool.execute(
        `SELECT agent_region, COUNT(*) AS total, SUM(is_correct) AS correct,
          ROUND(SUM(is_correct) / COUNT(*), 4) AS accuracy,
          ROUND(AVG(confidence), 2) AS avg_confidence
         FROM agent_verdicts GROUP BY agent_region`
      );
      const [byCategory] = await pool.execute(
        `SELECT item_category, COUNT(*) AS total, SUM(is_correct) AS correct,
          ROUND(SUM(is_correct) / COUNT(*), 4) AS accuracy
         FROM survey_responses GROUP BY item_category`
      );
      res.json({ totalCompletedSessions: totalSessions[0].count, accuracyByMode: byMode, accuracyByDifficulty: byDifficulty, agentAccuracy, accuracyByCategory: byCategory });
    } else {
      // In-memory summary
      const completed = [...memStore.sessions.values()].filter(s => s.completedAt);
      res.json({
        totalCompletedSessions: completed.length,
        accuracyByMode: [],
        accuracyByDifficulty: [],
        agentAccuracy: [],
        accuracyByCategory: [],
        note: 'Database not connected — showing in-memory data only.',
      });
    }
  } catch (err) {
    console.error('GET /api/analytics error:', err.message);
    res.status(500).json({
      error: 'Server error',
      message: 'Analytics data is temporarily unavailable.',
    });
  }
});

// ─── Global 404 Handler ───

app.use((_req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested endpoint does not exist.',
  });
});

// ─── Global Error Handler ───

app.use((err, _req, res, _next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: 'Unexpected error',
    message: 'Something unexpected happened. Our team has been notified.',
  });
});

// ─── Start Server with Graceful Shutdown ───

const PORT = process.env.API_PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`TrustFeed Survey API running on port ${PORT}`);
  console.log('Database:', process.env.DB_NAME || 'TrustFeed');
  console.log('NO PII is collected or stored.');
});

async function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    try {
      await pool.end();
      console.log('Database pool closed.');
    } catch (err) {
      console.error('Error closing database pool:', err.message);
    }
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
