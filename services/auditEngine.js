const https = require('https');
const http = require('http');
const url = require('url');
const { JSDOM } = require('jsdom');

class AuditEngine {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (compatible; N15Labs-AuditBot/1.0; +https://n15labs.com)';
    this.timeout = 30000; 
    this.maxRedirects = 5;
    this.redirectCount = 0;
  }

  async auditWebsite(websiteUrl, options = {}) {
    try {
      console.log(`Starting audit for: ${websiteUrl}`);
      
      const startTime = Date.now();
      const auditResults = {
        websiteUrl,
        timestamp: new Date().toISOString(),
        scores: {},
        issues: [],
        recommendations: [],
        quickWins: [],
        mediumTermGoals: [],
        longTermGoals: [],
        overallScore: 0
      };

      const fetchResult = await this.fetchWebsite(websiteUrl);
      if (!fetchResult.success) {
        throw new Error(fetchResult.error);
      }

      const { content, headers, loadTime, finalUrl } = fetchResult;
      auditResults.loadTime = loadTime;
      auditResults.finalUrl = finalUrl;

      const dom = new JSDOM(content);
      const document = dom.window.document;

      const checks = await Promise.all([
        this.checkPerformance(websiteUrl, content, headers, loadTime),
        this.checkSEO(document, content, finalUrl),
        this.checkSecurity(finalUrl, headers),
        this.checkMobile(document, content),
        this.checkAccessibility(document),
        this.checkBestPractices(document, headers, content)
      ]);

      auditResults.scores.performance = checks[0].score;
      auditResults.scores.seo = checks[1].score;
      auditResults.scores.security = checks[2].score;
      auditResults.scores.mobile = checks[3].score;
      auditResults.scores.accessibility = checks[4].score;
      auditResults.scores.bestPractices = checks[5].score;

      checks.forEach(check => {
        auditResults.issues.push(...check.issues);
        auditResults.recommendations.push(...check.recommendations);
      });

      const weights = {
        performance: 0.25,
        seo: 0.25,
        security: 0.20,
        mobile: 0.15,
        accessibility: 0.10,
        bestPractices: 0.05
      };

      auditResults.overallScore = Math.round(
        Object.keys(weights).reduce((total, category) => {
          return total + (auditResults.scores[category] * weights[category]);
        }, 0)
      );

      this.generateActionItems(auditResults, options);

      if (options.businessType) {
        auditResults.competitive = this.generateCompetitiveAnalysis(
          auditResults.overallScore, 
          options.businessType
        );
      }

      const endTime = Date.now();
      auditResults.auditDuration = endTime - startTime;

      console.log(`Audit completed in ${auditResults.auditDuration}ms. Overall score: ${auditResults.overallScore}`);
      
      return auditResults;

    } catch (error) {
      console.error('Audit engine error:', error);
      throw new Error(`Audit failed: ${error.message}`);
    }
  }

  async fetchWebsite(websiteUrl) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let parsedUrl;
      
