import React, { useEffect, useState } from 'react';
import axios from 'axios';
function TeamView({ teamId, onClose }: { teamId: string, onClose?: ()=>void }){
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [posting, setPosting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  async function load(){
    setLoading(true);
    try{
      const res = await axios.get(`http://localhost:3000/api/teams/${teamId}`);
      setTeam(res.data?.team || null);
    } catch(e) { setTeam(null); }
    setLoading(false);
  }

  useEffect(()=>{ if (teamId) load(); }, [teamId]);

  async function postMessage(){
    if (!msg.trim()) return;
    setPosting(true);
    try{
      const token = localStorage.getItem('token');
      const res = await axios.post(`http://localhost:3000/api/teams/${teamId}/message`, { message: msg }, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) {
        // optimistic append the sent message to avoid full reload and UI flicker
        const sent = res.data?.message || { userId: token ? 'you' : 'me', message: msg, createdAt: new Date() };
        setTeam((t:any) => ({ ...(t||{}), messages: [ ...(t?.messages || []), sent ] }));
        setMsg('');
      }
    } catch (e) { /* ignore */ }
    setPosting(false);
  }

  if (loading) return <div className="card">Loading team…</div>;
  if (!team) return <div className="card">Team not found.</div>;
  // resolve leader display name from members if available
  const leader = (team.members || []).find((m:any) => String(m.userId) === String(team.ownerId));
  const leaderName = leader ? (leader.username || leader.githubId || String(leader.userId).slice(0,8)) : (team.ownerUsername || String(team.ownerId).slice(0,8));
  const projectTitle = team.proposal?.title || team.proposalTitle || 'Project';

  return (
    <div className="card" style={{ color: 'inherit' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800 }}>{team.name || `${projectTitle} Team`}</div>
          <div className="small muted">Project: {projectTitle} • Leader: {leaderName}</div>
        </div>
        {onClose && <button className="btn ghost" onClick={onClose}>Close</button>}
      </div>

      {showDetails && (
        <div style={{ marginTop:12, borderTop:'1px solid rgba(255,255,255,0.02)', paddingTop:12 }}>
          <h4>Project & Members</h4>
          <div style={{ marginBottom:8 }}>
              <div style={{ fontWeight:700 }}>{team.proposal?.title || 'Project'}</div>
              {team.proposal?.repoUrl && (
                <a href={team.proposal.repoUrl} target="_blank" rel="noreferrer" className="small muted">{team.proposal.repoUrl}</a>
              )}
              <div className="small muted">Required team size: {team.teamSize || team.proposal?.teamSize || '—'}</div>
          </div>

          <ul style={{ listStyle:'none', padding:0, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {(team.members || []).map((m:any)=> (
              <li key={m.userId} style={{ display:'flex', gap:8, alignItems:'center', padding:8, borderRadius:8, background:'rgba(255,255,255,0.02)' }}>
                <img src={m.avatarUrl || m.avatar || '/avatar-placeholder.png'} alt={m.username || m.userId} style={{ width:40, height:40, borderRadius:999 }} />
                <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700 }}>{m.username || String(m.userId).slice(0,8)} <span className="small muted">• {m.role || 'member'}</span></div>
                  <div className="small muted">
                    {m.githubId ? (<a href={`https://github.com/${m.githubId}`} target="_blank" rel="noreferrer">@{m.githubId}</a>) : (m.profile?.handle || '')}
                  </div>
                  {m.profile?.bio && <div className="small muted" style={{ marginTop:6 }}>{m.profile.bio}</div>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop:12 }}>
        <h4>Chat</h4>
        <div style={{ maxHeight:240, overflow:'auto', padding:8, borderRadius:8, border:'1px solid rgba(255,255,255,0.04)', background:'var(--card)', color: 'inherit' }}>
              {(team.messages || []).map((m:any)=> {
                const key = m._id || `${m.userId}-${new Date(m.createdAt).getTime()}`;
                // try to resolve the message author from team.members
                const author = (team.members || []).find((mb:any) => String(mb.userId) === String(m.userId)) || null;
                const authorName = author ? (author.username || author.githubId || String(author.userId).slice(0,8)) : (m.username || m.userId);
                const authorAvatar = author ? (author.avatarUrl || author.avatar) : (m.avatarUrl || '/avatar-placeholder.png');
                return (
                  <div key={key} style={{ padding:8, borderBottom:'1px solid rgba(255,255,255,0.02)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <img src={authorAvatar} alt={authorName} style={{ width:28, height:28, borderRadius:999 }} />
                      <div style={{ fontWeight:700 }}>{authorName}</div>
                    </div>
                    <div className="small muted">{new Date(m.createdAt).toLocaleString()}</div>
                    <div style={{ marginTop:6 }}>{m.message}</div>
                  </div>
                );
              })}
        </div>
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <input value={msg} onChange={(e)=>setMsg(e.target.value)} placeholder="Write a message to your team" style={{ flex:1, padding:8, borderRadius:8, border:'1px solid rgba(255,255,255,0.04)', background:'transparent', color:'inherit' }} />
          <button className="btn" onClick={postMessage} disabled={posting || !msg.trim()}>{posting ? 'Sending…' : 'Send'}</button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(TeamView);
