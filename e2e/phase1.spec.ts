import { expect, test, type Page } from '@playwright/test'

const WORKOUTS = [
  'Back & Biceps A',
  'Chest & Triceps A',
  'Back & Biceps B',
  'Chest & Triceps B',
  'Legs & Stretching',
]

async function startWorkout(page: Page, name: string) {
  await page.goto('/')
  await page.locator(`[data-testid="workout"][data-name="${name}"]`).click()
  await expect(page.getByTestId('logger-title')).toHaveText(name)
}

async function addMachine(page: Page, name: string) {
  await page.getByTestId('add-exercise').click()
  await page.getByTestId('catalog-search').fill(name)
  await page.locator(`[data-testid="catalog-add"][data-name="${name}"]`).first().click()
  await expect(page.getByTestId('logger-title')).toBeVisible()
  await expect(page.locator(`[data-testid="exercise-card"][data-name="${name}"]`)).toBeVisible()
}

function card(page: Page, name: string) {
  return page.locator(`[data-testid="exercise-card"][data-name="${name}"]`)
}

test.beforeEach(async ({ page }) => {
  const hosts = new Set<string>()
  page.on('request', (request) => {
    hosts.add(new URL(request.url()).host)
  })
  await page.goto('/')
  await expect(page.getByTestId('app-title')).toBeVisible()
  expect([...hosts].every((host) => host === '127.0.0.1:4173')).toBe(true)
})

test('AC-1 selects any of the five workouts', async ({ page }) => {
  await expect(page.getByTestId('week-count')).toContainText('0 of 3 visits')
  const day = await page.evaluate(() => new Date().getDay())
  const suggested = [null, ...WORKOUTS, null][day]
  if (suggested) await expect(page.getByTestId('suggested')).toContainText(suggested)
  for (const name of WORKOUTS) {
    await page.goto('/')
    await expect(page.locator(`[data-testid="workout"][data-name="${name}"]`)).toBeVisible()
    await page.locator(`[data-testid="workout"][data-name="${name}"]`).click()
    await expect(page.getByTestId('logger-title')).toHaveText(name)
    await expect(page.getByTestId('empty-exercises')).toBeVisible()
  }
})

test('AC-2 and AC-7 keep a single completed set after reload', async ({ page }) => {
  await startWorkout(page, 'Back & Biceps A')
  await addMachine(page, 'Seated Row')
  const row = card(page, 'Seated Row')
  await row.getByTestId('set-done').nth(1).click()
  await expect(row.getByTestId('set-done').nth(0)).toHaveAttribute('aria-pressed', 'false')
  await expect(row.getByTestId('set-done').nth(1)).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(card(page, 'Seated Row').getByTestId('set-done').nth(1)).toHaveAttribute('aria-pressed', 'true')
  await expect(card(page, 'Seated Row').getByTestId('set-done').nth(0)).toHaveAttribute('aria-pressed', 'false')
})

test('AC-3 records different weights, reps, and per-side reps', async ({ page }) => {
  await startWorkout(page, 'Chest & Triceps A')
  await addMachine(page, 'Chest Press')
  const row = card(page, 'Chest Press')
  await row.getByTestId('weight-input').nth(0).fill('90')
  await row.getByTestId('reps-input').nth(0).fill('12')
  await row.getByTestId('weight-input').nth(1).fill('85')
  await row.getByTestId('reps-input').nth(1).fill('10')
  await page.reload()
  await expect(card(page, 'Chest Press').getByTestId('weight-input').nth(0)).toHaveValue('90')
  await expect(card(page, 'Chest Press').getByTestId('reps-input').nth(0)).toHaveValue('12')
  await expect(card(page, 'Chest Press').getByTestId('weight-input').nth(1)).toHaveValue('85')
  await expect(card(page, 'Chest Press').getByTestId('reps-input').nth(1)).toHaveValue('10')

  await page.getByTestId('add-exercise').click()
  await page.getByTestId('catalog-search').fill('Rotary Torso')
  await page.locator('[data-testid="catalog-add"][data-name="Rotary Torso"]').first().click()
  const torso = card(page, 'Rotary Torso')
  await torso.getByTestId('reps-left').first().fill('12')
  await torso.getByTestId('reps-right').first().fill('11')
  await page.reload()
  await expect(card(page, 'Rotary Torso').getByTestId('reps-left').first()).toHaveValue('12')
  await expect(card(page, 'Rotary Torso').getByTestId('reps-right').first()).toHaveValue('11')
  const done = card(page, 'Chest Press').getByTestId('set-done').first()
  const box = await done.boundingBox()
  expect(box?.width).toBeGreaterThanOrEqual(48)
  expect(box?.height).toBeGreaterThanOrEqual(48)
})

