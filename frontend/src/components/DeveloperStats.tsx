import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import LanguageSnapshot from './LanguageSnapshot';

function DonutChart({ data = [], size = 140 }: { data: { label: string, value: number, color?: string }[], size?: number }){
  const total = data.reduce((s,d)=>s + d.value, 0) || 1;
  const radius = size/2;
  const stroke = 18;
  const c = 2 * Math.PI * (radius - stroke/2);
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <defs>
        <linearGradient id="dg" x1="0" x2="1"><stop offset="0%" stopColor="#7c3aed"/><stop offset="100%" stopColor="#06b6d4"/></linearGradient>
      </defs>
      <g transform={`translate(${radius},${radius})`}>
        {data.map((d, idx) => {
          const frac = d.value / total;
          const dash = Math.max(2, Math.round(frac * c));
          const gap = Math.max(0, c - dash);
          const rotate = (offset / total) * 360;
          const color = d.color || `hsl(${(idx*55)%360} 80% 60%)`;
          offset += d.value;
          return (
            <g key={d.label} transform={`rotate(${rotate})`}>
              <circle r={radius - stroke/2} cx={0} cy={0} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={`${dash} ${gap}`} strokeLinecap="round"/>
            </g>
          );
        })}
        <text x="0" y="4" textAnchor="middle" fill="#e6eef6" style={{fontSize:14, fontWeight:700}}>Top</text>
      </g>
    </svg>
  );
}

function LineChart({ months = [] as { label:string, count:number }[], width=520, height=160 }:{ months:{label:string,count:number}[], width?:number, height?:number }){
  const max = Math.max(...months.map(m=>m.count), 1);
  const points = months.map((m,i)=>({ x: (i/(months.length-1))*width, y: height - (m.count/max)*height }));
  const d = points.map((p,i)=>`${i===0? 'M':'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.06" />
        </linearGradient>
      </defs>
      <path d={`${d} L ${width} ${height} L 0 ${height} Z`} fill="url(#lg)" stroke="none" />
      <path d={d} fill="none" stroke="#06b6d4" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p,i)=>(<circle key={i} cx={p.x} cy={p.y} r={3.2} fill="#fff" opacity={0.9}/>))}
    </svg>
  );
}

function Heatmap({ commitsByDay = [] as {date:string,count:number}[] }:{ commitsByDay:{date:string,count:number}[] }){
  // render a GitHub-like contributions heatmap: 53 weeks x 7 days
  // build a map for quick lookup
  const map: Record<string, number> = {};
  commitsByDay.forEach(d => map[d.date] = d.count || 0);

  // build 53 weeks (GitHub shows 53 columns) starting from 364 days ago
  const cols = 53;
  const days: { date:string, count:number }[] = [];
  for (let i = 364; i >= 0; i--) {
    const dt = new Date(); dt.setUTCDate(dt.getUTCDate() - i);
    const key = dt.toISOString().slice(0,10);
    days.push({ date: key, count: map[key] || 0 });
  }

  const weeksCount = Math.ceil(days.length / 7);
  const weeks: { date:string, days:{d:string,count:number}[] }[] = Array.from({ length: weeksCount }).map(() => ({ date: '', days: Array.from({ length: 7 }).map(() => ({ d: '', count: 0 })) }));
  for (let i = 0; i < days.length; i++) {
    const wIdx = Math.floor(i / 7);
    const dIdx = i % 7;
    weeks[wIdx].days[dIdx] = { d: days[i].date, count: days[i].count };
  }

  // compute color intensity scale
  const max = Math.max(...commitsByDay.map(d=>d.count), 1);

  return (
    <div style={{display:'flex',gap:6,overflowX:'auto',padding:4}}>
      {weeks.map((w,wi)=> (
        <div key={wi} style={{display:'grid',gridTemplateRows:'repeat(7,14px)',gap:6}}>
          {w.days.map((dd,ri)=>{
            const v = dd.count || 0;
            const intensity = Math.min(1, v / Math.max(1, max));
            const alpha = 0.08 + intensity * 0.9;
            const bg = v === 0 ? 'rgba(255,255,255,0.02)' : `linear-gradient(180deg, rgba(124,58,237,${0.12+intensity*0.6}), rgba(6,182,212,${0.08+intensity*0.5}))`;
            return <div key={ri} title={`${dd.d || '-'}: ${v} contributions`} style={{width:14,height:14,background:bg,borderRadius:4,boxShadow:'inset 0 -2px 4px rgba(0,0,0,0.2)'}}/>;
          })}
        </div>
      ))}
    </div>
  );
}

function SmallBarChart({ months = [] as {label:string,count:number}[], height = 48 }:{ months:{label:string,count:number}[], height?:number }){
  const max = Math.max(...months.map(m=>m.count), 1);
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${months.length*12} ${height}`} preserveAspectRatio="none" aria-hidden>
      {months.map((m,i)=>{
        const w = 8; const gap = 4; const x = i*(w+gap);
        const h = Math.round((m.count/max) * (height-6));
        return <rect key={i} x={x} y={height - h} width={w} height={h} rx={2} fill="#7c3aed" opacity={0.9} />;
      })}
    </svg>
  );
}

