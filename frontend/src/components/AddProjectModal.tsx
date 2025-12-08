import React, { useState } from 'react';
import axios from 'axios';

export default function AddProjectModal({ onClose, onSuccess }:{onClose:()=>void; onSuccess?:(data?:any)=>void}){
  const [repoUrl, setRepoUrl] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [readmeUrl, setReadmeUrl] = useState('');
  const [collaborators, setCollaborators] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string| null>(null);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setError(null);
    setLoading(true);
    try{
      const token = localStorage.getItem('token');
      const body = { repoUrl, name, description, readmeUrl, collaborators: collaborators.split(',').map(s=>s.trim()).filter(Boolean) };
      const res = await axios.post('http://15.207.111.237:3000/api/projects', body, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) {
        if (res.data?.collaboratorWarnings && Array.isArray(res.data.collaboratorWarnings) && res.data.collaboratorWarnings.length > 0) {
          setError(`Ignored collaborators (not found in repo): ${res.data.collaboratorWarnings.join(', ')}`);
          if (onSuccess) onSuccess(res.data);
          setTimeout(() => onClose(), 1600);
        } else {
          if (onSuccess) onSuccess(res.data);
          setError(null);
          setTimeout(() => onClose(), 600);
        }
      } else {
        setError(res.data?.message || 'Verification failed');
      }
    }catch(err:any){
      setError(err?.response?.data?.message || err?.message || 'Failed');
    }finally{ setLoading(false); }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h3>Add Project for verification</h3>
        <form onSubmit={submit}>
          <label>Repository URL</label>
          <input value={repoUrl} onChange={e=>setRepoUrl(e.target.value)} required />
          <label>Repo name (optional)</label>
          <input value={name} onChange={e=>setName(e.target.value)} />
          <label>Short description</label>
          <input value={description} onChange={e=>setDescription(e.target.value)} />
          <label>README raw URL</label>
          <input value={readmeUrl} onChange={e=>setReadmeUrl(e.target.value)} />
          <label>Collaborators (comma separated GitHub usernames)</label>
          <input value={collaborators} onChange={e=>setCollaborators(e.target.value)} />
          {error && <div className="error">{error}</div>}
          <div style={{display:'flex',gap:8,marginTop:12}}>
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={loading}>{loading? 'Verifying...' : 'Submit for verification'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
