import React, { useEffect, useState } from 'react';
import AddProjectModal from './AddProjectModal';
import ConfirmModal from './ConfirmModal';
import Toast from './Toast';
import axios from 'axios';
import DeveloperStats from './DeveloperStats';
import LanguageSnapshot from './LanguageSnapshot';
import Achievements from './Achievements';
import ProposalsList from './ProposalsList';
import ProposalCreate from './ProposalCreate';
import DashboardOwnerApplications from './DashboardOwnerApplications';
import DashboardMyApplications from './DashboardMyApplications';

type User = {
  id: string;
  username: string;
  email?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  githubId?: string | null;
};

function IconRepo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2l8 4v6c0 5-3 9-8 10-5-1-8-5-8-10V6l8-4z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconStar(){
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 17.3l6.18 3.9-1.64-7.03L21 9.24l-7.19-.61L12 2 10.19 8.63 3 9.24l4.46 4.93L5.82 21.2 12 17.3z" stroke="currentColor" strokeWidth="0.6" strokeLinejoin="round"/></svg>);
}

function IconProfile(){
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4 0-7 3-7 6v1h14v-1c0-3-3-6-7-6z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
}
function IconProposals(){
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M3 7h18M7 11h10M9 15h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>);
}
function IconTeams(){
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M16 11c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM8 11c1.657 0 3-1.343 3-3S9.657 5 8 5 5 6.343 5 8s1.343 3 3 3zM2 21c0-2.21 3.582-4 8-4s8 1.79 8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
}
function IconStats(){
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M3 12h3v8H3zM10 8h3v12h-3zM17 3h3v17h-3z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
}
// Settings removed

