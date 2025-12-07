import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function DashboardMyApplications({ user }: { user?: any }){
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  const load = async ()=>{
    setLoading(true); setError(null);
    try{
      const token = localStorage.getItem('token');
      let res;
      if (token) {
        res = await axios.get('http://localhost:3000/api/proposals/applications/me', { headers: { Authorization: `Bearer ${token}` } });
      } else if (user && user.id) {
        res = await axios.get(`http://localhost:3000/api/proposals/applications/me?userId=${encodeURIComponent(user.id)}`);
      } else {
        setError('Sign in to view your applications'); setLoading(false); return;
      }
      setApps(res.data?.applications || []);
    } catch (e:any) { setError(e?.response?.data?.message || e?.message || 'Failed'); }
    setLoading(false);
  };

  useEffect(()=>{ load(); }, []);

  useEffect(()=>{
    const onApplied = (e: any) => { load(); };
    window.addEventListener('proposal.applied', onApplied as EventListener);
    return () => { window.removeEventListener('proposal.applied', onApplied as EventListener); };
  }, []);

  return (
    <div className="card">
      <h3>My Applications</h3>
      <div className="small muted">Debug: userId={user?.id || 'none'} • token={!!localStorage.getItem('token') ? 'yes' : 'no'}</div>
      {loading && <div className="small muted">Loading…</div>}
      {error && <div className="small" style={{ color:'#b00' }}>{error}</div>}
      <ul style={{ listStyle:'none', padding:0 }}>
        {apps.map((a:any)=> (
          <li key={`${a.proposalId}-${a.appliedAt}`} style={{ padding:12, borderRadius:8, marginBottom:8, background:'rgba(0,0,0,0.02)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontWeight:800 }}>{a.title}</div>
                <div className="small muted">{a.repoUrl}</div>
                <div className="small muted">Status: {a.status}{a.reason ? ` • ${a.reason}` : ''}</div>
                {a.status === 'rejected' && a.deletedAt && (
                  <div className="small muted">Your application will be removed on {new Date(a.deletedAt).toLocaleString()}. You can reapply after that date.</div>
                )}
              </div>
              <div className="small muted">Applied: {a.appliedAt ? new Date(a.appliedAt).toLocaleString() : '-'}</div>
            </div>
            {a.status === 'pending' && (
              <div style={{ marginTop:8, display:'flex', justifyContent:'flex-end' }}>
                <button className="btn ghost small" onClick={async ()=>{
                  const token = localStorage.getItem('token');
                  if (!token) { alert('Sign in to withdraw application'); return; }
                  try {
                    const res = await axios.post(`http://localhost:3000/api/proposals/${a.proposalId}/withdraw`, {}, { headers: { Authorization: `Bearer ${token}` } });
                    if (res?.data?.success) { alert('Application withdrawn'); load(); }
                    else { alert('Withdraw failed: ' + (res?.data?.message || 'unknown')); }
                  } catch (err:any) { alert('Withdraw failed: ' + (err?.response?.data?.message || err?.message || 'unknown')); }
                }}>Withdraw</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
