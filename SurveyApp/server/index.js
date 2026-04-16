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
const fs = require('fs');
const path = require('path');
const { fetchUniqueContent, validateDatasetReadiness, DATASET_ROOT } = require('./content-fetcher');

const app = express();

// ─── Helmet: Sets many security headers (XSS, HSTS, noSniff, etc.) ───
app.use(helmet({
  contentSecurityPolicy: false, // CSP managed by nginx in production
  crossOriginEmbedderPolicy: false,
}));

// ─── CORS: Restrict to known origins ───
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:4200,https://trustfeed-survey-ealep.ondigitalocean.app').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (curl, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    // Allow any *.ondigitalocean.app origin (same platform)
    if (/^https:\/\/[a-z0-9-]+\.ondigitalocean\.app$/.test(origin)) return callback(null, true);
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
  return typeof id === 'string' && /^session-\d{13,}(-[a-f0-9]{8})?$/.test(id);
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

// Serve local dataset assets directly so survey media does not depend on API file proxying.
app.use('/dataset', express.static(DATASET_ROOT, {
  fallthrough: false,
  index: false,
  redirect: false,
}));

// ─── MySQL Connection Pool ───

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'doadmin',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'defaultdb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
};

// Digital Ocean Managed MySQL requires SSL with CA certificate
if (process.env.DB_SSL === 'true') {
  const caPath = path.join(__dirname, 'ca-certificate.crt');
  const caContents = fs.existsSync(caPath) ? fs.readFileSync(caPath, 'utf8') : null;
  dbConfig.ssl = {
    rejectUnauthorized: true,
    ca: caContents || undefined,
  };
}

const pool = mysql.createPool(dbConfig);

