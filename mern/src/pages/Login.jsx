import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Cursor from '../components/common/Cursor';
import Particles from '../components/common/Particles';

export default function Login() {
  const [tab,      setTab]      = useState('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login, register, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    try {
      if (tab === 'login') await login(email, password);
      else await register(name, email, password);
      setSuccess(true);
      setTimeout(() => navigate('/'), 1800);
    } catch (err) { setError(err.message); }
  };

  const artBgs = ['bg1','bg2','bg3','bg4'];
  const [activeArt, setActiveArt] = useState(0);

  return (
    <>
      <Cursor />
      <Particles />
    <div style={{ display:'flex', width:'100%', height:'100vh', position:'relative', zIndex:1 }}>
      {/* Left — artwork showcase */}
      <div style={{ flex:'1.1', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
        <div className={`prod-img-bg ${artBgs[activeArt]}`} style={{ position:'absolute', inset:0, animation:'artPan 18s ease-in-out infinite alternate' }} />
        <div style={{ position:'absolute', inset:0, background:'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(8,7,6,.05) 3px,rgba(8,7,6,.05) 4px)', zIndex:2 }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to right,rgba(8,7,6,.25) 0%,transparent 40%),linear-gradient(to top,rgba(8,7,6,.7) 0%,transparent 55%)', zIndex:3 }} />
        {/* Top nav */}
        <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:5, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'2rem 3.5rem' }}>
          <Link to="/" style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'1.25rem', fontWeight:500, letterSpacing:'.15em', color:'var(--gold)', textDecoration:'none' }}>Shades <span style={{ fontStyle:'italic', fontWeight:300, color:'var(--cream2)' }}>& Strokes</span></Link>
          <Link to="/" style={{ fontSize:'.58rem', letterSpacing:'.2em', textTransform:'uppercase', color:'var(--muted)', textDecoration:'none', display:'flex', alignItems:'center', gap:'.5rem', transition:'color .3s' }}
            onMouseEnter={e=>e.target.style.color='var(--gold)'} onMouseLeave={e=>e.target.style.color='var(--muted)'}>← Back to Gallery</Link>
        </div>
        {/* Artwork info */}
        <div style={{ position:'relative', zIndex:4, padding:'3.5rem' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:'.7rem', fontSize:'.55rem', letterSpacing:'.32em', textTransform:'uppercase', color:'var(--gold)', border:'.5px solid var(--border2)', padding:'.32rem .9rem', background:'rgba(8,7,6,.5)', backdropFilter:'blur(8px)', marginBottom:'1.5rem' }}>
            <span style={{ width:'5px', height:'5px', background:'var(--gold)', borderRadius:'50%' }} />Work of the Season
          </div>
          <h2 style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'2.6rem', fontWeight:300, color:'var(--cream)', lineHeight:1.05, marginBottom:'.5rem' }}>
            Molten <em style={{ fontStyle:'italic', color:'var(--gold)', fontFamily:"'IM Fell English',serif" }}>Hour</em>
          </h2>
          <div style={{ display:'flex', alignItems:'center', gap:'1.5rem', fontSize:'.58rem', letterSpacing:'.2em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'2.2rem' }}>
            {['Oil on Canvas','90 × 120 cm','2024'].map((s,i)=><span key={i} style={{ display:'flex', alignItems:'center', gap:'.5rem' }}><span style={{ width:'16px', height:'.5px', background:'var(--muted)', display:'inline-block' }} />{s}</span>)}
          </div>
          <div style={{ display:'flex', gap:'.6rem' }}>
            {artBgs.map((bg,i) => (
              <div key={i} onClick={() => setActiveArt(i)} style={{ width:'56px', height:'56px', border:`.5px solid ${activeArt===i?'var(--gold)':'var(--border)'}`, cursor:'none', overflow:'hidden', transition:'border-color .3s', flexShrink:0 }}>
                <div className={`prod-img-bg ${bg}`} style={{ width:'100%', height:'100%' }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div style={{ width:'480px', flexShrink:0, background:'var(--surface2)', borderLeft:'.5px solid var(--border)', display:'flex', flexDirection:'column', justifyContent:'center', padding:'4rem 3.5rem', position:'relative', overflow:'hidden' }}>
        {/* Corner ornament */}
        <svg style={{ position:'absolute', top:'2.5rem', right:'2.5rem', width:'48px', height:'48px' }} viewBox="0 0 48 48" stroke="var(--border2)" fill="none" strokeWidth=".5">
          <polyline points="48,0 0,0 0,48"/><polyline points="44,4 4,4 4,44"/><line x1="0" y1="0" x2="12" y2="12"/>
        </svg>

        {/* Success overlay */}
        {success && (
          <div style={{ position:'absolute', inset:0, background:'var(--surface2)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:10 }}>
            <div style={{ width:'60px', height:'60px', border:'.5px solid var(--border3)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'1.8rem', position:'relative' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" stroke="var(--gold)" fill="none" strokeWidth="1.2"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'1.8rem', fontWeight:300, color:'var(--cream)', marginBottom:'.5rem' }}>Welcome{tab==='login'?' Back':''}</div>
            <div style={{ fontSize:'.62rem', letterSpacing:'.14em', color:'var(--muted)' }}>Entering your gallery…</div>
          </div>
        )}

        {/* Tab toggle */}
        <div style={{ display:'flex', gap:'0', marginBottom:'2.5rem', border:'.5px solid var(--border2)' }}>
          {['login','register'].map(t => (
            <button key={t} onClick={() => { setTab(t); setError(''); }}
              style={{ flex:1, padding:'.65rem', fontFamily:'Josefin Sans,sans-serif', fontSize:'.58rem', letterSpacing:'.22em', textTransform:'uppercase', border:'none', cursor:'none', transition:'all .3s',
                background: tab===t?'var(--gold)':'transparent', color: tab===t?'var(--ink)':'var(--muted)' }}>
              {t === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'2rem' }}>
          <div style={{ height:'.5px', width:'36px', background:'linear-gradient(90deg,transparent,var(--gold))' }} />
          <span style={{ fontSize:'.55rem', letterSpacing:'.38em', textTransform:'uppercase', color:'var(--gold3)' }}>Private Access</span>
        </div>
        <h1 style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'2.8rem', fontWeight:300, color:'var(--cream)', lineHeight:1.05, marginBottom:'.5rem' }}>
          {tab === 'login' ? <>Sign <em style={{ fontStyle:'italic', color:'var(--gold)', fontFamily:"'IM Fell English',serif" }}>In</em></> : <>Create <em style={{ fontStyle:'italic', color:'var(--gold)', fontFamily:"'IM Fell English',serif" }}>Account</em></>}
        </h1>
        <p style={{ fontSize:'.65rem', letterSpacing:'.1em', color:'var(--muted)', marginBottom:'2.5rem', lineHeight:1.8 }}>
          {tab === 'login' ? 'Access your curated collection, wishlist, and order history.' : 'Join thousands of collectors and artists.'}
        </p>

        <form onSubmit={handleSubmit}>
          {tab === 'register' && (
            <div style={{ marginBottom:'1.6rem' }}>
              <label style={{ fontSize:'.56rem', letterSpacing:'.28em', textTransform:'uppercase', color:'var(--muted)', display:'block', marginBottom:'.65rem' }}>Full Name</label>
              <input value={name} onChange={e=>setName(e.target.value)} required type="text" placeholder="Your name"
                style={{ width:'100%', background:'transparent', border:'none', borderBottom:'.5px solid var(--border2)', outline:'none', padding:'.75rem 0', fontFamily:'Josefin Sans,sans-serif', fontSize:'.8rem', fontWeight:300, letterSpacing:'.1em', color:'var(--cream)', caretColor:'var(--gold)' }} />
            </div>
          )}
          <div style={{ marginBottom:'1.6rem' }}>
            <label style={{ fontSize:'.56rem', letterSpacing:'.28em', textTransform:'uppercase', color:'var(--muted)', display:'block', marginBottom:'.65rem' }}>Email Address</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} required type="email" placeholder="you@example.com"
              style={{ width:'100%', background:'transparent', border:'none', borderBottom:'.5px solid var(--border2)', outline:'none', padding:'.75rem 0', fontFamily:'Josefin Sans,sans-serif', fontSize:'.8rem', fontWeight:300, letterSpacing:'.1em', color:'var(--cream)', caretColor:'var(--gold)' }} />
          </div>
          <div style={{ marginBottom:'1.6rem', position:'relative' }}>
            <label style={{ fontSize:'.56rem', letterSpacing:'.28em', textTransform:'uppercase', color:'var(--muted)', display:'block', marginBottom:'.65rem' }}>Password</label>
            <div style={{ position:'relative' }}>
              <input value={password} onChange={e=>setPassword(e.target.value)} required type={showPass?'text':'password'} placeholder="••••••••••" minLength={6}
                style={{ width:'100%', background:'transparent', border:'none', borderBottom:'.5px solid var(--border2)', outline:'none', padding:'.75rem 2.5rem .75rem 0', fontFamily:'Josefin Sans,sans-serif', fontSize:'.8rem', fontWeight:300, letterSpacing:'.1em', color:'var(--cream)', caretColor:'var(--gold)' }} />
              <button type="button" onClick={() => setShowPass(s=>!s)} style={{ position:'absolute', right:0, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'none', color:'var(--muted)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.4">
                  {showPass ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
                </svg>
              </button>
            </div>
          </div>

          {tab === 'login' && (
            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'-.8rem', marginBottom:'2rem' }}>
              <Link to="#" style={{ fontSize:'.56rem', letterSpacing:'.16em', textTransform:'uppercase', color:'var(--muted)', textDecoration:'none' }}>Forgot Password?</Link>
            </div>
          )}

          {error && <div style={{ fontSize:'.6rem', letterSpacing:'.14em', color:'#c05050', textAlign:'center', marginBottom:'1rem' }}>{error}</div>}

          <button type="submit" className="btn-primary" style={{ width:'100%' }} disabled={loading}>
            {loading ? 'Verifying…' : tab === 'login' ? 'Enter Gallery' : 'Create Account'}
          </button>
        </form>

        <div style={{ display:'flex', alignItems:'center', gap:'1.2rem', margin:'1.8rem 0' }}>
          <div style={{ flex:1, height:'.5px', background:'var(--border)' }} />
          <span style={{ fontSize:'.55rem', letterSpacing:'.2em', textTransform:'uppercase', color:'var(--muted2)' }}>or continue with</span>
          <div style={{ flex:1, height:'.5px', background:'var(--border)' }} />
        </div>

        <div style={{ display:'flex', gap:'.8rem' }}>
          {['Google','GitHub'].map(p => (
            <button key={p} style={{ flex:1, background:'transparent', border:'.5px solid var(--border)', padding:'.75rem 1rem', cursor:'none', fontFamily:'Josefin Sans,sans-serif', fontSize:'.58rem', letterSpacing:'.18em', textTransform:'uppercase', color:'var(--muted)', transition:'all .3s' }}
              onMouseEnter={e=>e.currentTarget.style.borderColor='var(--border2)'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
              {p}
            </button>
          ))}
        </div>

        <div style={{ marginTop:'2rem', textAlign:'center', fontSize:'.58rem', letterSpacing:'.12em', color:'var(--muted)' }}>
          {tab === 'login' ? <>No account? <button onClick={() => setTab('register')} style={{ color:'var(--gold)', background:'none', border:'none', cursor:'none', fontSize:'.58rem', letterSpacing:'.12em', textDecoration:'underline' }}>Create one free</button></> : <>Have an account? <button onClick={() => setTab('login')} style={{ color:'var(--gold)', background:'none', border:'none', cursor:'none', fontSize:'.58rem', letterSpacing:'.12em', textDecoration:'underline' }}>Sign in</button></>}
        </div>
      </div>
      <style>{`@keyframes artPan{from{transform:scale(1.04) translate(0,0)}to{transform:scale(1.08) translate(-1%,1.5%)}}`}</style>
    </div>
    </>
  );
}
