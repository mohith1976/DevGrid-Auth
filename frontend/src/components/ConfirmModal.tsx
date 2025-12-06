import React from 'react';

export default function ConfirmModal({ open, title, body, items, onConfirm, onCancel }:{open:boolean,title:string,body?:string,items?:string[]|undefined,onConfirm:(include:boolean)=>void,onCancel:()=>void}){
  if (!open) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h3>{title}</h3>
        {body && <p className="muted">{body}</p>}
        {items && items.length>0 && (
          <div style={{marginTop:10}}>
            <div className="small muted">Contributors:</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:6}}>
              {items.map(i=> <div key={i} style={{padding:'6px 10px',background:'rgba(255,255,255,0.03)',borderRadius:8}}>{i}</div>)}
            </div>
          </div>
        )}
        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
          <button className="btn ghost" onClick={()=>onCancel()}>Cancel</button>
          <button className="btn primary" onClick={()=>onConfirm(true)}>Include collaborators & Publish</button>
          <button className="btn" onClick={()=>onConfirm(false)}>Publish without collaborators</button>
        </div>
      </div>
    </div>
  );
}
