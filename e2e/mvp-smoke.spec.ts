import { expect, test } from '@playwright/test'

test('buyer can browse a contractor and open the quote form', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /find the right contractor/i })).toBeVisible()

  await page.goto('/browse?category=Electrical')
  await expect(page).toHaveURL(/category=Electrical/)
  await expect(page.getByRole('heading', { name: /browse verified contractors/i })).toBeVisible()

  await page
    .getByRole('link', { name: /view company/i })
    .first()
    .click()
  await expect(page.getByRole('heading', { name: /lakefront electric/i })).toBeVisible()

  await page
    .locator('#main')
    .getByRole('link', { name: /request a quote/i })
    .click()
  await expect(
    page.getByRole('heading', { name: /tell the contractor about the job/i }),
  ).toBeVisible()
})

test('quote form validates and completes in demo fallback mode', async ({ page }) => {
  await page.goto('/request-quote?company=11111111-1111-4111-8111-111111111111')
  await page.getByLabel('Name').fill('Jordan Lee')
  await page.getByLabel('Email').fill('jordan@example.com')
  await page.getByLabel('Phone').fill('312-555-0199')
  await page.getByLabel('Street address').fill('1234 W Grand Ave')
  await page.getByLabel('City').fill('Chicago')
  await page.getByLabel('State').fill('IL')
  await page.getByLabel('ZIP code').fill('60642')
  await page
    .getByLabel('Describe the work')
    .fill('Replace a damaged electrical panel and inspect the service entrance for code issues.')

  await page.locator('form').evaluate((form) => {
    ;(form as HTMLFormElement).requestSubmit()
  })
  await expect(page.getByRole('heading', { name: /your request is ready/i })).toBeVisible()
})