// ─── Auto-migrate: create tables if they don't exist ───
async function runMigrations() {
  try {
    await pool.query('SELECT 1');
    console.log('DB connected — running auto-migration...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS survey_sessions (
        session_id        VARCHAR(64) PRIMARY KEY,
        started_at        DATETIME NOT NULL,
        completed_at      DATETIME DEFAULT NULL,
        collab_mode       BOOLEAN NOT NULL DEFAULT FALSE,
        item_count        INT NOT NULL,
        human_correct     INT DEFAULT NULL,
        human_accuracy    DECIMAL(5,4) DEFAULT NULL,
        human_ai_count    INT DEFAULT NULL,
        human_human_count INT DEFAULT NULL,
        actual_ai_count   INT DEFAULT NULL,
        actual_human_count INT DEFAULT NULL,
        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS survey_responses (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        session_id        VARCHAR(64) NOT NULL,
        item_index        INT NOT NULL,
        item_title        VARCHAR(255) NOT NULL,
        item_category     VARCHAR(64) NOT NULL,
        item_difficulty   ENUM('easy','medium','hard') NOT NULL,
        content_type      VARCHAR(16) NOT NULL DEFAULT 'text',
        ground_truth      ENUM('ai','human') NOT NULL,
        human_verdict     ENUM('ai','human') NOT NULL,
        human_confidence  TINYINT NOT NULL,
        human_reasoning   TEXT DEFAULT NULL,
        is_correct        BOOLEAN GENERATED ALWAYS AS (human_verdict = ground_truth) STORED,
        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_response_session FOREIGN KEY (session_id) REFERENCES survey_sessions(session_id) ON DELETE CASCADE,
        UNIQUE KEY uq_session_item (session_id, item_index)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_verdicts (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        session_id        VARCHAR(64) NOT NULL,
        item_index        INT NOT NULL,
        agent_region      VARCHAR(64) NOT NULL,
        verdict           ENUM('ai','human') NOT NULL,
        confidence        DECIMAL(4,2) NOT NULL,
        reasoning         TEXT NOT NULL,
        ground_truth      ENUM('ai','human') NOT NULL,
        is_correct        BOOLEAN GENERATED ALWAYS AS (verdict = ground_truth) STORED,
        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_verdict_session FOREIGN KEY (session_id) REFERENCES survey_sessions(session_id) ON DELETE CASCADE,
        UNIQUE KEY uq_session_item_agent (session_id, item_index, agent_region)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_results (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        session_id        VARCHAR(64) NOT NULL,
        agent_region      VARCHAR(64) NOT NULL,
        correct_count     INT NOT NULL,
        accuracy          DECIMAL(5,4) NOT NULL,
        ai_count          INT NOT NULL,
        human_count       INT NOT NULL,
        avg_confidence    DECIMAL(4,2) NOT NULL,
        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_agent_result_session FOREIGN KEY (session_id) REFERENCES survey_sessions(session_id) ON DELETE CASCADE,
        UNIQUE KEY uq_session_agent (session_id, agent_region)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS agreement_matrix (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        session_id        VARCHAR(64) NOT NULL,
        agent_region      VARCHAR(32) NOT NULL,
        agreement_rate    DECIMAL(5,4) NOT NULL,
        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_agreement_session FOREIGN KEY (session_id) REFERENCES survey_sessions(session_id) ON DELETE CASCADE,
        UNIQUE KEY uq_session_agreement (session_id, agent_region)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS feed_analysis_log (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        post_id           VARCHAR(128) NOT NULL,
        content_type      VARCHAR(16) NOT NULL DEFAULT 'text',
        agent_name        VARCHAR(64) NOT NULL,
        agent_region      VARCHAR(64) DEFAULT NULL,
        score             DECIMAL(6,4) NOT NULL,
        confidence        DECIMAL(6,4) NOT NULL,
        bias_direction    VARCHAR(16) DEFAULT NULL,
        reasoning         TEXT DEFAULT NULL,
        bias_highlights   JSON DEFAULT NULL,
        ml_features       JSON DEFAULT NULL,
        debiased_score    DECIMAL(6,4) DEFAULT NULL,
        bias_delta        DECIMAL(6,4) DEFAULT NULL,
        disagreement_rate DECIMAL(6,4) DEFAULT NULL,
        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_post_id (post_id),
        INDEX idx_agent_region (agent_region),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ─── Alter existing tables to fix column sizes (if they already exist) ───
    try {
      await pool.query(`ALTER TABLE agent_verdicts MODIFY COLUMN agent_region VARCHAR(64) NOT NULL`);
      await pool.query(`ALTER TABLE agent_results MODIFY COLUMN agent_region VARCHAR(64) NOT NULL`);
      await pool.query(`ALTER TABLE agreement_matrix MODIFY COLUMN agent_region VARCHAR(64) DEFAULT NULL`);
      await pool.query(`ALTER TABLE feed_analysis_log MODIFY COLUMN agent_region VARCHAR(64) DEFAULT NULL`);
    } catch (altErr) {
      // ALTER might fail if columns are already correct or table doesn't exist yet
      if (!altErr.message.includes('Duplicate column name') && !altErr.message.includes('check') && !altErr.message.includes('exists')) {
        console.warn('ALTER TABLE (optional):', altErr.message);
      }
    }

    console.log('Auto-migration complete — all tables ready.');
  } catch (err) {
    console.warn('Auto-migration skipped (DB not available):', err.message);
  }
}

runMigrations();

// ─── In-memory fallback when MySQL is not available ───
const memStore = {
  sessions: new Map(),
  responses: new Map(),
  agentVerdicts: new Map(),
  agentResults: new Map(),
  agreementMatrix: new Map(),
};

// ─── Bot & Fraud Detection (per IP, no PII stored — only counts) ───

const ipSessionTracker = new Map(); // IP → { count, firstSeen }
const IP_SESSION_LIMIT = 5;         // Max sessions per IP per hour
const IP_SESSION_WINDOW = 3600000;  // 1 hour

function trackIpSession(ip) {
  const now = Date.now();
  const entry = ipSessionTracker.get(ip) || { count: 0, firstSeen: now };
  if (now - entry.firstSeen > IP_SESSION_WINDOW) {
    entry.count = 0;
    entry.firstSeen = now;
  }
  entry.count++;
  ipSessionTracker.set(ip, entry);
  return entry.count;
}

// Clean up IP tracker every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipSessionTracker) {
    if (now - entry.firstSeen > IP_SESSION_WINDOW * 2) ipSessionTracker.delete(ip);
  }
}, 1800000);

// ─── Straight-Line & Quality Detection ───

function detectStraightLine(responses) {
  if (!Array.isArray(responses) || responses.length < 3) return false;
  const verdicts = responses.map(r => r.humanVerdict).filter(Boolean);
  if (verdicts.length < 3) return false;
  // All same answer = straight-lining
  return verdicts.every(v => v === verdicts[0]);
}

function computeFraudFlags(responses) {
  const flags = [];
  if (detectStraightLine(responses)) {
    flags.push('straight_line');
  }
  // Check if all responses were suspiciously fast (<2s each)
  const fastCount = responses.filter(r => r.flaggedFast).length;
  if (fastCount > 0 && fastCount >= responses.length * 0.5) {
    flags.push('speed_bot');
  }
  // Check for zero-variance confidence (all same confidence)
  const confidences = responses.map(r => r.humanConfidence).filter(c => c != null);
  if (confidences.length >= 3 && confidences.every(c => c === confidences[0])) {
    flags.push('uniform_confidence');
  }
  return flags;
}

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
  const dataset = validateDatasetReadiness();

  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', dataset });
  } catch (err) {
    res.json({ status: 'ok', database: 'disconnected', dataset, message: 'API running, DB not yet configured' });
  }
});

