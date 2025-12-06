import React from 'react';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="foot-grid">
          <div>
            <div className="logo small">DG</div>
            <p className="muted small">DevGrid — Verified developer portfolios</p>
          </div>
          <div>
            <h4>Product</h4>
            <div className="muted small">Features • Pricing • Docs</div>
          </div>
          <div>
            <h4>Company</h4>
            <div className="muted small">About • Blog • Careers</div>
          </div>
        </div>
        <div className="foot-bottom muted small">© {new Date().getFullYear()} DevGrid. Built with ❤️.</div>
      </div>
    </footer>
  );
}
