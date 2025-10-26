require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');
const admin = require('firebase-admin');                    // ← ADD THIS
const { Pool } = require('pg');                             // ← ADD THIS (for PostgreSQL)
// OR for MySQL:
// const mysql = require('mysql2/promise');                 // ← ADD THIS (for MySQL)

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// FIREBASE ADMIN INITIALIZATION               ← ADD THIS ENTIRE SECTION
// ============================================
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
  console.log('✓ Firebase Admin initialized');
}

// ============================================
// DATABASE CONNECTION                         ← ADD THIS ENTIRE SECTION
// ============================================
// For PostgreSQL (Railway):
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// OR for MySQL:
// const pool = mysql.createPool({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0
// });

// Test database connection
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✓ Database connected');
  }
});

app.use(helmet());
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'http://localhost:8080',
      'http://localhost:8081',
      'http://localhost:3000',
      'http://127.0.0.1:8080',
      'http://127.0.0.1:8081',
      'https://n15labs.co.uk'
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true
}));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

const auditLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many audit requests from this IP, please try again later.'
});

// ============================================
// AUTHENTICATION MIDDLEWARE                   ← ADD THIS ENTIRE SECTION
// ============================================
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'No authorization token provided' 
      });
    }
    
    const token = authHeader.split('Bearer ')[1];
    
    // Verify the Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    
    console.log('✓ User authenticated:', decodedToken.email);
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid or expired token' 
    });
  }
}

