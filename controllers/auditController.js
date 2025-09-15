const { query } = require('../config/database');
const auditEngine = require('../services/auditEngine');
const emailService = require('../services/emailService');
const { logConsent, logAuditConsent } = require('./consentController');

class AuditController {
  
  async trackPageVisit(req, res) {
    try {
      const { userAgent, referrer, timestamp } = req.body;
      
      await query(`
        INSERT INTO audit_page_visits (ip_address, user_agent, referrer, created_at)
        VALUES ($1, $2, $3, $4)
      `, [req.ip, userAgent, referrer, timestamp]);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error tracking page visit:', error);
      res.json({ success: true }); 
    }
  }

  async validateUrl(req, res) {
    try {
      const { url } = req.body;
      
      const recentSubmission = await query(`
        SELECT id FROM audits 
        WHERE website_url = $1 AND ip_address = $2 
        AND created_at > NOW() - INTERVAL '1 hour'
      `, [url, req.ip]);
      
      if (recentSubmission.length > 0) {
        return res.json({
          success: false,
          eligible: false,
          reason: 'This website was recently audited from your location. Please try again later.'
        });
      }
      
      const eligibilityResult = await auditEngine.isUrlEligible(url);
      
      res.json({
        success: true,
        ...eligibilityResult
      });
      
    } catch (error) {
      console.error('URL validation error:', error);
      res.json({
        success: false,
        error: 'Unable to validate URL'
      });
    }
  }

  async checkFinalEligibility(req, res) {
    try {
      const { websiteUrl, businessType, email } = req.body;
      
      const todayAudits = await query(`
        SELECT COUNT(*) as count FROM audits 
        WHERE email = $1 
        AND created_at > NOW() - INTERVAL '24 hours'
      `, [email]);
      
      if (parseInt(todayAudits[0].count) >= 3) {
        return res.json({
          eligible: false,
          reason: 'This email has reached the daily audit limit. Please try again tomorrow.'
        });
      }
        
      const restrictedTypes = ['adult', 'gambling', 'illegal'];
      if (restrictedTypes.includes(businessType.toLowerCase())) {
        return res.json({
          eligible: false,
          reason: 'This business type is not eligible for our audit service.'
        });
      }
      
      res.json({
        eligible: true,
        reason: 'Website is eligible for audit'
      });
      
    } catch (error) {
      console.error('Final eligibility check error:', error);
      res.json({
        eligible: true 
      });
    }
  }

  async runAudit(req, res) {
    try {
      const { 
        websiteUrl, 
        businessType, 
        websiteGoals, 
        trafficVolume, 
        technicalLevel,
        userAgent,
        timestamp 
      } = req.body;
      
      const userEmail = req.body.email || req.user?.email;

      if (!userEmail) {
        return res.status(400).json({
          success: false,
          error: 'Email is required for audit'
        });
      }

      const existingAudit = await query(`
        SELECT id FROM audits WHERE email = $1
      `, [userEmail]);

      if (existingAudit.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'This email address has already been used for an audit. Each email can only be audited once.'
        });
      }
      
      const auditResults = await auditEngine.auditWebsite(websiteUrl, {
        businessType,
        websiteGoals,
        trafficVolume,
        technicalLevel
      });
      
      const auditRecord = await query(`
        INSERT INTO audits (
          email, website_url, business_type, website_goals, traffic_volume, 
          technical_level, overall_score, performance_score, seo_score,
          security_score, mobile_score, accessibility_score, best_practices_score,
          audit_data, ip_address, user_agent, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING id
      `, [
        userEmail,  
        websiteUrl,
        businessType,
        JSON.stringify(websiteGoals),
        trafficVolume,
        technicalLevel,
        auditResults.overallScore,
        auditResults.scores.performance,
        auditResults.scores.seo,
        auditResults.scores.security,
        auditResults.scores.mobile,
        auditResults.scores.accessibility,
        auditResults.scores.bestPractices,
        JSON.stringify(auditResults),
        req.ip,
        userAgent,
        timestamp
      ]);
      
