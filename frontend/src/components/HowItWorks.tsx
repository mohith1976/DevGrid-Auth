import React from 'react';

const steps = [
  { title: 'Connect GitHub', desc: 'Authorize DevGrid to read your public repos and basic profile information.' },
  { title: 'Verify Projects', desc: 'We scan contributions, tags and repo metadata to verify project ownership.' },
  { title: 'Upload Proofs', desc: 'Add certificates or achievement screenshots — we OCR and validate them.' },
  { title: 'Publish Portfolio', desc: 'A living portfolio page is generated and kept up to date automatically.' },
];

export default function HowItWorks() {
  return (
    <section id="how" className="how">
      <h2>How it works</h2>
      <div className="how-grid">
        {steps.map((s, idx) => (
          <div key={s.title} className="how-step">
            <div className="step-num">{idx + 1}</div>
            <div>
              <h4>{s.title}</h4>
              <p className="muted small">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
