import React, { useState } from 'react';
import axios from 'axios';

export default function ProposalCreate() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [teamSize, setTeamSize] = useState(3);
  const [repoUrl, setRepoUrl] = useState('');
  // reward is fixed by policy: 100 points awarded on successful completion
  const FIXED_REWARD = 100;
  const [minRepoCount, setMinRepoCount] = useState(0);
  const [minCommits, setMinCommits] = useState(0);
  const [minLevel, setMinLevel] = useState(0);
  const [languages, setLanguages] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const styles: { [k: string]: React.CSSProperties } = {
    formRow: { display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 },
    col: { flex: 1 },
    label: { display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 600 },
    input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)', fontSize: 14 },
    textarea: { width: '100%', padding: 12, borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', fontSize: 14, minHeight: 120 },
    smallMuted: { fontSize: 13, color: '#666', marginBottom: 10 },
    card: { maxWidth: 920, margin: '0 auto', padding: 18, borderRadius: 10, background: '#fff', color: '#111', boxShadow: '0 6px 18px rgba(0,0,0,0.06)' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    badge: { background: '#f3f6ff', color: '#0b3bff', padding: '6px 10px', borderRadius: 8, fontWeight: 700, fontSize: 13 },
    reqBox: { padding: 12, borderRadius: 8, background: '#fbfbfb', border: '1px solid #eee' },
    primaryBtn: { background: '#0b63ff', color: '#fff', padding: '10px 16px', borderRadius: 8, border: 'none', fontWeight: 700, cursor: 'pointer' },
    ghostBtn: { background: 'transparent', color: '#0b63ff', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(11,99,255,0.15)', cursor: 'pointer' }
  };

  async function submit(e: any) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const token = localStorage.getItem('token');
    // basic client-side validation
    if (!title.trim() || !description.trim() || !repoUrl.trim() || !languages.trim()) {
      setMsg('Please fill required fields');
      setSaving(false);
      return;
    }
    try {
      const payload = {
        title,
        description,
        repoUrl,
        teamSize,
        rewardPoints: FIXED_REWARD,
        requirements: { minRepoCount, minCommits, minLevel, languages: languages.split(',').map(s => s.trim()).filter(Boolean) },
        tags: tags.split(',').map(s => s.trim()).filter(Boolean)
      };
      const res = await axios.post('http://localhost:3000/api/proposals/create', payload, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) {
        const created = res.data.proposal || null;
        setMsg('Proposal created');
        // dispatch event so lists can refresh in-place without URL navigation
        try { window.dispatchEvent(new CustomEvent('proposal.created', { detail: created })); } catch (e) { /* ignore */ }
      } else {
        setMsg('Create failed: ' + (res.data?.message || 'unknown'));
      }
    } catch (err: any) {
      setMsg('Create failed: ' + (err?.response?.data?.message || err?.message || 'unknown'));
    } finally { setSaving(false); }
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Create Project Proposal</div>
          <div style={styles.smallMuted}>Fill the required fields. Reward is fixed to <strong>{FIXED_REWARD}</strong> points and awarded after successful completion and verification of the open-source deliverable.</div>
        </div>
        <div style={styles.badge}>Fixed Reward</div>
      </div>

      <form onSubmit={submit}>
        <div style={{ marginBottom: 12 }}>
          <label style={styles.label}>Project Title <span style={{ color: '#d00' }}>*</span></label>
          <input style={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Short descriptive title" />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={styles.label}>Project Description <span style={{ color: '#d00' }}>*</span></label>
          <textarea style={styles.textarea} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what you'll build, goals and deliverables" required />
        </div>

        <div style={styles.formRow}>
          <div style={styles.col}>
            <label style={styles.label}>Project Repo URL <span style={{ color: '#d00' }}>*</span></label>
            <input style={styles.input} value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/owner/repo" required />
          </div>
          <div style={{ width: 200 }}>
            <label style={styles.label}>Team size</label>
            <input style={styles.input} type="number" value={teamSize} onChange={(e) => setTeamSize(Number(e.target.value))} min={1} max={10} />
            <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>Suggest 1-5 members for focused projects</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12, alignItems: 'start' }}>
          <div>
            <label style={styles.label}>Languages to be used (comma separated) <span style={{ color: '#d00' }}>*</span></label>
            <input style={styles.input} value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="TypeScript, React, Node" required />
          </div>
          <div>
            <label style={styles.label}>Reward points</label>
            <div style={{ ...styles.input, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>{FIXED_REWARD} <span style={{ color: '#666', fontSize: 13 }}>fixed</span></div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={styles.label}>Tags (comma separated)</label>
          <input style={styles.input} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="web, ui, api" />
        </div>

        <div style={{ marginTop: 14, ...styles.reqBox }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Requirements</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Min repo's</label>
              <input style={styles.input} type="number" value={minRepoCount} onChange={(e) => setMinRepoCount(Number(e.target.value))} min={0} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Min commits</label>
              <input style={styles.input} type="number" value={minCommits} onChange={(e) => setMinCommits(Number(e.target.value))} min={0} />
            </div>
            <div style={{ width: 160 }}>
              <label style={styles.label}>Profile level</label>
              <input style={styles.input} type="number" value={minLevel} onChange={(e) => setMinLevel(Number(e.target.value))} min={0} />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" style={styles.ghostBtn} onClick={() => { window.history.back(); }} disabled={saving}>Cancel</button>
          <button type="submit" style={styles.primaryBtn} disabled={saving}>{saving ? 'Creating…' : 'Create Proposal'}</button>
        </div>

        {msg && <div style={{ marginTop: 12, color: msg.startsWith('Create failed') ? '#b00' : '#0a0' }}>{msg}</div>}
      </form>
    </div>
  );
}