      const auditId = auditRecord[0].id;
      auditResults.auditId = auditId;
      
      const crypto = require('crypto');
      auditResults.viewToken = crypto.randomBytes(32).toString('hex');
      
      await query(`
        UPDATE audits SET view_token = $1 WHERE id = $2
      `, [auditResults.viewToken, auditId]);
      
      res.json({
        success: true,
        results: auditResults,
        auditId: auditId
      });
      
    } catch (error) {
      console.error('Audit execution error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Audit failed to complete'
      });
    }
  }

  async captureExistingUser(req, res) {
    try {
      const { auditId } = req.body;
      const userId = req.user.id;
      
      const audit = await query(`
        SELECT * FROM audits WHERE id = $1
      `, [auditId]);
      
      if (audit.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Audit not found'
        });
      }
      
      await logConsent({
        userId,
        consentType: 'marketing',
        granted: true,
        source: 'audit_capture',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      await query(`
        UPDATE audits SET user_id = $1, email_captured = true, email_captured_at = NOW()
        WHERE id = $2
      `, [userId, auditId]);
      
      const auditData = typeof audit[0].audit_data === 'string' 
        ? JSON.parse(audit[0].audit_data) 
        : audit[0].audit_data;
        
      await emailService.sendAuditReportEmail(
        req.user.email,
        req.user.firstName,
        auditData
      );
      
      res.json({
        success: true,
        message: 'Preferences updated and audit report sent'
      });
      
    } catch (error) {
      console.error('Error capturing existing user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update preferences'
      });
    }
  }

  async captureAnonymousUser(req, res) {
    try {
      const { firstName, lastName, email, auditResults, source, userAgent, timestamp } = req.body;
      
      const existingUser = await query('SELECT id, email FROM users WHERE email = $1', [email]);
      
      if (existingUser.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'An account with this email already exists. Please log in to receive your audit report.'
        });
      }
      
      const userId = await logAuditConsent({
        email,
        firstName,
        lastName,
        auditId: auditResults?.auditId,
        ipAddress: req.ip,
        userAgent
      });
      
      if (auditResults) {
        await emailService.sendAuditReportEmail(email, firstName, auditResults);
      }
      
      await emailService.sendWelcomeEmail(email, firstName);
      
      res.json({
        success: true,
        message: 'Audit report sent! Please check your email.',
        verificationRequired: false,
        userId
      });
      
    } catch (error) {
      console.error('Error capturing anonymous user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to capture email'
      });
    }
  }

  async captureIneligibleUser(req, res) {
    try {
      const { firstName, lastName, email, source, userAgent, timestamp } = req.body;
      const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
      
      if (existingUser.length > 0) {
        await logConsent({
          userId: existingUser[0].id,
          consentType: 'marketing',
          granted: true,
          source: 'audit_ineligible',
          ipAddress: req.ip,
          userAgent
        });
      } else {
        const result = await query(
          'INSERT INTO users (email, first_name, last_name, firebase_uid) VALUES ($1, $2, $3, $4) RETURNING id',
          [email, firstName, lastName, `ineligible_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`]
        );
        
        const userId = result[0].id;
        
        await logConsent({
          userId,
          consentType: 'marketing',
          granted: true,
          source: 'audit_ineligible',
          ipAddress: req.ip,
          userAgent
        });
      }
      
      await emailService.sendWelcomeEmail(email, firstName);
      
      res.json({
        success: true,
        message: 'Thank you for subscribing! Check your email for website improvement tips.'
      });
      
    } catch (error) {
      console.error('Error capturing ineligible user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to subscribe'
      });
    }
  }

  async checkEmailAvailability(req, res) {
    try {
      const { email } = req.body;

      const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
      
      if (existingUser.length > 0) {
        return res.json({
          success: false,
          error: 'This email is already registered. Please use a different email or log in.'
        });
      }
      
      const suppressed = await query('SELECT id FROM email_suppression WHERE email = $1', [email]);
      
      if (suppressed.length > 0) {
        return res.json({
          success: false,
          error: 'This email has opted out of communications.'
        });
      }
      
      res.json({ success: true });
      
    } catch (error) {
      console.error('Error checking email:', error);
      res.json({ success: true }); 
    }
  }

  async trackCaptureView(req, res) {
    try {
      const { auditId, isEligible, isAuthenticated, timestamp } = req.body;
      
      await query(`
        INSERT INTO audit_capture_views 
        (audit_id, ip_address, is_eligible, is_authenticated, created_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [auditId, req.ip, isEligible, isAuthenticated, timestamp]);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error tracking capture view:', error);
      res.json({ success: true }); 
    }
  }

  async downloadReport(req, res) {
    try {
      const { auditId, format } = req.body;
      
      const audit = await query('SELECT * FROM audits WHERE id = $1', [auditId]);
      
      if (audit.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Audit not found'
        });
      }
      
      const auditData = typeof audit[0].audit_data === 'string' 
        ? JSON.parse(audit[0].audit_data) 
        : audit[0].audit_data;
      
      if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="audit-report-${auditId}.json"`);
        res.json(auditData);
      } else {
        const htmlReport = this.generateHtmlReport(auditData);
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `attachment; filename="audit-report-${auditId}.html"`);
        res.send(htmlReport);
      }
      
    } catch (error) {
      console.error('Error downloading report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate report'
      });
    }
  }

  generateHtmlReport(auditData) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Website Audit Report - ${auditData.websiteUrl}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { text-align: center; margin-bottom: 40px; }
            .score { font-size: 48px; font-weight: bold; color: #667eea; }
            .category { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
            .recommendations { margin-top: 40px; }
            .rec-item { margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 6px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Website Audit Report</h1>
            <p>${auditData.websiteUrl}</p>
            <div class="score">${auditData.overallScore}/100</div>
          </div>
          
          <h2>Performance Breakdown</h2>
          ${Object.entries(auditData.scores).map(([category, score]) => `
            <div class="category">
              <h3>${category.charAt(0).toUpperCase() + category.slice(1)}: ${score}/100</h3>
            </div>
          `).join('')}
          
          <div class="recommendations">
            <h2>Top Recommendations</h2>
            ${auditData.recommendations.slice(0, 5).map(rec => `
              <div class="rec-item">
                <h3>${rec.title}</h3>
                <p><strong>Priority:</strong> ${rec.priority}</p>
                <p>${rec.description}</p>
              </div>
            `).join('')}
          </div>
          
          <p><em>Report generated on ${new Date().toLocaleDateString()}</em></p>
        </body>
      </html>
    `;
  }

  async getAuditStats(req, res) {
    try {
      const stats = await query(`
        SELECT 
          COUNT(*) as total_audits,
          COUNT(CASE WHEN email_captured = true THEN 1 END) as captured_emails,
          AVG(overall_score) as avg_score,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as recent_audits
        FROM audits
      `);
      
      const topIssues = await query(`
        SELECT business_type, COUNT(*) as count
        FROM audits 
        GROUP BY business_type 
        ORDER BY count DESC 
        LIMIT 5
      `);
      
      res.json({
        success: true,
        stats: stats[0] || { total_audits: 0, captured_emails: 0, avg_score: 0, recent_audits: 0 },
        topBusinessTypes: topIssues
      });
      
    } catch (error) {
      console.error('Error getting audit stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get statistics'
      });
    }
  }

  async getRecentAudits(req, res) {
    try {
      const audits = await query(`
        SELECT 
          a.id, a.website_url, a.business_type, a.overall_score,
          a.email_captured, a.created_at,
          u.email, u.first_name, u.last_name
        FROM audits a
        LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC
        LIMIT 50
      `);
      
      res.json({
        success: true,
        audits
      });
      
    } catch (error) {
      console.error('Error getting recent audits:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get recent audits'
      });
    }
  }
}

module.exports = new AuditController();