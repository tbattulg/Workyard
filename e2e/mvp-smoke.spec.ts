import { expect, test, type Page } from '@playwright/test'

async function routeEmptyCompanySearch(page: Page) {
  await page.route('**/api/v1/companies**', async (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() === 'GET' && url.pathname === '/api/v1/companies') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { requestId: 'empty-search' } }),
      })
      return
    }
    await route.fallback()
  })
}

test('buyer can browse a contractor and open the quote form', async ({ page }) => {
  await routeEmptyCompanySearch(page)

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
  await routeEmptyCompanySearch(page)

  await page.goto('/browse')
  await page.getByLabel('Filter by state').selectOption('PA')
  await page.getByRole('button', { name: /^search$/i }).click()

  await expect(page).toHaveURL(/state=PA/)
  await expect(page.getByRole('heading', { name: /lakefront electric/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /prairie & stone/i })).toHaveCount(0)
})

test('buyer sees demo contractors when the live search API is empty', async ({ page }) => {
  await routeEmptyCompanySearch(page)

  await page.goto('/browse?q=solar')

  await expect(page.getByRole('heading', { name: /desert sun electrical/i })).toBeVisible()
  await expect(page.getByText(/demo contractors for testing/i)).toBeVisible()
})

test('contractor submits a profile, admin approves it, and search shows it', async ({ page }) => {
  const companyId = '11111111-1111-4111-8111-111111111111'
  const electricalCategoryId = '10000000-0000-4000-8000-000000000001'
  let status = 'draft'
  const company = {
    id: companyId,
    name: 'Brightline Electrical Group',
    description:
      'Licensed residential and light-commercial electrical work with organized project handoffs.',
    licenseNumber: 'ELE-20481',
    website: 'https://example.com/brightline',
    phone: '312-555-0101',
    email: 'hello@brightline.example',
    city: 'Chicago',
    state: 'IL',
    zip: '60601',
    serviceRadiusMiles: 35,
    serviceStates: ['IL'],
    serviceCategoryIds: [electricalCategoryId],
  }

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    const json = (data: unknown, statusCode = 200) =>
      route.fulfill({
        status: statusCode,
        contentType: 'application/json',
        body: JSON.stringify({ data, meta: { requestId: 'workflow-test' } }),
      })

    if (path === '/api/v1/service-categories') {
      await json([{ id: electricalCategoryId, name: 'Electrical', slug: 'electrical' }])
      return
    }

    if (path === `/api/v1/companies/${companyId}/onboarding` && method === 'GET') {
      await json({ ...company, status })
      return
    }

    if (path === `/api/v1/companies/${companyId}/onboarding` && method === 'PATCH') {
      Object.assign(company, JSON.parse(request.postData() ?? '{}'))
      status = 'draft'
      await json({
        id: companyId,
        status,
        serviceStates: company.serviceStates,
        serviceCategoryIds: company.serviceCategoryIds,
      })
      return
    }

    if (path === `/api/v1/companies/${companyId}/submit-verification` && method === 'POST') {
      status = 'pending'
      await json({ id: companyId, status })
      return
    }

    if (path === '/api/v1/admin/companies/pending') {
      await json(status === 'pending' ? [{ ...company, status }] : [])
      return
    }

    if (path === `/api/v1/admin/companies/${companyId}/approve` && method === 'POST') {
      status = 'verified'
      await json({ id: companyId, status })
      return
    }

    if (path === '/api/v1/companies' && method === 'GET') {
      await json(
        status === 'verified'
          ? [
              {
                id: companyId,
                name: company.name,
                slug: 'brightline-electrical-group',
                description: company.description,
                categories: ['Electrical'],
                city: company.city,
                state: company.state,
                serviceStates: company.serviceStates,
                serviceRadiusMiles: company.serviceRadiusMiles,
                rating: 0,
                reviewCount: 0,
                verified: true,
                licenseNumber: company.licenseNumber,
                imageUrl: null,
              },
            ]
          : [],
      )
      return
    }

    await route.fallback()
  })

  await page.goto('/dashboard/company')
  await expect(page.getByRole('heading', { name: /company onboarding/i })).toBeVisible()
  await page.getByLabel('Business name').fill(company.name)
  await page.getByLabel('Contact email').fill(company.email)
  await page.getByLabel('Contact phone').fill(company.phone)
  await page.getByLabel('Website').fill(company.website)
  await page.getByLabel('License number').fill(company.licenseNumber)
  await page.getByLabel('City').fill(company.city)
  await page.getByLabel('State').selectOption(company.state)
  await page.getByLabel('ZIP code').fill(company.zip)
  await page.getByLabel('Description').fill(company.description)
  await page.getByLabel('Electrical').check({ force: true })
  await page.getByLabel('Illinois (IL)').check({ force: true })
  await page.getByLabel('Wisconsin (WI)').check({ force: true })
  await page.getByRole('button', { name: /save draft/i }).click()
  await expect(page.getByText(/draft saved/i)).toBeVisible()
  await page.getByRole('button', { name: /submit for review/i }).click()
  await expect(page.getByText(/submitted for verification/i)).toBeVisible()

  await page.goto('/admin')
  await expect(page.getByText(/brightline electrical group/i)).toBeVisible()
  await page.getByRole('button', { name: /approve/i }).click()

  await page.goto('/browse?q=Brightline&state=IL')
  await expect(page.getByRole('heading', { name: /brightline electrical group/i })).toBeVisible()
})

test('quote form validates and completes in demo fallback mode', async ({ page }) => {
  await page.goto('/request-quote?company=11111111-1111-4111-8111-111111111111')
  await page.getByLabel('Name').fill('Jordan Lee')
  await page.getByLabel('Email').fill('jordan@example.com')
  await page.getByLabel('Phone').fill('312-555-0199')
  await page.getByLabel('Street address').fill('1234 W Grand Ave')
  await page.getByLabel('City').fill('Denver')
  await page.getByLabel('State').fill('CO')
  await page.getByLabel('ZIP code').fill('80202')
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
  await expect(page.getByText(/proposal sent - raleigh/i)).toBeVisible()

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
  await expect(page.getByRole('button', { name: /send invoice/i })).toBeVisible()

  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: /trust and safety/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /pending companies/i })).toBeVisible()
  await expect(page.getByText(/canyon masonry group/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /approve/i }).first()).toBeVisible()
})
