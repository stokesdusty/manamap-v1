export function SupportPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}>
      <div className="card" style={{ maxWidth: 480, width: '100%', padding: '48px 36px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🗺️</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>ManaMap Support</h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
          Having trouble with ManaMap? We're happy to help. Reach out and we'll get back to you as soon as we can.
        </p>

        <a
          href="mailto:stokes.dusty@gmail.com"
          className="btn"
          style={{ display: 'inline-block', marginBottom: 32 }}
        >
          stokes.dusty@gmail.com
        </a>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', marginBottom: 24 }} />

        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Common questions</h2>
        <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
          <li>App crashing or not loading? Try closing and reopening the app.</li>
          <li>Can't find your local game store? Use "Suggest a Store" inside the app.</li>
          <li>Check-in not working? Make sure location permissions are enabled.</li>
          <li>Want to remove your account or data? Email us and we'll take care of it.</li>
        </ul>
      </div>
    </div>
  );
}
