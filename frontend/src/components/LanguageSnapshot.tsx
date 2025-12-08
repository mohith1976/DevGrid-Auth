import React, { useEffect, useState } from 'react';
import axios from 'axios';

type Props = {
  token?: string | null;
};

export default function LanguageSnapshot({ token: initialToken }: Props) {
  const [aggregate, setAggregate] = useState<any>(null);
  const [repoCounts, setRepoCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState<string[]>(() => {
    try { const raw = localStorage.getItem('hiddenLanguages'); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });

  const fetchAggregate = async (t?: string | null) => {
    const tok = t ?? localStorage.getItem('token');
    if (!tok) return;
    setLoading(true);
    try {
      const res = await axios.get('https://api.digitaldevgrid.tech/api/projects/profile/aggregate', { headers: { Authorization: `Bearer ${tok}` } });
      setAggregate(res.data?.aggregate || null);
      // fetch owner's repos and compute repo-count per language
      try {
        const rres = await axios.get('https://api.digitaldevgrid.tech/api/projects/repos', { headers: { Authorization: `Bearer ${tok}` } });
        const repos = rres.data?.repos || [];
        const counts: Record<string, number> = {};
        for (const repo of repos) {
          const langs = repo.languages || {};
          // languages keys are language names like 'JavaScript', 'HTML'
          for (const k of Object.keys(langs)) {
            counts[k] = (counts[k] || 0) + 1;
          }
        }
        setRepoCounts(counts);
      } catch (e) {
        // ignore repo counts failure
      }
    } catch (e) {
      // ignore for now
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAggregate(initialToken ?? null); }, [initialToken]);

  // SSE to listen for profile.updated events and refresh aggregate when language-agg occurs
  useEffect(() => {
    const tok = initialToken ?? localStorage.getItem('token');
    if (!tok) return;
    const sse = new EventSource(`https://api.digitaldevgrid.tech/api/projects/events?token=${tok}`);
    sse.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data || '{}');
        if (payload?.source === 'language-agg' || payload?.source === 'recalc') {
          fetchAggregate(tok);
        }
      } catch (e) { /* ignore */ }
    };
    sse.onerror = () => sse.close();
    return () => sse.close();
  }, [initialToken]);

  const skills = aggregate?.skills || null;
  const entries = skills ? Object.entries(skills as Record<string, any>) : [];
  // normalize entries into { name, percent }
  const normalized = entries.map(([k,v]: any) => {
    const pct = typeof v === 'number' ? v : (v?.percent ?? 0);
    const lvl = typeof v === 'object' && v?.level ? v.level : null;
    const lbl = typeof v === 'object' && v?.label ? v.label : null;
    const repoCountFromV = typeof v === 'object' && (typeof v?.repoCount === 'number') ? v.repoCount : undefined;
    const repoCount = typeof repoCountFromV === 'number' ? repoCountFromV : (repoCounts[k] || 0);
    return { name: k, percent: pct, level: lvl, label: lbl, repoCount };
  }).sort((a:any,b:any)=>b.percent - a.percent);

  const visible = normalized.filter((n:any)=>!hidden.includes(n.name));

  const toggleHide = (name:string) => {
    const next = hidden.includes(name) ? hidden.filter(h=>h!==name) : [...hidden, name];
    setHidden(next); localStorage.setItem('hiddenLanguages', JSON.stringify(next));
  };

  return (
    <div>
      {loading && <div className="small muted">Updating languages…</div>}
      {!loading && normalized.length === 0 && <div className="small muted">No skill data yet</div>}
      {/* Icons for hide/unhide */}
      {!loading && normalized.length > 0 && (
        visible.slice(0,8).map((s:any) => (
          <div key={s.name} style={{marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div className="skill-name">{s.name}</div>
                <div className="small muted">{s.percent}% • {s.repoCount} repos</div>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <button title="Hide language" className="btn ghost small" onClick={() => toggleHide(s.name)} style={{marginLeft:8,padding:'6px 8px'}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M17.94 17.94A10 10 0 0 1 6.06 6.06M1 1l22 22" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="skill-bar"><div className="skill-fill" style={{width:`${s.percent}%`}}/></div>
          </div>
        ))
      )}
      {!loading && normalized.length > 0 && (
        <div style={{marginTop:8}}>
          <div className="small muted">Hidden languages:</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
            {hidden.length === 0 ? (
              <div className="small muted">none</div>
            ) : (
              hidden.map((h) => (
                <div key={h} style={{display:'flex',alignItems:'center',gap:8,background:'rgba(255,255,255,0.02)',padding:'6px 10px',borderRadius:8}}>
                  <div className="small" style={{fontWeight:700}}>{h}</div>
                  <button title="Unhide language" className="btn ghost small" onClick={() => toggleHide(h)} style={{padding:'6px 8px'}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M12 5c7 0 11 7 11 7s-4 7-11 7S1 12 1 12s4-7 11-7z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