// Helper function for database queries
async function dbQuery(query, params = []) {
  try {
    const result = await pool.query(query, params);
    return result.rows || result; // PostgreSQL returns .rows, MySQL returns result directly
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Your performComprehensiveAudit function starts here...

async function performComprehensiveAudit(url) {
  const audit = {
    performance: {
      score: 0,
      metrics: {},
      issues: []
    },
    seo: {
      score: 0,
      metrics: {},
      issues: []
    },
    security: {
      score: 0,
      metrics: {},
      issues: []
    },
    accessibility: {
      score: 0,
      metrics: {},
      issues: []
    },
    ux: {
      score: 0,
      metrics: {},
      issues: []
    },
    technical: {
      score: 0,
      metrics: {},
      issues: []
    },
    content: {
      score: 0,
      metrics: {},
      issues: []
    },
    mobile: {
      score: 0,
      metrics: {},
      issues: []
    },
    overallScore: 0,
    criticalIssues: [],
    recommendations: []
  };

  let browser;
  
  try {
    const startTime = Date.now();
    
    const htmlResponse = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(htmlResponse.data);
    const loadTime = Date.now() - startTime;
    
    audit.performance.metrics.loadTime = loadTime;
    audit.performance.metrics.htmlSize = htmlResponse.data.length;
    audit.performance.metrics.sizeInMB = (htmlResponse.data.length / 1048576).toFixed(2);
    
    if (loadTime > 3000) {
      audit.performance.issues.push({
        severity: 'high',
        issue: 'Slow page load',
        detail: `Page took ${(loadTime/1000).toFixed(2)}s to load (should be under 3s)`
      });
    }
    
    if (htmlResponse.data.length > 2097152) {
      audit.performance.issues.push({
        severity: 'medium',
        issue: 'Large page size',
        detail: `Page size is ${audit.performance.metrics.sizeInMB}MB (should be under 2MB)`
      });
    }
    
    audit.performance.score = loadTime < 2000 ? 90 : loadTime < 3000 ? 70 : loadTime < 5000 ? 50 : 30;
    
    const title = $('title').text();
    const metaDescription = $('meta[name="description"]').attr('content');
    const h1Tags = $('h1');
    const h2Tags = $('h2');
    const canonicalUrl = $('link[rel="canonical"]').attr('href');
    const ogTags = $('meta[property^="og:"]');
    const metaKeywords = $('meta[name="keywords"]').attr('content');
    const robots = $('meta[name="robots"]').attr('content');
    const viewport = $('meta[name="viewport"]').attr('content');
    
    audit.seo.metrics = {
      hasTitle: !!title,
      titleLength: title ? title.length : 0,
      titleText: title || '',
      hasMetaDescription: !!metaDescription,
      metaDescriptionLength: metaDescription ? metaDescription.length : 0,
      metaDescriptionText: metaDescription || '',
      h1Count: h1Tags.length,
      h2Count: h2Tags.length,
      hasCanonicalUrl: !!canonicalUrl,
      hasOpenGraphTags: ogTags.length > 0,
      ogTagCount: ogTags.length,
      hasKeywords: !!metaKeywords,
      hasRobotsMeta: !!robots,
      hasViewport: !!viewport
    };
    
    if (!title) {
      audit.seo.issues.push({
        severity: 'critical',
        issue: 'Missing page title',
        detail: 'No <title> tag found - essential for SEO'
      });
    } else if (title.length < 30 || title.length > 60) {
      audit.seo.issues.push({
        severity: 'medium',
        issue: 'Title length not optimal',
        detail: `Title is ${title.length} characters (ideal: 30-60)`
      });
    }
    
    if (!metaDescription) {
      audit.seo.issues.push({
        severity: 'high',
        issue: 'Missing meta description',
        detail: 'No meta description tag - critical for search results'
      });
    } else if (metaDescription.length < 120 || metaDescription.length > 160) {
      audit.seo.issues.push({
        severity: 'medium',
        issue: 'Meta description length not optimal',
        detail: `Description is ${metaDescription.length} characters (ideal: 120-160)`
      });
    }
    
    if (h1Tags.length === 0) {
      audit.seo.issues.push({
        severity: 'high',
        issue: 'Missing H1 tag',
        detail: 'No H1 tag found - important for SEO structure'
      });
    } else if (h1Tags.length > 1) {
      audit.seo.issues.push({
        severity: 'medium',
        issue: 'Multiple H1 tags',
        detail: `Found ${h1Tags.length} H1 tags (should have exactly 1)`
      });
    }
    
    if (!canonicalUrl) {
      audit.seo.issues.push({
        severity: 'low',
        issue: 'No canonical URL',
        detail: 'Consider adding canonical URL to prevent duplicate content issues'
      });
    }
    
    if (ogTags.length < 4) {
      audit.seo.issues.push({
        severity: 'low',
        issue: 'Incomplete Open Graph tags',
        detail: 'Add og:title, og:description, og:image, og:url for better social sharing'
      });
    }
    
    let seoScore = 100;
    if (!title) seoScore -= 20;
    if (!metaDescription) seoScore -= 20;
    if (h1Tags.length !== 1) seoScore -= 15;
    if (!canonicalUrl) seoScore -= 5;
    if (ogTags.length < 4) seoScore -= 10;
    audit.seo.score = Math.max(0, seoScore);
    
    const urlObj = new URL(url);
    const isHTTPS = urlObj.protocol === 'https:';
    const hasCSP = !!htmlResponse.headers['content-security-policy'];
    const hasXFrame = !!htmlResponse.headers['x-frame-options'];
    const hasXContent = !!htmlResponse.headers['x-content-type-options'];
    const hasStrictTransport = !!htmlResponse.headers['strict-transport-security'];
    
    audit.security.metrics = {
      hasSSL: isHTTPS,
      hasContentSecurityPolicy: hasCSP,
      hasXFrameOptions: hasXFrame,
      hasXContentTypeOptions: hasXContent,
      hasStrictTransportSecurity: hasStrictTransport
    };
    
    if (!isHTTPS) {
      audit.security.issues.push({
        severity: 'critical',
        issue: 'No HTTPS',
        detail: 'Site not using HTTPS - critical for security and SEO'
      });
    }
    
    if (!hasCSP) {
      audit.security.issues.push({
        severity: 'medium',
        issue: 'Missing Content Security Policy',
        detail: 'No CSP header detected'
      });
    }
    
    if (!hasXFrame) {
      audit.security.issues.push({
        severity: 'medium',
        issue: 'Missing X-Frame-Options',
        detail: 'Site vulnerable to clickjacking attacks'
      });
    }
    
    let securityScore = 100;
    if (!isHTTPS) securityScore -= 40;
    if (!hasCSP) securityScore -= 15;
    if (!hasXFrame) securityScore -= 15;
    if (!hasXContent) securityScore -= 15;
    if (!hasStrictTransport) securityScore -= 15;
    audit.security.score = Math.max(0, securityScore);
    
    const images = $('img');
    const imagesWithAlt = $('img[alt]');
    const imagesWithoutAlt = images.length - imagesWithAlt.length;
    const hasLang = !!$('html').attr('lang');
    const hasAriaLabels = $('[aria-label]').length > 0;
    const buttons = $('button, input[type="submit"], input[type="button"]');
    const links = $('a');
    const linksWithText = $('a').filter(function() {
      return $(this).text().trim().length > 0 || $(this).attr('aria-label');
    });
    
    audit.accessibility.metrics = {
      totalImages: images.length,
      imagesWithAlt: imagesWithAlt.length,
      imagesWithoutAlt: imagesWithoutAlt,
      altTextRatio: images.length > 0 ? (imagesWithAlt.length / images.length) : 1,
      hasLangAttribute: hasLang,
      hasViewportMeta: !!viewport,
      hasAriaLabels: hasAriaLabels,
      totalButtons: buttons.length,
      totalLinks: links.length,
      linksWithText: linksWithText.length
    };
    
    if (imagesWithoutAlt > 0) {
      audit.accessibility.issues.push({
        severity: 'high',
        issue: 'Images missing alt text',
        detail: `${imagesWithoutAlt} images lack alt text for screen readers`
      });
    }
    
    if (!hasLang) {
      audit.accessibility.issues.push({
        severity: 'medium',
        issue: 'Missing language attribute',
        detail: 'HTML tag missing lang attribute'
      });
    }
    
    if (!viewport) {
      audit.accessibility.issues.push({
        severity: 'high',
        issue: 'Missing viewport meta tag',
        detail: 'Essential for mobile responsiveness'
      });
    }
    
    let accessibilityScore = 100;
    if (audit.accessibility.metrics.altTextRatio < 0.9) accessibilityScore -= 30;
    if (!hasLang) accessibilityScore -= 20;
    if (!viewport) accessibilityScore -= 20;
    audit.accessibility.score = Math.max(0, accessibilityScore);
    
    const forms = $('form');
    const inputsWithLabels = $('input[id]').filter(function() {
      const id = $(this).attr('id');
      return $(`label[for="${id}"]`).length > 0;
    });
    const totalInputs = $('input, textarea, select').length;
    const hasFavicon = $('link[rel*="icon"]').length > 0;
    const hasSearchBox = $('input[type="search"], input[placeholder*="search" i]').length > 0;
    const hasContactInfo = $('a[href^="tel:"], a[href^="mailto:"]').length > 0;
    const hasSocialLinks = $('a[href*="facebook.com"], a[href*="twitter.com"], a[href*="instagram.com"], a[href*="linkedin.com"]').length > 0;
    
    audit.ux.metrics = {
      formCount: forms.length,
      inputsWithLabels: inputsWithLabels.length,
      totalInputs: totalInputs,
      labelRatio: totalInputs > 0 ? (inputsWithLabels.length / totalInputs) : 1,
      hasFavicon: hasFavicon,
      hasSearchBox: hasSearchBox,
      hasContactInfo: hasContactInfo,
      hasSocialLinks: hasSocialLinks,
      hasNavigation: $('nav, [role="navigation"]').length > 0,
      hasFooter: $('footer, [role="contentinfo"]').length > 0
    };
    
    if (!hasFavicon) {
      audit.ux.issues.push({
        severity: 'low',
        issue: 'Missing favicon',
        detail: 'Add a favicon for better branding'
      });
    }
    
    if (forms.length > 0 && audit.ux.metrics.labelRatio < 0.8) {
      audit.ux.issues.push({
        severity: 'medium',
        issue: 'Form inputs missing labels',
        detail: 'Some form inputs lack proper labels'
      });
    }
    
    if (!hasContactInfo) {
      audit.ux.issues.push({
        severity: 'medium',
        issue: 'No visible contact information',
        detail: 'Add phone number or email for better trust'
      });
    }
    
    let uxScore = 100;
    if (!hasFavicon) uxScore -= 10;
    if (audit.ux.metrics.labelRatio < 0.8) uxScore -= 20;
    if (!hasContactInfo) uxScore -= 15;
    if (!audit.ux.metrics.hasNavigation) uxScore -= 20;
    audit.ux.score = Math.max(0, uxScore);
    
    const scripts = $('script');
    const stylesheets = $('link[rel="stylesheet"]');
    const inlineStyles = $('*[style]');
    const totalRequests = scripts.length + stylesheets.length;
    
    audit.technical.metrics = {
      scriptCount: scripts.length,
      stylesheetCount: stylesheets.length,
      inlineStyleCount: inlineStyles.length,
      totalRequests: totalRequests,
      hasMinifiedJS: false,
      hasMinifiedCSS: false,
      hasCompression: htmlResponse.headers['content-encoding'] === 'gzip',
      responseTime: loadTime
    };
    
    if (scripts.length > 15) {
      audit.technical.issues.push({
        severity: 'medium',
        issue: 'Too many JavaScript files',
        detail: `${scripts.length} scripts detected (optimize by bundling)`
      });
    }
    
    if (stylesheets.length > 10) {
      audit.technical.issues.push({
        severity: 'medium',
        issue: 'Too many CSS files',
        detail: `${stylesheets.length} stylesheets detected (optimize by bundling)`
      });
    }
    
    if (inlineStyles.length > 20) {
      audit.technical.issues.push({
        severity: 'low',
        issue: 'Excessive inline styles',
        detail: `${inlineStyles.length} elements with inline styles (move to CSS files)`
      });
    }
    
    let techScore = 100;
    if (scripts.length > 15) techScore -= 15;
    if (stylesheets.length > 10) techScore -= 15;
    if (inlineStyles.length > 20) techScore -= 10;
    if (loadTime > 4000) techScore -= 30;
    audit.technical.score = Math.max(0, techScore);
    
    const textContent = $('body').text();
    const wordCount = textContent.split(/\s+/).length;
    const headings = $('h1, h2, h3, h4, h5, h6');
    const paragraphs = $('p');
    const lists = $('ul, ol');
    const hasStructuredData = $('script[type="application/ld+json"]').length > 0;
    
    audit.content.metrics = {
      wordCount: wordCount,
      headingCount: headings.length,
      paragraphCount: paragraphs.length,
      listCount: lists.length,
      hasStructuredData: hasStructuredData,
      contentLength: textContent.length,
      uniqueWords: new Set(textContent.toLowerCase().split(/\s+/)).size
    };
    
    if (wordCount < 300) {
      audit.content.issues.push({
        severity: 'high',
        issue: 'Thin content',
        detail: `Only ${wordCount} words found (aim for 300+ for SEO)`
      });
    }
    
    if (headings.length < 3) {
      audit.content.issues.push({
        severity: 'medium',
        issue: 'Poor content structure',
        detail: 'Add more headings to structure content'
      });
    }
    
    if (!hasStructuredData) {
      audit.content.issues.push({
        severity: 'low',
        issue: 'No structured data',
        detail: 'Add schema markup for better search visibility'
      });
    }
    
    let contentScore = 100;
    if (wordCount < 300) contentScore -= 30;
    if (headings.length < 3) contentScore -= 20;
    if (!hasStructuredData) contentScore -= 10;
    audit.content.score = Math.max(0, contentScore);
    
    audit.mobile.metrics = {
      hasViewport: !!viewport,
      viewportContent: viewport || '',
      hasResponsiveImages: $('img[srcset], picture').length > 0,
      fontSizeReadable: true,
      tappableElementsSpaced: true
    };
    
    if (!viewport) {
      audit.mobile.issues.push({
        severity: 'critical',
        issue: 'Not mobile optimized',
        detail: 'Missing viewport meta tag - site won\'t display properly on mobile'
      });
    }
    
    if (!audit.mobile.metrics.hasResponsiveImages && images.length > 0) {
      audit.mobile.issues.push({
        severity: 'medium',
        issue: 'Non-responsive images',
        detail: 'Images not optimized for different screen sizes'
      });
    }
    
    let mobileScore = 100;
    if (!viewport) mobileScore -= 40;
    if (!audit.mobile.metrics.hasResponsiveImages) mobileScore -= 20;
    audit.mobile.score = Math.max(0, mobileScore);
    
    const scores = [
      audit.performance.score,
      audit.seo.score,
      audit.security.score,
      audit.accessibility.score,
      audit.ux.score,
      audit.technical.score,
      audit.content.score,
      audit.mobile.score
    ];
    
    audit.overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    
    const allIssues = [
      ...audit.performance.issues,
      ...audit.seo.issues,
      ...audit.security.issues,
      ...audit.accessibility.issues,
      ...audit.ux.issues,
      ...audit.technical.issues,
      ...audit.content.issues,
      ...audit.mobile.issues
    ];
    
    audit.criticalIssues = allIssues.filter(i => i.severity === 'critical');
    audit.highPriorityIssues = allIssues.filter(i => i.severity === 'high');
    audit.mediumPriorityIssues = allIssues.filter(i => i.severity === 'medium');
    audit.lowPriorityIssues = allIssues.filter(i => i.severity === 'low');
    
    audit.recommendations = generateDetailedRecommendations(audit);
    
    return audit;
    
  } catch (error) {
    console.error('Audit error:', error);
    throw new Error(`Failed to audit website: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function generateDetailedRecommendations(audit) {
  const recommendations = [];
  
  if (audit.performance.score < 70) {
    recommendations.push({
      category: 'Performance',
      priority: 'Critical',
      title: 'Improve Page Load Speed',
      description: 'Your page load time is affecting user experience and SEO rankings',
      actions: [
        'Optimize and compress images',
        'Minify CSS and JavaScript files',
        'Enable browser caching',
        'Use a Content Delivery Network (CDN)',
        'Reduce server response time'
      ],
      estimatedImpact: 'High',
      estimatedTime: '2-4 hours'
    });
  }
  
  if (!audit.seo.metrics.hasMetaDescription) {
    recommendations.push({
      category: 'SEO',
      priority: 'High',
      title: 'Add Meta Description',
      description: 'Meta descriptions are crucial for search engine visibility',
      actions: [
        'Write a compelling 150-160 character description',
        'Include target keywords naturally',
        'Make it unique for each page'
      ],
      estimatedImpact: 'High',
      estimatedTime: '30 minutes'
    });
  }
  
  if (audit.seo.metrics.h1Count !== 1) {
    recommendations.push({
      category: 'SEO',
      priority: 'Medium',
      title: 'Optimize H1 Tags',
      description: audit.seo.metrics.h1Count === 0 ? 'Missing H1 tag hurts SEO' : 'Multiple H1 tags confuse search engines',
      actions: [
        audit.seo.metrics.h1Count === 0 ? 'Add one clear H1 tag' : 'Use only one H1 tag per page',
        'Make H1 descriptive and keyword-rich',
        'Use H2-H6 for subheadings'
      ],
      estimatedImpact: 'Medium',
      estimatedTime: '20 minutes'
    });
  }
  
  if (!audit.security.metrics.hasSSL) {
    recommendations.push({
      category: 'Security',
      priority: 'Critical',
      title: 'Enable HTTPS',
      description: 'Your site is not secure - this hurts trust and SEO',
      actions: [
        'Install an SSL certificate',
        'Redirect all HTTP traffic to HTTPS',
        'Update internal links to use HTTPS'
      ],
      estimatedImpact: 'Critical',
      estimatedTime: '1-2 hours'
    });
  }
  
  if (audit.accessibility.metrics.imagesWithoutAlt > 0) {
    recommendations.push({
      category: 'Accessibility',
      priority: 'High',
      title: 'Add Alt Text to Images',
      description: `${audit.accessibility.metrics.imagesWithoutAlt} images are missing alt text`,
      actions: [
        'Add descriptive alt text to all images',
        'Keep alt text under 125 characters',
        'Include keywords where relevant'
      ],
      estimatedImpact: 'Medium',
      estimatedTime: '1 hour'
    });
  }
  
  if (audit.content.metrics.wordCount < 300) {
    recommendations.push({
      category: 'Content',
      priority: 'High',
      title: 'Add More Content',
      description: 'Thin content hurts SEO and user engagement',
      actions: [
        'Expand content to at least 300-500 words',
        'Add valuable, relevant information',
        'Include keywords naturally',
        'Break up text with headings and lists'
      ],
      estimatedImpact: 'High',
      estimatedTime: '2-3 hours'
    });
  }
  
  if (!audit.mobile.metrics.hasViewport) {
    recommendations.push({
      category: 'Mobile',
      priority: 'Critical',
      title: 'Make Site Mobile-Friendly',
      description: 'Site is not optimized for mobile devices',
      actions: [
        'Add viewport meta tag',
        'Implement responsive design',
        'Test on multiple devices',
        'Ensure buttons are touch-friendly'
      ],
      estimatedImpact: 'Critical',
      estimatedTime: '4-8 hours'
    });
  }
  
  if (!audit.ux.metrics.hasFavicon) {
    recommendations.push({
      category: 'User Experience',
      priority: 'Low',
      title: 'Add Favicon',
      description: 'Favicon improves brand recognition',
      actions: [
        'Create a 16x16 and 32x32 favicon',
        'Add favicon link tags to HTML head',
        'Consider adding apple-touch-icon for mobile'
      ],
      estimatedImpact: 'Low',
      estimatedTime: '30 minutes'
    });
  }
  
  return recommendations;
}

async function checkWebsiteAccessibility(url) {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    return { accessible: true, statusCode: response.status };
  } catch (error) {
    return { accessible: false, error: error.message };
  }
}

app.post('/api/audit/validate-url', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }
  
  try {
    const urlObj = new URL(url);
    
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return res.json({ 
        success: false, 
        error: 'Invalid protocol. Please use http:// or https://' 
      });
    }
    
    const accessibility = await checkWebsiteAccessibility(url);
    
    if (accessibility.accessible) {
      res.json({ 
        success: true, 
        eligible: true,
        statusCode: accessibility.statusCode
      });
    } else {
      res.json({ 
        success: false, 
        error: 'Website is not accessible',
        details: accessibility.error 
      });
    }
  } catch (error) {
    res.json({ 
      success: false, 
      error: 'Invalid URL format' 
    });
  }
});

app.post('/api/audit/final-eligibility', async (req, res) => {
  const { websiteUrl } = req.body;
  
  if (!websiteUrl) {
    return res.status(400).json({ eligible: false, reason: 'URL is required' });
  }
  
  try {
    const accessibility = await checkWebsiteAccessibility(websiteUrl);
    
    if (!accessibility.accessible) {
      return res.json({ 
        eligible: false, 
        reason: 'Website is not accessible for audit' 
      });
    }
    
    res.json({ eligible: true });
  } catch (error) {
    res.json({ 
      eligible: false, 
      reason: 'Unable to validate website' 
    });
  }
});

app.post('/api/audit/perform', auditLimiter, async (req, res) => {
  const { websiteUrl, businessType, websiteGoals, trafficVolume, technicalLevel, email } = req.body;
  
  if (!websiteUrl || !email) {
    return res.status(400).json({ 
      success: false, 
      error: 'Website URL and email are required' 
    });
  }
  
  try {
    // Generate unique IDs
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const auditResults = await performComprehensiveAudit(websiteUrl);
    
    // Flatten the structure to match frontend expectations
    const fullResults = {
      auditId,           // ADD THIS
      sessionId,         // ADD THIS
      score: auditResults.overallScore || 0,
      overallScore: auditResults.overallScore || 0,
      
      performance: {
        score: auditResults.performance?.score || 0,
        loadTime: auditResults.performance?.metrics?.loadTime || 0,
        htmlSize: auditResults.performance?.metrics?.htmlSize || 0,
        sizeInMB: auditResults.performance?.metrics?.sizeInMB || '0',
        issues: auditResults.performance?.issues || []
      },
      
      seo: {
        score: auditResults.seo?.score || 0,
        hasTitle: auditResults.seo?.metrics?.hasTitle || false,
        titleLength: auditResults.seo?.metrics?.titleLength || 0,
        titleText: auditResults.seo?.metrics?.titleText || '',
        hasMetaDescription: auditResults.seo?.metrics?.hasMetaDescription || false,
        metaDescriptionLength: auditResults.seo?.metrics?.metaDescriptionLength || 0,
        metaDescriptionText: auditResults.seo?.metrics?.metaDescriptionText || '',
        h1Count: auditResults.seo?.metrics?.h1Count || 0,
        h2Count: auditResults.seo?.metrics?.h2Count || 0,
        hasCanonicalUrl: auditResults.seo?.metrics?.hasCanonicalUrl || false,
        hasOpenGraphTags: auditResults.seo?.metrics?.hasOpenGraphTags || false,
        ogTagCount: auditResults.seo?.metrics?.ogTagCount || 0,
        hasKeywords: auditResults.seo?.metrics?.hasKeywords || false,
        hasRobotsMeta: auditResults.seo?.metrics?.hasRobotsMeta || false,
        hasViewport: auditResults.seo?.metrics?.hasViewport || false,
        issues: auditResults.seo?.issues || []
      },
      
      security: {
        score: auditResults.security?.score || 0,
        hasSSL: auditResults.security?.metrics?.hasSSL || false,
        hasContentSecurityPolicy: auditResults.security?.metrics?.hasContentSecurityPolicy || false,
        hasXFrameOptions: auditResults.security?.metrics?.hasXFrameOptions || false,
        hasXContentTypeOptions: auditResults.security?.metrics?.hasXContentTypeOptions || false,
        hasStrictTransportSecurity: auditResults.security?.metrics?.hasStrictTransportSecurity || false,
        issues: auditResults.security?.issues || []
      },
      
      accessibility: {
        score: auditResults.accessibility?.score || 0,
        totalImages: auditResults.accessibility?.metrics?.totalImages || 0,
        imagesWithAlt: auditResults.accessibility?.metrics?.imagesWithAlt || 0,
        imagesWithoutAlt: auditResults.accessibility?.metrics?.imagesWithoutAlt || 0,
        imageAltRatio: auditResults.accessibility?.metrics?.altTextRatio || 0,
        hasLangAttribute: auditResults.accessibility?.metrics?.hasLangAttribute || false,
        hasViewportMeta: auditResults.accessibility?.metrics?.hasViewportMeta || false,
        hasAriaLabels: auditResults.accessibility?.metrics?.hasAriaLabels || false,
        issues: auditResults.accessibility?.issues || []
      },
      
      bestPractices: {
        score: auditResults.ux?.score || 0,
        hasRobotsTxt: auditResults.seo?.metrics?.hasRobotsMeta || false,
        hasSitemap: false,
        hasFavicon: auditResults.ux?.metrics?.hasFavicon || false,
        issues: auditResults.ux?.issues || []
      },
      
      ux: auditResults.ux || { score: 0, metrics: {}, issues: [] },
      technical: auditResults.technical || { score: 0, metrics: {}, issues: [] },
      content: auditResults.content || { score: 0, metrics: {}, issues: [] },
      mobile: auditResults.mobile || { score: 0, metrics: {}, issues: [] },
      
      criticalIssues: auditResults.criticalIssues || [],
      highPriorityIssues: auditResults.highPriorityIssues || [],
      mediumPriorityIssues: auditResults.mediumPriorityIssues || [],
      lowPriorityIssues: auditResults.lowPriorityIssues || [],
      recommendations: auditResults.recommendations || [],
      
      websiteUrl,
      businessType,
      websiteGoals,
      trafficVolume,
      technicalLevel,
      email,
      timestamp: new Date().toISOString()
    };
    
    console.log('Sending audit results:', { auditId, sessionId, score: fullResults.score });
    
    res.json({
      success: true,
      results: fullResults
    });
  } catch (error) {
    console.error('Audit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform audit',
      details: error.message
    });
  }
});

app.post('/api/audit/analyze', async (req, res) => {
  const { websiteUrl, email, businessType } = req.body;
  
  if (!websiteUrl) {
    return res.status(400).json({ 
      success: false, 
      error: 'Website URL is required' 
    });
  }
  
  try {
    // Generate unique IDs
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const auditResults = await performComprehensiveAudit(websiteUrl);
    
    // Flatten the structure to match frontend expectations
    const fullResults = {
      auditId,           // ADD THIS
      sessionId,         // ADD THIS
      score: auditResults.overallScore || 0,
      overallScore: auditResults.overallScore || 0,
      
      performance: {
        score: auditResults.performance?.score || 0,
        loadTime: auditResults.performance?.metrics?.loadTime || 0,
        htmlSize: auditResults.performance?.metrics?.htmlSize || 0,
        sizeInMB: auditResults.performance?.metrics?.sizeInMB || '0',
        issues: auditResults.performance?.issues || []
      },
      
      seo: {
        score: auditResults.seo?.score || 0,
        hasTitle: auditResults.seo?.metrics?.hasTitle || false,
        titleLength: auditResults.seo?.metrics?.titleLength || 0,
        titleText: auditResults.seo?.metrics?.titleText || '',
        hasMetaDescription: auditResults.seo?.metrics?.hasMetaDescription || false,
        metaDescriptionLength: auditResults.seo?.metrics?.metaDescriptionLength || 0,
        metaDescriptionText: auditResults.seo?.metrics?.metaDescriptionText || '',
        h1Count: auditResults.seo?.metrics?.h1Count || 0,
        h2Count: auditResults.seo?.metrics?.h2Count || 0,
        hasCanonicalUrl: auditResults.seo?.metrics?.hasCanonicalUrl || false,
        hasOpenGraphTags: auditResults.seo?.metrics?.hasOpenGraphTags || false,
        ogTagCount: auditResults.seo?.metrics?.ogTagCount || 0,
        hasKeywords: auditResults.seo?.metrics?.hasKeywords || false,
        hasRobotsMeta: auditResults.seo?.metrics?.hasRobotsMeta || false,
        hasViewport: auditResults.seo?.metrics?.hasViewport || false,
        issues: auditResults.seo?.issues || []
      },
      
      security: {
        score: auditResults.security?.score || 0,
        hasSSL: auditResults.security?.metrics?.hasSSL || false,
        hasContentSecurityPolicy: auditResults.security?.metrics?.hasContentSecurityPolicy || false,
        hasXFrameOptions: auditResults.security?.metrics?.hasXFrameOptions || false,
        hasXContentTypeOptions: auditResults.security?.metrics?.hasXContentTypeOptions || false,
        hasStrictTransportSecurity: auditResults.security?.metrics?.hasStrictTransportSecurity || false,
        issues: auditResults.security?.issues || []
      },
      
      accessibility: {
        score: auditResults.accessibility?.score || 0,
        totalImages: auditResults.accessibility?.metrics?.totalImages || 0,
        imagesWithAlt: auditResults.accessibility?.metrics?.imagesWithAlt || 0,
        imagesWithoutAlt: auditResults.accessibility?.metrics?.imagesWithoutAlt || 0,
        imageAltRatio: auditResults.accessibility?.metrics?.altTextRatio || 0,
        hasLangAttribute: auditResults.accessibility?.metrics?.hasLangAttribute || false,
        hasViewportMeta: auditResults.accessibility?.metrics?.hasViewportMeta || false,
        hasAriaLabels: auditResults.accessibility?.metrics?.hasAriaLabels || false,
        issues: auditResults.accessibility?.issues || []
      },
      
      bestPractices: {
        score: auditResults.ux?.score || 0,
        hasRobotsTxt: auditResults.seo?.metrics?.hasRobotsMeta || false,
        hasSitemap: false,
        hasFavicon: auditResults.ux?.metrics?.hasFavicon || false,
        issues: auditResults.ux?.issues || []
      },
      
      ux: auditResults.ux || { score: 0, metrics: {}, issues: [] },
      technical: auditResults.technical || { score: 0, metrics: {}, issues: [] },
      content: auditResults.content || { score: 0, metrics: {}, issues: [] },
      mobile: auditResults.mobile || { score: 0, metrics: {}, issues: [] },
      
      criticalIssues: auditResults.criticalIssues || [],
      highPriorityIssues: auditResults.highPriorityIssues || [],
      mediumPriorityIssues: auditResults.mediumPriorityIssues || [],
      lowPriorityIssues: auditResults.lowPriorityIssues || [],
      recommendations: auditResults.recommendations || [],
      
      websiteUrl,
      businessType,
      email,
      timestamp: new Date().toISOString()
    };
    
    console.log('Sending audit results:', { auditId, sessionId, score: fullResults.score });
    
    res.json({
      success: true,
      results: fullResults
    });
  } catch (error) {
    console.error('Audit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform audit',
      details: error.message
    });
  }
});

// ============= ADD THESE THREE NEW ROUTES =============

// Route 1: Track capture view
app.post('/api/audit/track-capture-view', async (req, res) => {
  const { auditId, sessionId } = req.body;
  console.log('Capture view tracked:', { auditId, sessionId, timestamp: new Date().toISOString() });
  res.json({ success: true });
});

// Route 2: Check if email exists
app.post('/api/audit/check-email', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ 
      success: false, 
      error: 'Email is required' 
    });
  }
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValid = emailRegex.test(email);
  
  // For now, always return that email doesn't exist (not registered)
  // In production, you'd check against your database
  res.json({ 
    success: true,
    exists: false,  // Change to true if email found in DB
    isValid: isValid
  });
});

// Route 3: Capture anonymous user
app.post('/api/audit/capture-anonymous', async (req, res) => {
  const { auditId, sessionId, timestamp } = req.body;
  
  console.log('Anonymous capture:', { 
    auditId, 
    sessionId, 
    timestamp: timestamp || new Date().toISOString() 
  });
  
  // Generate anonymous user ID
  const anonymousUserId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  res.json({ 
    success: true,
    userId: anonymousUserId,
    message: 'Anonymous user captured successfully'
  });
});

// Route 4: Track visit
app.post('/api/audit/track-visit', async (req, res) => {
  const { page, timestamp, sessionId, referrer } = req.body;
  
  console.log('Visit tracked:', { 
    page, 
    sessionId, 
    referrer,
    timestamp: timestamp || new Date().toISOString() 
  });
  
  res.json({ 
    success: true,
    message: 'Visit tracked successfully'
  });
});

// Route 5: Capture email (different from check-email)
app.post('/api/audit/capture', async (req, res) => {
  const { email, auditId, sessionId, timestamp } = req.body;
  
  if (!email) {
    return res.status(400).json({ 
      success: false, 
      error: 'Email is required' 
    });
  }
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValid = emailRegex.test(email);
  
  if (!isValid) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid email format' 
    });
  }
  
  console.log('Email captured:', { 
    email, 
    auditId, 
    sessionId,
    timestamp: timestamp || new Date().toISOString() 
  });
  
  // Generate user ID (in production, save to database)
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  res.json({ 
    success: true,
    userId: userId,
    message: 'Email captured successfully',
    email: email
  });
});

app.post('/api/analytics/track', async (req, res) => {
  console.log('Analytics event:', req.body);
  res.json({ success: true });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!' });
});

// ============================================
// USER AUTHENTICATION ENDPOINTS               ← ADD ALL OF THIS
// ============================================

// GET /user/profile - Get user profile (CRITICAL - THIS FIXES THE 404)
app.get('/user/profile', authenticateToken, async (req, res) => {
  try {
    const firebaseUid = req.user.uid;
    const email = req.user.email;
    
    console.log('Fetching profile for:', email);
    
    // Query user from database
    const userResult = await dbQuery(
      'SELECT id, email, first_name, last_name, created_at, updated_at, is_beta_user, last_login FROM users WHERE firebase_uid = $1',
      [firebaseUid]
    );
    
    if (!userResult || userResult.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found in database' 
      });
    }
    
    const user = userResult[0];
    
    // Update last login
    await dbQuery(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );
    
    // Get user consents
    const consentsResult = await dbQuery(
      'SELECT consent_type, is_granted FROM user_consents WHERE user_id = $1',
      [user.id]
    );
    
    // Format consents
    const consents = {
      necessary: true,
      analytics: false,
      marketing: false
    };
    
    consentsResult.forEach(consent => {
      consents[consent.consent_type] = consent.is_granted;
    });
    
    console.log('✓ Profile fetched successfully for user:', user.id);
    
    // Return user profile
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLogin: user.last_login,
        isBetaUser: user.is_beta_user,
        isAdmin: user.is_admin
      },
      consents: consents
    });
    
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message
    });
  }
});

// POST /auth/complete-registration - Complete user registration
app.post('/auth/complete-registration', authenticateToken, async (req, res) => {
  try {
    const firebaseUid = req.user.uid;
    const email = req.user.email;
    const { firstName, lastName, marketingConsent } = req.body;
    
    console.log('Completing registration for:', email);
    
    // Check if user already exists
    const existingUser = await dbQuery(
      'SELECT id FROM users WHERE firebase_uid = $1 OR email = $2',
      [firebaseUid, email]
    );
    
    if (existingUser && existingUser.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'User already exists' 
      });
    }
    
    // Insert new user
    const insertResult = await dbQuery(
      `INSERT INTO users (firebase_uid, email, first_name, last_name, is_beta_user, created_at, updated_at, last_login) 
       VALUES ($1, $2, $3, $4, true, NOW(), NOW(), NOW()) 
       RETURNING id, email, first_name, last_name, created_at, is_beta_user`,
      [firebaseUid, email, firstName, lastName]
    );
    
    const newUser = insertResult[0];
    
    // Save consent preferences
    await dbQuery(
      `INSERT INTO user_consents (user_id, consent_type, is_granted, granted_at) 
       VALUES 
       ($1, 'necessary', true, NOW()),
       ($2, 'analytics', true, NOW()),
       ($3, 'marketing', $4, NOW())`,
      [newUser.id, newUser.id, newUser.id, marketingConsent]
    );
    
    console.log('✓ User registered successfully:', newUser.id);
    
    res.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        createdAt: newUser.created_at,
        isBetaUser: true,
      },
      consents: {
        necessary: true,
        analytics: true,
        marketing: marketingConsent
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Registration failed on server',
      details: error.message
    });
  }
});

// POST /consent/update - Update user consent preferences
app.post('/consent/update', authenticateToken, async (req, res) => {
  try {
    const firebaseUid = req.user.uid;
    const { analytics, marketing } = req.body;
    
    // Get user ID
    const userResult = await dbQuery(
      'SELECT id FROM users WHERE firebase_uid = $1',
      [firebaseUid]
    );
    
    if (!userResult || userResult.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    const userId = userResult[0].id;
    
    // Update analytics consent
    await dbQuery(
      `UPDATE user_consents 
       SET is_granted = $1, granted_at = NOW() 
       WHERE user_id = $2 AND consent_type = 'analytics'`,
      [analytics, userId]
    );
    
    // Update marketing consent
    await dbQuery(
      `UPDATE user_consents 
       SET is_granted = $1, granted_at = NOW() 
       WHERE user_id = $2 AND consent_type = 'marketing'`,
      [marketing, userId]
    );
    
    console.log('✓ Consents updated for user:', userId);
    
    res.json({ 
      success: true,
      message: 'Consent preferences updated'
    });
    
  } catch (error) {
    console.error('Error updating consent:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update consent',
      details: error.message
    });
  }
});

// POST /audit/capture-existing-user - Link audit to logged-in user
app.post('/audit/capture-existing-user', authenticateToken, async (req, res) => {
  try {
    const firebaseUid = req.user.uid;
    const { auditId } = req.body;
    
    // Get user ID
    const userResult = await dbQuery(
      'SELECT id FROM users WHERE firebase_uid = $1',
      [firebaseUid]
    );
    
    if (!userResult || userResult.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    const userId = userResult[0].id;
    
    // Update audit to associate with user (if you have an audits table)
    // await dbQuery(
    //   'UPDATE audits SET user_id = $1, updated_at = NOW() WHERE id = $2',
    //   [userId, auditId]
    // );
    
    console.log('✓ Audit captured for user:', userId, 'Audit ID:', auditId);
    
    res.json({ 
      success: true,
      message: 'Audit captured for user'
    });
    
  } catch (error) {
    console.error('Error capturing audit:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to capture audit',
      details: error.message
    });
  }
});

// ============================================
// AUTHENTICATION ENDPOINTS (FIXED PATHS)
// ============================================

// GET /api/health - Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    firebase: !!admin.apps.length,
    database: 'connected'
  });
});

// GET /api/user/profile - Get user profile (FIXED PATH!)
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const firebaseUid = req.user.uid;
    const email = req.user.email;
    
    console.log('Fetching profile for:', email);
    
    const userResult = await dbQuery(
      'SELECT id, email, first_name, last_name, created_at, updated_at, is_beta_user, is_admin, last_login FROM users WHERE firebase_uid = $1',
      [firebaseUid]
    );
    
    if (!userResult || userResult.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found in database' 
      });
    }
    
    const user = userResult[0];
    
    await dbQuery('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    
    const consentsResult = await dbQuery(
      'SELECT consent_type, is_granted FROM user_consents WHERE user_id = $1',
      [user.id]
    );
    
    const consents = { necessary: true, analytics: false, marketing: false };
    consentsResult.forEach(consent => {
      consents[consent.consent_type] = consent.is_granted;
    });
    
    console.log('✓ Profile fetched successfully for user:', user.id);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLogin: user.last_login,
        isBetaUser: user.is_beta_user,
        isAdmin: user.is_admin
      },
      consents: consents
    });
    
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
  }
});

// POST /api/auth/complete-registration
app.post('/api/auth/complete-registration', authenticateToken, async (req, res) => {
  try {
    const firebaseUid = req.user.uid;
    const email = req.user.email;
    const { firstName, lastName, marketingConsent } = req.body;
    
    console.log('Completing registration for:', email);
    
    const existingUser = await dbQuery(
      'SELECT id FROM users WHERE firebase_uid = $1 OR email = $2',
      [firebaseUid, email]
    );
    
    if (existingUser && existingUser.length > 0) {
      return res.status(400).json({ success: false, error: 'User already exists' });
    }
    
    const insertResult = await dbQuery(
      `INSERT INTO users (firebase_uid, email, first_name, last_name, is_beta_user, created_at, updated_at, last_login) 
       VALUES ($1, $2, $3, $4, true, NOW(), NOW(), NOW()) 
       RETURNING id, email, first_name, last_name, created_at, is_beta_user`,
      [firebaseUid, email, firstName, lastName]
    );
    
    const newUser = insertResult[0];
    
    await dbQuery(
      `INSERT INTO user_consents (user_id, consent_type, is_granted, granted_at) 
       VALUES ($1, 'necessary', true, NOW()), ($2, 'analytics', true, NOW()), ($3, 'marketing', $4, NOW())`,
      [newUser.id, newUser.id, newUser.id, marketingConsent]
    );
    
    console.log('✓ User registered successfully:', newUser.id);
    
    res.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        createdAt: newUser.created_at,
        isBetaUser: true
      },
      consents: { necessary: true, analytics: true, marketing: marketingConsent }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Registration failed on server', details: error.message });
  }
});

// POST /api/consent/update
app.post('/api/consent/update', authenticateToken, async (req, res) => {
  try {
    const firebaseUid = req.user.uid;
    const { analytics, marketing } = req.body;
    
    const userResult = await dbQuery('SELECT id FROM users WHERE firebase_uid = $1', [firebaseUid]);
    
    if (!userResult || userResult.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const userId = userResult[0].id;
    
    await dbQuery(
      `UPDATE user_consents SET is_granted = $1, granted_at = NOW() WHERE user_id = $2 AND consent_type = 'analytics'`,
      [analytics, userId]
    );
    
    await dbQuery(
      `UPDATE user_consents SET is_granted = $1, granted_at = NOW() WHERE user_id = $2 AND consent_type = 'marketing'`,
      [marketing, userId]
    );
    
    console.log('✓ Consents updated for user:', userId);
    res.json({ success: true, message: 'Consent preferences updated' });
    
  } catch (error) {
    console.error('Error updating consent:', error);
    res.status(500).json({ success: false, error: 'Failed to update consent', details: error.message });
  }
});

// POST /api/audit/capture-existing-user
app.post('/api/audit/capture-existing-user', authenticateToken, async (req, res) => {
  try {
    const firebaseUid = req.user.uid;
    const { auditId } = req.body;
    
    const userResult = await dbQuery('SELECT id FROM users WHERE firebase_uid = $1', [firebaseUid]);
    
    if (!userResult || userResult.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const userId = userResult[0].id;
    console.log('✓ Audit captured for user:', userId, 'Audit ID:', auditId);
    res.json({ success: true, message: 'Audit captured for user' });
    
  } catch (error) {
    console.error('Error capturing audit:', error);
    res.status(500).json({ success: false, error: 'Failed to capture audit', details: error.message });
  }
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

// GET /api/admin/stats - Get admin dashboard statistics
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get total users
    const totalUsersResult = await dbQuery('SELECT COUNT(*) as count FROM users');
    const totalUsers = parseInt(totalUsersResult[0].count);
    
    // Get users with marketing consent
    const marketingConsentResult = await dbQuery(`
      SELECT COUNT(DISTINCT uc.user_id) as count 
      FROM user_consents uc 
      WHERE uc.consent_type = 'marketing' AND uc.is_granted = true
    `);
    const marketingConsent = parseInt(marketingConsentResult[0].count);
    
    // Get total emails sent
    const emailsSentResult = await dbQuery('SELECT COUNT(*) as count FROM email_logs');
    const emailsSent = parseInt(emailsSentResult[0].count);
    
    // Get suppressed emails (you can implement this based on your email suppression logic)
    const suppressedEmails = 0; // Placeholder - implement based on your needs
    
    // Get total audits (placeholder - implement if you have an audits table)
    const totalAudits = 0;
    
    // Get audit captures (placeholder - implement if you have audit captures tracked)
    const auditCaptures = 0;
    
    console.log('✓ Admin stats fetched successfully');
    
    res.json({
      success: true,
      stats: {
        totalUsers,
        marketingConsent,
        emailsSent,
        suppressedEmails,
        totalAudits,
        auditCaptures
      }
    });
    
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch stats',
      details: error.message 
    });
  }
});

// GET /api/admin/users - Get all users
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get all users with their consent information
    const usersResult = await dbQuery(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.email_verified, 
        u.created_at,
        u.is_admin,
        COALESCE(
          (SELECT is_granted FROM user_consents 
          WHERE user_id = u.id AND consent_type = 'marketing' 
          LIMIT 1), 
          false
        ) as marketing_consent
      FROM users u
      ORDER BY u.created_at DESC
    `);
    
    console.log(`✓ Fetched ${usersResult.length} users for admin`);
    
    res.json({
      success: true,
      users: usersResult
    });
    
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch users',
      details: error.message 
    });
  }
});

