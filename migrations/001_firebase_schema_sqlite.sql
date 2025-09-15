-- PostgreSQL Schema Migration
-- File: backend/migrations/001_firebase_schema_postgresql.sql

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  firebase_uid VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_firebase_uid ON users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_email ON users(email);

-- Consent ledger table
CREATE TABLE IF NOT EXISTS consent_ledger (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  consent_type VARCHAR(50) NOT NULL CHECK (consent_type IN ('marketing', 'analytics', 'necessary')),
  granted BOOLEAN NOT NULL,
  source VARCHAR(255) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for consent_ledger table
CREATE INDEX IF NOT EXISTS idx_user_consent ON consent_ledger(user_id, consent_type);
CREATE INDEX IF NOT EXISTS idx_created_at ON consent_ledger(created_at);

-- Email suppression table
CREATE TABLE IF NOT EXISTS email_suppression (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  reason VARCHAR(50) NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint')),
  suppressed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for email_suppression table
CREATE INDEX IF NOT EXISTS idx_email_suppression ON email_suppression(email);

-- Unsubscribe tokens table
CREATE TABLE IF NOT EXISTS unsubscribe_tokens (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for unsubscribe_tokens table
CREATE INDEX IF NOT EXISTS idx_token ON unsubscribe_tokens(token);
CREATE INDEX IF NOT EXISTS idx_unsubscribe_email ON unsubscribe_tokens(email);

-- Additional tables that appear to be referenced in the controller
-- Audits table (inferred from controller)
CREATE TABLE IF NOT EXISTS audits (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  email VARCHAR(255) NOT NULL,
  website_url VARCHAR(255) NOT NULL,
  business_type VARCHAR(100),
  website_goals JSONB,
  traffic_volume VARCHAR(50),
  technical_level VARCHAR(50),
  overall_score INTEGER,
  performance_score INTEGER,
  seo_score INTEGER,
  security_score INTEGER,
  mobile_score INTEGER,
  accessibility_score INTEGER,
  best_practices_score INTEGER,
  audit_data JSONB,
  view_token VARCHAR(255),
  email_captured BOOLEAN DEFAULT FALSE,
  email_captured_at TIMESTAMP,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for audits table
CREATE INDEX IF NOT EXISTS idx_audit_email ON audits(email);
CREATE INDEX IF NOT EXISTS idx_audit_website_url ON audits(website_url);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audits(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_view_token ON audits(view_token);

-- Audit page visits table (inferred from controller)
CREATE TABLE IF NOT EXISTS audit_page_visits (
  id SERIAL PRIMARY KEY,
  ip_address INET,
  user_agent TEXT,
  referrer VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for audit_page_visits table
CREATE INDEX IF NOT EXISTS idx_page_visits_created_at ON audit_page_visits(created_at);

-- Audit capture views table (inferred from controller)
CREATE TABLE IF NOT EXISTS audit_capture_views (
  id SERIAL PRIMARY KEY,
  audit_id INTEGER,
  ip_address INET,
  is_eligible BOOLEAN,
  is_authenticated BOOLEAN,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE CASCADE
);

-- Index for audit_capture_views table
CREATE INDEX IF NOT EXISTS idx_capture_views_audit_id ON audit_capture_views(audit_id);