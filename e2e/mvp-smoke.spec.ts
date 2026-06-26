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

test('buyer can filter marketplace results by service state', async ({ page }) => {
  await page.goto('/browse')
  await page.getByLabel('Filter by state').selectOption('IN')
  await page.getByRole('button', { name: /^search$/i }).click()

  await expect(page).toHaveURL(/state=IN/)
  await expect(page.getByRole('heading', { name: /lakefront electric/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /prairie & stone/i })).toHaveCount(0)
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

test('operator workflow surfaces cover leads jobs invoices and admin verification', async ({
  page,
}) => {
  await page.goto('/dashboard/company')
  await expect(page.getByRole('heading', { name: /company command center/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /lead inbox/i })).toBeVisible()
  await expect(page.getByText(/200a panel upgrade/i)).toBeVisible()
  await expect(page.getByText(/proposal sent/i).first()).toBeVisible()

  await page.goto('/dashboard/leads')
  await expect(page.getByRole('heading', { name: /^lead inbox$/i })).toBeVisible()
  await expect(page.getByText(/review project details/i)).toBeVisible()
  await expect(page.getByText(/proposal sent - oak park/i)).toBeVisible()

  await page.goto('/dashboard/jobs')
  await expect(page.getByRole('heading', { name: /^jobs$/i })).toBeVisible()
  await expect(page.getByText(/awaiting invoice/i)).toBeVisible()

  await page.goto('/dashboard/invoices')
  await expect(page.getByRole('heading', { name: /^invoices$/i })).toBeVisible()
  await expect(page.getByText(/sent/i).first()).toBeVisible()
  await expect(page.getByText(/paid jun 10/i)).toBeVisible()
  await page.getByRole('link', { name: /new invoice/i }).click()
  await expect(page.getByRole('heading', { name: /build invoice/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /invoice summary/i })).toBeVisible()
  await expect(page.getByText(/once sent, this invoice becomes immutable/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /preview pdf/i })).toBeVisible()

  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: /trust and safety/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /pending companies/i })).toBeVisible()
  await expect(page.getByText(/chicago masonry group/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /approve/i }).first()).toBeVisible()
})
