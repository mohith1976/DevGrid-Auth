import React, { useEffect, useState } from 'react';
import AddProjectModal from './AddProjectModal';
import ConfirmModal from './ConfirmModal';
import Toast from './Toast';
import axios from 'axios';
import DeveloperStats from './DeveloperStats';
import LanguageSnapshot from './LanguageSnapshot';
import ProposalsList from './ProposalsList';
import ProposalCreate from './ProposalCreate';

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

export default function Dashboard({ user }: { user: User }){
  const [projects, setProjects] = useState<Array<any>>([]);
  const [profile, setProfile] = useState<any>({ points: 0, contributionCount: 0, level: 1 });
  const [aggregate, setAggregate] = useState<any>(null);
  const [activities, setActivities] = useState<string[]>([]);
  const [repos, setRepos] = useState<any[]>([]);
  const [toast, setToast] = useState<{msg:string,type?:'info'|'success'|'error'} | null>(null);
  const [confirmModal, setConfirmModal] = useState<{open:boolean, repo?:any} | null>(null);

  const [active, setActive] = React.useState<'Projects'|'Profile'|'Achievements'|'Stats'|'Settings'>('Projects');
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
      const [pRes, statsRes, reposRes] = await Promise.all([
        axios.get('http://localhost:3000/api/projects', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:3000/api/projects/profile/me', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:3000/api/projects/repos', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setProjects(pRes.data || []);
      setProfile(statsRes.data?.profile || { points: 0, contributionCount: 0, level: 1 });
      setAggregate(statsRes.data?.aggregate || null);
      setRepos(reposRes.data?.repos || []);
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
      const res = await axios.get('http://localhost:3000/api/projects/profile/aggregate', { headers: { Authorization: `Bearer ${token}` } });
      setAggregate(res.data?.aggregate || null);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const sse = new EventSource(`http://localhost:3000/api/projects/events?token=${token}`);
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
            <div className="small">DevGrid</div>
            <div className="muted small">Developer Dashboard</div>
          </div>
        </div>

        <nav className="side-nav">
          <a className={`nav-item ${active==='Profile' ? 'active':''}`} onClick={() => setActive('Profile')}><div style={{width:18}}/> Profile</a>
          <a className={`nav-item ${active==='Projects' ? 'active':''}`} onClick={() => setActive('Projects')}><IconRepo /> Projects</a>
          <a className={`nav-item ${active==='Achievements' ? 'active':''}`} onClick={() => setActive('Achievements')}><IconStar /> Achievements</a>
          <a className={`nav-item ${active==='Stats' ? 'active':''}`} onClick={() => setActive('Stats')}>Stats</a>
          <a className={`nav-item ${active==='Settings' ? 'active':''}`} onClick={() => setActive('Settings')}>Settings</a>
        </nav>
      </aside>

      <main className="dash-main">
        <div className="topbar">
          <div className="search">🔍 Search projects, people, badges</div>
          <div className="top-actions">
            <button className="btn" onClick={()=>setShowAdd(true)}>Publish Project</button>
            <button className="btn" onClick={()=>{ setProposalView('list'); }}>Browse Proposals</button>
            <button className="btn" onClick={()=>{ setProposalView('create'); }}>Create Proposal</button>
            {/* recompute button removed — profile recalculation happens automatically on publish/unpublish */}
            <div className="small muted">Hello, <strong>{user.username}</strong></div>
            {user.avatarUrl ? <img src={user.avatarUrl} className="avatar-sm" alt="avatar" /> : <div className="avatar-sm placeholder">{user.username?.[0]}</div>}
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
                <div className="small muted">{profile?.totalCommits ?? 0} commits • {profile?.totalPullRequests ?? 0} PRs</div>
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
              <div className="card overview">
                <h4>Level</h4>
                <div className="big">Level {profile?.level ?? 1}</div>
                <div className="small muted">Progress to next level</div>
              </div>
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
                                <button className="btn ghost small" onClick={async ()=>{ try { const token = localStorage.getItem('token'); const res = await axios.post('http://localhost:3000/api/projects/unpublish',{ repo: repoUrl }, { headers: { Authorization: `Bearer ${token}` } }); if (res.data?.success) { if (res.data.profile) setProfile(res.data.profile); setProjects((prev)=>{ const next = prev.filter((p:any)=>!String(p.repoUrl||'').toLowerCase().includes((r.full||'').toLowerCase())); updateActivities(next); return next; }); setToast({ msg: 'Unpublished', type: 'success' }); } else setToast({ msg: 'Unpublish failed: '+(res.data?.message||'unknown'), type: 'error' }); } catch (e:any){ setToast({ msg: 'Unpublish failed: '+(e?.response?.data?.message || e?.message || 'unknown'), type: 'error' }); } }}>Unpublish</button>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="card">
                  <h4>Recent Projects</h4>
                  <ul className="project-list">
                    {projects.map((p:any) => (
                      <li key={p._id || p.repoUrl} className="project-item">
                        <div className="proj-left">
                          <div className="proj-name">{p.name || p.repoUrl}</div>
                          <div className="muted small">{p.description || p.repoUrl}</div>
                        </div>
                        <div className="proj-right">
                          <div className="small muted">{new Date(p.createdAt || p.verifiedAt).toLocaleString()}</div>
                          <div className="small muted">{p.commitsCount ?? 0} commits</div>
                          <div className="small muted">{p.pullRequestsCount ?? 0} PRs</div>
                          <div className="stars">{p.pointsAwarded ?? 0} pts</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="card">
                  <h4>Activity</h4>
                  <ul className="activity">
                    {activities.map((a,i) => <li key={i} className="small muted">{a}</li>)}
                  </ul>
                </div>
              </div>

              <div className="col-right">
                <div className="card">
                  <h4>Achievements</h4>
                  <div className="badges-row">
                    <div className="badge-large">Top100</div>
                    <div className="badge-large">Verifier</div>
                    <div className="badge-large">Contributor</div>
                  </div>
                </div>

                <div className="card">
                  <h4>Language Snapshot</h4>
                  <LanguageSnapshot token={localStorage.getItem('token')} />
                </div>
              </div>
            </div>
          </>
        ) : active === 'Achievements' ? (
          <div className="card">
            <h4>Achievements & Badges</h4>
            <div className="badges-row">
              <div className="badge-large">Top100</div>
              <div className="badge-large">Verifier</div>
              <div className="badge-large">Mentor</div>
            </div>
          </div>
        ) : active === 'Stats' ? (
          <div>
            <DeveloperStats />
          </div>
        ) : (
          <div className="card">Settings panel coming soon.</div>
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
          const res = await axios.post('http://localhost:3000/api/projects/publish',{ repo: repoUrl, includeCollaborators: include }, { headers: { Authorization: `Bearer ${token}` } });
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

// render modal at bottom of file so TSX compiles
export function DashboardWithModalWrapper(props:{user:User}){
  return (
    <div>
      <Dashboard {...props} />
      {/* Modal controlled inside Dashboard; nothing here */}
    </div>
  );
}
