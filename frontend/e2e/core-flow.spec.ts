import { expect, test } from '@playwright/test'
import path from 'node:path'

const fixture = (name: string) => path.join(import.meta.dirname, 'fixtures', name)

test('upload a leaf photo, see an honest result, save it to the journal', async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
  await page.goto('/welcome')
  await page.getByRole('button', { name: 'Create an account' }).click()
  await page.getByLabel('Your name').fill('E2E Gardener')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('a long e2e password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'A little care. A little bloom.' })).toBeVisible()

  // Start the analysis flow and create the plant inline.
  await page.goto('/analyze')
  await page.getByRole('button', { name: 'Add a plant' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add a plant' })
  await dialog.getByLabel('Nickname').fill('Balcony tomato')
  await dialog.getByLabel('Kind of plant').selectOption('tomato')
  await dialog.getByRole('button', { name: 'Add plant' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByLabel('Plant', { exact: true })).toHaveValue(/\d+/)

  // Client-side validation explains bad files.
  const input = page.locator('input[type=file]').first()
  await input.setInputFiles(fixture('not-an-image.jpg'))
  await expect(page.getByRole('alert')).toContainText(/JPEG, PNG or WebP|couldn't read/)
  await page.locator('input[type=file]').first().setInputFiles(fixture('too-small.png'))
  await expect(page.getByRole('alert')).toContainText('at least 128 pixels')

  // A real photo previews and can be analysed.
  await page.locator('input[type=file]').first().setInputFiles(fixture('tomato-leaf.jpg'))
  await expect(page.getByRole('img', { name: 'Selected leaf photo' })).toBeVisible()
  await page.getByRole('button', { name: 'This week' }).click()
  await page.getByRole('button', { name: 'Every day' }).click()
  await page.getByRole('button', { name: 'Analyse photo' }).click()

  // Result page: one of the honest outcomes, model output separated from context.
  await expect(page).toHaveURL(/\/analyses\/\d+/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    /Possible |No known issue found|This image is inconclusive|Image analysis is unavailable right now/,
  )
  await expect(page.getByText('What you told us')).toBeVisible()
  await expect(page.getByText('Curated care guide')).toBeVisible()
  await expect(page.getByText('Every day')).toBeVisible()

  await page.getByLabel('Add a note').fill('Removed two spotted leaves.')
  await page.getByRole('button', { name: 'Save to journal' }).click()
  await expect(page.getByText(/Saved to Balcony tomato.s journal/).first()).toBeVisible()

  // The journal shows the entry with its photo and note.
  await page.getByRole('link', { name: 'Open journal' }).click()
  await expect(page.getByRole('heading', { name: /Balcony tomato.s journal/ })).toBeVisible()
  await expect(page.getByText('Removed two spotted leaves.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Review analysis' })).toBeVisible()
})