// GET /api/emails/log - Get email logs
app.get('/api/emails/log', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get the last 100 email logs
    const logsResult = await dbQuery(`
      SELECT 
        id,
        email,
        type,
        template,
        subject,
        sent_at,
        status,
        error_message
      FROM email_logs
      ORDER BY sent_at DESC
      LIMIT 100
    `);
    
    console.log(`✓ Fetched ${logsResult.length} email logs`);
    
    res.json({
      success: true,
      logs: logsResult
    });
    
  } catch (error) {
    console.error('Error fetching email logs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch email logs',
      details: error.message 
    });
  }
});

// POST /api/emails/marketing/send - Send marketing campaign
app.post('/api/emails/marketing/send', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { subject, template, content } = req.body;
      
      if (!subject || !content) {
        return res.status(400).json({ 
          success: false, 
          error: 'Subject and content are required' 
        });
      }
    
    // Get users with marketing consent
    const recipientsResult = await dbQuery(`
      SELECT u.email, u.first_name, u.last_name
      FROM users u
      INNER JOIN user_consents uc ON u.id = uc.user_id
      WHERE uc.consent_type = 'marketing' 
        AND uc.is_granted = true
        AND u.email_verified = true
    `);
    
    if (recipientsResult.length === 0) {
      return res.json({
        success: true,
        message: 'No recipients with marketing consent found',
        sent: 0,
        failed: 0
      });
    }
    
    console.log(`📧 Sending campaign to ${recipientsResult.length} recipients...`);
    
    let sent = 0;
    let failed = 0;
    
    // Send emails (implement your email sending logic here)
    // For now, we'll just log them to the database
    for (const recipient of recipientsResult) {
      try {
        // TODO: Implement actual email sending using nodemailer or your email service
        // const emailSent = await sendEmail({
        //   to: recipient.email,
        //   subject: subject,
        //   template: template,
        //   content: content
        // });
        
        // Log the email
        await dbQuery(`
          INSERT INTO email_logs (email, type, template, subject, content, sent_at, status)
          VALUES ($1, $2, $3, $4, $5, NOW(), $6)
        `, [recipient.email, 'marketing', template, subject, content, 'sent']);
        
        sent++;
        
      } catch (emailError) {
        console.error(`Failed to send to ${recipient.email}:`, emailError.message);
        
        // Log the failed email
        await dbQuery(`
          INSERT INTO email_logs (email, type, template, subject, content, sent_at, status, error_message)
          VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
        `, [recipient.email, 'marketing', template, subject, content, 'failed', emailError.message]);
        
        failed++;
      }
    }
    
    console.log(`✓ Campaign sent: ${sent} succeeded, ${failed} failed`);
    
    res.json({
      success: true,
      message: 'Campaign sent',
      sent,
      failed,
      total: recipientsResult.length
    });
    
  } catch (error) {
    console.error('Error sending campaign:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send campaign',
      details: error.message 
    });
  }
});


