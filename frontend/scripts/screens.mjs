// Dev utility: captures key screens at desktop and phone widths for visual review.
// Usage: OUT=/some/dir node scripts/screens.mjs   (needs both dev servers running)
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const OUT = process.env.OUT ?? 'screens'
const pages = (process.env.PAGES ?? '/,/plants,/journal,/analyze,/care-guide,/care-guide/early-blight,/reminders,/settings').split(',')
const browser = await chromium.launch()
const email = `screens-${Date.now()}@example.com`

for (const [name, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: name === 'mobile' ? 2 : 1, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
  page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()))
  if (name === 'desktop') {
    await page.goto(`${BASE}/welcome`)
    await page.screenshot({ path: `${OUT}/${name}-welcome.png`, fullPage: true })
    await page.getByRole('button', { name: 'Create an account' }).click()
    await page.getByLabel('Your name').fill('Erti')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('a long test password')
    await page.getByRole('button', { name: 'Create account' }).click()
    await page.waitForURL(`${BASE}/`)
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${OUT}/${name}-empty.png`, fullPage: true })
    await page.getByRole('button', { name: 'Show example garden' }).click()
    await page.getByText('Example garden added').waitFor()
    // One real analysis so the result page can be reviewed.
    const h = { 'X-Requested-With': 'to-my-petal' }
    const plant = await (await page.request.post(`${BASE}/api/plants`, { headers: h, data: { nickname: 'Balcony tomato', species_key: 'tomato' } })).json()
    const photo = await (await page.request.post(`${BASE}/api/photos`, {
      headers: h,
      multipart: { plant_id: String(plant.id), file: { name: 'leaf.jpg', mimeType: 'image/jpeg', buffer: readFileSync(process.env.LEAF ?? 'e2e/fixtures/tomato-leaf.jpg') } },
    })).json()
    const analysis = await (await page.request.post(`${BASE}/api/analyses`, { headers: h, data: { photo_id: photo.id, watering: 'daily', light: 'full_sun', symptoms_started: 'this_week' } })).json()
    pages.push(`/analyses/${analysis.id}`)
  } else {
    await page.goto(`${BASE}/welcome`)
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('a long test password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL(`${BASE}/`)
  }
  for (const path of pages) {
    await page.goto(`${BASE}${path}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(700)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    if (overflow > 0) console.log(`OVERFLOW ${name} ${path}: ${overflow}px`)
    await page.screenshot({ path: `${OUT}/${name}${path.replaceAll('/', '_') || '_home'}.png`, fullPage: true })
  }
  await ctx.close()
}
await browser.close()
console.log('done', email)