app.get('/api/dataset-health', (_req, res) => {
  const dataset = validateDatasetReadiness();
  res.json({ status: dataset.ready ? 'ok' : 'warning', dataset });
});

// ─── GET /api/content/fetch — Fetch balanced content from local dataset ───

app.get('/api/content/fetch', async (req, res) => {
  try {
    const count = Math.min(Math.max(parseInt(req.query.count) || 6, 1), 30);

    console.log(`Loading ${count} content items from local dataset...`);
    const content = await fetchUniqueContent(count);

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

// ─── GET /api/dataset-file — Legacy dataset file proxy (kept for compatibility) ───

app.get('/api/dataset-file', (req, res) => {
  const filePath = req.query.path;
  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ error: 'Missing path parameter' });
  }
  // Security: prevent directory traversal
  const resolved = path.resolve(DATASET_ROOT, filePath);
  if (!resolved.startsWith(path.resolve(DATASET_ROOT))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.sendFile(resolved);
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

    // ─── Duplicate IP Detection ───
    const clientIp = req.ip || 'unknown';
    const ipCount = trackIpSession(clientIp);
    if (ipCount > IP_SESSION_LIMIT) {
      console.warn(`FRAUD: IP ${clientIp} exceeded session limit (${ipCount} sessions)`);
      return res.status(429).json({
        error: 'Too many sessions',
        message: 'Multiple survey submissions from the same network have been detected. Please wait before starting a new session.',
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
      responseTimeMs, flaggedFast,
      agentVerdicts
    } = req.body;

    // Log response time and fraud flag
    const responseTime = typeof responseTimeMs === 'number' ? Math.max(0, responseTimeMs) : null;
    const isFast = !!flaggedFast;
    if (isFast) {
      console.warn(`FRAUD: Fast response detected — session ${sessionId}, item ${itemIndex}, ${responseTime}ms`);
    }

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

      // Ensure session exists (handles race condition with createSession)
      await conn.execute(
        `INSERT IGNORE INTO survey_sessions (session_id, started_at, collab_mode, item_count)
         VALUES (?, NOW(), FALSE, 6)`,
        [sessionId]
      );

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
          groundTruth || humanVerdict, humanVerdict, humanConfidence,
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
              sanitizeString(av.region, 32),
              isValidVerdict(av.verdict) ? av.verdict : 'human',
              typeof av.confidence === 'number' ? Math.min(Math.max(av.confidence, 0), 1) : 0.5,
              sanitizeString(av.reasoning, 500),
              groundTruth || humanVerdict
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
        responseTimeMs: responseTime, flaggedFast: isFast,
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
      session.humanAiCount = humanAiCount;
      session.humanHumanCount = humanHumanCount;
      session.actualAiCount = actualAiCount;
      session.actualHumanCount = actualHumanCount;
      memStore.sessions.set(sessionId, session);
      if (Array.isArray(agentResults)) memStore.agentResults.set(sessionId, agentResults);
      if (Array.isArray(agreementMatrix)) memStore.agreementMatrix.set(sessionId, agreementMatrix);
    }

    // ─── Straight-Line & Fraud Audit (runs on every completion) ───
    const sessionResponses = [...memStore.responses.values()].filter(r => r.sessionId === sessionId);
    const fraudFlags = computeFraudFlags(sessionResponses);
    if (fraudFlags.length > 0) {
      console.warn(`FRAUD AUDIT — Session ${sessionId}: [${fraudFlags.join(', ')}]`);
    }

    res.json({
      sessionId,
      message: 'Session completed and results saved',
      qualityFlags: fraudFlags.length > 0 ? fraudFlags : undefined,
    });
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

app.get('/api/sessions', async (req, res) => {
  try {
    if (dbAvailable) {
      const [sessions] = await pool.execute(
        `SELECT s.session_id, s.started_at, s.completed_at, s.collab_mode,
                s.item_count, s.human_correct, s.human_accuracy,
                s.human_ai_count, s.human_human_count,
                s.actual_ai_count, s.actual_human_count
         FROM survey_sessions s
         WHERE s.completed_at IS NOT NULL
         ORDER BY s.completed_at DESC`
      );
      const results = [];
      for (const s of sessions) {
        const [agentRes] = await pool.execute('SELECT * FROM agent_results WHERE session_id = ?', [s.session_id]);
        const [agreement] = await pool.execute('SELECT * FROM agreement_matrix WHERE session_id = ?', [s.session_id]);
        results.push({
          sessionId: s.session_id,
          startedAt: s.started_at,
          completedAt: s.completed_at,
          collabMode: !!s.collab_mode,
          totalItems: s.item_count,
          humanCorrect: s.human_correct,
          humanAccuracy: parseFloat(s.human_accuracy) || 0,
          humanAiCount: s.human_ai_count,
          humanHumanCount: s.human_human_count,
          actualAiCount: s.actual_ai_count,
          actualHumanCount: s.actual_human_count,
          agentResults: agentRes.map(a => ({
            region: a.agent_region,
            correct: a.correct_count,
            accuracy: parseFloat(a.accuracy) || 0,
            aiCount: a.ai_count,
            humanCount: a.human_count,
            avgConfidence: parseFloat(a.avg_confidence) || 0,
          })),
          agreementMatrix: agreement.map(a => ({
            region: a.agent_region,
            agreementRate: parseFloat(a.agreement_rate) || 0,
          })),
        });
      }
      res.json({ sessions: results });
    } else {
      const allSessions = [...memStore.sessions.values()]
        .filter(s => s.completedAt)
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
      const results = allSessions.map(s => ({
        sessionId: s.sessionId,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        collabMode: !!s.collabMode,
        totalItems: s.itemCount,
        humanCorrect: s.humanCorrect || 0,
        humanAccuracy: s.humanAccuracy || 0,
        humanAiCount: s.humanAiCount || 0,
        humanHumanCount: s.humanHumanCount || 0,
        actualAiCount: s.actualAiCount || 0,
        actualHumanCount: s.actualHumanCount || 0,
        agentResults: memStore.agentResults.get(s.sessionId) || [],
        agreementMatrix: memStore.agreementMatrix.get(s.sessionId) || [],
      }));
      res.json({ sessions: results });
    }
  } catch (err) {
    console.error('GET /api/sessions error:', err.message);
    res.status(500).json({ error: 'Server error', message: 'Could not retrieve sessions.' });
  }
});

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

// ─── GET /api/survey-stats — Survey completion report (no PII) ───

app.get('/api/survey-stats', async (req, res) => {
  try {
    if (dbAvailable) {
      const [total] = await pool.execute(
        'SELECT COUNT(*) AS count FROM survey_sessions'
      );
      const [completed] = await pool.execute(
        'SELECT COUNT(*) AS count FROM survey_sessions WHERE completed_at IS NOT NULL'
      );
      const [inProgress] = await pool.execute(
        'SELECT COUNT(*) AS count FROM survey_sessions WHERE completed_at IS NULL'
      );
      const [avgStats] = await pool.execute(
        `SELECT ROUND(AVG(human_accuracy), 4) AS avg_accuracy,
                ROUND(AVG(item_count), 1) AS avg_items
         FROM survey_sessions WHERE completed_at IS NOT NULL`
      );
      const [byMode] = await pool.execute(
        `SELECT CASE WHEN collab_mode THEN 'Human-AI Collab' ELSE 'Solo' END AS mode,
                COUNT(*) AS sessions, ROUND(AVG(human_accuracy), 4) AS avg_accuracy
         FROM survey_sessions WHERE completed_at IS NOT NULL GROUP BY collab_mode`
      );
      const [byDifficulty] = await pool.execute(
        `SELECT item_difficulty AS difficulty, COUNT(*) AS total,
                SUM(is_correct) AS correct,
                ROUND(SUM(is_correct) / COUNT(*), 4) AS accuracy
         FROM survey_responses GROUP BY item_difficulty`
      );
      const [recentCompletions] = await pool.execute(
        `SELECT DATE(completed_at) AS date, COUNT(*) AS completed_count
         FROM survey_sessions WHERE completed_at IS NOT NULL
           AND completed_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
         GROUP BY DATE(completed_at) ORDER BY date`
      );

      const totalCount = total[0].count;
      const completedCount = completed[0].count;

      res.json({
        totalSessions: totalCount,
        completedSessions: completedCount,
        inProgressSessions: inProgress[0].count,
        completionRate: totalCount > 0 ? completedCount / totalCount : 0,
        avgAccuracy: avgStats[0].avg_accuracy || 0,
        avgItemsPerSession: avgStats[0].avg_items || 0,
        byMode: byMode.map(r => ({ mode: r.mode, sessions: r.sessions, avgAccuracy: r.avg_accuracy })),
        byDifficulty: byDifficulty.map(r => ({ difficulty: r.difficulty, total: r.total, correct: r.correct, accuracy: r.accuracy })),
        recentCompletions: recentCompletions.map(r => ({ date: r.date, completedCount: r.completed_count })),
      });
    } else {
      const allSessions = [...memStore.sessions.values()];
      const completed = allSessions.filter(s => s.completedAt);
      const totalCount = allSessions.length;
      const completedCount = completed.length;

      res.json({
        totalSessions: totalCount,
        completedSessions: completedCount,
        inProgressSessions: totalCount - completedCount,
        completionRate: totalCount > 0 ? completedCount / totalCount : 0,
        avgAccuracy: 0,
        avgItemsPerSession: 0,
        byMode: [],
        byDifficulty: [],
        recentCompletions: [],
        note: 'Database not connected — showing in-memory data only.',
      });
    }
  } catch (err) {
    console.error('GET /api/survey-stats error:', err.message);
    res.status(500).json({ error: 'Server error', message: 'Survey stats temporarily unavailable.' });
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

// ─── Broken Media Reporting & Auto-Fix ───

const brokenMediaStore = [];
const urlReplacements = new Map();

app.post('/api/report-broken-media', (req, res) => {
  const { brokenUrl, context, agentRegion } = req.body || {};
  if (!brokenUrl || typeof brokenUrl !== 'string' || brokenUrl.length > 2000) {
    return res.status(400).json({ error: 'Invalid brokenUrl' });
  }
  if (!brokenUrl.startsWith('http://') && !brokenUrl.startsWith('https://')) {
    return res.status(400).json({ error: 'brokenUrl must start with http(s)://' });
  }

  // Return cached fix if already reported
  if (urlReplacements.has(brokenUrl)) {
    return res.json({ status: 'already-fixed', brokenUrl, replacementUrl: urlReplacements.get(brokenUrl) });
  }

  const replacementUrl = '/assets/logo.svg';

  urlReplacements.set(brokenUrl, replacementUrl);
  brokenMediaStore.push({
    brokenUrl,
    replacementUrl,
    context: (context || '').slice(0, 200),
    agentRegion: (agentRegion || '').slice(0, 200),
    reportedAt: new Date().toISOString(),
  });

  res.json({ status: 'fixed', brokenUrl, replacementUrl, agentRegion: agentRegion || '' });
});

app.get('/api/broken-media', (_req, res) => {
  res.json({
    totalReports: brokenMediaStore.length,
    reports: brokenMediaStore.slice(-50),
    activeReplacements: urlReplacements.size,
  });
});

// ─── POST /api/feed-analysis-log — Log Core API agent analysis to DB ───

app.post('/api/feed-analysis-log', async (req, res) => {
  try {
    const { postId, contentType, agentScores, debiasedScore, biasDelta, disagreementRate, mlFeatures } = req.body || {};

    if (!postId || typeof postId !== 'string' || postId.length > 128) {
      return res.status(400).json({ error: 'Invalid postId' });
    }
    if (!Array.isArray(agentScores) || agentScores.length === 0) {
      return res.status(400).json({ error: 'agentScores must be a non-empty array' });
    }

    if (dbAvailable) {
      let logged = 0;
      for (const agent of agentScores.slice(0, 10)) {
        if (!agent.agent || typeof agent.score !== 'number') continue;
        await pool.execute(
          `INSERT INTO feed_analysis_log
           (post_id, content_type, agent_name, agent_region, score, confidence,
            bias_direction, reasoning, bias_highlights, ml_features,
            debiased_score, bias_delta, disagreement_rate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            postId.slice(0, 128),
            (contentType || 'text').slice(0, 16),
            (agent.agent || '').slice(0, 64),
            agent.region ? agent.region.slice(0, 32) : null,
            Math.min(Math.max(agent.score, 0), 1),
            Math.min(Math.max(agent.confidence || 0, 0), 1),
            agent.biasDirection ? agent.biasDirection.slice(0, 16) : null,
            agent.reasoning ? agent.reasoning.slice(0, 2000) : null,
            agent.biasHighlights ? JSON.stringify(agent.biasHighlights.slice(0, 20)) : null,
            mlFeatures ? JSON.stringify(mlFeatures) : null,
            typeof debiasedScore === 'number' ? debiasedScore : null,
            typeof biasDelta === 'number' ? biasDelta : null,
            typeof disagreementRate === 'number' ? disagreementRate : null,
          ]
        );
        logged++;
      }
      res.json({ status: 'logged', postId, agentsLogged: logged });
    } else {
      res.json({ status: 'skipped', reason: 'database not connected', postId });
    }
  } catch (err) {
    console.error('POST /api/feed-analysis-log error:', err.message);
    res.status(500).json({ error: 'Server error', message: 'Failed to log analysis.' });
  }
});

// ─── GET /api/agent-tracking — Per-agent uniqueness stats from feed analysis log ───

app.get('/api/agent-tracking', async (req, res) => {
  try {
    if (dbAvailable) {
      const [agentStats] = await pool.execute(
        `SELECT agent_name, agent_region,
          COUNT(*) AS total_analyses,
          ROUND(AVG(score), 4) AS avg_score,
          ROUND(MIN(score), 4) AS min_score,
          ROUND(MAX(score), 4) AS max_score,
          ROUND(STDDEV_POP(score), 4) AS score_stddev,
          ROUND(AVG(confidence), 4) AS avg_confidence,
          ROUND(AVG(bias_delta), 4) AS avg_bias_delta,
          ROUND(AVG(disagreement_rate), 4) AS avg_disagreement
         FROM feed_analysis_log
         WHERE agent_region IS NOT NULL
         GROUP BY agent_name, agent_region
         ORDER BY agent_region`
      );

      const [recentLogs] = await pool.execute(
        `SELECT post_id, agent_name, agent_region, score, confidence,
          bias_delta, disagreement_rate, created_at
         FROM feed_analysis_log
         WHERE agent_region IS NOT NULL
         ORDER BY created_at DESC LIMIT 30`
      );

      const [surveyAgentStats] = await pool.execute(
        `SELECT agent_region, COUNT(*) AS total_verdicts,
          SUM(is_correct) AS correct_count,
          ROUND(SUM(is_correct) / COUNT(*), 4) AS accuracy,
          ROUND(AVG(confidence), 4) AS avg_confidence
         FROM agent_verdicts GROUP BY agent_region`
      );

      res.json({
        feedAnalysis: { agentStats, recentLogs },
        surveyVerdicts: surveyAgentStats,
        totalFeedAnalyses: agentStats.reduce((sum, a) => sum + a.total_analyses, 0),
        totalSurveyVerdicts: surveyAgentStats.reduce((sum, a) => sum + a.total_verdicts, 0),
      });
    } else {
      res.json({
        feedAnalysis: { agentStats: [], recentLogs: [] },
        surveyVerdicts: [],
        totalFeedAnalyses: 0,
        totalSurveyVerdicts: 0,
        note: 'Database not connected.',
      });
    }
  } catch (err) {
    console.error('GET /api/agent-tracking error:', err.message);
    res.status(500).json({ error: 'Server error' });
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