async function requireAdmin(req, res, next) {
  try {
    const firebaseUid = req.user.uid;
    
    // Get user from database
    const userResult = await dbQuery(
      'SELECT id, email, is_admin FROM users WHERE firebase_uid = $1',
      [firebaseUid]
    );
    
    if (!userResult || userResult.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    const user = userResult[0];
    
    // Check if user is admin
    if (!user.is_admin) {
      console.log(`❌ Admin access denied for user: ${user.email}`);
      return res.status(403).json({ 
        success: false, 
        error: 'Admin access required' 
      });
    }
    
    console.log(`✓ Admin access granted to: ${user.email}`);
    req.dbUser = user; // Attach user to request for later use
    next();
    
  } catch (error) {
    console.error('Admin middleware error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}

// ============================================
// ADMIN ENDPOINTS
// ============================================

// GET /api/admin/stats - Get admin dashboard statistics
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get total users
    const totalUsersResult = await dbQuery('SELECT COUNT(*) as count FROM users');
    const totalUsers = parseInt(totalUsersResult[0].count);
    
    // Get users with marketing consent
    const marketingConsentResult = await dbQuery(`
      SELECT COUNT(DISTINCT uc.user_id) as count 
      FROM user_consents uc 
      WHERE uc.consent_type = 'marketing' AND uc.is_granted = true
    `);
    const marketingConsent = parseInt(marketingConsentResult[0].count);
    
    // Get total emails sent
    const emailsSentResult = await dbQuery('SELECT COUNT(*) as count FROM email_logs');
    const emailsSent = parseInt(emailsSentResult[0].count);
    
    // Get suppressed emails (you can implement this based on your email suppression logic)
    const suppressedEmails = 0; // Placeholder - implement based on your needs
    
    // Get total audits (placeholder - implement if you have an audits table)
    const totalAudits = 0;
    
    // Get audit captures (placeholder - implement if you have audit captures tracked)
    const auditCaptures = 0;
    
    console.log('✓ Admin stats fetched successfully');
    
    res.json({
      success: true,
      stats: {
        totalUsers,
        marketingConsent,
        emailsSent,
        suppressedEmails,
        totalAudits,
        auditCaptures
      }
    });
    
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch stats',
      details: error.message 
    });
  }
});

