const nodemailer = require('nodemailer');
const { query } = require('../config/database');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({ 
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  
  async sendWelcomeEmail(email, firstName) {
    const mailOptions = {
      from: `"N15 Labs" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Welcome to N15 Labs!',
      html: this.getWelcomeTemplate(firstName)
    };
    
    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Welcome email sent to:', email);
      
      await this.logEmailSent({
        email,
        type: 'transactional',
        template: 'welcome',
        subject: 'Welcome to N15 Labs!'
      });
      
    } catch (error) {
      console.error('Error sending welcome email:', error);
      throw error;
    }
  }
  
  async sendAuditReportEmail(email, firstName, auditResults) {
    const mailOptions = {
      from: `"N15 Labs" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Your Website Audit Report - Score: ${auditResults.overallScore}/100`,
      html: this.getAuditReportTemplate(firstName, auditResults),
      attachments: auditResults.pdfBuffer ? [{
        filename: 'website-audit-report.pdf',
        content: auditResults.pdfBuffer
      }] : []
    };
    
    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Audit report email sent to:', email);
      
      await this.logEmailSent({
        email,
        type: 'transactional',
        template: 'audit_report',
        subject: mailOptions.subject
      });
      
    } catch (error) {
      console.error('Error sending audit report email:', error);
      throw error;
    }
  }

  async sendMarketingEmail({ to, subject, template, data = {} }) {
    try {
      const canSendMarketing = await this.canSendMarketingEmail(to);
      
      if (!canSendMarketing) {
        console.log(`Skipping marketing email to ${to} - no consent or suppressed`);
        return { success: false, reason: 'No marketing consent or suppressed' };
      }
      
      const unsubscribeToken = await this.generateUnsubscribeToken(to);
      const unsubscribeUrl = `${process.env.FRONTEND_URL}/unsubscribe?token=${unsubscribeToken}`;
      
      const enhancedData = {
        ...data,
        unsubscribeUrl
      };
      
      const emailHtml = this.getMarketingTemplate(template, enhancedData);
      const finalHtml = this.addUnsubscribeFooter(emailHtml, unsubscribeUrl);
      
      const mailOptions = {
        from: `"N15 Labs" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html: finalHtml,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
        }
      };
      
      await this.transporter.sendMail(mailOptions);
      
      await this.logEmailSent({
        email: to,
        type: 'marketing',
        template,
        subject
      });
      
      return { success: true };
      
    } catch (error) {
      console.error('Error sending marketing email:', error);
      throw error;
    }
  }
  
  async canSendMarketingEmail(email) {
    try {
      const suppressed = await query(
        'SELECT id FROM email_suppression WHERE email = ?',
        [email]
      );
      
      if (suppressed.length > 0) {
        return false;
      }
      
      const user = await query('SELECT id FROM users WHERE email = ?', [email]);
      if (user.length === 0) {
        return false;
      }
      
      const consent = await query(
        `SELECT granted FROM consent_ledger 
         WHERE user_id = ? AND consent_type = 'marketing' 
         ORDER BY created_at DESC LIMIT 1`,
        [user[0].id]
      );
      
      return consent.length > 0 && consent[0].granted;
      
    } catch (error) {
      console.error('Error checking marketing email permission:', error);
      return false;
    }
  }
  
  async generateUnsubscribeToken(email) {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    await query(
      `INSERT OR REPLACE INTO unsubscribe_tokens (email, token, expires_at) VALUES (?, ?, ?)`,
      [email, token, expiresAt.toISOString()]
    );
    
    return token;
  }
  
  getWelcomeTemplate(firstName) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to N15 Labs</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to N15 Labs!</h1>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">Hi ${firstName}!</h2>
            
            <p>Thanks for joining N15 Labs! We're excited to have you as part of our community.</p>
            
            <p>Here's what you can do with your new account:</p>
            <ul style="padding-left: 20px;">
              <li>Manage your communication preferences</li>
              <li>Stay updated with our latest projects and releases</li>
              <li>Access exclusive beta features when available</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/profile" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 12px 24px; 
                        text-decoration: none; 
                        border-radius: 6px; 
                        display: inline-block;">
                Visit Your Profile
              </a>
            </div>
            
            <p>If you have any questions, feel free to reach out to us at 
               <a href="mailto:dre_86@hotmail.co.uk">dre_86@hotmail.co.uk</a>
            </p>
            
            <p>Best regards,<br>The N15 Labs Team</p>
          </div>
        </body>
      </html>
    `;
  }
  
  getMarketingTemplate(templateName, data) {
    const templates = {
      newsletter: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #667eea;">N15 Labs Newsletter</h1>
            <p>Hi ${data.firstName || 'there'},</p>
            <p>Here's what's new at N15 Labs:</p>
            ${data.content || '<p>Latest updates and news...</p>'}
          </body>
        </html>
      `,
      
      product_update: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #667eea;">New Feature Release</h1>
            <p>Hi ${data.firstName || 'there'},</p>
            <p>We've just released some exciting new features:</p>
            ${data.content || '<p>Check out our latest updates...</p>'}
          </body>
        </html>
      `
    };
    
    return templates[templateName] || templates.newsletter;
  }
  
  getAuditReportTemplate(firstName, auditResults) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your Website Audit Report</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Website Audit Report</h1>
            <div style="color: white; font-size: 48px; font-weight: bold; margin-top: 10px;">
              ${auditResults.overallScore}/100
            </div>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">Hi ${firstName}!</h2>
            
            <p>We've completed the audit of <strong>${auditResults.websiteUrl}</strong>. Here's your performance breakdown:</p>
            
            <div style="margin: 20px 0;">
              <h3>Performance Scores:</h3>
              <ul style="list-style: none; padding: 0;">
                <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
                  <strong>Performance:</strong> ${auditResults.scores.performance}/100
                </li>
                <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
                  <strong>SEO:</strong> ${auditResults.scores.seo}/100
                </li>
                <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
                  <strong>Security:</strong> ${auditResults.scores.security}/100
                </li>
                <li style="padding: 8px 0;">
                  <strong>Mobile Friendly:</strong> ${auditResults.scores.mobile}/100
                </li>
              </ul>
            </div>
            
            <h3>Top Recommendations:</h3>
            <ul>
              ${auditResults.recommendations.slice(0, 3).map(rec => 
                `<li style="margin-bottom: 8px;"><strong>${rec.priority}:</strong> ${rec.description}</li>`
              ).join('')}
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/audit?token=${auditResults.viewToken}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 12px 24px; 
                        text-decoration: none; 
                        border-radius: 6px; 
                        display: inline-block;">
                View Full Report
              </a>
            </div>
            
            <p>Want to improve your website's performance? Our team can help optimize your site for better speed, SEO, and user experience.</p>
            
            <p>Best regards,<br>The N15 Labs Team</p>
          </div>
        </body>
      </html>
    `;
  }

  addUnsubscribeFooter(html, unsubscribeUrl) {
    const footer = `
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center;">
        <p>This email was sent because you opted in to receive marketing communications from N15 Labs.</p>
        <p>You can <a href="${unsubscribeUrl}" style="color: #3b82f6; text-decoration: none;">unsubscribe here</a> or update your preferences in your account settings.</p>
        <p>N15 Labs, Stoke-on-Trent, Staffordshire, UK</p>
      </div>
    `;
    
    return html.replace('</body>', `${footer}</body>`);
  }
  
  async logEmailSent({ email, type, template, subject }) {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS email_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL,
          type TEXT NOT NULL,
          template TEXT,
          subject TEXT,
          sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await query(
        `INSERT INTO email_log (email, type, template, subject) VALUES (?, ?, ?, ?)`,
        [email, type, template, subject]
      );
    } catch (error) {
      console.error('Error logging email send:', error);
    }
  }
}

module.exports = new EmailService();