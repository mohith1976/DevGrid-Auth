import React, { useEffect, useState } from 'react';
import axios from 'axios';

type Props = {
  token?: string | null;
};

export default function LanguageSnapshot({ token: initialToken }: Props) {
  const [aggregate, setAggregate] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState<string[]>(() => {
    try { const raw = localStorage.getItem('hiddenLanguages'); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });

  const fetchAggregate = async (t?: string | null) => {
    const tok = t ?? localStorage.getItem('token');
    if (!tok) return;
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:3000/api/projects/profile/aggregate', { headers: { Authorization: `Bearer ${tok}` } });
      setAggregate(res.data?.aggregate || null);
    } catch (e) {
      // ignore for now
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAggregate(initialToken ?? null); }, [initialToken]);

  // SSE to listen for profile.updated events and refresh aggregate when language-agg occurs
  useEffect(() => {
    const tok = initialToken ?? localStorage.getItem('token');
    if (!tok) return;
    const sse = new EventSource(`http://localhost:3000/api/projects/events?token=${tok}`);
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
    const repoCount = typeof v === 'object' && (typeof v?.repoCount === 'number') ? v.repoCount : 0;
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
      {!loading && normalized.length > 0 && (
        visible.slice(0,8).map((s:any) => (
          <div key={s.name} style={{marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div className="skill-name">{s.name}</div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                {s.label && <div className="small" style={{color:'#9cc'}}>Lvl {s.level} • {s.label}</div>}
                <div className="small muted">{s.percent}% • {s.repoCount} repos</div>
                <button className="btn ghost small" onClick={() => toggleHide(s.name)} style={{marginLeft:8}}>{hidden.includes(s.name) ? 'Unhide' : 'Hide'}</button>
              </div>
            </div>
            <div className="skill-bar"><div className="skill-fill" style={{width:`${s.percent}%`}}/></div>
          </div>
        ))
      )}
      {!loading && normalized.length > 0 && (
        <div style={{marginTop:8}}>
          <div className="small muted">Hidden languages: {hidden.length === 0 ? 'none' : hidden.join(', ')}</div>
        </div>
      )}
    </div>
  );
}
