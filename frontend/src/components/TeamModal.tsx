import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function TeamModal({ teamId, onClose, onSaved }: { teamId: string, onClose: ()=>void, onSaved?: (team:any)=>void }){
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(()=>{
    // try to load existing team name
    (async ()=>{
      try{
        const res = await axios.get(`http://15.207.111.237:3000/api/teams/${teamId}`);
        const t = res.data?.team || null;
        if (t && t.name) setName(t.name);
      }catch(e){/* ignore */}
    })();
  }, [teamId]);

  async function save(){
    setSaving(true); setError(null);
    try{
      const token = localStorage.getItem('token');
      const res = await axios.put(`http://15.207.111.237:3000/api/teams/${teamId}`, { name }, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) {
        if (onSaved) onSaved(res.data.team);
        onClose();
      } else setError(res.data?.message || 'Failed to save');
    } catch (err:any) { setError(err?.response?.data?.message || err?.message || 'Failed'); }
    setSaving(false);
  }

  return (
    <div style={{ position:'fixed', left:0, top:0, right:0, bottom:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}>
      <div style={{ width:640, background:'var(--card)', borderRadius:10, padding:20, boxShadow:'0 10px 40px rgba(0,0,0,0.2)', color: 'inherit' }}>
        <h3 style={{ marginTop:0 }}>Create Team</h3>
        <div style={{ color:'#666', marginBottom:12 }}>Enter a team name for this project. Members will be added automatically.</div>
        <div>
          <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Team name" style={{ width:'100%', padding:10, borderRadius:8, border:'1px solid rgba(255,255,255,0.04)', background:'transparent', color:'inherit' }} />
        </div>
        {error && <div style={{ color:'#b00', marginTop:8 }}>{error}</div>}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:16 }}>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save} disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Save & Open Team'}</button>
        </div>
      </div>
    </div>
  );
}
