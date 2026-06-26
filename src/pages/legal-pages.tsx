const documents = {
  privacy: {
    title: 'Privacy Policy',
    intro:
      'This draft describes how the marketplace expects to collect, use, retain, and protect personal information.',
  },
  terms: {
    title: 'Terms of Use',
    intro:
      'This draft governs access to the marketplace and defines the platform as a lead, communication, job-record, and invoicing service.',
  },
  vendor: {
    title: 'Vendor Agreement',
    intro:
      'This draft describes company eligibility, profile accuracy, credential responsibilities, service delivery, invoicing, and marketplace conduct.',
  },
  disputes: {
    title: 'Dispute Policy',
    intro:
      'This draft describes how buyers and companies submit concerns, preserve supporting records, and participate in platform review.',
  },
} as const

export function LegalPage({ kind }: { kind: keyof typeof documents }) {
  const doc = documents[kind]
  return (
    <article className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <p className="font-bold text-amber-700">Implementation draft - legal review required</p>
      <h1 className="mt-3 text-4xl font-black">{doc.title}</h1>
      <p className="mt-6 text-lg leading-8 text-slate-600">{doc.intro}</p>
      <div className="prose-legal mt-10">
        <h2>1. Scope</h2>
        <p>
          This policy applies to marketplace visitors, buyers, business representatives, staff
          users, and administrators. The final document must identify the legal operator, contact
          address, effective date, and governing jurisdiction.
        </p>
        <h2>2. Platform role</h2>
        <p>
          The marketplace helps users discover businesses, exchange project information, track jobs,
          and create or view invoices. It does not employ listed contractors, guarantee their work,
          or process payment in version one.
        </p>
        <h2>3. Records and communications</h2>
        <p>
          Project requests, messages, status changes, files, proposals, change orders, invoices,
          reviews, support cases, and administrative actions may be retained to provide the service,
          prevent abuse, and resolve disputes.
        </p>
        <h2>4. User responsibilities</h2>
        <p>
          Users must provide accurate information, protect their accounts, use project data only for
          legitimate service delivery, and comply with applicable licensing, tax, employment,
          safety, consumer, and privacy laws.
        </p>
        <h2>5. Review required</h2>
        <p>
          This page is a product placeholder and not legal advice. Qualified counsel must replace or
          approve it before a public launch.
        </p>
      </div>
    </article>
  )
}
