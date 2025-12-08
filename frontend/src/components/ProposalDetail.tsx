import React, { useEffect, useState } from 'react';
import axios from 'axios';
import TeamModal from './TeamModal';
import TeamView from './TeamView';

export default function ProposalDetail({ id, showOwnerControls }: { id?: string, showOwnerControls?: boolean }){
  const [proposal, setProposal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [statusMsg, setStatusMsg] = useState<string| null>(null);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [myApplication, setMyApplication] = useState<any | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [teamToOpen, setTeamToOpen] = useState<string | null>(null);
  const [openTeamView, setOpenTeamView] = useState<string | null>(null);

  useEffect(()=>{ if (id) load(); }, [id]);

  async function load(){
    setLoading(true);
    try{
      const res = await axios.get(`http://15.207.111.237:3000/api/proposals/${id}`);
      const p = res.data?.proposal || null;
      setProposal(p);
      // determine current user's application status if token present
      const token = localStorage.getItem('token');
      let sub = null;
      try { sub = decodeJwtSub(token); } catch(e){}
      if (sub && p && Array.isArray(p.applicants)) {
        const found = p.applicants.find((a:any)=>String(a.userId) === String(sub));
        setMyApplication(found || null);
      } else setMyApplication(null);
      return p;
    } catch (e) {
      setProposal(null);
      return null;
    } finally { setLoading(false); }
  }

  function decodeJwtSub(token?: string | null) {
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const payload = parts[1];
      const json = decodeURIComponent(atob(payload).split('').map(function(c){
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      const obj = JSON.parse(json);
      return obj?.sub || obj?.userId || null;
    } catch (e) { return null; }
  }

  async function apply(){
    const token = localStorage.getItem('token');
    if (!token) { setStatusMsg('You must sign in to apply'); return; }
    if (isOwner) { setStatusMsg('You are the owner of this proposal and cannot apply'); return; }
    if (myApplication) {
      if (myApplication.status === 'pending') { setStatusMsg('You already have a pending application for this proposal'); return; }
      if (myApplication.status === 'rejected') { setStatusMsg('Your previous application was rejected; you cannot reapply'); return; }
      if (myApplication.status === 'accepted') { setStatusMsg('You are already a member of this proposal'); return; }
    }
    try{
      const res = await axios.post(`http://15.207.111.237:3000/api/proposals/${id}/apply`, { message }, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) {
        if (res.data?.status === 'rejected') {
          setStatusMsg(`Application auto-rejected: ${res.data?.reason || 'requirements not met'}`);
        } else if (res.data?.status === 'pending') {
          setStatusMsg('Application submitted and pending owner review');
          // set myApplication locally as pending
          const app = { userId: decodeJwtSub(token), status: 'pending', message, createdAt: new Date().toISOString() };
          setMyApplication(app);
          // notify other components (e.g., My Applications list) to refresh
          try { window.dispatchEvent(new CustomEvent('proposal.applied', { detail: { proposalId: id, application: app } })); } catch (e) { /* ignore */ }
          // refresh proposal data from server to ensure canonical state
          load();
        } else {
          setStatusMsg('Application submitted');
        }
      } else setStatusMsg('Apply failed: '+(res.data?.message||'unknown'));
    } catch (err:any) { setStatusMsg('Apply failed: '+(err?.response?.data?.message || err?.message || 'unknown')); }
  }

  async function withdraw(){
    const token = localStorage.getItem('token');
    if (!token) { setStatusMsg('Sign in to withdraw'); return; }
    try{
      const res = await axios.post(`http://15.207.111.237:3000/api/proposals/${id}/withdraw`, {}, { headers: { Authorization: `Bearer ${token}` } });
      if (res?.data?.success) {
        setStatusMsg('Application withdrawn');
        setMyApplication(null);
        load();
      } else setStatusMsg('Withdraw failed: '+(res?.data?.message||'unknown'));
    } catch (err:any) { setStatusMsg('Withdraw failed: '+(err?.response?.data?.message || err?.message || 'unknown')); }
  }

  async function loadApplicants(){
    const token = localStorage.getItem('token');
    if (!token) return;
    try{
      const res = await axios.get(`http://15.207.111.237:3000/api/proposals/${id}/applicants`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.applicants) setApplicants(res.data.applicants);
    } catch (e) { /* ignore */ }
  }

  async function rejectApplicant(applicantId:string, reason?:string){
    const token = localStorage.getItem('token');
    if (!token) return;
    try{
      const res = await axios.post(`http://15.207.111.237:3000/api/proposals/${id}/reject`, { applicantId, reason }, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) { setStatusMsg('Applicant rejected'); loadApplicants(); load(); }
      else setStatusMsg('Reject failed: '+(res.data?.message||'unknown'));
    } catch (err:any) { setStatusMsg('Reject failed: '+(err?.response?.data?.message || err?.message || 'unknown')); }
  }

  async function acceptApplicant(applicantId:string){
    const token = localStorage.getItem('token');
    if (!token) return;
    try{
      const res = await axios.post(`http://15.207.111.237:3000/api/proposals/${id}/accept`, { applicantId }, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) {
        setStatusMsg('Applicant accepted');
        // reload applicants/proposal and wait for canonical state
        loadApplicants();
        const refreshed = await load();
        // server may have returned teamId directly, or proposal may now include teamId
        const teamId = res.data?.teamId || (refreshed && refreshed.teamId) || null;
        if (teamId) {
          setTeamToOpen(teamId);
          setTeamModalOpen(true);
        }
      }
      else setStatusMsg('Accept failed: '+(res.data?.message||'unknown'));
    } catch (err:any) { setStatusMsg('Accept failed: '+(err?.response?.data?.message || err?.message || 'unknown')); }
  }

  useEffect(()=>{
    if (proposal && proposal.ownerId) loadApplicants();
    const token = localStorage.getItem('token');
    const sub = decodeJwtSub(token);
    setIsOwner(Boolean(sub && proposal && String(sub) === String(proposal.ownerId)));
  }, [proposal]);

  if (loading) return <div className="card">Loading…</div>;
  if (!proposal) return <div className="card">Proposal not found.</div>;

  return (
    <div className="card">
      <h3>{proposal.title}</h3>
      <div className="small muted">Team size: {proposal.teamSize} • Reward: {proposal.rewardPoints} • Status: {proposal.status}</div>
      <div style={{ marginTop:12 }}>{proposal.description}</div>

      <div style={{ marginTop:12 }}>
        <h4>Requirements</h4>
        <div className="small muted">Min repos: {proposal.requirements?.minRepoCount || 0} • Min contributions: {(proposal.requirements?.minContributions ?? proposal.requirements?.minCommits) || 0} • Min level: {proposal.requirements?.minLevel || 0}</div>
        <div className="small muted">Languages: {(proposal.requirements?.languages || []).join(', ')}</div>
      </div>

      <div style={{ marginTop:12 }}>
        <h4>Apply</h4>
        <textarea value={message} onChange={(e)=>setMessage(e.target.value)} placeholder="Optional message to owner" rows={3} style={{ width: '100%', padding:8, borderRadius:8, border:'1px solid rgba(255,255,255,0.04)', background:'transparent', color:'inherit' }} />
        <div style={{ marginTop:8 }}>
          <button className="btn" onClick={apply} disabled={Boolean(myApplication && (myApplication.status === 'pending' || myApplication.status === 'rejected' || myApplication.status === 'accepted'))}>{ myApplication ? (myApplication.status === 'pending' ? 'Applied (pending)' : myApplication.status === 'rejected' ? 'Application Rejected' : 'Member') : 'Apply' }</button>
          {myApplication && myApplication.status === 'pending' && (
            <button className="btn ghost" style={{ marginLeft:8 }} onClick={withdraw}>Withdraw</button>
          )}
          {statusMsg && <div className="small muted" style={{ marginTop:8 }}>{statusMsg}</div>}
        </div>
      </div>

      {isOwner && (showOwnerControls === true) && (
        <div style={{ marginTop:16 }}>
          <h4>Applicants</h4>
          {(!applicants || applicants.length === 0) && <div className="small muted">No applicants yet.</div>}
          <ul style={{ listStyle:'none', padding:0 }}>
            {applicants.map((a:any)=> (
              <li key={String(a.userId)} style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.01)', marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:700 }}>{String(a.userId)}</div>
                  <div className="small muted">{a.message}</div>
                  <div className="small muted">
                    Status: {a.status}{a.reason ? ` • ${a.reason}` : ''}
                    {a.status === 'rejected' && a.deletedAt && (
                      <span> • Will be removed on {new Date(a.deletedAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {a.status === 'pending' && <button className="btn small" onClick={()=>acceptApplicant(a.userId)}>Accept</button>}
                  {a.status === 'pending' && <button className="btn ghost small" onClick={()=>rejectApplicant(a.userId)}>Reject</button>}
                </div>
              </li>
            ))}
          </ul>
          {proposal.teamId && (
            <div style={{ marginTop:12 }}>
              <button className="btn" onClick={()=>setOpenTeamView(proposal.teamId)}>Open Team</button>
            </div>
          )}
        </div>
      )}
      {teamModalOpen && teamToOpen && (
        <TeamModal teamId={teamToOpen} onClose={()=>{ setTeamModalOpen(false); setTeamToOpen(null); setOpenTeamView(teamToOpen); }} onSaved={(team)=>{ setOpenTeamView(team._id || teamId); }} />
      )}
      {openTeamView && (
        <div style={{ marginTop:12 }}>
          <TeamView teamId={openTeamView} onClose={()=>setOpenTeamView(null)} />
        </div>
      )}
    </div>
  );
}
