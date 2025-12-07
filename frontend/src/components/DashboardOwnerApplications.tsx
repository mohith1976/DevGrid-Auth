import React, { useEffect, useState } from 'react';
import axios from 'axios';
import TeamModal from './TeamModal';
import TeamView from './TeamView';

export default function DashboardOwnerApplications({ user }: { user?: any }){
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [confirmReject, setConfirmReject] = useState<{ open: boolean; proposalId?: string; applicantId?: string; applicantName?: string } | null>(null);
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);
  const [openTeamModalId, setOpenTeamModalId] = useState<string | null>(null);

  const load = async ()=>{
    setLoading(true); setError(null);
    try{
      const token = localStorage.getItem('token');
      let res;
      if (token) {
        res = await axios.get('http://localhost:3000/api/proposals/owner', { headers: { Authorization: `Bearer ${token}` } });
      } else if (user && user.id) {
        // dev fallback: allow fetching by userId query when token not available
        res = await axios.get(`http://localhost:3000/api/proposals/owner?userId=${encodeURIComponent(user.id)}`);
      } else {
        setError('Sign in to view your proposals'); setLoading(false); return;
      }
      // handle API returning { success: false, message }
      if (res?.data && res.data.success === false) {
        setError(res.data.message || 'Failed to load proposals');
        setProposals([]);
      } else {
        setProposals(res.data?.proposals || []);
      }
    } catch (e:any) { setError(e?.response?.data?.message || e?.message || 'Failed'); }
    setLoading(false);
  };

  useEffect(()=>{ load(); }, []);

  return (
    <div className="card">
      <h3>Manage My Proposals</h3>
      {loading && <div className="small muted">Loading…</div>}
      {error && <div className="small" style={{ color:'#b00' }}>{error}</div>}
      {!loading && !error && proposals.length === 0 && lastResponse && (
        <div style={{ marginTop:8, padding:8, borderRadius:6, background:'rgba(255,255,255,0.02)' }}>
          <div className="small muted">No proposals returned from API. Raw response:</div>
          <pre style={{ maxHeight:200, overflow:'auto', fontSize:12 }}>{JSON.stringify(lastResponse, null, 2)}</pre>
        </div>
      )}
      <ul style={{ listStyle:'none', padding:0 }}>
        {proposals.map((p:any)=> (
          <li key={p._id} style={{ padding:12, borderRadius:8, marginBottom:8, background:'rgba(0,0,0,0.02)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontWeight:800 }}>{p.title}</div>
                <div className="small muted">{p.description}</div>
                <div className="small muted">Applicants: {(p.applicants||[]).length} • Status: {p.status}</div>
              </div>
              <div>
                {p.teamId && (
                  <button className="btn ghost small" onClick={() => setOpenTeamId(p.teamId)}>Open Team</button>
                )}
              </div>
            </div>
            {p.applicants && p.applicants.length > 0 && (
              <div style={{ marginTop:8 }}>
                <h4 className="small">Applicants</h4>
                <ul style={{ listStyle:'none', padding:0 }}>
                  {p.applicants.map((a:any) => {
                    const isMember = (p.members || []).some((m:any)=>String(m.userId) === String(a.userId)) || a.status === 'accepted';
                    const full = (p.members || []).length >= (p.teamSize || 0);
                    return (
                      <li key={String(a.userId)} style={{ padding:8, borderRadius:6, background:'#0f1720', marginBottom:6, display:'flex', gap:12, alignItems:'center' }}>
                        <div style={{ width:56, flex:'0 0 56px' }}>
                          <img src={a.avatarUrl || (a.username ? `https://github.com/${a.username}.png?size=80` : 'https://avatars.githubusercontent.com/u/0?v=4')} alt={a.username || String(a.userId)} style={{ width:48, height:48, borderRadius:999, objectFit:'cover', border:'1px solid rgba(255,255,255,0.03)' }} />
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:700 }}>{a.username ? a.username : String(a.userId)}{a.profile ? ` — L${a.profile.level} • ${a.profile.points} pts` : ''}</div>
                          <div className="small muted">{a.message || <span className="small muted">No message</span>}</div>
                          <div className="small muted">Applied: {a.createdAt ? new Date(a.createdAt).toLocaleString() : ' — '}</div>
                        </div>
                        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                          {a.status === 'pending' ? (
                            <>
                              <button
                                className="btn small"
                                disabled={isMember || full}
                                onClick={async () => {
                                  const token = localStorage.getItem('token');
                                  try {
                                    const res = await axios.post(`http://localhost:3000/api/proposals/${p._id}/accept`, { applicantId: a.userId }, { headers: { Authorization: `Bearer ${token}` } });
                                    if (res?.data && res.data.success === false) {
                                      const msg = res.data.message || 'Failed to accept';
                                      if (msg.includes('Team is full') || msg.includes('full')) {
                                        alert('Team size is full — cannot accept more members.');
                                      } else if (msg.includes('already a member') || msg.includes('already')) {
                                        alert('Applicant is already a team member.');
                                      } else {
                                        alert(msg);
                                      }
                                    }
                                    let teamId = res?.data?.teamId || null;
                                    if (!teamId) {
                                      try {
                                        const r = await axios.get(`http://localhost:3000/api/proposals/${p._id}`, { headers: { Authorization: `Bearer ${token}` } });
                                        teamId = r.data?.team?.teamId || r.data?.teamId || r.data?.team?._id || null;
                                      } catch (e) { teamId = null; }
                                    }
                                    if (teamId) {
                                      setOpenTeamId(null);
                                      setOpenTeamModalId(teamId);
                                    }
                                  } catch (err:any) {
                                    const msg = err?.response?.data?.message || err?.message || 'Failed to accept';
                                    alert(msg);
                                    await load();
                                  }
                                }}
                              >
                                {isMember ? 'Accepted' : full ? 'Team Full' : 'Accept'}
                              </button>
                              <button className="btn ghost small" onClick={() => setConfirmReject({ open: true, proposalId: p._id, applicantId: a.userId, applicantName: a.username || String(a.userId) })}>Reject</button>
                            </>
                          ) : a.status === 'rejected' && a.deletedAt ? (
                            <div className="small muted">Rejected • removes on {new Date(a.deletedAt).toLocaleDateString()}</div>
                          ) : a.status === 'accepted' ? (
                            <div className="small muted">Accepted</div>
                          ) : (
                            <div className="small muted">{a.status}</div>
                          )}
                        </div>
                        {/* single Open Team button lives in the proposal header; remove per-applicant duplicate */}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>

      {confirmReject && confirmReject.open && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Reject Application</h3>
            <p className="muted">Are you sure you want to reject the application from <strong>{confirmReject.applicantName}</strong>?</p>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:12 }}>
              <button className="btn ghost" onClick={()=>setConfirmReject(null)}>Cancel</button>
              <button className="btn" onClick={async ()=>{
                try {
                  const token = localStorage.getItem('token');
                  await axios.post(`http://localhost:3000/api/proposals/${confirmReject.proposalId}/reject`, { applicantId: confirmReject.applicantId }, { headers: { Authorization: `Bearer ${token}` } });
                } catch (e:any) {
                  // ignore
                }
                setConfirmReject(null);
                load();
              }}>Confirm Reject</button>
            </div>
          </div>
        </div>
      )}
      {openTeamModalId && (
        <TeamModal teamId={openTeamModalId} onClose={() => setOpenTeamModalId(null)} onSaved={(team:any) => {
          // after naming/creating team, open the team view
          setOpenTeamModalId(null);
          if (team && team._id) setOpenTeamId(team._id);
        }} />
      )}
      {openTeamId && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <TeamView teamId={openTeamId} onClose={() => setOpenTeamId(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
