import React, { useEffect, useState } from 'react';

export default function Hero() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="hero-block">
      <div className={`hero-left reveal ${mounted ? 'in delay-1' : ''}`}>
        <h1>Turn your work into a verified, living portfolio</h1>
        <p className="lead muted">DevGrid connects your GitHub, verifies accomplishments, and builds a beautiful portfolio that updates automatically — shareable, verifiable, and gamified.</p>

        <div className="hero-ctas">
          <a href="http://15.207.111.237:3000/auth/github"><button className="btn primary">Get Started — Connect GitHub</button></a>
          <a href="#how"><button className="btn ghost">How it works</button></a>
        </div>

        <div className="trust">
          <div className="trust-item">
            <strong>Verified</strong>
            <div className="muted small">Proof from GitHub & certificates</div>
          </div>
          <div className="trust-item">
            <strong>Automated</strong>
            <div className="muted small">Sets up once, stays updated</div>
          </div>
          <div className="trust-item">
            <strong>Gamified</strong>
            <div className="muted small">Points, levels and shareable badges</div>
          </div>
        </div>
      </div>

      <div className={`hero-right reveal ${mounted ? 'in delay-2' : ''}`}>
        <div className="mock-card">
          
          <div className="mock-header">
            <div className="pill">Profile</div>
            <div className="badge">Pro</div>
          </div>
          <div className="mock-body">
            <div className="row">
              <div className="avatar" />
              <div>
                <div className="mock-name">Jane Developer</div>
                <div className="muted small">Full stack • Open source</div>
              </div>
            </div>

            <div className="stats">
              <div>
                <div className="stat-num">42</div>
                <div className="small muted">Projects</div>
              </div>
              <div>
                <div className="stat-num">3.6k</div>
                <div className="small muted">Contribs</div>
              </div>
              <div>
                <div className="stat-num">120</div>
                <div className="small muted">Points</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
