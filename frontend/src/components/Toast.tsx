import React, { useEffect } from 'react';

export default function Toast({ message, type='info', onClose }:{message:string|undefined, type?:'info'|'success'|'error', onClose?:()=>void}){
  useEffect(()=>{
    if (!message) return;
    const t = setTimeout(()=>{ onClose && onClose(); }, 3000);
    return ()=> clearTimeout(t);
  },[message]);
  if (!message) return null;
  const bg = type==='error' ? '#7f1d1d' : type==='success' ? '#064e3b' : '#0b1220';
  return (
    <div style={{position:'fixed',right:18,bottom:18,zIndex:200,background:bg,color:'#e6eef6',padding:'12px 16px',borderRadius:10,boxShadow:'0 6px 20px rgba(2,6,23,0.6)'}}>
      {message}
    </div>
  );
}
