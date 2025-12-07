import React, { useEffect, useState } from 'react';
import axios from 'axios';

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

  const [repos, setRepos] = useState<any[]>(projects ?? []);
  const [teams, setTeams] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    async function load(){
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      try{
        // fetch repos from backend
        const r = await axios.get('http://localhost:3000/api/projects/repos', { headers });
        setRepos(Array.isArray(r.data?.repos) ? r.data.repos : repos);
      } catch(e){ /* ignore */ }
      try{
        // fetch teams
        const t = await axios.get('http://localhost:3000/api/teams', { headers });
        setTeams(t.data?.teams || []);
        // derive notifications from teams (recent messages)
        const notifs: any[] = [];
        for (const team of (t.data?.teams || [])){
          if (team.lastMessage) notifs.push({ teamId: team._id, teamName: team.name || (team.proposal?.title||''), text: team.lastMessage.message, when: team.lastMessage.createdAt, author: team.lastMessage.authorName || team.lastMessage.userId });
        }
        setNotifications(notifs.sort((a,b)=> new Date(b.when).getTime() - new Date(a.when).getTime()));
      } catch(e){ /* ignore */ }
      setLoading(false);
    }
    load();
  }, []);

  const sampleProjects = repos.length > 0 ? repos.map((r:any)=> ({ name: r.full_name || r.name, desc: r.description || '', url: r.html_url || '#' })) : [
    {name:'devgrid-core', desc:'Auth, verification & APIs', stars:124, url:'#'},
    {name:'portfolio-ui', desc:'Shareable portfolio renderer', stars:82, url:'#'},
  ];

  const sampleCerts = certs ?? [
    {title:'Cloud Developer', issuer:'Coursera', year:2024},
    {title:'Advanced Node.js', issuer:'Udemy', year:2023},
  ];

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
                <div className="stat-num">{sampleProjects.length}</div>
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
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:36,height:36,borderRadius:8,display:'grid',placeItems:'center',background:'linear-gradient(90deg,#7c3aed,#06b6d4)',color:'#022',fontWeight:800}}>{p.name?.charAt(0).toUpperCase()}</div>
                      <div className="proj-title">{p.name}</div>
                    </div>
                    <div className="proj-stars">⭐ {p.stars || ''}</div>
                  </div>
                  <p className="muted small">{p.desc}</p>
                  <div className="proj-actions"><a className="small" href={p.url} target="_blank" rel="noreferrer">View repo</a></div>
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
            <h4>Repository Summary</h4>
            <div style={{display:'flex',gap:12,alignItems:'center'}}>
              <div>
                <div className="stat-num">{sampleProjects.length}</div>
                <div className="small muted">Total repos</div>
              </div>
              <div style={{flex:1}}>
                <div className="small muted">Open-source projects</div>
                <ul style={{margin:0,padding:0,listStyle:'none'}}>
                  {sampleProjects.map(p=> <li key={p.name} className="small"><a href={p.url} className="small" target="_blank" rel="noreferrer">{p.name}</a> — <span className="muted">{p.desc}</span></li>)}
                </ul>
              </div>
            </div>
          </div>

          <div className="card">
            <h4>Ongoing Team Projects</h4>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {teams.length === 0 && <div className="small muted">No active team projects</div>}
              {teams.map(t=> (
                <div key={t._id} style={{display:'flex',alignItems:'center',gap:10}}>
                  <div className="avatar-sm placeholder">{t.name?.charAt(0) || 'T'}</div>
                  <div>
                    <div style={{fontWeight:700}}>{t.name || (t.proposal?.title || 'Team')}</div>
                    <div className="small muted">{(t.members || []).length} members • {t.proposal?.status || 'active'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h4>Team Notifications</h4>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {notifications.length === 0 && <div className="small muted">No recent notifications</div>}
              {notifications.map((n,i)=> (
                <div key={i} className="notif-item" style={{display:'flex',gap:10,alignItems:'center'}}>
                  <div className="avatar-sm placeholder">{(n.author||'U')[0]}</div>
                  <div>
                    <div style={{fontWeight:700}}>{n.author}</div>
                    <div className="small muted">{n.text?.slice(0,80)} • {new Date(n.when).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
