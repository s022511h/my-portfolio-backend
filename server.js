const express = require('express')
const path = require('path')
const compression = require('compression')

const app = express()
const PORT = process.env.PORT || 3000

app.use(compression())

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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'))
})

app.listen(PORT, () => {
  console.log(`✅ Frontend is running at http://localhost:${PORT}`)
})
