import React from 'react';

function ProgressRing({percent=65, size=120}:{percent?:number; size?:number}){
  const r = size/2 - 8;
  const c = 2*Math.PI*r;
  const dash = (percent/100)*c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="progress-ring">
      <defs>
        <linearGradient id="ring" x1="0" x2="1">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={8} fill="none" />
      <circle cx={size/2} cy={size/2} r={r} stroke="url(#ring)" strokeWidth={8} fill="none" strokeLinecap="round"
        strokeDasharray={`${dash} ${c-dash}`} transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fill="#e6eef8" fontWeight={700}>{percent}%</text>
    </svg>
  );
}

export default function Gamification(){
  const badges = ['Contributor','Verifier','Mentor','Top100'];
  return (
    <section className="gamification">
      <h2>Gamification & Rewards</h2>
      <div className="g-grid">
        <div className="card center">
          <h4>Level Progress</h4>
          <ProgressRing percent={58} />
          <div className="muted small">Earn points by contributing, getting projects verified and sharing your portfolio.</div>
        </div>

        <div className="card">
          <h4>Badges</h4>
          <div className="badges">
            {badges.map(b => (
              <div key={b} className="badge-item">
                <div className="badge-ico">★</div>
                <div className="small">{b}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h4>Points</h4>
          <div className="points big">1,420</div>
          <div className="muted small">Total points earned</div>
        </div>
      </div>
    </section>
  );
}
