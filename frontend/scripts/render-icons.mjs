// Renders the brand SVGs to PNG app icons (and an optional preview sheet).
// Usage: npm run icons            -> writes public/icons/*.png
//        npm run icons -- preview -> also writes logo-preview.png for review
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const symbol = readFileSync('src/assets/brand/symbol.svg', 'utf8')
const favicon = readFileSync('src/assets/brand/favicon.svg', 'utf8')
const full = readFileSync('src/assets/brand/logo-full.svg', 'utf8')
const ivory = '#F8F5EC'

const icons = [
  { file: 'public/icons/icon-192.png', size: 192, svg: symbol, pad: 0.14, bg: ivory },
  { file: 'public/icons/icon-512.png', size: 512, svg: symbol, pad: 0.14, bg: ivory },
  // Maskable icons need the artwork inside the central 80% safe zone.
  { file: 'public/icons/icon-maskable-512.png', size: 512, svg: symbol, pad: 0.24, bg: ivory },
  { file: 'public/icons/apple-touch-icon.png', size: 180, svg: symbol, pad: 0.14, bg: ivory },
  { file: 'public/icons/favicon-32.png', size: 32, svg: favicon, pad: 0.02, bg: 'transparent' },
]

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })
for (const icon of icons) {
  const inner = icon.size * (1 - icon.pad * 2)
  await page.setViewportSize({ width: icon.size, height: icon.size })
  await page.setContent(`<html><body style="margin:0;background:${icon.bg};display:grid;place-items:center;width:${icon.size}px;height:${icon.size}px">
    <div style="width:${inner}px;height:${inner}px">${icon.svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`)
  await page.screenshot({ path: icon.file, omitBackground: icon.bg === 'transparent' })
  console.log('wrote', icon.file)
}
if (process.argv.includes('preview')) {
  await page.setViewportSize({ width: 900, height: 420 })
  await page.setContent(`<html><body style="margin:0;padding:24px;background:${ivory};font-family:sans-serif">
    <div style="width:520px">${full}</div>
    <div style="display:flex;gap:24px;align-items:end;margin-top:24px">
      ${[160, 64, 32].map((s) => `<div style="width:${s}px;height:${s}px">${symbol.replace('<svg ', '<svg width="100%" height="100%" ')}</div>`).join('')}
      ${[32, 16].map((s) => `<div style="width:${s}px;height:${s}px">${favicon.replace('<svg ', '<svg width="100%" height="100%" ')}</div>`).join('')}
      <div style="width:64px;height:64px;background:#173D29;border-radius:14px;padding:8px;box-sizing:border-box">${favicon.replaceAll('#173D29', '#FFFCF5').replace('<svg ', '<svg width="100%" height="100%" ')}</div>
    </div></body></html>`)
  await page.screenshot({ path: process.env.PREVIEW_OUT ?? 'logo-preview.png' })
}
await browser.close()