// GET /api/admin/users - Get all users
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get all users with their consent information
    const usersResult = await dbQuery(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.email_verified,
        u.created_at,
        u.is_admin,
        COALESCE(
          (SELECT is_granted FROM user_consents 
           WHERE user_id = u.id AND consent_type = 'marketing' 
           LIMIT 1), 
          false
        ) as marketing_consent
      FROM users u
      ORDER BY u.created_at DESC
    `);
    
    console.log(`✓ Fetched ${usersResult.length} users for admin`);
    
    res.json({
      success: true,
      users: usersResult
    });
    
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch users',
      details: error.message 
    });
  }
});

// GET /api/emails/log - Get email logs
app.get('/api/emails/log', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get the last 100 email logs
    const logsResult = await dbQuery(`
      SELECT 
        id,
        email,
        type,
        template,
        subject,
        sent_at,
        status,
        error_message
      FROM email_logs
      ORDER BY sent_at DESC
      LIMIT 100
    `);
    
    console.log(`✓ Fetched ${logsResult.length} email logs`);
    
    res.json({
      success: true,
      logs: logsResult
    });
    
  } catch (error) {
    console.error('Error fetching email logs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch email logs',
      details: error.message 
    });
  }
});

// POST /api/emails/marketing/send - Send marketing campaign
app.post('/api/emails/marketing/send', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { subject, template, content } = req.body;
    
    if (!subject || !content) {
      return res.status(400).json({ 
        success: false, 
        error: 'Subject and content are required' 
      });
    }
    
    // Get users with marketing consent
    const recipientsResult = await dbQuery(`
      SELECT u.email, u.first_name, u.last_name
      FROM users u
      INNER JOIN user_consents uc ON u.id = uc.user_id
      WHERE uc.consent_type = 'marketing' 
        AND uc.is_granted = true
        AND u.email_verified = true
    `);
    
    if (recipientsResult.length === 0) {
      return res.json({
        success: true,
        message: 'No recipients with marketing consent found',
        sent: 0,
        failed: 0
      });
    }
    
    console.log(`📧 Sending campaign to ${recipientsResult.length} recipients...`);
    
    let sent = 0;
    let failed = 0;
    
    // Send emails (implement your email sending logic here)
    // For now, we'll just log them to the database
    for (const recipient of recipientsResult) {
      try {
        // TODO: Implement actual email sending using nodemailer or your email service
        // const emailSent = await sendEmail({
        //   to: recipient.email,
        //   subject: subject,
        //   template: template,
        //   content: content
        // });
        
        // Log the email
        await dbQuery(`
          INSERT INTO email_logs (email, type, template, subject, content, sent_at, status)
          VALUES ($1, $2, $3, $4, $5, NOW(), $6)
        `, [recipient.email, 'marketing', template, subject, content, 'sent']);
        
        sent++;
        
      } catch (emailError) {
        console.error(`Failed to send to ${recipient.email}:`, emailError.message);
        
        // Log the failed email
        await dbQuery(`
          INSERT INTO email_logs (email, type, template, subject, content, sent_at, status, error_message)
          VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
        `, [recipient.email, 'marketing', template, subject, content, 'failed', emailError.message]);
        
        failed++;
      }
    }
    
    console.log(`✓ Campaign sent: ${sent} succeeded, ${failed} failed`);
    
    res.json({
      success: true,
      message: 'Campaign sent',
      sent,
      failed,
      total: recipientsResult.length
    });
    
  } catch (error) {
    console.error('Error sending campaign:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send campaign',
      details: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`✓ Audit server running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
});