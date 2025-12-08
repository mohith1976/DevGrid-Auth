import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import LanguageSnapshot from './LanguageSnapshot';
import Achievements from './Achievements';
import Certifications from './Certifications';

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
  const [aggregate, setAggregate] = useState<any>(null);
  const [profileDoc, setProfileDoc] = useState<any>(null);

  useEffect(()=>{
    async function load(){
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      try{
        // fetch repos from backend
        const r = await axios.get('http://15.207.111.237:3000/api/projects/repos', { headers });
        setRepos(Array.isArray(r.data?.repos) ? r.data.repos : repos);
      } catch(e){ /* ignore */ }
      try{
        // fetch teams
        const t = await axios.get('http://15.207.111.237:3000/api/teams', { headers });
        setTeams(t.data?.teams || []);
        // derive notifications from teams (recent messages)
        const notifs: any[] = [];
        for (const team of (t.data?.teams || [])){
          if (team.lastMessage) notifs.push({ teamId: team._id, teamName: team.name || (team.proposal?.title||''), text: team.lastMessage.message, when: team.lastMessage.createdAt, author: team.lastMessage.authorName || team.lastMessage.userId });
        }
        setNotifications(notifs.sort((a,b)=> new Date(b.when).getTime() - new Date(a.when).getTime()));
      } catch(e){ /* ignore */ }
      try{
        const pm = await axios.get('http://15.207.111.237:3000/api/projects/profile/me', { headers });
        setProfileDoc(pm.data?.profile || null);
        setAggregate(pm.data?.aggregate || null);
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

  const topLangs = useMemo(()=>{
    const skills = aggregate?.skills || {};
    return Object.keys(skills).map(k=>({ label: skills[k].label || k, percent: skills[k].percent || 0, repoCount: skills[k].repoCount || 0 })).sort((a,b)=>b.percent - a.percent).slice(0,8);
  }, [aggregate]);

  const totalCommits = useMemo(()=> (aggregate?.commitsByUser ?? profileDoc?.totalCommits ?? 0), [aggregate, profileDoc]);
  const totalPRs = useMemo(()=> (aggregate?.totalPRs ?? profileDoc?.totalPullRequests ?? 0), [aggregate, profileDoc]);
  const profileLevel = useMemo(()=> (profileDoc?.level ?? 1), [profileDoc]);
  const bioText = useMemo(()=> (profileDoc?.bio ?? 'Building useful tools, contributing to open source, and verifying work. Passionate about developer experience and automation.'), [profileDoc]);

  return (
    <main className="portfolio-canvas" style={{padding:'32px 24px',maxWidth:1200,margin:'0 auto'}}>
      {/* Hero */}
      <section id="hero" style={{display:'flex',gap:24,alignItems:'flex-start',marginBottom:32}}>
        <div className="profile-left">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="avatar" className="profile-avatar" /> : <div className="profile-avatar placeholder">{user.username?.[0]}</div>}
          <div className="profile-meta">
            <h2 style={{display:'flex',alignItems:'center',gap:10}}>
              {user.fullName ?? user.username}
              <span className="level-badge" title="Profile level">{profileLevel}</span>
            </h2>
            <div className="muted">@{user.username} • Developer</div>
            <p className="muted" style={{marginTop:10}}>{bioText}</p>

            <div className="hero-stats" style={{display:'flex',gap:24,marginTop:16}}>
              <div>
                <div className="stat-num">{sampleProjects.length}</div>
                <div className="small muted">Projects</div>
              </div>
              <div>
                <div className="stat-num">{profileDoc?.points ?? 0}</div>
                <div className="small muted">Points</div>
              </div>
              <div>
                <div className="stat-num">{Math.min(100, Math.round(((profileDoc?.points ?? 0) % 1000)/10))}%</div>
                <div className="small muted">To next level</div>
              </div>
            </div>

            <div style={{height:16}} />
            <div className="profile-actions" style={{display:'flex',gap:12}}>
              <a className="btn primary" href={`/profile/${user.username}`} target="_blank" rel="noreferrer">Share portfolio</a>
            </div>
          </div>
        </div>
        <div className="profile-right" style={{flex:1,display:'grid',gap:16}}>
          <section id="skills" style={{padding:16,borderRadius:12,border:'1px solid #222',background:'rgba(255,255,255,0.03)'}}>
            <h4 style={{margin:'0 0 8px'}}>Languages Known</h4>
            <LanguageSnapshot token={localStorage.getItem('token')} />
          </section>

          <section id="summary" style={{padding:16,borderRadius:12,border:'1px solid #222',background:'rgba(255,255,255,0.03)'}}>
            <h4 style={{margin:'0 0 8px'}}>Contributions</h4>
            <div className="map-placeholder muted">Heatmap placeholder — contributions across months</div>
          </section>
        </div>
      </section>

      {/* Contributions */}
      <section id="contributions" style={{padding:16,borderRadius:12,border:'1px solid #222',background:'rgba(255,255,255,0.03)',marginBottom:24}}>
        <h4 style={{margin:'0 0 8px'}}>Contribution Summary</h4>
        <div className="map-placeholder muted">
          Contributions across months
          <div className="small muted">Total commits: {totalCommits} • PRs: {totalPRs}</div>
        </div>
      </section>

      {/* Projects */}
      <section id="projects" style={{padding:16,borderRadius:12,border:'1px solid #222',background:'rgba(255,255,255,0.03)',marginBottom:24}}>
        <h4 style={{margin:'0 0 8px'}}>Projects</h4>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
            {sampleProjects.map(p => (
              <article key={p.name} className="project-card reveal in">
                <div className="proj-header">
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:36,height:36,borderRadius:8,display:'grid',placeItems:'center',background:'linear-gradient(90deg,#7c3aed,#06b6d4)',color:'#022',fontWeight:800}}>{p.name?.charAt(0).toUpperCase()}</div>
                    <div className="proj-title">{p.name}</div>
                  </div>
                </div>
                <p className="muted small">{p.desc}</p>
                <div className="proj-actions"><a className="small" href={p.url} target="_blank" rel="noreferrer">View repo</a></div>
              </article>
            ))}
        </div>
      </section>

      {/* Certifications */}
      <section id="certifications" style={{padding:16,borderRadius:12,border:'1px solid #222',background:'rgba(255,255,255,0.03)',marginBottom:24}}>
        <h4 style={{margin:'0 0 8px'}}>Certifications</h4>
        <div className="cert-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
            {sampleCerts.map((c, i) => (
              <div key={i} className="cert-card">
                <div className="cert-title">{c.title}</div>
                <div className="muted small">{c.issuer} • {c.year}</div>
              </div>
            ))}
        </div>
        <Certifications />
      </section>

      {/* Achievements */}
      <section id="achievements" style={{padding:16,borderRadius:12,border:'1px solid #222',background:'rgba(255,255,255,0.03)',marginBottom:24}}>
        <h4 style={{margin:'0 0 8px'}}>Achievements</h4>
        <Achievements />
      </section>

      {/* Open-source list */}
      <section id="oss" style={{padding:16,borderRadius:12,border:'1px solid #222',background:'rgba(255,255,255,0.03)',marginBottom:24}}>
        <h4 style={{margin:'0 0 8px'}}>Open-source Projects</h4>
        <div style={{display:'flex',gap:16}}>
            <div>
              <div className="stat-num">{sampleProjects.length}</div>
              <div className="small muted">Total repos</div>
            </div>
            <div style={{flex:1}}>
              <ul style={{margin:0,padding:0,listStyle:'none'}}>
                {sampleProjects.map(p=> (
                  <li key={p.name} className="small">
                    <a href={p.url} className="small" target="_blank" rel="noreferrer">{p.name}</a> — <span className="muted">{p.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
      </section>

      {/* Team Projects */}
      <section id="teams" style={{padding:16,borderRadius:12,border:'1px solid #222',background:'rgba(255,255,255,0.03)',marginBottom:24}}>
        <h4 style={{margin:'0 0 8px'}}>Team Projects</h4>
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
      </section>

      {/* Notifications */}
      <section id="notifications" style={{padding:16,borderRadius:12,border:'1px solid #222',background:'rgba(255,255,255,0.03)'}}>
        <h4 style={{margin:'0 0 8px'}}>Team Notifications</h4>
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
      </section>
    </main>
  );
}
