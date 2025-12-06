import React from 'react';

export default function PublicProfile({ username }:{username:string}){
  // In a full implementation we'd fetch public profile data from the backend by username.
  // For now render a visually rich portfolio page using sample data.
  const sample = {
    fullName: username,
    bio: 'Full-stack engineer. Open source maintainer. Building delightful developer tools.',
    projects: [
      {name:'devgrid-core', desc:'Auth & verification platform', stars:124, url:'#'},
      {name:'portfolio-ui', desc:'Beautiful, verified portfolios', stars:82, url:'#'},
    ],
    achievements:['Top100 Contributor','Verifier','Mentor']
  };

  return (
    <div className="public-profile">
      <header className="public-header">
        <div className="brand">
          <div className="logo">DG</div>
          <div>
            <h1>{sample.fullName}</h1>
            <div className="muted">@{username} • {sample.bio}</div>
          </div>
        </div>
        <div className="share">
          <button className="btn">Download PDF</button>
          <button className="btn primary">Follow</button>
        </div>
      </header>

      <main className="public-main container">
        <section className="public-hero card">
          <div className="public-hero-left">
            <h2>Selected Projects</h2>
            <p className="muted">Verified projects, recent work and open-source contributions.</p>
            <div className="project-grid">
              {sample.projects.map(p => (
                <article key={p.name} className="project-card">
                  <div className="proj-header">
                    <div className="proj-title">{p.name}</div>
                    <div className="proj-stars">⭐ {p.stars}</div>
                  </div>
                  <p className="muted small">{p.desc}</p>
                </article>
              ))}
            </div>
          </div>
          <aside className="public-hero-right">
            <div className="card">
              <h4>Achievements</h4>
              <div className="badges-row">
                {sample.achievements.map(a => <div key={a} className="badge-large">{a}</div>)}
              </div>
            </div>
            <div style={{height:12}} />
            <div className="card">
              <h4>Skills</h4>
              <div className="skill-mini"><div className="skill-name">TypeScript</div><div className="skill-bar"><div className="skill-fill" style={{width:'72%'}}/></div></div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
