import React, { useEffect, useState } from 'react';
import axios from 'axios';
import ProposalDetail from './ProposalDetail';

export default function ProposalsList() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const API_BASE = 'https://api.digitaldevgrid.tech';

  useEffect(() => {
    load();
    const onCreated = (e: any) => { load(); };
    const onApplied = (e: any) => { load(); };
    window.addEventListener('proposal.created', onCreated as EventListener);
    window.addEventListener('proposal.applied', onApplied as EventListener);
    return () => { 
      window.removeEventListener('proposal.created', onCreated as EventListener);
      window.removeEventListener('proposal.applied', onApplied as EventListener);
    };
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE}/api/proposals`);
      setProposals(res.data?.proposals || []);
    } catch (e:any) {
      setProposals([]);
      setError(e?.response?.data?.message || e?.message || 'Failed to load proposals');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h3>Open Proposals</h3>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <strong>Open Proposals</strong>
          <span className="small muted">({proposals.length})</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input placeholder="Search proposals" value={query} onChange={(e)=>setQuery(e.target.value)} style={{ padding: '6px 8px', borderRadius:6, border:'1px solid rgba(0,0,0,0.06)' }} />
          <button className="btn ghost small" onClick={load} disabled={loading} style={{ marginLeft:4 }}>Refresh</button>
        </div>
      </div>
      {loading && <div className="small muted">Loading proposals…</div>}
      {error && <div className="small" style={{ color: '#b00', marginBottom:8 }}>{error}</div>}
      {!loading && !error && proposals.length === 0 && (
        <div style={{ padding: 12, borderRadius:8, background:'rgba(0,0,0,0.02)' }}>
          <div className="small muted">No proposals found. Try creating one to get started.</div>
        </div>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {(proposals || []).filter((p:any) => {
          const q = query.trim().toLowerCase();
          if (!q) return true;
          const title = String(p.title || '').toLowerCase();
          const desc = String(p.description || '').toLowerCase();
          const tags = (p.tags || []).join(' ').toLowerCase();
          return title.includes(q) || desc.includes(q) || tags.includes(q);
        }).map((p:any, i:number) => (
          <li key={p._id || p.id || i} style={{ padding: 12, borderRadius: 8, background: 'linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.005))', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800 }}>{p.title}</div>
                <div className="small muted">{p.description}</div>
                <div className="small muted">Team size: {p.teamSize} • Reward: {p.rewardPoints} pts • Status: {p.status}</div>
                <div className="small muted">Min contributions: {(p.requirements?.minContributions ?? p.requirements?.minCommits) || 0}</div>
              </div>
                <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => setSelected(p._id || p.id || String(i))}>View</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {selected && (
        <div style={{ marginTop: 12 }}>
          <ProposalDetail id={selected} showOwnerControls={false} />
          <div style={{ marginTop:8 }}><button className="btn ghost" onClick={()=>setSelected(null)}>Close</button></div>
        </div>
      )}
    </div>
  );
}
