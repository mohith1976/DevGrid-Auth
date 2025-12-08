import React, { useEffect, useState } from 'react';
import axios from 'axios';
import TeamView from './TeamView';
import TeamModal from './TeamModal';

export default function Teams({ user }: { user?: any }){
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  const [infoTeamId, setInfoTeamId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = token ? await axios.get('http://15.207.111.237:3000/api/teams', { headers: { Authorization: `Bearer ${token}` } }) : await axios.get('http://15.207.111.237:3000/api/teams');
      setTeams(res.data?.teams || []);
    } catch (e) {
      setTeams([]);
    }
    setLoading(false);
  };

  useEffect(()=>{ load(); }, []);

  const infoTeam = infoTeamId ? teams.find(x=>x._id === infoTeamId) : null;

  return (
    <div className="card no-hover">
      <h3>Teams</h3>
      {loading && <div className="small muted">Loading…</div>}
      {!loading && teams.length === 0 && <div className="small muted">No teams yet. Teams you join will appear here.</div>}
      <ul style={{ listStyle: 'none', padding: 0, marginTop: 8 }}>
        {teams.map(t => (
          <li key={t._id} style={{ display: 'flex', alignItems: 'center', padding: 10, borderRadius:8, marginBottom:8, background:'rgba(0,0,0,0.02)', cursor:'pointer' }} onClick={() => { setEditTeamId(null); setSelectedTeamId(t._id); }}>
            <div style={{ width:52, height:52, borderRadius:999, overflow:'hidden', marginRight:12, display:'flex', alignItems:'center', justifyContent:'center', background:'#0b74ff' }}>
              {t.members && t.members.length > 0 && (t.members[0].avatarUrl || t.members[0].avatar) ? (
                <img src={t.members[0].avatarUrl || t.members[0].avatar} alt={(t.members[0].username||'member')} style={{ width:52, height:52, objectFit:'cover' }} />
              ) : (
                <div style={{ color:'#fff', fontWeight:700 }}>{(t.name||'T').charAt(0).toUpperCase()}</div>
              )}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontWeight:800 }}>{t.name || (t.proposal?.title ? `${t.proposal.title} Team` : 'Team')}</div>
                <div className="small muted">{t.proposal ? (t.proposal.title ? '' : '') : ''}</div>
              </div>
              <div className="small muted">{t.proposal ? (t.proposal.title || t.proposal.repoUrl) : (t.proposalId || '')}</div>
              <div className="small muted">Members: {(t.members || []).length} • {t.lastMessage ? `${t.lastMessage.authorName || t.lastMessage.userId}: ${String(t.lastMessage.message).slice(0,60)}` : 'No messages yet'}</div>
            </div>
            <div style={{ display:'flex', gap:8, marginLeft:12 }}>
              <button className="btn ghost small" onClick={(e)=>{ e.stopPropagation(); setInfoTeamId(t._id); }}>i</button>
              {String(t.ownerId) === String(user?.id) && (
                <button className="btn ghost small" onClick={(e)=>{ e.stopPropagation(); setSelectedTeamId(null); setEditTeamId(t._id); }}>Edit</button>
              )}
              <button className="btn small" onClick={(e)=>{ e.stopPropagation(); setEditTeamId(null); setSelectedTeamId(t._id); }}>Open</button>
            </div>
          </li>
        ))}
      </ul>

      {editTeamId && (
        <TeamModal teamId={editTeamId} onClose={() => { setEditTeamId(null); load(); }} onSaved={() => { setEditTeamId(null); load(); }} />
      )}

      {selectedTeamId && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <TeamView teamId={selectedTeamId} onClose={() => { setSelectedTeamId(null); load(); }} />
          </div>
        </div>
      )}

      {infoTeamId && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ minWidth:360 }}>
            <h3>Team: {infoTeam?.name || (infoTeam?.proposal?.title ? `${infoTeam.proposal.title} Team` : 'Team')}</h3>
            <div className="small muted" style={{ marginBottom:8 }}>{infoTeam?.proposal?.title || ''}</div>
            {infoTeam?.proposal?.description && <div style={{ marginBottom:8 }}>{infoTeam.proposal.description}</div>}
            {infoTeam?.proposal?.repoUrl && (
              <div style={{ marginBottom:8 }}>
                <a href={infoTeam.proposal.repoUrl} target="_blank" rel="noreferrer" style={{ display:'inline-block', width:'100%', padding:8, borderRadius:8, border:'1px solid rgba(255,255,255,0.04)', background:'transparent', color:'var(--muted)', textDecoration:'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {infoTeam.proposal.repoUrl}
                </a>
              </div>
            )}

            <h4>Members</h4>
            <div style={{ maxHeight:320, overflow:'auto' }}>
              <ul style={{ listStyle:'none', padding:0 }}>
                { (infoTeam?.members || []).map((m:any)=> (
                  <li key={m.userId} style={{ display:'flex', gap:10, alignItems:'center', padding:8, borderRadius:8, background:'rgba(255,255,255,0.01)', marginBottom:8 }}>
                    <img src={m.avatarUrl||m.avatar||'/avatar-placeholder.png'} alt={m.username||m.userId} style={{ width:44, height:44, borderRadius:999 }} />
                    <div>
                      <div style={{ fontWeight:700 }}>{m.username || String(m.userId).slice(0,8)}</div>
                      <div className="small muted">{m.githubId ? `@${m.githubId}` : (m.profile?.handle||'')}</div>
                      <div className="small muted">{m.email || m.profile?.email || ''}</div>
                    </div>
                  </li>
                )) }
              </ul>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:8 }}>
              <button className="btn ghost" onClick={()=>setInfoTeamId(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