test('AC-4 adds a set and confirms removal only when the set has data', async ({ page }) => {
  await startWorkout(page, 'Back & Biceps B')
  await addMachine(page, 'Lat Pulldown')
  const row = card(page, 'Lat Pulldown')
  await expect(row.getByTestId('set-row')).toHaveCount(2)
  await row.getByTestId('add-set').click()
  await expect(row.getByTestId('set-row')).toHaveCount(3)
  await row.getByTestId('remove-set').click()
  await expect(page.getByTestId('confirm-remove-set')).toHaveCount(0)
  await expect(row.getByTestId('set-row')).toHaveCount(2)
  await row.getByTestId('weight-input').nth(1).fill('100')
  await row.getByTestId('remove-set').click()
  await expect(page.getByTestId('confirm-remove-set')).toBeVisible()
  await page.getByTestId('confirm-remove-set').click()
  await expect(row.getByTestId('set-row')).toHaveCount(1)
})

test('AC-5 adds, substitutes, and creates a custom exercise', async ({ page }) => {
  await startWorkout(page, 'Chest & Triceps B')
  await addMachine(page, 'Seated Row')
  await card(page, 'Seated Row').getByTestId('exercise-menu').locator('summary').click()
  await card(page, 'Seated Row').getByTestId('substitute').click()
  await page.getByTestId('catalog-search').fill('Lat Pulldown')
  await page.locator('[data-testid="catalog-add"][data-name="Lat Pulldown"]').first().click()
  await expect(page.getByTestId('sub-label')).toContainText('sub for Seated Row')

  await page.getByTestId('add-exercise').click()
  await page.getByTestId('custom-name').fill('Sled Push')
  await page.getByTestId('custom-save').click()
  await expect(card(page, 'Sled Push')).toBeVisible()
})

test('AC-6, AC-8, and AC-10 finish a read-only workout and copy the log', async ({ page }) => {
  await startWorkout(page, 'Legs & Stretching')
  await addMachine(page, 'Seated Leg Press')
  const row = card(page, 'Seated Leg Press')
  await row.getByTestId('weight-input').nth(0).fill('180')
  await row.getByTestId('reps-input').nth(0).fill('12')
  await row.getByTestId('set-done').nth(0).click()
  await page.getByTestId('notes').fill('Knees felt fine')
  await page.getByTestId('finish-workout').click()
  await page.getByTestId('confirm-finish').click()
  await expect(page.getByTestId('history-detail')).toBeVisible()
  await expect(page.getByTestId('weight-input')).toHaveCount(0)
  await expect(page.getByTestId('log-text')).toContainText('Seated Leg Press')
  await expect(page.getByTestId('log-text')).toContainText('180×12')
  await expect(page.getByTestId('log-text')).toContainText('Notes: Knees felt fine')
  await page.evaluate(() => {
    const clipboard = navigator.clipboard
    const writeText = clipboard.writeText.bind(clipboard)
    clipboard.writeText = async (text: string) => {
      ;(window as unknown as { __copied?: string }).__copied = text
      return writeText(text)
    }
  })
  await page.getByTestId('copy-log').click()
  await expect(page.getByTestId('copy-status')).toHaveText('Copied')
  const clip = await page.evaluate(() => (window as unknown as { __copied?: string }).__copied ?? '')
  expect(clip).toContain('180×12')
  expect(clip).toContain('Notes: Knees felt fine')
  await page.goto('/')
  await expect(page.getByTestId('week-count')).toContainText('1 of 3 visits')
  await page.getByTestId('nav-history').click()
  await page.locator('[data-testid="history-item"][data-name="Legs & Stretching"]').click()
  await expect(page.getByTestId('log-text')).toContainText('180×12')
})

