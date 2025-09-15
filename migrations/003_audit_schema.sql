CREATE TABLE audits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE, 
  website_url TEXT NOT NULL,
  business_type TEXT NOT NULL,
  website_goals TEXT, 
  traffic_volume TEXT NOT NULL,
  technical_level TEXT NOT NULL,
  
  overall_score INTEGER NOT NULL,
  performance_score INTEGER NOT NULL,
  seo_score INTEGER NOT NULL,
  security_score INTEGER NOT NULL,
  mobile_score INTEGER NOT NULL,
  accessibility_score INTEGER NOT NULL,
  best_practices_score INTEGER NOT NULL,
  
  audit_data TEXT, 
  
  user_id INTEGER,
  email_captured BOOLEAN DEFAULT 0,
  email_captured_at DATETIME,

  ip_address TEXT,
  user_agent TEXT,
  view_token TEXT, 
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id)
);


CREATE INDEX idx_audits_email ON audits(email);
CREATE INDEX idx_audits_website_url ON audits(website_url);
CREATE INDEX idx_audits_created_at ON audits(created_at);
CREATE INDEX idx_audits_user_id ON audits(user_id);
CREATE INDEX idx_audits_email_captured ON audits(email_captured);
CREATE INDEX idx_audits_ip_address ON audits(ip_address);
CREATE INDEX idx_audits_view_token ON audits(view_token);

CREATE TABLE audit_page_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_visits_ip ON audit_page_visits(ip_address);
CREATE INDEX idx_audit_visits_created_at ON audit_page_visits(created_at);

CREATE TABLE audit_capture_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id INTEGER,
  ip_address TEXT,
  is_eligible BOOLEAN,
  is_authenticated BOOLEAN,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (audit_id) REFERENCES audits(id)
);

CREATE INDEX idx_capture_views_audit_id ON audit_capture_views(audit_id);
CREATE INDEX idx_capture_views_created_at ON audit_capture_views(created_at);

CREATE TABLE audit_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id INTEGER NOT NULL,
  category TEXT NOT NULL, 
  issue_type TEXT NOT NULL, 
  priority TEXT NOT NULL, 
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (audit_id) REFERENCES audits(id)
);

CREATE INDEX idx_audit_issues_audit_id ON audit_issues(audit_id);
CREATE INDEX idx_audit_issues_category ON audit_issues(category);
CREATE INDEX idx_audit_issues_priority ON audit_issues(priority);

CREATE TABLE audit_url_validations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  ip_address TEXT,
  is_eligible BOOLEAN,
  failure_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_url_validations_url ON audit_url_validations(url);
CREATE INDEX idx_url_validations_ip ON audit_url_validations(ip_address);
CREATE INDEX idx_url_validations_created_at ON audit_url_validations(created_at);

CREATE TABLE audit_capture_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id INTEGER,
  capture_type TEXT, 
  email TEXT,
  success BOOLEAN,
  failure_reason TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (audit_id) REFERENCES audits(id)
);

CREATE INDEX idx_capture_analytics_audit_id ON audit_capture_analytics(audit_id);
CREATE INDEX idx_capture_analytics_email ON audit_capture_analytics(email);
CREATE INDEX idx_capture_analytics_type ON audit_capture_analytics(capture_type);

CREATE TABLE audit_follow_up_emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id INTEGER NOT NULL,
  email_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  sent_at DATETIME,
  opened_at DATETIME,
  clicked_at DATETIME,
  status TEXT DEFAULT 'pending', 
  
  FOREIGN KEY (audit_id) REFERENCES audits(id)
);

CREATE INDEX idx_follow_up_emails_audit_id ON audit_follow_up_emails(audit_id);
CREATE INDEX idx_follow_up_emails_status ON audit_follow_up_emails(status);
CREATE INDEX idx_follow_up_emails_type ON audit_follow_up_emails(email_type);

