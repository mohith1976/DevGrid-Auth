import React from 'react';

const testimonials = [
  { name: 'Alex R.', quote: 'DevGrid made my portfolio credible — recruiters noticed the verified projects right away.' },
  { name: 'Priya S.', quote: 'Uploading certificates was effortless. The OCR did the heavy lifting.' },
  { name: 'Sam T.', quote: 'Points and badges made contributing more fun — nice gamification.' },
];

export default function Testimonials() {
  return (
    <section className="testimonials">
      <h2>Trusted by developers</h2>
      <div className="test-grid">
        {testimonials.map((t) => (
          <blockquote key={t.name} className="test-card">
            <p>“{t.quote}”</p>
            <cite>- {t.name}</cite>
          </blockquote>
        ))}
      </div>
    </section>
  );
}