export default function DeveloperStats(){
  const [aggregate, setAggregate] = useState<any>(null);
  const [repos, setRepos] = useState<any[]>([]);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  useEffect(()=>{
    const fetchAll = async () => {
      if (!token) return;
      try{
        const [aggRes, reposRes] = await Promise.all([
          axios.get('http://15.207.111.237:3000/api/projects/profile/aggregate', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('http://15.207.111.237:3000/api/projects/repos', { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setAggregate(aggRes.data?.aggregate || null);
        setRepos(reposRes.data?.repos || []);
      }catch(e){/* ignore */}
    };
    fetchAll();
  }, [token]);

  // realtime updates
  useEffect(()=>{
    if (!token) return;
    const sse = new EventSource(`http://15.207.111.237:3000/api/projects/events?token=${token}`);
    sse.onmessage = (evt) => { try { const p = JSON.parse(evt.data||'{}'); if (p?.source) { axios.get('http://15.207.111.237:3000/api/projects/profile/aggregate', { headers: { Authorization: `Bearer ${token}` } }).then(r=>setAggregate(r.data?.aggregate || null)); } } catch(e){} };
    sse.onerror = ()=>sse.close();
    return ()=>sse.close();
  }, [token]);

  const topLangs = useMemo(()=> {
    const langs = aggregate?.skills || {};
    return Object.entries(langs).map(([k,v]:any)=>({ name:k, percent: v?.percent ?? (typeof v==='number'?v:0), repoCount: v?.repoCount || 0 })).sort((a,b)=>b.percent - a.percent).slice(0,8);
  }, [aggregate]);

  const commitsByMonth = aggregate?.commitsByMonth || [];
  const heatValues = new Array(42).fill(0).map((_,i)=>Math.round(Math.random()*5)); // placeholder until we fetch daily contributions

  return (
    <section className="dev-stats">
      <h2 style={{marginBottom:12}}>Developer Insights</h2>

      {/* Section 1: Summary */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:16,marginBottom:18}}>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'flex',gap:12}}>
            <div style={{flex:1}}>
              <div className="card" style={{padding:14,display:'flex',gap:12,alignItems:'center'}}>
                <div style={{width:220,flexShrink:0}}>
                  <LanguageSnapshot token={token} />
                </div>
                <div style={{flex:1,display:'flex',flexDirection:'column',gap:8}}>
                  <div style={{display:'flex',gap:12,alignItems:'center'}}>
                    <div style={{width:56,height:56,borderRadius:12,background:'linear-gradient(90deg,#7c3aed,#06b6d4)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700}}>DG</div>
                    <div>
                      <div style={{fontWeight:700,fontSize:16}}>Overview</div>
                      <div className="small muted">High-level account metrics</div>
                    </div>
                  </div>

                  <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                    <div style={{background:'rgba(255,255,255,0.02)',padding:10,borderRadius:8,minWidth:140}}>
                      <div className="small muted">Total Repos</div>
                      <div style={{fontWeight:700,fontSize:18}}>{aggregate?.totalRepos ?? 0}</div>
                    </div>
                    <div style={{background:'rgba(255,255,255,0.02)',padding:10,borderRadius:8,minWidth:140}}>
                      <div className="small muted">Total PRs</div>
                      <div style={{fontWeight:700,fontSize:18}}>{aggregate?.totalPRs ?? aggregate?.totalPrs ?? 0}</div>
                    </div>
                    <div style={{background:'rgba(255,255,255,0.02)',padding:10,borderRadius:8,minWidth:140}}>
                      <div className="small muted">Total Contributions</div>
                      <div style={{fontWeight:700,fontSize:18}}>{aggregate?.commitsByUser ?? 0}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{padding:12}}>
            <h4 style={{margin:'0 0 8px 0'}}>Contributions This Year</h4>
            <div style={{padding:8,background:'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))',borderRadius:8}}>
              <LineChart months={commitsByMonth.map((m:any)=>({ label: m.label, count: m.count }))} />
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:8}}>
              <div className="small muted">Monthly contributions</div>
              <div className="small muted">Total: {commitsByMonth.reduce((s:any,m:any)=>s + (m.count||0), 0)}</div>
            </div>
          </div>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div className="card" style={{padding:12}}>
            <h4 style={{margin:'0 0 8px 0'}}>Activity Heatmap</h4>
            {Array.isArray(aggregate?.commitsByDay) && aggregate.commitsByDay.length > 0 ? (
              <Heatmap commitsByDay={aggregate.commitsByDay} />
            ) : (
              <div className="small muted">No contribution heatmap available. Connect GitHub or allow more activity/events to be indexed.</div>
            )}
            <div style={{marginTop:10}} className="small muted">Activity over the past year</div>
          </div>

          <div className="card" style={{padding:12}}>
            <h4 style={{margin:'0 0 8px 0'}}>Quick Stats</h4>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div style={{background:'rgba(255,255,255,0.02)',padding:10,borderRadius:8}}>
                <div className="small muted">Followers</div>
                <div style={{fontWeight:700}}>{aggregate?.followers ?? '-'}</div>
              </div>
              <div style={{background:'rgba(255,255,255,0.02)',padding:10,borderRadius:8}}>
                <div className="small muted">Starred Repos</div>
                <div style={{fontWeight:700}}>{aggregate?.starredCount ?? (repos.reduce((s:any,r:any)=>s + (r.stargazers_count||r.stars||0), 0))}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Activity & Repos */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div className="card" style={{padding:12}}>
          <h4 style={{margin:'0 0 8px 0'}}>PRs & Trends</h4>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div className="small muted">Total PRs</div>
                <div className="big">{aggregate?.totalPRs ?? aggregate?.totalPrs ?? 0}</div>
              </div>
              <div style={{width:120}}>
                <DonutChart size={100} data={[{label:'PRs', value: aggregate?.totalPRs || 0},{label:'Repos', value: aggregate?.totalRepos || 0}]} />
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div>
                <div className="small muted">PRs (last 12 months)</div>
                {Array.isArray(aggregate?.prsByMonth) && aggregate.prsByMonth.length > 0 ? (
                  <div style={{height:56}}><SmallBarChart months={aggregate.prsByMonth.map((m:any)=>({label:m.label,count:m.count}))} /></div>
                ) : (
                  <div className="small muted">No PR data available</div>
                )}
              </div>
              <div>
                <div className="small muted">Issues closed</div>
                {Array.isArray(aggregate?.issuesByMonth) && aggregate.issuesByMonth.length > 0 ? (
                  <div style={{height:56}}><SmallBarChart months={aggregate.issuesByMonth.map((m:any)=>({label:m.label,count:m.count}))} /></div>
                ) : (
                  <div className="small muted">No issues data available</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{padding:12}}>
          <h4 style={{margin:'0 0 8px 0'}}>Open-source Contributions</h4>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {aggregate?.openSourceContribs ? (
              <>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div className="small muted">Total contributions to our projects</div>
                    <div className="big">{aggregate.openSourceContribs.totalCommits ?? 0}</div>
                  </div>
                </div>
                <div style={{marginTop:8}}>
                  {Array.isArray(aggregate.openSourceContribs.projects) && aggregate.openSourceContribs.projects.length > 0 ? (
                    <div style={{height:72}}>
                      <SmallBarChart months={aggregate.openSourceContribs.projects.slice(0,12).map((p:any)=>({ label: p.name, count: p.commits }))} />
                    </div>
                  ) : (
                    <div className="small muted">No recorded contributions to projects in our collection.</div>
                  )}
                </div>
              </>
            ) : (
              <div className="small muted">No data available for open-source contributions.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
