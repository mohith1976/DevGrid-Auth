import React from 'react';

type User = {
  id: string;
  username: string;
  email?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  githubId?: string | null;
};

export default function ProfilePage({ user, projects, certs, achievements }:
  { user: User; projects?: any[]; certs?: any[]; achievements?: any[] }){

  const sampleProjects = projects ?? [
    {name:'devgrid-core', desc:'Auth, verification & APIs', stars:124, url:'#'},
    {name:'portfolio-ui', desc:'Shareable portfolio renderer', stars:82, url:'#'},
  ];

  const sampleCerts = certs ?? [
    {title:'Cloud Developer', issuer:'Coursera', year:2024},
    {title:'Advanced Node.js', issuer:'Udemy', year:2023},
  ];

  const sampleAchievements = achievements ?? ['Top100 Contributor','Verifier','Mentor'];

  return (
    <section className="profile-page">
      <div className="profile-hero card">
        <div className="profile-left">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="avatar" className="profile-avatar" /> : <div className="profile-avatar placeholder">{user.username?.[0]}</div>}
          <div className="profile-meta">
            <h2>{user.fullName ?? user.username}</h2>
            <div className="muted">@{user.username} • Developer</div>
            <p className="muted" style={{marginTop:10}}>Building useful tools, contributing to open source, and verifying work. Passionate about developer experience and automation.</p>

            <div className="hero-stats">
              <div>
                <div className="stat-num">42</div>
                <div className="small muted">Projects</div>
              </div>
              <div>
                <div className="stat-num">1.4k</div>
                <div className="small muted">Points</div>
              </div>
              <div>
                <div className="stat-num">58%</div>
                <div className="small muted">To next level</div>
              </div>
            </div>

            <div style={{height:12}} />
            <div className="profile-actions">
              <a className="btn primary" href={`/profile/${user.username}`} target="_blank" rel="noreferrer">Share portfolio</a>
              <button className="btn ghost">Edit profile</button>
            </div>
          </div>
        </div>

        <div className="profile-right">
          <div className="card small">
            <h4>Skill Snapshot</h4>
            <div className="skill-mini"><div className="skill-name">TypeScript</div><div className="skill-bar"><div className="skill-fill" style={{width:'72%'}}/></div></div>
            <div style={{height:10}} />
            <div className="skill-mini"><div className="skill-name">React</div><div className="skill-bar"><div className="skill-fill" style={{width:'78%'}}/></div></div>
          </div>

          <div className="card small">
            <h4>Contribution Map</h4>
            <div className="map-placeholder muted">Heatmap placeholder — contributions across months</div>
          </div>
        </div>
      </div>

      <div className="profile-body">
        <div className="col-left">
          <div className="card">
            <h4>Projects</h4>
            <div className="project-grid">
              {sampleProjects.map(p => (
                <article key={p.name} className="project-card reveal in">
                  <div className="proj-header">
                    <div className="proj-title">{p.name}</div>
                    <div className="proj-stars">⭐ {p.stars}</div>
                  </div>
                  <p className="muted small">{p.desc}</p>
                  <div className="proj-actions"><a className="small" href={p.url}>View repo</a></div>
                </article>
              ))}
            </div>
          </div>

          <div className="card">
            <h4>Certifications</h4>
            <div className="cert-grid">
              {sampleCerts.map((c, i) => (
                <div key={i} className="cert-card">
                  <div className="cert-title">{c.title}</div>
                  <div className="muted small">{c.issuer} • {c.year}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="col-right">
          <div className="card">
            <h4>Achievements</h4>
            <div className="badges-row">
              {sampleAchievements.map(a => <div key={a} className="badge-large">{a}</div>)}
            </div>
          </div>

          <div className="card">
            <h4>Activity Timeline</h4>
            <ol className="timeline">
              <li className="small muted">2025-11-21: Verified project devgrid-core</li>
              <li className="small muted">2025-10-02: Earned Verifier badge</li>
              <li className="small muted">2025-08-15: Published portfolio</li>
            </ol>
          </div>
        </aside>
      </div>
    </section>
  );
}
