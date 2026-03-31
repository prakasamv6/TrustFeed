-- =====================================================
-- TrustFeed Survey Database Schema
-- Database: TrustFeed
-- NO PII (Personally Identifiable Information) STORED
-- All sessions are fully anonymous
-- =====================================================

CREATE DATABASE IF NOT EXISTS TrustFeed;
USE TrustFeed;

-- ---------------------------------------------------
-- Anonymous survey sessions (NO PII)
-- No names, emails, IPs, cookies, or user identifiers
-- ---------------------------------------------------
CREATE TABLE survey_sessions (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------
-- Individual item responses (per item per session)
-- ---------------------------------------------------
CREATE TABLE survey_responses (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------
-- Agent verdicts (per item per agent per session)
-- ---------------------------------------------------
CREATE TABLE agent_verdicts (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  session_id        VARCHAR(64) NOT NULL,
  item_index        INT NOT NULL,
  agent_region      ENUM('Africa','Asia','Europe','Americas','Oceania') NOT NULL,
  verdict           ENUM('ai','human') NOT NULL,
  confidence        DECIMAL(4,2) NOT NULL,
  reasoning         TEXT NOT NULL,
  ground_truth      ENUM('ai','human') NOT NULL,
  is_correct        BOOLEAN GENERATED ALWAYS AS (verdict = ground_truth) STORED,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_verdict_session FOREIGN KEY (session_id) REFERENCES survey_sessions(session_id) ON DELETE CASCADE,
  UNIQUE KEY uq_session_item_agent (session_id, item_index, agent_region)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------
-- Per-session agent result summaries
-- ---------------------------------------------------
CREATE TABLE agent_results (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  session_id        VARCHAR(64) NOT NULL,
  agent_region      ENUM('Africa','Asia','Europe','Americas','Oceania') NOT NULL,
  correct_count     INT NOT NULL,
  accuracy          DECIMAL(5,4) NOT NULL,
  ai_count          INT NOT NULL,
  human_count       INT NOT NULL,
  avg_confidence    DECIMAL(4,2) NOT NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_agent_result_session FOREIGN KEY (session_id) REFERENCES survey_sessions(session_id) ON DELETE CASCADE,
  UNIQUE KEY uq_session_agent (session_id, agent_region)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------
-- Human-agent agreement matrix (per session)
-- ---------------------------------------------------
CREATE TABLE agreement_matrix (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  session_id        VARCHAR(64) NOT NULL,
  agent_region      ENUM('Africa','Asia','Europe','Americas','Oceania') NOT NULL,
  agreement_rate    DECIMAL(5,4) NOT NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_agreement_session FOREIGN KEY (session_id) REFERENCES survey_sessions(session_id) ON DELETE CASCADE,
  UNIQUE KEY uq_session_agreement (session_id, agent_region)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------
-- Useful aggregate views
-- ---------------------------------------------------

-- View: Overall accuracy by mode (Solo vs Collab)
CREATE OR REPLACE VIEW v_accuracy_by_mode AS
SELECT
  CASE WHEN collab_mode THEN 'Human-AI Collab' ELSE 'Solo' END AS mode,
  COUNT(*) AS total_sessions,
  ROUND(AVG(human_accuracy), 4) AS avg_accuracy,
  ROUND(MIN(human_accuracy), 4) AS min_accuracy,
  ROUND(MAX(human_accuracy), 4) AS max_accuracy,
  ROUND(AVG(human_correct), 1) AS avg_correct
FROM survey_sessions
WHERE completed_at IS NOT NULL
GROUP BY collab_mode;

-- View: Accuracy by difficulty
CREATE OR REPLACE VIEW v_accuracy_by_difficulty AS
SELECT
  item_difficulty,
  COUNT(*) AS total_responses,
  SUM(is_correct) AS correct_count,
  ROUND(SUM(is_correct) / COUNT(*), 4) AS accuracy,
  ROUND(AVG(human_confidence), 2) AS avg_confidence
FROM survey_responses
GROUP BY item_difficulty;

-- View: Agent accuracy comparison
CREATE OR REPLACE VIEW v_agent_accuracy AS
SELECT
  agent_region,
  COUNT(*) AS total_verdicts,
  SUM(is_correct) AS correct_count,
  ROUND(SUM(is_correct) / COUNT(*), 4) AS accuracy,
  ROUND(AVG(confidence), 2) AS avg_confidence
FROM agent_verdicts
GROUP BY agent_region;

-- View: Human vs Agent accuracy by category
CREATE OR REPLACE VIEW v_accuracy_by_category AS
SELECT
  sr.item_category,
  ROUND(SUM(sr.is_correct) / COUNT(*), 4) AS human_accuracy,
  (SELECT ROUND(SUM(av.is_correct) / COUNT(*), 4)
   FROM agent_verdicts av
   JOIN survey_responses sr2 ON av.session_id = sr2.session_id AND av.item_index = sr2.item_index
   WHERE sr2.item_category = sr.item_category) AS agent_accuracy
FROM survey_responses sr
GROUP BY sr.item_category;
