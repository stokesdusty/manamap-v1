import type { LegalDocument as LegalDocumentContent } from '@manamap/shared';

export function LegalDocument({ doc }: { doc: LegalDocumentContent }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        background: 'var(--paper)',
        padding: '48px 24px',
      }}
    >
      <div className="card" style={{ maxWidth: 720, width: '100%', padding: '48px 40px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{doc.title}</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 32 }}>
          Effective {doc.effectiveDate}
        </p>

        {doc.sections.map((section) => (
          <section key={section.heading} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{section.heading}</h2>
            {section.body.map((paragraph, i) => (
              <p
                key={i}
                style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 10 }}
              >
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
