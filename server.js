const express = require('express')
const path = require('path')
const compression = require('compression')
const helmet = require('helmet')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
require('dotenv').config()
require('./config/firebase')

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors({
  origin: [
    'my-portfolio-eta-green-79.vercel.app',
    'https://www.n15labs.co.uk',
    process.env.FRONTEND_URL || 'http://localhost:8080',
    'http://localhost:8081'
  ],
  credentials: true
}));

if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://www.youtube.com", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        frameSrc: ["https://www.youtube.com"],
        connectSrc: ["'self'", "https:"]
      }
    },
    frameguard: { action: 'deny' },
    hsts: { maxAge: 31536000, includeSubDomains: true }
  }))
} else {
  app.use(helmet({
    contentSecurityPolicy: false,
    frameguard: { action: 'sameorigin' }
  }))
  app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    next()
  })
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100 
})
app.use('/api/', limiter)

app.use(compression())

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.use('/api/auth', require('./routes/auth'))
app.use('/api/user', require('./routes/user'))
app.use('/api/consent', require('./routes/consent'))
app.use('/api/emails', require('./routes/emails'))      
app.use('/api/unsubscribe', require('./routes/unsubscribe')) 
app.use('/api/admin', require('./routes/admin'))
app.use('/api/audit', require('./routes/audit')) 

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    firebase: 'connected', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  })
})

app.use(express.static(path.join(__dirname, '../dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache')
    } else if (
      filePath.endsWith('.js') ||
      filePath.endsWith('.css') ||
      filePath.endsWith('.webp') ||
      filePath.endsWith('.avif') ||
      filePath.endsWith('.png') ||
      filePath.endsWith('.jpg') ||
      filePath.endsWith('.svg') ||
      filePath.endsWith('.woff2') ||
      filePath.endsWith('.ttf')
    ) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    }
  }
}))

app.use((err, req, res, next) => {
  console.error('Error:', err.stack)
  
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'Internal server error' })
  } else {
    res.status(500).json({ 
      error: 'Something went wrong!',
      details: err.message,
      stack: err.stack
    })
  }
})

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '../dist/index.html'))
  } else {
    res.status(404).json({ error: 'API route not found' })
  }
})

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`)
  console.log(`🔥 API endpoints available at http://localhost:${PORT}/api/`)
  console.log(`🔐 Firebase project: ${process.env.FIREBASE_PROJECT_ID || 'Not configured'}`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
})