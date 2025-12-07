import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import Certifications from './Certifications';

export default function Achievements(){
  const [list, setList] = useState<any[]>([]);
  const [certs, setCerts] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string,boolean>>({});
  const token = localStorage.getItem('token');

  const API_BASE = 'http://localhost:3000';
  const fetchList = async ()=>{
    try {
      const res = await axios.get(`${API_BASE}/api/achievements`, { headers: { Authorization: `Bearer ${token}` } });
      setList(res.data?.achievements || []);
    } catch (e) { /* ignore */ }
  };

  const fetchCerts = async ()=>{
    try {
      const res = await axios.get(`${API_BASE}/api/certifications`, { headers: { Authorization: `Bearer ${token}` } });
      setCerts(res.data?.certifications || []);
    } catch (e) { /* ignore */ }
  };

  useEffect(()=>{ fetchList(); fetchCerts(); }, []);

  const onFiles = (ev: React.ChangeEvent<HTMLInputElement>)=>{
    const f = ev.target.files ? Array.from(ev.target.files) : [];
    setFiles(f);
  };

  const uploadFile = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await axios.post(`${API_BASE}/api/achievements/upload`, fd, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
    return res.data?.url;
  };

  const submit = async ()=>{
    if (!title) return alert('Enter title');
    setUploading(true);
    try {
      const media: string[] = [];
      for (const f of files) {
        try { const url = await uploadFile(f); if (url) media.push(url); } catch (e) { console.warn('upload failed', e); }
      }
      const body = { title, description, media };
      await axios.post(`${API_BASE}/api/achievements`, body, { headers: { Authorization: `Bearer ${token}` } });
      setTitle(''); setDescription(''); setFiles([]);
      fetchList();
    } catch (e:any) { alert('Failed to save achievement: '+(e?.response?.data?.message || e?.message || 'unknown')); }
    setUploading(false);
  };

  const toggleExpand = (id:string) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const dropRef = useRef<HTMLDivElement | null>(null);

  const [activeTab, setActiveTab] = useState<'achievements'|'certifications'>('achievements');

  // drag & drop handlers
  useEffect(()=>{
    const el = dropRef.current;
    if (!el) return;
    const onDragOver = (e:DragEvent) => { e.preventDefault(); el.classList.add('drop-active'); };
    const onDragLeave = (e:DragEvent) => { e.preventDefault(); el.classList.remove('drop-active'); };
    const onDropEvent = (e:DragEvent) => { e.preventDefault(); el.classList.remove('drop-active'); const dt = e.dataTransfer; if (dt && dt.files) setFiles(Array.from(dt.files)); };
    el.addEventListener('dragover', onDragOver as any);
    el.addEventListener('dragleave', onDragLeave as any);
    el.addEventListener('drop', onDropEvent as any);
    return ()=>{
      el.removeEventListener('dragover', onDragOver as any);
      el.removeEventListener('dragleave', onDragLeave as any);
      el.removeEventListener('drop', onDropEvent as any);
    };
  }, [dropRef.current]);

  return (
    <div className="achievements-page content-max">
      {/* Top hero + single tabbed form to reduce clutter */}
      <div className="forms-wrap">
        <div className="hero-card">
          <svg width="220" height="220" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="heroG" x1="0" x2="1"><stop offset="0" stopColor="#7c3aed"/><stop offset="1" stopColor="#06b6d4"/></linearGradient>
            </defs>
            <rect x="8" y="8" width="204" height="204" rx="18" fill="url(#heroG)" opacity="0.06" />
            <g transform="translate(40,40)" stroke="url(#heroG)" strokeWidth="2" fill="none">
              <path d="M0 120 Q40 80 80 120 T160 120" strokeOpacity="0.18" />
              <circle cx="80" cy="40" r="28" strokeOpacity="0.9" />
            </g>
          </svg>
          <h2 style={{marginTop:12}}>Share your Achievements</h2>
          <p className="muted">Showcase finished work, certificates and proof — short stories with media.</p>
        </div>

        <div className="form-card" style={{display:'flex',gap:20,alignItems:'flex-start'}}>
          <div style={{flex:1}}>
            <div className="achievements-form card">
              <div className="form-hero">
                <div className="illustration">
                  <div style={{width:96,height:96,borderRadius:12,background:'linear-gradient(90deg,#7c3aed,#06b6d4)'}} />
                  <div className="muted small" style={{marginTop:12}}>Tell the story and attach proof.</div>
                </div>
                <div className="form-fields">
                  <input className="field" placeholder="Title" value={title} onChange={(e)=>setTitle(e.target.value)} />
                  <textarea className="field area" placeholder="Tell the full story — what you did, your role, impact (long form)" value={description} onChange={(e)=>setDescription(e.target.value)} rows={6} />

                  <div ref={dropRef} className="dropzone">
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                      <div className="muted">Drag & drop files here or</div>
                      <label className="btn ghost" style={{cursor:'pointer'}}>
                        Browse files
                        <input type="file" multiple onChange={onFiles} style={{display:'none'}} />
                      </label>
                    </div>
                  </div>

                  <div className="thumb-grid">
                    {files.map((f,i)=> (
                      <div key={i} className="thumb-item">
                        <div className="thumb-name">{f.name}</div>
                        <div className="thumb-size small muted">{Math.round(f.size/1024)} KB</div>
                        <button className="btn ghost small" onClick={()=>{ setFiles(prev => prev.filter((_,idx)=>idx!==i)); }}>Remove</button>
                      </div>
                    ))}
                  </div>

                  <div className="action-bar">
                    <button className="btn primary" onClick={submit} disabled={uploading}>{uploading ? 'Posting…' : 'Post Achievement'}</button>
                    <button className="btn ghost" onClick={()=>{ setTitle(''); setDescription(''); setFiles([]); }}>Clear</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{flex:1}}>
            <Certifications hideList={true} hideForm={false} />
          </div>
        </div>
      </div>

      <div style={{marginTop:28}}>
        <h4>Your Achievements</h4>
        <div className="h-scroll-achievements">
          {list.length === 0 ? (
            <div className="small muted">No achievements posted yet.</div>
          ) : (
            list.map((a:any)=>{
              const id = a._id || a.id || Math.random().toString(36).slice(2,9);
              const desc = a.description || '';
              const isLong = desc.length > 300;
              const isExpanded = !!expanded[id];
              const displayDesc = isExpanded ? desc : (isLong ? desc.slice(0,300) + '...' : desc);
              return (
                <article key={"a-"+id} className="achievement-card card">
                  <div className="post-header" style={{display:'flex',gap:12,alignItems:'center'}}>
                    <div className="avatar-sm placeholder">{a.userId ? String(a.userId)[0] : 'U'}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:800}}>{a.name || a.title || 'Achievement'}</div>
                      <div className="small muted">{new Date(a.awardedAt||a.createdAt||a.created_at).toLocaleString()}</div>
                    </div>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <button title="Edit" className="btn ghost small" onClick={async ()=>{
                        try {
                          const newTitle = prompt('Edit title', a.name || a.title || '');
                          if (newTitle === null) return;
                          const newDesc = prompt('Edit description', a.description || '');
                          const token = localStorage.getItem('token');
                          await axios.patch(`${API_BASE}/api/achievements/${id}`, { title: newTitle, description: newDesc }, { headers: { Authorization: `Bearer ${token}` } });
                          fetchList();
                        } catch (e:any) { alert('Update failed: '+(e?.response?.data?.message || e?.message || 'unknown')); }
                      }}>✏️</button>
                      <button title="Delete" className="btn ghost small" onClick={async ()=>{
                        try { if (!confirm('Delete this achievement?')) return; const token = localStorage.getItem('token'); await axios.delete(`${API_BASE}/api/achievements/${id}`, { headers: { Authorization: `Bearer ${token}` } }); fetchList(); } catch (e:any) { alert('Delete failed: '+(e?.response?.data?.message || e?.message || 'unknown')); }
                      }}>🗑</button>
                    </div>
                  </div>
                  {displayDesc ? <div className="post-body" style={{marginTop:10,whiteSpace:'pre-wrap'}}>{displayDesc}</div> : null}
                  {isLong && (
                    <div style={{marginTop:8}}>
                      <button className="btn ghost small" onClick={()=>toggleExpand(id)}>{isExpanded ? 'Show less' : 'Show more'}</button>
                    </div>
                  )}
                  {a.media && Array.isArray(a.media) && a.media.length > 0 && (
                    <div className="media-grid" style={{marginTop:12}}>
                      {a.media.map((m:string,i:number)=> {
                        const lower = String(m).toLowerCase();
                        const isImage = lower.match(/\.(png|jpg|jpeg|gif|webp|bmp)$/i);
                        if (isImage) return <a key={i} href={m} target="_blank" rel="noreferrer"><img className="media-thumb" src={m} alt={`media-${i}`} /></a>;
                        return <a key={i} href={m} target="_blank" rel="noreferrer" className="file-link">{m.split('/').pop()}</a>;
                      })}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </div>
      <div style={{marginTop:20}}>
        <h4>Your Certifications</h4>
        <div className="h-scroll-certs">
          {certs.length === 0 ? (
            <div className="small muted">No certifications added yet.</div>
          ) : (
            certs.map((c:any)=>{
              const cid = c._id || c.id || Math.random().toString(36).slice(2,9);
              return (
                <article key={"c-"+cid} className="cert-card card">
                  <div style={{display:'flex',gap:12,alignItems:'center'}}>
                    <div className="avatar-sm placeholder">C</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:800}}>{c.title || c.name || 'Certification'}</div>
                      <div className="small muted">{c.issuer} • {c.year || (c.createdAt ? new Date(c.createdAt).getFullYear() : '')}</div>
                      <div className="small muted">{c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}</div>
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      {c.file ? <a className="btn ghost small" href={c.file} target="_blank" rel="noreferrer">View</a> : null}
                      <button className="btn ghost small" onClick={async ()=>{ if(!confirm('Delete this certification?')) return; try{ await axios.delete(`${API_BASE}/api/certifications/${cid}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }); fetchCerts(); }catch(e:any){ alert('Delete failed: '+(e?.response?.data?.message||e?.message||'unknown')) } }}>Delete</button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
