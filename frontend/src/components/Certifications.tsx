import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const API_BASE = 'https://api.digitaldevgrid.tech';

export default function Certifications({ hideForm=false, hideList=false, horizontal=false }: any) {
  const [list, setList] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [issuer, setIssuer] = useState('');
  const [year, setYear] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const token = localStorage.getItem('token');
  const dropRef = useRef<HTMLDivElement | null>(null);

  const fetchList = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/certifications`, { headers: { Authorization: `Bearer ${token}` } });
      setList(res.data?.certifications || []);
    } catch (e) { console.warn('failed fetching certifications', e); }
  };

  useEffect(()=>{
    fetchList();
    const onUpdate = () => fetchList();
    window.addEventListener('certifications:updated', onUpdate as EventListener);
    return () => window.removeEventListener('certifications:updated', onUpdate as EventListener);
  }, []);

  useEffect(()=>{
    const el = dropRef.current; if (!el) return;
    const onDragOver = (e:DragEvent) => { e.preventDefault(); el.classList.add('drop-active'); };
    const onDragLeave = (e:DragEvent) => { e.preventDefault(); el.classList.remove('drop-active'); };
    const onDropEvent = (e:DragEvent) => { e.preventDefault(); el.classList.remove('drop-active'); const dt = e.dataTransfer; if (dt && dt.files) setFiles(Array.from(dt.files)); };
    el.addEventListener('dragover', onDragOver as any);
    el.addEventListener('dragleave', onDragLeave as any);
    el.addEventListener('drop', onDropEvent as any);
    return ()=>{ el.removeEventListener('dragover', onDragOver as any); el.removeEventListener('dragleave', onDragLeave as any); el.removeEventListener('drop', onDropEvent as any); };
  }, [dropRef.current]);

  const uploadFile = async (file: File) => {
    // request presigned URL and upload directly to S3
    const presign = await axios.post(`${API_BASE}/api/uploads/presign`, { filename: file.name, contentType: file.type, folder: 'certifications' }, { headers: { Authorization: `Bearer ${token}` } });
    const { url, publicUrl } = presign.data || {};
    if (!url) throw new Error('Failed to obtain upload URL');
    // include ACL header as presign was generated with public-read
    await axios.put(url, file, { headers: { 'Content-Type': file.type || 'application/octet-stream' } });
    return publicUrl;
  };

  const submit = async () => {
    if (!title) return alert('Enter certification title');
    setUploading(true);
    try {
      let uploaded: string | null = null;
      if (files.length > 0) {
        uploaded = await uploadFile(files[0]);
      }
      const body = { title, issuer, year: year || null, file: uploaded };
      await axios.post(`${API_BASE}/api/certifications`, body, { headers: { Authorization: `Bearer ${token}` } });
      setTitle(''); setIssuer(''); setYear(''); setFiles([]);
      try { window.dispatchEvent(new CustomEvent('certifications:updated')); } catch(e){}
      fetchList();
    } catch (e:any) { alert('Failed to save certification: '+(e?.response?.data?.message || e?.message || 'unknown')); }
    setUploading(false);
  };

  const remove = async (id:string) => {
    if (!confirm('Delete this certification?')) return;
    try {
      await axios.delete(`${API_BASE}/api/certifications/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      try { window.dispatchEvent(new CustomEvent('certifications:updated')); } catch(e){}
      fetchList();
    } catch (e:any) { alert('Delete failed: '+(e?.response?.data?.message || e?.message || 'unknown')); }
  };

  return (
    <div style={{marginTop:12}}>
      {!hideForm && (
        <div className="card">
          <h3>Add Certification</h3>
          <div className="form-hero">
            <div className="illustration" style={{flex:'0 0 160px'}}>
              <svg width="120" height="120" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                <defs><linearGradient id="g2" x1="0" x2="1"><stop offset="0" stopColor="#06b6d4"/><stop offset="1" stopColor="#7c3aed"/></linearGradient></defs>
                <rect x="10" y="10" width="180" height="180" rx="18" fill="url(#g2)" opacity="0.08" />
                <g transform="translate(40,45)" fill="none" stroke="url(#g2)" strokeWidth="2">
                  <rect x="0" y="0" width="80" height="50" rx="6"/>
                  <path d="M0 70 L80 70" />
                </g>
              </svg>
              <div className="small muted" style={{marginTop:8}}>Upload your certificate (PDF or image)</div>
            </div>
            <div style={{flex:1,display:'flex',flexDirection:'column',gap:8}}>
              <input className="field" placeholder="Course or Certification title" value={title} onChange={(e)=>setTitle(e.target.value)} />
              <input className="field" placeholder="Issuer (e.g. Coursera, Udemy)" value={issuer} onChange={(e)=>setIssuer(e.target.value)} />
              <input className="field" placeholder="Year (optional)" value={year} onChange={(e)=>setYear(e.target.value)} />
              <div ref={dropRef} className="dropzone">
                <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
                  <div className="muted">Drag & drop certificate or</div>
                  <label className="btn ghost" style={{cursor:'pointer'}}>
                    Browse
                    <input type="file" accept="application/pdf,image/*" onChange={(e)=>{ if (e.target.files) setFiles(Array.from(e.target.files)); }} style={{display:'none'}} />
                  </label>
                </div>
              </div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {files.map((f,i)=> <div key={i} className="thumb-item"><div className="thumb-name">{f.name}</div><div className="thumb-size small muted">{Math.round(f.size/1024)} KB</div></div>)}
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn primary" onClick={submit} disabled={uploading}>{uploading ? 'Saving…' : 'Save Certification'}</button>
                <button className="btn ghost" onClick={()=>{ setTitle(''); setIssuer(''); setYear(''); setFiles([]); }}>Clear</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!hideList && (
        <div style={{marginTop:12}}>
          <div className={horizontal ? 'h-scroll-certs' : 'achievements-grid'}>
            {list.map(c=> (
              <article key={c._id} className="cert-card card">
                <div style={{display:'flex',gap:12,alignItems:'center'}}>
                  <div className="avatar-sm placeholder">C</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:800}}>{c.title}</div>
                    <div className="small muted">{c.issuer} • {c.year || (new Date(c.createdAt).getFullYear())}</div>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    {c.file ? <a className="btn ghost small" href={c.file} target="_blank" rel="noreferrer">View</a> : null}
                    <button className="btn ghost small" onClick={()=>remove(c._id)}>Delete</button>
                  </div>
                </div>
              </article>
            ))}
            {list.length === 0 && <div className="small muted">No certifications added yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