CREATE TABLE audit_industry_benchmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_type TEXT NOT NULL,
  avg_overall_score REAL,
  avg_performance_score REAL,
  avg_seo_score REAL,
  avg_security_score REAL,
  avg_mobile_score REAL,
  avg_accessibility_score REAL,
  sample_size INTEGER,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_benchmarks_business_type ON audit_industry_benchmarks(business_type);

INSERT INTO audit_industry_benchmarks (business_type, avg_overall_score, avg_performance_score, avg_seo_score, avg_security_score, avg_mobile_score, avg_accessibility_score, sample_size) VALUES
('ecommerce', 72, 68, 75, 78, 70, 65, 100),
('service', 68, 65, 70, 72, 68, 60, 80),
('restaurant', 65, 60, 68, 70, 72, 58, 60),
('healthcare', 74, 70, 76, 82, 72, 75, 90),
('technology', 78, 80, 82, 85, 76, 70, 120),
('education', 70, 68, 72, 80, 68, 78, 70),
('nonprofit', 66, 62, 70, 75, 65, 72, 50),
('real-estate', 69, 65, 72, 74, 70, 62, 85),
('automotive', 71, 68, 74, 76, 72, 64, 75),
('other', 70, 66, 72, 75, 70, 65, 200);

CREATE TABLE audit_report_downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id INTEGER NOT NULL,
  format TEXT NOT NULL, 
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (audit_id) REFERENCES audits(id)
);

CREATE INDEX idx_report_downloads_audit_id ON audit_report_downloads(audit_id);
CREATE INDEX idx_report_downloads_created_at ON audit_report_downloads(created_at);

CREATE TRIGGER update_audits_timestamp 
  AFTER UPDATE ON audits
BEGIN
  UPDATE audits SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE VIEW audit_conversion_funnel AS
SELECT 
  DATE(apv.created_at) as date,
  COUNT(DISTINCT apv.ip_address) as page_visits,
  COUNT(DISTINCT a.ip_address) as audits_started,
  COUNT(DISTINCT CASE WHEN a.email_captured = 1 THEN a.ip_address END) as emails_captured,
  ROUND(
    (COUNT(DISTINCT a.ip_address) * 100.0 / COUNT(DISTINCT apv.ip_address)), 2
  ) as audit_conversion_rate,
  ROUND(
    (COUNT(DISTINCT CASE WHEN a.email_captured = 1 THEN a.ip_address END) * 100.0 / COUNT(DISTINCT a.ip_address)), 2
  ) as email_conversion_rate
FROM audit_page_visits apv
LEFT JOIN audits a ON DATE(apv.created_at) = DATE(a.created_at)
GROUP BY DATE(apv.created_at)
ORDER BY date DESC;

CREATE VIEW business_type_performance AS
SELECT 
  business_type,
  COUNT(*) as audit_count,
  AVG(overall_score) as avg_overall_score,
  AVG(performance_score) as avg_performance_score,
  AVG(seo_score) as avg_seo_score,
  AVG(security_score) as avg_security_score,
  AVG(mobile_score) as avg_mobile_score,
  AVG(accessibility_score) as avg_accessibility_score,
  COUNT(CASE WHEN email_captured = 1 THEN 1 END) as emails_captured,
  ROUND(COUNT(CASE WHEN email_captured = 1 THEN 1 END) * 100.0 / COUNT(*), 2) as capture_rate
FROM audits
GROUP BY business_type
ORDER BY audit_count DESC;

CREATE VIEW daily_audit_stats AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_audits,
  COUNT(CASE WHEN email_captured = 1 THEN 1 END) as emails_captured,
  AVG(overall_score) as avg_score,
  MIN(overall_score) as min_score,
  MAX(overall_score) as max_score,
  COUNT(DISTINCT business_type) as unique_business_types
FROM audits
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Insert sample audit page visit for testing (optional)
-- INSERT INTO audit_page_visits (ip_address, user_agent, referrer) 
-- VALUES ('127.0.0.1', 'Mozilla/5.0 Test Browser', 'https://google.com');

PRAGMA foreign_keys = ON;