      try {
        parsedUrl = url.parse(websiteUrl);
      } catch (error) {
        return resolve({
          success: false,
          error: 'Invalid URL format'
        });
      }

      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.path || '/',
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'identity', 
          'Connection': 'close',
          'Cache-Control': 'no-cache'
        },
        timeout: this.timeout
      };

      const req = client.request(options, (res) => {
        let data = '';
        const loadTime = Date.now() - startTime;

        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (this.redirectCount < this.maxRedirects) {
            this.redirectCount++;
            const redirectUrl = res.headers.location.startsWith('http') 
              ? res.headers.location 
              : url.resolve(websiteUrl, res.headers.location);
            return this.fetchWebsite(redirectUrl).then(resolve);
          } else {
            return resolve({
              success: false,
              error: 'Too many redirects - the website may have a redirect loop'
            });
          }
        }

        this.redirectCount = 0;

        if (res.statusCode === 403) {
          return resolve({
            success: false,
            error: 'Access denied - the website blocks automated requests'
          });
        }

        if (res.statusCode === 404) {
          return resolve({
            success: false,
            error: 'Page not found - please check the URL is correct'
          });
        }

        if (res.statusCode >= 500) {
          return resolve({
            success: false,
            error: 'Server error - the website is experiencing technical difficulties'
          });
        }

        if (res.statusCode < 200 || res.statusCode >= 400) {
          return resolve({
            success: false,
            error: `Unable to access website (HTTP ${res.statusCode})`
          });
        }

        res.setEncoding('utf8');
        
        res.on('data', chunk => {
          data += chunk;
          if (data.length > 5 * 1024 * 1024) { 
            req.destroy();
            resolve({
              success: false,
              error: 'Website content is too large to analyze'
            });
          }
        });

        res.on('end', () => {
          resolve({
            success: true,
            content: data,
            headers: res.headers,
            loadTime,
            finalUrl: websiteUrl,
            statusCode: res.statusCode
          });
        });
      });

      req.on('error', (error) => {
        this.redirectCount = 0;
        let errorMessage = 'Unable to connect to website';
        
        if (error.code === 'ENOTFOUND') {
          errorMessage = 'Website not found - please check the domain name is correct';
        } else if (error.code === 'ECONNREFUSED') {
          errorMessage = 'Connection refused - the website may be down';
        } else if (error.code === 'ECONNRESET') {
          errorMessage = 'Connection was reset - the website may be blocking requests';
        } else if (error.code === 'ETIMEDOUT') {
          errorMessage = 'Connection timed out - the website is taking too long to respond';
        }
        
        resolve({
          success: false,
          error: errorMessage
        });
      });

      req.on('timeout', () => {
        req.destroy();
        this.redirectCount = 0;
        resolve({
          success: false,
          error: 'Website took too long to respond - please try again later'
        });
      });

      req.end();
    });
  }

  async checkPerformance(websiteUrl, content, headers, loadTime) {
    const issues = [];
    const recommendations = [];
    let score = 100;

    if (loadTime > 3000) {
      score -= 30;
      issues.push({
        id: 'slow-load-time',
        category: 'performance',
        priority: 'high',
        description: `Your website loads in ${(loadTime/1000).toFixed(2)} seconds, which may frustrate visitors`
      });
      recommendations.push({
        title: 'Speed Up Your Website',
        description: 'Slow loading times hurt both user experience and search rankings. Most visitors expect pages to load in under 3 seconds.',
        priority: 'high',
        impact: 9,
        difficulty: 'medium',
        estimatedTime: '2-4 hours',
        steps: [
          'Compress and optimize your images',
          'Minify your CSS and JavaScript files',
          'Enable browser caching on your server',
          'Consider using a Content Delivery Network (CDN)'
        ]
      });
    } else if (loadTime > 1500) {
      score -= 15;
      issues.push({
        id: 'moderate-load-time',
        category: 'performance',
        priority: 'medium',
        description: `Your website loads in ${(loadTime/1000).toFixed(2)} seconds - there's room for improvement`
      });
    }

    const contentSize = Buffer.byteLength(content, 'utf8');
    if (contentSize > 1024 * 1024) { 
      score -= 20;
      issues.push({
        id: 'large-page-size',
        category: 'performance',
        priority: 'medium',
        description: `Your page is ${(contentSize/1024/1024).toFixed(2)}MB, which may slow down loading on mobile connections`
      });
      recommendations.push({
        title: 'Reduce Page Weight',
        description: 'Large pages take longer to download, especially on mobile devices with slower connections.',
        priority: 'medium',
        impact: 7,
        difficulty: 'easy',
        estimatedTime: '1-2 hours',
        steps: [
          'Compress images using tools like TinyPNG or ImageOptim',
          'Remove any unused CSS and JavaScript code',
          'Enable GZIP compression on your web server',
          'Consider lazy loading for images below the fold'
        ]
      });
    }

    const cacheControl = headers['cache-control'];
    if (!cacheControl || !cacheControl.includes('max-age')) {
      score -= 10;
      issues.push({
        id: 'no-cache-headers',
        category: 'performance',
        priority: 'low',
        description: 'Your website isn\'t telling browsers to cache content, missing a speed optimization'
      });
      recommendations.push({
        title: 'Enable Browser Caching',
        description: 'Browser caching helps returning visitors load your site faster by storing certain files locally.',
        priority: 'low',
        impact: 6,
        difficulty: 'easy',
        estimatedTime: '30 minutes',
        steps: [
          'Configure your server to send Cache-Control headers',
          'Set appropriate cache times for different file types',
          'Add ETags for better cache validation',
          'Test caching with browser developer tools'
        ]
      });
    }

    if (!headers['content-encoding']) {
      score -= 15;
      issues.push({
        id: 'no-compression',
        category: 'performance',
        priority: 'medium',
        description: 'Your website content isn\'t compressed, making it larger than necessary'
      });
    }

    return { score: Math.max(0, score), issues, recommendations };
  }

  async checkSEO(document, content, finalUrl) {
    const issues = [];
    const recommendations = [];
    let score = 100;

    const title = document.querySelector('title');
    if (!title || !title.textContent.trim()) {
      score -= 25;
      issues.push({
        id: 'missing-title',
        category: 'seo',
        priority: 'high',
        description: 'Your page is missing a title tag, which is crucial for search engine rankings'
      });
      recommendations.push({
        title: 'Add a Page Title',
        description: 'The title tag is one of the most important SEO elements. It appears in search results and browser tabs.',
        priority: 'high',
        impact: 10,
        difficulty: 'easy',
        estimatedTime: '15 minutes',
        steps: [
          'Add a descriptive <title> tag in your HTML head section',
          'Keep your title between 50-60 characters for best display',
          'Include your main keyword naturally in the title',
          'Make each page title unique and descriptive'
        ]
      });
    } else if (title.textContent.length > 60) {
      score -= 10;
      issues.push({
        id: 'long-title',
        category: 'seo',
        priority: 'medium',
        description: `Your title is ${title.textContent.length} characters long - search engines may cut it off`
      });
    }

    const metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription || !metaDescription.getAttribute('content')) {
      score -= 20;
      issues.push({
        id: 'missing-meta-description',
        category: 'seo',
        priority: 'high',
        description: 'Your page is missing a meta description, which appears in search results'
      });
      recommendations.push({
        title: 'Write a Meta Description',
        description: 'Meta descriptions appear below your title in search results and influence whether people click through to your site.',
        priority: 'high',
        impact: 8,
        difficulty: 'easy',
        estimatedTime: '20 minutes',
        steps: [
          'Add a meta description tag to your HTML head section',
          'Write a compelling 150-160 character description of your page',
          'Include your main keyword naturally',
          'Make it sound appealing to encourage clicks'
        ]
      });
    }

    const h1Tags = document.querySelectorAll('h1');
    if (h1Tags.length === 0) {
      score -= 15;
      issues.push({
        id: 'missing-h1',
        category: 'seo',
        priority: 'medium',
        description: 'Your page doesn\'t have an H1 heading, which helps search engines understand your content'
      });
    } else if (h1Tags.length > 1) {
      score -= 10;
      issues.push({
        id: 'multiple-h1',
        category: 'seo',
        priority: 'medium',
        description: `You have ${h1Tags.length} H1 headings - it's best practice to use only one per page`
      });
    }

    const images = document.querySelectorAll('img');
    let imagesWithoutAlt = 0;
    images.forEach(img => {
      if (!img.getAttribute('alt')) {
        imagesWithoutAlt++;
      }
    });

    if (imagesWithoutAlt > 0) {
      score -= Math.min(20, imagesWithoutAlt * 3);
      issues.push({
        id: 'missing-alt-text',
        category: 'seo',
        priority: 'medium',
        description: `${imagesWithoutAlt} of your images are missing alt text, which helps search engines understand them`
      });
      recommendations.push({
        title: 'Add Alt Text to Images',
        description: 'Alt text helps search engines understand your images and improves accessibility for visually impaired users.',
        priority: 'medium',
        impact: 6,
        difficulty: 'easy',
        estimatedTime: '30 minutes',
        steps: [
          'Add descriptive alt attributes to all meaningful images',
          'Describe what the image shows, not just what it is',
          'Keep descriptions concise but informative',
          'Use empty alt="" for purely decorative images'
        ]
      });
    }

    const internalLinks = document.querySelectorAll('a[href^="/"], a[href*="' + finalUrl + '"]');
    if (internalLinks.length < 3) {
      score -= 10;
      issues.push({
        id: 'few-internal-links',
        category: 'seo',
        priority: 'low',
        description: 'Your page has limited internal links, which could help visitors explore more of your site'
      });
    }

    return { score: Math.max(0, score), issues, recommendations };
  }

  async checkSecurity(finalUrl, headers) {
    const issues = [];
    const recommendations = [];
    let score = 100;

    if (!finalUrl.startsWith('https://')) {
      score -= 40;
      issues.push({
        id: 'no-https',
        category: 'security',
        priority: 'high',
        description: 'Your website isn\'t using HTTPS, which means data isn\'t encrypted'
      });
      recommendations.push({
        title: 'Switch to HTTPS',
        description: 'HTTPS encrypts data between your website and visitors, protecting sensitive information and boosting SEO rankings.',
        priority: 'high',
        impact: 10,
        difficulty: 'medium',
        estimatedTime: '1-2 hours',
        steps: [
          'Get an SSL certificate from your hosting provider (often free)',
          'Configure your server to use HTTPS',
          'Set up automatic redirects from HTTP to HTTPS',
          'Update all internal links to use HTTPS'
        ]
      });
    }

    const securityHeaders = [
      { name: 'x-frame-options', description: 'clickjacking protection' },
      { name: 'x-content-type-options', description: 'MIME type security' },
      { name: 'strict-transport-security', description: 'HTTPS enforcement' },
      { name: 'x-xss-protection', description: 'XSS attack prevention' }
    ];

    let missingHeaders = 0;
    const missingHeaderNames = [];
    
    securityHeaders.forEach(header => {
      if (!headers[header.name]) {
        missingHeaders++;
        missingHeaderNames.push(header.description);
      }
    });

    if (missingHeaders > 0) {
      score -= missingHeaders * 10;
      issues.push({
        id: 'missing-security-headers',
        category: 'security',
        priority: 'medium',
        description: `Your website is missing ${missingHeaders} security headers that protect against common attacks`
      });
      recommendations.push({
        title: 'Add Security Headers',
        description: 'Security headers provide an extra layer of protection against common web vulnerabilities and attacks.',
        priority: 'medium',
        impact: 7,
        difficulty: 'medium',
        estimatedTime: '1 hour',
        steps: [
          'Configure X-Frame-Options to prevent your site being embedded maliciously',
          'Add X-Content-Type-Options to prevent MIME type confusion attacks',
          'Set up Content Security Policy (CSP) to prevent code injection',
          'Enable X-XSS-Protection for older browsers'
        ]
      });
    }

    return { score: Math.max(0, score), issues, recommendations };
  }

  async checkMobile(document, content) {
    const issues = [];
    const recommendations = [];
    let score = 100;

    const viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      score -= 30;
      issues.push({
        id: 'missing-viewport',
        category: 'mobile',
        priority: 'high',
        description: 'Your website is missing mobile optimization settings'
      });
      recommendations.push({
        title: 'Add Mobile Viewport Settings',
        description: 'The viewport meta tag is essential for making your website display properly on mobile devices.',
        priority: 'high',
        impact: 9,
        difficulty: 'easy',
        estimatedTime: '5 minutes',
        steps: [
          'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to your HTML head',
          'Test your site on different mobile devices',
          'Ensure content scales properly on small screens'
        ]
      });
    }

    const hasMediaQueries = content.includes('@media');
    if (!hasMediaQueries) {
      score -= 25;
      issues.push({
        id: 'no-responsive-design',
        category: 'mobile',
        priority: 'high',
        description: 'Your website doesn\'t appear to have responsive design for different screen sizes'
      });
      recommendations.push({
        title: 'Make Your Site Mobile-Friendly',
        description: 'Responsive design ensures your website looks and works great on phones, tablets, and desktops.',
        priority: 'high',
        impact: 9,
        difficulty: 'hard',
        estimatedTime: '4-8 hours',
        steps: [
          'Use CSS media queries to adapt your layout for different screen sizes',
          'Implement a flexible grid system',
          'Use relative units (%, em, rem) instead of fixed pixel sizes',
          'Test your site on various devices and screen sizes'
        ]
      });
    }

    const buttons = document.querySelectorAll('button, a, input[type="submit"]');
    if (buttons.length > 0) {
      let potentiallySmallElements = 0;
      buttons.forEach(button => {
        const style = button.getAttribute('style') || '';
        if (style.includes('font-size') && (style.includes('px') && parseInt(style.match(/font-size:\s*(\d+)px/)?.[1] || 16) < 14)) {
          potentiallySmallElements++;
        }
      });
      
      if (potentiallySmallElements > buttons.length * 0.3) {
        score -= 15;
        issues.push({
          id: 'small-touch-targets',
          category: 'mobile',
          priority: 'medium',
          description: 'Some of your buttons and links may be too small for mobile users to tap easily'
        });
      }
    }

    return { score: Math.max(0, score), issues, recommendations };
  }

  async checkAccessibility(document) {
    const issues = [];
    const recommendations = [];
    let score = 100;

    const images = document.querySelectorAll('img');
    let imagesWithoutAlt = 0;
    images.forEach(img => {
      if (!img.getAttribute('alt')) {
        imagesWithoutAlt++;
      }
    });

    if (imagesWithoutAlt > 0) {
      score -= Math.min(25, imagesWithoutAlt * 5);
      issues.push({
        id: 'accessibility-missing-alt',
        category: 'accessibility',
        priority: 'medium',
        description: `${imagesWithoutAlt} images don't have alt text, making them inaccessible to screen readers`
      });
    }

    const inputs = document.querySelectorAll('input, textarea, select');
    let inputsWithoutLabels = 0;
    inputs.forEach(input => {
      const id = input.getAttribute('id');
      const label = id ? document.querySelector(`label[for="${id}"]`) : null;
      const ariaLabel = input.getAttribute('aria-label');
      const ariaLabelledby = input.getAttribute('aria-labelledby');
      
      if (!label && !ariaLabel && !ariaLabelledby) {
        inputsWithoutLabels++;
      }
    });

    if (inputsWithoutLabels > 0) {
      score -= Math.min(20, inputsWithoutLabels * 8);
      issues.push({
        id: 'missing-form-labels',
        category: 'accessibility',
        priority: 'medium',
        description: `${inputsWithoutLabels} form fields are missing labels, making them hard to use with screen readers`
      });
      recommendations.push({
        title: 'Add Labels to Form Fields',
        description: 'Form labels help all users understand what information to enter, and are essential for screen reader users.',
        priority: 'medium',
        impact: 7,
        difficulty: 'easy',
        estimatedTime: '30 minutes',
        steps: [
          'Add <label> elements for all form inputs',
          'Use the "for" attribute to connect labels with their inputs',
          'Consider using aria-label for inputs that don\'t need visible labels',
          'Test your forms with keyboard navigation'
        ]
      });
    }

    const hasCustomColors = document.querySelector('[style*="color"]') || 
                           document.querySelector('style') ||
                           document.querySelector('link[rel="stylesheet"]');
    
    if (hasCustomColors) {
      score -= 5;
      issues.push({
        id: 'color-contrast-warning',
        category: 'accessibility',
        priority: 'low',
        description: 'Manual review recommended to ensure text has sufficient color contrast'
      });
    }

    return { score: Math.max(0, score), issues, recommendations };
  }

  async checkBestPractices(document, headers, content) {
    const issues = [];
    const recommendations = [];
    let score = 100;

    const doctype = content.trim().toLowerCase().startsWith('<!doctype html>');
    if (!doctype) {
      score -= 15;
      issues.push({
        id: 'missing-doctype',
        category: 'bestPractices',
        priority: 'low',
        description: 'Your HTML is missing the modern DOCTYPE declaration'
      });
    }

    const charset = document.querySelector('meta[charset]') || 
                   document.querySelector('meta[http-equiv="Content-Type"]');
    if (!charset) {
      score -= 10;
      issues.push({
        id: 'missing-charset',
        category: 'bestPractices',
        priority: 'low',
        description: 'Your website doesn\'t specify character encoding, which could cause display issues'
      });
    }

    const html = document.querySelector('html');
    if (!html || !html.getAttribute('lang')) {
      score -= 10;
      issues.push({
        id: 'missing-lang',
        category: 'bestPractices',
        priority: 'low',
        description: 'Your HTML doesn\'t specify the page language, which helps search engines and screen readers'
      });
    }

    const elementsWithInlineStyles = document.querySelectorAll('[style]').length;
    if (elementsWithInlineStyles > 5) {
      score -= 15;
      issues.push({
        id: 'excessive-inline-styles',
        category: 'bestPractices',
        priority: 'low',
        description: `You have ${elementsWithInlineStyles} elements with inline styles - external CSS is more maintainable`
      });
    }

    return { score: Math.max(0, score), issues, recommendations };
  }

  generateActionItems(auditResults, options) {
    const sortedRecommendations = auditResults.recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return (b.impact || 0) - (a.impact || 0);
    });

    auditResults.quickWins = sortedRecommendations
      .filter(rec => rec.difficulty === 'easy' && rec.impact >= 7)
      .slice(0, 3)
      .map(rec => rec.title);

    auditResults.mediumTermGoals = sortedRecommendations
      .filter(rec => rec.difficulty === 'medium' || (rec.impact >= 5 && rec.impact < 7))
      .slice(0, 3)
      .map(rec => rec.title);

    auditResults.longTermGoals = sortedRecommendations
      .filter(rec => rec.difficulty === 'hard' || rec.estimatedTime.includes('hours'))
      .slice(0, 3)
      .map(rec => rec.title);

    if (auditResults.quickWins.length === 0) {
      auditResults.quickWins = ['Optimize images for faster loading', 'Add missing alt text to images', 'Enable browser caching'];
    }
    
    if (auditResults.mediumTermGoals.length === 0) {
      auditResults.mediumTermGoals = ['Improve mobile responsiveness', 'Enhance security headers', 'Optimize content structure'];
    }
    
    if (auditResults.longTermGoals.length === 0) {
      auditResults.longTermGoals = ['Implement comprehensive SEO strategy', 'Redesign for better user experience', 'Develop content marketing plan'];
    }
  }

  generateCompetitiveAnalysis(overallScore, businessType) {
    const industryAverages = {
      'ecommerce': 72,
      'service': 68,
      'restaurant': 65,
      'healthcare': 74,
      'technology': 78,
      'education': 70,
      'nonprofit': 66,
      'real-estate': 69,
      'automotive': 71,
      'other': 70
    };

    const avgScore = industryAverages[businessType] || 70;
    const percentile = Math.min(95, Math.max(5, Math.round((overallScore / avgScore) * 50 + 25)));

    return {
      avgIndustryScore: avgScore,
      percentile: percentile,
      ranking: overallScore > avgScore ? 'above average' : 'below average'
    };
  }

  async isUrlEligible(websiteUrl) {
    console.log(`Checking eligibility for: ${websiteUrl}`);
    
    try {
      let parsedUrl;
      try {
        parsedUrl = new URL(websiteUrl);
      } catch (error) {
        return {
          eligible: false,
          reason: 'Please enter a valid website URL (e.g., https://yoursite.com)'
        };
      }

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return {
          eligible: false,
          reason: 'Only HTTP and HTTPS websites can be audited'
        };
      }

      const domain = parsedUrl.hostname?.toLowerCase();
      const restrictedDomains = [
        'localhost', '127.0.0.1', '0.0.0.0',
        'file://', 'ftp://',
        'data:', 'javascript:',
        'about:', 'chrome:', 'chrome-extension:'
      ];

      if (restrictedDomains.some(restricted => domain?.includes(restricted))) {
        return {
          eligible: false,
          reason: 'Local or system URLs cannot be audited'
        };
      }

      this.redirectCount = 0;

      const fetchResult = await this.fetchWebsite(websiteUrl);
      
      if (!fetchResult.success) {
        let reason = fetchResult.error;
        
        if (fetchResult.error.includes('not found') || fetchResult.error.includes('ENOTFOUND')) {
          reason = 'We couldn\'t find this website. Please check the URL is correct.';
        } else if (fetchResult.error.includes('denied') || fetchResult.error.includes('403')) {
          reason = 'This website is blocking automated requests, so we can\'t audit it.';
        } else if (fetchResult.error.includes('timeout') || fetchResult.error.includes('too long')) {
          reason = 'This website is taking too long to respond. Please try again later.';
        } else if (fetchResult.error.includes('too large')) {
          reason = 'This website\'s content is too large for our audit system to process.';
        }
        
        return {
          eligible: false,
          reason: reason
        };
      }

      const { content, headers } = fetchResult;

      const contentType = headers['content-type'] || '';
      
      const excludedTypes = [
        'application/pdf', 'application/zip', 'application/octet-stream',
        'image/', 'video/', 'audio/',
        'application/json', 'application/xml'
      ];
      
      const isExcludedType = excludedTypes.some(type => 
        contentType.toLowerCase().includes(type.toLowerCase())
      );

      if (isExcludedType) {
        return {
          eligible: false,
          reason: 'This URL appears to be a file download rather than a website page'
        };
      }

      const lowerContent = content.toLowerCase();
      const hasHtmlIndicators = 
        lowerContent.includes('<html') ||
        lowerContent.includes('<head') ||
        lowerContent.includes('<body') ||
        lowerContent.includes('<title') ||
        lowerContent.includes('<div') ||
        lowerContent.includes('<p>') ||
        lowerContent.includes('<h1') ||
        lowerContent.includes('<h2') ||
        lowerContent.includes('<nav') ||
        lowerContent.includes('<main') ||
        lowerContent.includes('<section') ||
        lowerContent.includes('<article') ||
        lowerContent.includes('<!doctype') ||
        (content.length > 1000 && contentType.includes('text')); 

      if (!hasHtmlIndicators) {
        return {
          eligible: false,
          reason: 'This doesn\'t appear to be a standard website page. Please check the URL.'
        };
      }

      if (content.trim().length < 200) {
        return {
          eligible: false,
          reason: 'This page appears to be empty or have very little content to analyze'
        };
      }

      console.log(`Website ${websiteUrl} is eligible for audit`);
      return {
        eligible: true,
        reason: 'Website is ready for analysis'
      };

    } catch (error) {
      console.error(`Eligibility check error for ${websiteUrl}:`, error);
      
      return {
        eligible: true,
        reason: 'Unable to pre-verify website, but will attempt audit'
      };
    }
  }
}

module.exports = new AuditEngine();