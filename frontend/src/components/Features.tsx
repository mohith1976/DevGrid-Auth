import React from 'react';

const items = [
  { title: 'Verified Projects', desc: 'We verify repositories, contributions and release tags to ensure work authenticity.' },
  { title: 'Find Contribution Opportunities', desc: 'Discover open-source projects matching your skills and issues you can contribute to.' },
  { title: 'Certificate OCR', desc: 'Upload certificates; we extract details automatically and attach them to your profile.' },
  { title: 'Skill Maps & Stats', desc: 'Automatic skill-level tracking with contribution maps and activity visualizations.' },
  { title: 'Achievements & Badges', desc: 'Earn points and badges for contributions, verified projects and community work.' },
  { title: 'Shareable Portfolio', desc: 'One-click shareable portfolio page — embeddable on your CV or social profiles.' },
];

export default function Features() {
  return (
    <section className="features">
      <h2>What DevGrid Does</h2>
      <p className="muted">A developer-first platform that automates portfolio generation and verification.</p>
      <div className="feature-grid">
        {items.map((i) => (
          <div className="feature" key={i.title}>
            <div className="feature-ico" />
            <h4>{i.title}</h4>
            <p className="muted small">{i.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
