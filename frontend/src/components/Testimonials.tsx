import React from 'react';

const testimonials = [
  { name: 'Harsha Tumma.', quote: 'DevGrid made my portfolio credible — recruiters noticed the verified projects right away.' },
  { name: 'SivaKumar Vemuri.', quote: 'Uploading certificates was effortless. The OCR did the heavy lifting.' },
  { name: 'Sriram Kolli', quote: 'Points and badges made contributing more fun — nice gamification.' },
  { name: 'Harsha Kurasala', quote: 'DevGrid made collaboration feel structured — tasks, contributions, and progress were finally visible.' },

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