export default function Dashboard({ user }: { user: User }){
  const [projects, setProjects] = useState<Array<any>>([]);
  const [profile, setProfile] = useState<any>({ points: 0, contributionCount: 0, level: 1 });
  const [aggregate, setAggregate] = useState<any>(null);
  const [activities, setActivities] = useState<string[]>([]);
  const [repos, setRepos] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [toast, setToast] = useState<{msg:string,type?:'info'|'success'|'error'} | null>(null);
  const [confirmModal, setConfirmModal] = useState<{open:boolean, repo?:any} | null>(null);

  const [active, setActive] = React.useState<'Projects'|'Profile'|'Achievements'|'Stats'|'Teams'|'OwnerApps'|'MyApps'>('Projects');
  // local, in-dashboard proposal view: null = none, 'list' = browse, 'create' = create form
  const [proposalView, setProposalView] = React.useState<null|'list'|'create'>(null);

  const [showAdd, setShowAdd] = React.useState(false);

  const updateActivities = (nextProjects:any[]) => {
    const acts = (nextProjects || []).slice(0,5).map((p:any)=>`Verified project: ${p.name || p.repoUrl}`);
    setActivities(acts);
  };

  const refresh = async () => {
    const token = localStorage.getItem('token');
    try {
      const [pRes, statsRes, reposRes, teamsRes] = await Promise.all([
        axios.get('http://15.207.111.237:3000/api/projects', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://15.207.111.237:3000/api/projects/profile/me', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://15.207.111.237:3000/api/projects/repos', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://15.207.111.237:3000/api/teams', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setProjects(pRes.data || []);
      setProfile(statsRes.data?.profile || { points: 0, contributionCount: 0, level: 1 });
      setAggregate(statsRes.data?.aggregate || null);
      setRepos(reposRes.data?.repos || []);
      setTeams(teamsRes.data?.teams || []);
      updateActivities(pRes.data || []);
      // make sure we attempt to load account-level aggregate (may be computed async)
      try { loadAggregate(); } catch (e) { /* ignore */ }
    } catch (e) {
      // keep defaults
    }
  };

  useEffect(()=>{ refresh(); }, []);

  const loadAggregate = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await axios.get('http://15.207.111.237:3000/api/projects/profile/aggregate', { headers: { Authorization: `Bearer ${token}` } });
      setAggregate(res.data?.aggregate || null);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const sse = new EventSource(`http://15.207.111.237:3000/api/projects/events?token=${token}`);
    sse.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data || '{}');
        if (payload?.profile) {
          setProfile(payload.profile);
          // when language aggregation finishes, also refresh aggregate snapshot
          if (payload?.source === 'language-agg') loadAggregate();
        }
      } catch (e) {
        // ignore malformed event
      }
    };
    sse.onerror = () => {
      sse.close();
    };
    return () => sse.close();
  }, []);

  // Poll briefly for aggregate if it's missing (worker may update profile async)
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 10; // poll ~10 times (every 3s = 30s)
    const tryPoll = async () => {
      if (cancelled) return;
      if (aggregate && aggregate.skills && Object.keys(aggregate.skills).length > 0) return;
      try {
        await loadAggregate();
      } catch (e) { /* ignore */ }
      attempts++;
      if (attempts >= maxAttempts) return;
      setTimeout(tryPoll, 3000);
    };
    // start polling only if aggregate absent
    if (!aggregate || !aggregate.skills || Object.keys(aggregate.skills).length === 0) tryPoll();
    return () => { cancelled = true; };
  }, [aggregate]);

  return (
    <div className="dashboard-shell reveal in">
      <aside className="sidebar">
        <div className="side-brand">
          <div className="logo">DG</div>
          <div>
           
            <div className="muted small">Developer Dashboard</div>
          </div>
        </div>

        <nav className="side-nav">
          <a className={`nav-item ${active==='Profile' ? 'active':''}`} onClick={() => setActive('Profile')}><span className="nav-icon"><IconProfile /></span> Profile</a>
          <a className={`nav-item ${active==='Projects' ? 'active':''}`} onClick={() => setActive('Projects')}><span className="nav-icon"><IconRepo /></span> Projects</a>
          <a className={`nav-item ${active==='Achievements' ? 'active':''}`} onClick={() => setActive('Achievements')}><span className="nav-icon"><IconStar /></span> Achievements</a>
          <a className={`nav-item ${active==='OwnerApps' ? 'active':''}`} onClick={() => setActive('OwnerApps')}><span className="nav-icon"><IconProposals /></span> Proposals</a>
          <a className={`nav-item ${active==='MyApps' ? 'active':''}`} onClick={() => setActive('MyApps')}><span className="nav-icon"><IconProposals /></span> My Applications</a>
          <a className={`nav-item ${active==='Teams' ? 'active':''}`} onClick={() => setActive('Teams')}><span className="nav-icon"><IconTeams /></span> Teams</a>
          <a className={`nav-item ${active==='Stats' ? 'active':''}`} onClick={() => setActive('Stats')}><span className="nav-icon"><IconStats /></span> Stats</a>
          {/* Settings removed */}
        </nav>
      </aside>

      <main className="dash-main">
        <div className="topbar">
          <div className="header-illustration">✨</div>
          <div className="top-actions">
            <div className="action-group">
              <button className="btn primary" onClick={()=>setShowAdd(true)}><span className="btn-icon"><IconRepo/></span> Publish</button>
              <button className="btn ghost" onClick={()=>{ setProposalView('list'); }}><span className="btn-icon"><IconProposals/></span> Browse</button>
              <button className="btn ghost" onClick={()=>{ setProposalView('create'); }}><span className="btn-icon"><IconProposals/></span> Create</button>
            </div>
            <div className="profile-inline">
              <div className="hello small muted">Hello, <strong>{user.username}</strong></div>
              <div className="avatar-with-level">
                {user.avatarUrl ? <img src={user.avatarUrl} className="avatar-sm" alt="avatar" /> : <div className="avatar-sm placeholder">{user.username?.[0]}</div>}
                <div className="level-badge">{profile?.level ?? 1}</div>
              </div>
            </div>
          </div>
        </div>
        {proposalView ? (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ fontWeight:600 }}>{proposalView === 'create' ? 'Create Proposal' : 'Browse Proposals'}</div>
              <div>
                <button className="btn ghost small" onClick={()=>setProposalView(null)}>Back</button>
              </div>
            </div>
            {proposalView === 'create' ? <ProposalCreate /> : <ProposalsList />}
          </div>
        ) : active === 'Profile' ? (
          // lazy-load profile component
          <React.Suspense fallback={<div className="card">Loading profile…</div>}>
            <ProfilePlaceholder user={user} />
          </React.Suspense>
        ) : active === 'Projects' ? (
          <>
            <div className="overview-grid">
              <div className="card overview">
                <h4>Projects</h4>
                <div className="big">{repos.length ?? projects.length}</div>
                <div className="small muted">Owned repositories (you can publish to Open Source)</div>
              </div>
              <div className="card overview">
                <h4>Points</h4>
                <div className="big">{profile?.points ?? 0}</div>
                <div className="small muted">Total points earned</div>
                <div className="small muted">{profile?.totalCommits ?? 0} contributions • {profile?.totalPullRequests ?? 0} PRs</div>
              </div>
              <div className="card overview">
                <h4>Contributions</h4>
                <div className="big">{aggregate?.commitsByUser ?? profile?.totalCommits ?? 0}</div>
                <div className="small muted">Total contributions (account)</div>
              </div>
              <div className="card overview">
                <h4>Pull Requests</h4>
                <div className="big">{aggregate?.totalPRs ?? profile?.totalPullRequests ?? 0}</div>
                <div className="small muted">Total PRs (account)</div>
              </div>
              {/* Level card removed; level now shown as small badge on avatar */}
            </div>

            <div className="dash-grid">
              <div className="col-left">
                <div className="card">
                  <h4>Owned Repositories</h4>
                  <ul className="project-list">
                    {repos.slice(0,12).map((r:any) => {
                      // determine if published (exists in projects)
                      const repoUrl = r.html_url || r.full || `${r.owner}/${r.name}`;
                      const published = projects.some((p:any) => (p.repoUrl || '').toLowerCase() === (repoUrl||'').toLowerCase() || (p.repoUrl || '').toLowerCase().includes((r.full||'').toLowerCase()));
                      return (
                        <li key={repoUrl} className="project-item">
                          <div className="proj-left">
                            <div className="proj-name">{r.name}</div>
                            <div className="muted small">{r.description || r.html_url}</div>
                          </div>
                          <div className="proj-right">
                            <div className="small muted">{r.contributorsCount ?? 0} contributors</div>
                            <div style={{display:'flex',gap:8,marginLeft:8}}>
                              {!published ? (
                                <button className="btn small" onClick={async ()=>{
                                  try {
                                    const otherContribs = (r.contributors || []).filter((x:string) => String(x).toLowerCase() !== String(user.username).toLowerCase());
                                    // open confirm modal
                                    setConfirmModal({ open: true, repo: { repoUrl, contributors: r.contributors || [] } });
                                  } catch (e:any){ setToast({ msg: 'Publish failed: '+(e?.response?.data?.message || e?.message || 'unknown'), type: 'error' }); }
                                }}>Publish</button>
                              ) : (
                                <button className="btn ghost small" onClick={async ()=>{ try { const token = localStorage.getItem('token'); const res = await axios.post('http://15.207.111.237:3000/api/projects/unpublish',{ repo: repoUrl }, { headers: { Authorization: `Bearer ${token}` } }); if (res.data?.success) { if (res.data.profile) setProfile(res.data.profile); setProjects((prev)=>{ const next = prev.filter((p:any)=>!String(p.repoUrl||'').toLowerCase().includes((r.full||'').toLowerCase())); updateActivities(next); return next; }); setToast({ msg: 'Unpublished', type: 'success' }); } else setToast({ msg: 'Unpublish failed: '+(res.data?.message||'unknown'), type: 'error' }); } catch (e:any){ setToast({ msg: 'Unpublish failed: '+(e?.response?.data?.message || e?.message || 'unknown'), type: 'error' }); } }}>Unpublish</button>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="card">
                  <h4>Open-source Publications</h4>
                  <div className="pub-row">
                    <div className="pub-stat">
                      <div className="stat-num">{projects.length}</div>
                      <div className="small muted">Published projects</div>
                    </div>
                    <div className="pub-content">
                      <div className="small muted">Projects published to Open Source</div>
                      <div className="pub-list">
                        {projects.slice(0,6).map((p:any)=> (
                          <article key={p._id || p.repoUrl} className="pub-card">
                            <div className="pub-title"><a href={p.repoUrl || p.url || '#'} target="_blank" rel="noreferrer">{p.name || p.repoUrl}</a></div>
                            {p.description ? <div className="pub-desc muted small">{p.description}</div> : null}
                            <div className="pub-meta small muted">
                              <span>{p.commitsCount ?? p.contributionsCount ?? 0} contribs</span>
                              <span>•</span>
                              <span>{p.pullRequestsCount ?? p.prsCount ?? 0} PRs</span>
                            </div>
                          </article>
                        ))}
                      </div>
                      {projects.length > 6 && <div className="small" style={{marginTop:8}}><a href="#" className="small">View all publications</a></div>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-right">
                

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
                      {/* derive recent messages */}
                      {teams.flatMap(t => (t.lastMessage ? [{ teamId: t._id, teamName: t.name||t.proposal?.title, text: t.lastMessage.message, when: t.lastMessage.createdAt, author: t.lastMessage.authorName || t.lastMessage.userId }]:[])).slice(0,6).map((n:any,i:number)=> (
                        <div key={i} className="notif-item" style={{display:'flex',gap:10,alignItems:'center'}}>
                          <div className="avatar-sm placeholder">{(n.author||'U')[0]}</div>
                          <div>
                            <div style={{fontWeight:700}}>{n.author}</div>
                            <div className="small muted">{String(n.text).slice(0,80)} • {new Date(n.when).toLocaleString()}</div>
                          </div>
                        </div>
                      ))}
                      {teams.length === 0 && <div className="small muted">No recent notifications</div>}
                    </div>
                  </div>
                      <div className="card">
                  <h4>Activity</h4>
                  <ul className="activity">
                    {activities.map((a,i) => <li key={i} className="small muted">{a}</li>)}
                  </ul>
                </div>
                  <div className="card">
                    <h4>Language Snapshot</h4>
                    <LanguageSnapshot token={localStorage.getItem('token')} />
                  </div>
              </div>
            </div>
          </>
        ) : active === 'Achievements' ? (
          <div>
            <Achievements />
          </div>
        ) : active === 'OwnerApps' ? (
          <div>
            <DashboardOwnerApplications user={user} />
          </div>
        ) : active === 'MyApps' ? (
          <div>
            <DashboardMyApplications user={user} />
          </div>
        ) : active === 'Teams' ? (
          <div>
            <React.Suspense fallback={<div className="card">Loading teams…</div>}>
              <Teams user={user} />
            </React.Suspense>
          </div>
        ) : active === 'Stats' ? (
          <div>
            <DeveloperStats />
          </div>
        ) : (
          <div />
        )}

      </main>
      {showAdd && <AddProjectModal onClose={()=>setShowAdd(false)} onSuccess={(data?:any) => {
        if (data?.project) {
          setProjects((prev)=>{
            const exists = prev.some((p:any)=>String(p.repoUrl||'').toLowerCase() === String(data.project.repoUrl||'').toLowerCase());
            const next = exists ? prev : [data.project, ...prev];
            updateActivities(next);
            return next;
          });
        }
        if (data?.profile) setProfile(data.profile);
        setShowAdd(false);
      }} />}
      <ConfirmModal open={!!confirmModal?.open} title="Publish repository" body="Include collaborators?" items={confirmModal?.repo?.contributors || []} onCancel={() => setConfirmModal(null)} onConfirm={async (include:boolean) => {
        try {
          const repoUrl = confirmModal?.repo?.repoUrl;
          const token = localStorage.getItem('token');
          const res = await axios.post('http://15.207.111.237:3000/api/projects/publish',{ repo: repoUrl, includeCollaborators: include }, { headers: { Authorization: `Bearer ${token}` } });
          if (res.data?.success) {
            // if the API returned an updated profile, use it to update UI immediately
            if (res.data.profile) setProfile(res.data.profile);
            setToast({ msg: 'Publish succeeded', type: 'success' });
            // if project returned, add it locally for immediate feedback
            if (res.data.project) {
              setProjects((prev)=>{
                const exists = prev.some((p:any)=>String(p.repoUrl||'').toLowerCase() === String(res.data.project.repoUrl||'').toLowerCase());
                const next = exists ? prev : [res.data.project, ...prev];
                updateActivities(next);
                return next;
              });
            }
          } else setToast({ msg: 'Publish failed: ' + (res.data?.message || 'unknown'), type: 'error' });
        } catch (e:any) { setToast({ msg: 'Publish failed: ' + (e?.response?.data?.message || e?.message || 'unknown'), type: 'error' }); }
        setConfirmModal(null);
      }} />
      <Toast message={toast?.msg} type={toast?.type} onClose={()=>setToast(null)} />
    </div>
  );
}

// Lazy wrapper to import profile page to avoid import cycles
const ProfilePlaceholder = (props:{user:User}) => {
  const Profile = React.lazy(() => import('./ProfilePage'));
  return <Profile user={props.user} projects={undefined} certs={undefined} achievements={undefined} />;
};

// placeholders for owner/apps pages
const OwnerAppsPlaceholder = (props:{user:any}) => {
  const Owner = React.lazy(() => import('./DashboardOwnerApplications'));
  return <Owner user={props.user} />;
};

const MyAppsPlaceholder = (props:{user:any}) => {
  const Mine = React.lazy(() => import('./DashboardMyApplications'));
  return <Mine user={props.user} />;
};

// Lazy load Teams page
const Teams = React.lazy(() => import('./Teams'));

// render modal at bottom of file so TSX compiles
export function DashboardWithModalWrapper(props:{user:User}){
  return (
    <div>
      <Dashboard {...props} />
      {/* Modal controlled inside Dashboard; nothing here */}
    </div>
  );
}