test('AC-9 keeps history after the template changes', async ({ page }) => {
  await startWorkout(page, 'Back & Biceps A')
  await addMachine(page, 'Seated Row')
  const row = card(page, 'Seated Row')
  await row.getByTestId('weight-input').first().fill('90')
  await row.getByTestId('reps-input').first().fill('12')
  await row.getByTestId('set-done').first().click()
  await page.getByTestId('save-to-template').click()
  await page.getByTestId('finish-workout').click()
  await page.getByTestId('confirm-finish').click()
  await expect(page.getByTestId('log-text')).toContainText('Seated Row')
  await page.goto('/catalog')
  await page.locator('[data-testid="template-edit"][data-name="Back & Biceps A"]').click()
  await expect(page.getByRole('heading', { name: 'Seated Row' })).toBeVisible()
  await page.locator('[data-testid="draft-remove"][data-name="Seated Row"]').click()
  await page.getByPlaceholder('Add a machine').fill('Pec Fly')
  await page.locator('[data-testid="draft-add"][data-name="Pec Fly"]').click()
  await page.getByTestId('save-template-version').click()
  await page.getByTestId('nav-history').click()
  await page.locator('[data-testid="history-item"][data-name="Back & Biceps A"]').click()
  await expect(page.getByTestId('log-text')).toContainText('Seated Row')
  await expect(page.getByTestId('log-text')).toContainText('90×12')
  await expect(page.getByTestId('log-text')).not.toContainText('Pec Fly')
})

test('Project 22 suggests the next step and still lets the lifter type something else', async ({ page }) => {
  await startWorkout(page, 'Back & Biceps B')
  await addMachine(page, 'Biceps Curl')
  const first = card(page, 'Biceps Curl')
  await first.getByTestId('weight-input').nth(0).fill('30')
  await first.getByTestId('weight-input').nth(1).fill('30')
  await first.getByTestId('set-done').nth(0).click()
  await first.getByTestId('set-done').nth(1).click()
  await page.getByTestId('finish-workout').click()
  await page.getByTestId('confirm-finish').click()
  await expect(page.getByText('Next time: 2×10 done → try 2×11')).toBeVisible()
  await page.goto('/')
  await page.locator('[data-testid="workout"][data-name="Back & Biceps B"]').click()
  await addMachine(page, 'Biceps Curl')
  const second = card(page, 'Biceps Curl')
  await expect(second.getByTestId('p22')).toContainText('2×10 done → try 2×11')
  await expect(second.getByTestId('reps-input').first()).toHaveValue('11')
  await second.getByTestId('reps-input').nth(0).fill('8')
  await second.getByTestId('reps-input').nth(1).fill('8')
  await second.getByTestId('set-done').nth(0).click()
  await second.getByTestId('set-done').nth(1).click()
  await page.getByTestId('finish-workout').click()
  await page.getByTestId('confirm-finish').click()
  await expect(page.getByTestId('log-text')).toContainText('30×8')
  await expect(page.getByTestId('log-text')).not.toContainText('30×11')
})

test('settings theme, goal, and a rejected restore stay on the device', async ({ page }) => {
  await page.getByTestId('open-settings').click()
  await page.getByTestId('theme-dark').click()
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')
  await page.getByTestId('goal-up').click()
  await expect(page.getByTestId('weekly-goal')).toHaveText('4')
  await page.getByTestId('back').click()
  await expect(page.getByTestId('week-count')).toContainText('0 of 4 visits')
  await page.getByTestId('nav-export').click()
  await page.getByTestId('restore-file').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"app":"other-app"}'),
  })
  await expect(page.getByTestId('error')).toContainText('not an AFI')
})

test('records offline after the app shell is cached', async ({ page, context }) => {
  await page.evaluate(async () => {
    const ready = await navigator.serviceWorker.ready
    if (!ready.active) throw new Error('service worker is not active')
  })
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByTestId('app-title')).toBeVisible()
  await startWorkout(page, 'Chest & Triceps A')
  await addMachine(page, 'Pec Fly')
  await card(page, 'Pec Fly').getByTestId('weight-input').first().fill('40')
  await page.reload()
  await expect(card(page, 'Pec Fly').getByTestId('weight-input').first()).toHaveValue('40')
  await context.setOffline(false)
})
