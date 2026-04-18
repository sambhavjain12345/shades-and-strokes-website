import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArtistAPI, getBgClass, getProductImageStyle } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import Cursor from '../components/common/Cursor';
import Particles from '../components/common/Particles';

// ── Shared styles ─────────────────────────────────────────────
const inp = { width:'100%', background:'rgba(201,168,76,.04)', border:'.5px solid var(--border2)', outline:'none', padding:'.7rem 1rem', fontFamily:"'Josefin Sans',sans-serif", fontSize:'.72rem', fontWeight:300, letterSpacing:'.08em', color:'var(--cream)', caretColor:'var(--gold)', transition:'border-color .3s', boxSizing:'border-box' };
const lbl = { fontSize:'.54rem', letterSpacing:'.26em', textTransform:'uppercase', color:'var(--muted)', display:'block', marginBottom:'.5rem' };
const th  = { fontSize:'.52rem', letterSpacing:'.22em', textTransform:'uppercase', color:'var(--muted)', padding:'.85rem 1.2rem', textAlign:'left', borderBottom:'.5px solid var(--border)', fontWeight:300 };
const td  = { padding:'.8rem 1.2rem', borderBottom:'.5px solid var(--border)', fontSize:'.7rem', color:'var(--cream2)', verticalAlign:'middle' };
const goldBtn = { background:'var(--gold)', color:'var(--ink)', border:'none', padding:'.6rem 1.3rem', cursor:'none', fontFamily:"'Josefin Sans',sans-serif", fontSize:'.58rem', letterSpacing:'.18em', textTransform:'uppercase', transition:'background .3s' };
const outBtn  = (c='var(--muted)') => ({ background:'none', border:`.5px solid ${c}55`, color:c, padding:'.28rem .65rem', cursor:'none', fontFamily:"'Josefin Sans',sans-serif", fontSize:'.5rem', letterSpacing:'.14em', textTransform:'uppercase', transition:'all .25s', marginRight:'.4rem' });

const STATUS_COLOR = { confirmed:'#4a8c5c', packaging:'var(--gold3)', shipped:'var(--gold3)', delivered:'var(--muted)', cancelled:'#c05050', pending:'var(--muted2)' };

// ── Confirm Dialog ────────────────────────────────────────────
function Confirm({ msg, onOk, onCancel }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:9100, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'var(--surface2)', border:'.5px solid var(--border2)', padding:'2.5rem', maxWidth:'400px', width:'90%' }}>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.2rem', color:'var(--cream)', marginBottom:'1rem' }}>Confirm</div>
        <p style={{ fontSize:'.7rem', color:'var(--muted)', lineHeight:1.7, marginBottom:'2rem' }}>{msg}</p>
        <div style={{ display:'flex', gap:'.8rem', justifyContent:'flex-end' }}>
          <button onClick={onCancel} style={{ ...outBtn('var(--muted)'), padding:'.6rem 1.4rem', fontSize:'.6rem' }}>Cancel</button>
          <button onClick={onOk} style={{ background:'#c05050', color:'#fff', border:'none', padding:'.6rem 1.4rem', cursor:'none', fontFamily:"'Josefin Sans',sans-serif", fontSize:'.6rem', letterSpacing:'.18em', textTransform:'uppercase' }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ── Upload image to Cloudinary via backend ────────────────────
const uploadImage = async (file) => {
  const token = localStorage.getItem('ss_token');
  const apiBase = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
    : '';
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`${apiBase}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Upload failed');
  return data.url;
};

// ── Image Uploader Component ──────────────────────────────────
function ImageUploader({ value, onChange }) {
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver]   = useState(false);

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch (e) {
      alert('Upload failed: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label style={lbl}>
        Artwork Image
        <span style={{ color:'var(--muted2)', fontSize:'.46rem', marginLeft:'.5rem', textTransform:'none', letterSpacing:0 }}>
          — upload a file OR paste a URL below
        </span>
      </label>
      <div
        onClick={() => !uploading && fileRef.current.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
        style={{
          border: `.5px dashed ${dragOver ? 'var(--gold)' : 'var(--border2)'}`,
          background: dragOver ? 'rgba(201,168,76,.06)' : 'rgba(201,168,76,.02)',
          padding: '1.2rem', textAlign: 'center',
          cursor: uploading ? 'not-allowed' : 'pointer',
          transition: 'all .3s', marginBottom: '.8rem',
        }}>
        {uploading ? (
          <div style={{ fontSize:'.62rem', letterSpacing:'.14em', color:'var(--gold3)' }}>⏳ Uploading to Cloudinary…</div>
        ) : (
          <>
            <div style={{ fontSize:'1.4rem', marginBottom:'.4rem' }}>📁</div>
            <div style={{ fontSize:'.6rem', letterSpacing:'.14em', color:'var(--muted)' }}>Click to browse or drag & drop</div>
            <div style={{ fontSize:'.52rem', letterSpacing:'.1em', color:'var(--muted2)', marginTop:'.3rem' }}>JPG, PNG, WEBP — max 5MB</div>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }}
          onChange={e => handleFile(e.target.files[0])} />
      </div>
      <input
        style={inp} value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Or paste image URL: https://res.cloudinary.com/..."
        onFocus={e => e.target.style.borderColor = 'var(--gold)'}
        onBlur={e => e.target.style.borderColor = 'var(--border2)'}
      />
      {value && (
        <div style={{ marginTop:'.6rem', position:'relative' }}>
          <div style={{ width:'100%', height:'140px', backgroundImage:`url(${value})`, backgroundSize:'cover', backgroundPosition:'center', border:'.5px solid var(--border2)' }} />
          <button type="button" onClick={() => onChange('')}
            style={{ position:'absolute', top:'.4rem', right:'.4rem', background:'rgba(192,80,80,.85)', color:'#fff', border:'none', padding:'.3rem .7rem', cursor:'pointer', fontSize:'.5rem', letterSpacing:'.12em', textTransform:'uppercase' }}>
            ✕ Remove
          </button>
        </div>
      )}
    </div>
  );
}

// ── Artwork Form Modal ────────────────────────────────────────
function ArtworkModal({ artwork, categories, onSave, onClose }) {
  const [form, setForm] = useState({
    title:       artwork?.title       || '',
    price:       artwork?.price       || '',
    stock:       artwork?.stock       || 1,
    medium:      artwork?.medium      || '',
    dimensions:  artwork?.dimensions  || '',
    year:        artwork?.year        || new Date().getFullYear(),
    tag:         artwork?.tag         || '',
    description: artwork?.description || '',
    category_id: artwork?.category_id || (categories[0]?.id || ''),
    image_url:   artwork?.image_url   || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:9100, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem', overflowY:'auto' }}>
      <div style={{ background:'var(--surface2)', border:'.5px solid var(--border2)', padding:'2.5rem', width:'100%', maxWidth:'580px' }}>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.4rem', color:'var(--cream)', marginBottom:'2rem' }}>
          {artwork ? 'Edit Artwork' : 'Add New Artwork'}
        </div>

        {/* Image upload with Cloudinary support */}
        <div style={{ marginBottom:'1.2rem' }}>
          <ImageUploader value={form.image_url} onChange={v => set('image_url', v)} />
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.2rem 1.6rem' }}>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={lbl}>Title *</label>
            <input style={inp} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Artwork title"
              onFocus={e=>e.target.style.borderColor='var(--gold)'} onBlur={e=>e.target.style.borderColor='var(--border2)'} />
          </div>
          <div>
            <label style={lbl}>Category *</label>
            <select value={form.category_id} onChange={e => set('category_id', e.target.value)} style={{ ...inp, appearance:'none' }}>
              <option value="">— Select —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Price (₹) *</label>
            <input style={inp} type="number" value={form.price} onChange={e => set('price', e.target.value)}
              onFocus={e=>e.target.style.borderColor='var(--gold)'} onBlur={e=>e.target.style.borderColor='var(--border2)'} />
          </div>
          <div>
            <label style={lbl}>Medium</label>
            <input style={inp} value={form.medium} onChange={e => set('medium', e.target.value)} placeholder="Oil on Canvas"
              onFocus={e=>e.target.style.borderColor='var(--gold)'} onBlur={e=>e.target.style.borderColor='var(--border2)'} />
          </div>
          <div>
            <label style={lbl}>Dimensions</label>
            <input style={inp} value={form.dimensions} onChange={e => set('dimensions', e.target.value)} placeholder="90 × 120 cm"
              onFocus={e=>e.target.style.borderColor='var(--gold)'} onBlur={e=>e.target.style.borderColor='var(--border2)'} />
          </div>
          <div>
            <label style={lbl}>Year</label>
            <input style={inp} type="number" value={form.year} onChange={e => set('year', e.target.value)}
              onFocus={e=>e.target.style.borderColor='var(--gold)'} onBlur={e=>e.target.style.borderColor='var(--border2)'} />
          </div>
          <div>
            <label style={lbl}>
              Quantity Available
              <span style={{ color:'var(--muted2)', fontSize:'.46rem', marginLeft:'.4rem', textTransform:'none', letterSpacing:0 }}>(0 = sold out)</span>
            </label>
            <input style={inp} type="number" min="0" value={form.stock} onChange={e => set('stock', e.target.value)}
              onFocus={e=>e.target.style.borderColor='var(--gold)'} onBlur={e=>e.target.style.borderColor='var(--border2)'} />
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={lbl}>Tag <span style={{ color:'var(--muted2)', fontSize:'.48rem' }}>(optional — e.g. New, Featured)</span></label>
            <input style={inp} value={form.tag} onChange={e => set('tag', e.target.value)} placeholder="New"
              onFocus={e=>e.target.style.borderColor='var(--gold)'} onBlur={e=>e.target.style.borderColor='var(--border2)'} />
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={lbl}>Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
              placeholder="Tell collectors about this piece…" style={{ ...inp, resize:'vertical', lineHeight:1.6 }}
              onFocus={e=>e.target.style.borderColor='var(--gold)'} onBlur={e=>e.target.style.borderColor='var(--border2)'} />
          </div>
        </div>

        <div style={{ display:'flex', gap:'.8rem', justifyContent:'flex-end', marginTop:'2rem', paddingTop:'1.5rem', borderTop:'.5px solid var(--border)' }}>
          <button onClick={onClose} style={{ ...outBtn('var(--muted)'), padding:'.7rem 1.6rem', fontSize:'.6rem' }}>Cancel</button>
          <button onClick={() => onSave(form)} style={{ ...goldBtn, padding:'.7rem 1.8rem', fontSize:'.62rem' }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--gold2)'}
            onMouseLeave={e=>e.currentTarget.style.background='var(--gold)'}>
            {artwork ? 'Save Changes' : 'Add Artwork'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Artist Dashboard ─────────────────────────────────────
export default function ArtistDashboard() {
  const { user }      = useAuth();
  const { showToast } = useToast();
  const navigate      = useNavigate();

  const [tab,        setTab]        = useState('dashboard');
  const [artist,     setArtist]     = useState(null);
  const [stats,      setStats]      = useState(null);
  const [monthly,    setMonthly]    = useState([]);
  const [artworks,   setArtworks]   = useState([]);
  const [sales,      setSales]      = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState('');
  const [modal,      setModal]      = useState(null);
  const [confirm,    setConfirm]    = useState(null);
  const [noProfile,  setNoProfile]  = useState(false);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (user.role !== 'artist') { navigate('/'); return; }
    loadAll();
  }, [user]);

  useEffect(() => { if (tab === 'artworks') loadArtworks(); }, [tab, search]);
  useEffect(() => { if (tab === 'sales')    loadSales();    }, [tab]);

  const loadAll = async () => {
    try {
      const [statsData, catsData] = await Promise.all([
        ArtistAPI.getStats(),
        fetch('/api/products/categories').then(r => r.json()).catch(() => ({ categories: [] })),
      ]);
      if (statsData.success) {
        setStats(statsData.stats);
        setMonthly(statsData.monthly || []);
        setArtist(statsData.artist);
      }
      setCategories(catsData.categories || []);
    } catch (e) {
      if (e.message?.includes('Artist profile not found') || e.message?.includes('404')) setNoProfile(true);
    }
  };

  const loadArtworks = async () => {
    setLoading(true);
    try {
      const d = await ArtistAPI.getArtworks({ search, limit:50 });
      if (d.success) setArtworks(d.artworks || []);
    } catch { setArtworks([]); }
    finally { setLoading(false); }
  };

  const loadSales = async () => {
    setLoading(true);
    try {
      const d = await ArtistAPI.getSales({ limit:50 });
      if (d.success) setSales(d.sales || []);
    } catch { setSales([]); }
    finally { setLoading(false); }
  };

  const saveArtwork = async (form) => {
    if (!form.title || !form.category_id || !form.price) {
      showToast('Title, category and price are required', 'error'); return;
    }
    const isEdit = modal && typeof modal === 'object';
    try {
      const d = isEdit
        ? await ArtistAPI.updateArtwork(modal.id, form)
        : await ArtistAPI.createArtwork(form);
      if (!d.success) throw new Error(d.message);
      showToast(isEdit ? 'Artwork updated ✓' : 'Artwork added ✓ — now live on the gallery!', 'success');
      setModal(null); loadArtworks(); loadAll();
    } catch (e) { showToast(e.message, 'error'); }
  };

  const deleteArtwork = (a) => setConfirm({
    msg: `Remove "${a.title}" from the gallery?`,
    onOk: async () => {
      try {
        const d = await ArtistAPI.deleteArtwork(a.id);
        if (!d.success) throw new Error(d.message);
        showToast('Artwork removed', 'success'); loadArtworks(); loadAll();
      } catch (e) { showToast(e.message, 'error'); }
      setConfirm(null);
    }
  });

  const maxRev = Math.max(...monthly.map(m => Number(m.revenue) || 0), 1);
  const initials = artist?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  if (noProfile) return (
    <>
      <Cursor /><Particles />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', flexDirection:'column', gap:'1.5rem', position:'relative', zIndex:1 }}>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'2rem', color:'var(--cream)', textAlign:'center' }}>
          No Artist Profile <em style={{ fontStyle:'italic', color:'var(--gold)' }}>Linked</em>
        </div>
        <p style={{ fontSize:'.7rem', color:'var(--muted)', letterSpacing:'.1em', textAlign:'center', maxWidth:'400px', lineHeight:1.8 }}>
          Your account hasn't been linked to an artist profile yet.<br/>
          Please contact the admin to link your account.
        </p>
        <a href="/" style={{ ...goldBtn, textDecoration:'none', padding:'.8rem 2rem' }}>Back to Gallery</a>
      </div>
    </>
  );

  const sideItems = [
    { key:'dashboard', label:'Dashboard'   },
    { key:'artworks',  label:'My Artworks' },
    { key:'sales',     label:'My Sales'    },
  ];

  return (
    <>
      <Cursor />
      <Particles />

      {confirm && <Confirm msg={confirm.msg} onOk={confirm.onOk} onCancel={() => setConfirm(null)} />}
      {modal !== null && (
        <ArtworkModal
          artwork={typeof modal === 'object' ? modal : null}
          categories={categories}
          onSave={saveArtwork}
          onClose={() => setModal(null)}
        />
      )}

      <div style={{ display:'flex', minHeight:'100vh', position:'relative', zIndex:1 }}>

        {/* ── Sidebar ── */}
        <aside style={{ width:'220px', flexShrink:0, background:'var(--surface2)', borderRight:'.5px solid var(--border)', display:'flex', flexDirection:'column', position:'sticky', top:0, height:'100vh' }}>
          <div style={{ padding:'1.8rem 1.6rem', borderBottom:'.5px solid var(--border)' }}>
            <a href="/" style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.1rem', fontWeight:500, letterSpacing:'.15em', color:'var(--gold)', textDecoration:'none', display:'block', marginBottom:'.4rem' }}>
              Shades <span style={{ fontStyle:'italic', fontWeight:300, color:'var(--cream2)' }}>&amp; Strokes</span>
            </a>
            <span style={{ fontSize:'.48rem', letterSpacing:'.22em', textTransform:'uppercase', color:'var(--gold3)', border:'.5px solid var(--border)', padding:'.18rem .55rem', display:'inline-block' }}>Artist Studio</span>
          </div>

          {/* Artist info */}
          {artist && (
            <div style={{ padding:'1.4rem 1.6rem', borderBottom:'.5px solid var(--border)', display:'flex', alignItems:'center', gap:'1rem' }}>
              <div style={{ width:'42px', height:'42px', border:'.5px solid var(--border2)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Cormorant Garamond',serif", fontSize:'.9rem', color:'var(--gold)', flexShrink:0 }}>
                {initials}
              </div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'.95rem', color:'var(--cream)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{artist.name}</div>
                <div style={{ fontSize:'.52rem', letterSpacing:'.14em', textTransform:'uppercase', color:'var(--muted)' }}>{artist.location || 'Artist'}</div>
              </div>
            </div>
          )}

          <nav style={{ flex:1, padding:'.8rem 0' }}>
            {sideItems.map(item => (
              <button key={item.key} onClick={() => setTab(item.key)}
                style={{ display:'block', width:'100%', textAlign:'left', padding:'.8rem 1.6rem', fontSize:'.6rem', letterSpacing:'.2em', textTransform:'uppercase', border:'none', cursor:'none', fontFamily:"'Josefin Sans',sans-serif", transition:'all .25s', position:'relative',
                  color:      tab === item.key ? 'var(--gold)'           : 'var(--muted)',
                  background: tab === item.key ? 'rgba(201,168,76,.07)' : 'none',
                }}>
                {tab === item.key && <span style={{ position:'absolute', left:0, top:0, bottom:0, width:'2px', background:'var(--gold)' }} />}
                {item.label}
              </button>
            ))}
            <div style={{ height:'.5px', background:'#1a1712', margin:'.8rem 0' }} />
            <a href="/" style={{ display:'block', padding:'.8rem 1.6rem', fontSize:'.58rem', letterSpacing:'.18em', textTransform:'uppercase', color:'var(--muted)', textDecoration:'none', transition:'color .3s' }}
              onMouseEnter={e=>e.currentTarget.style.color='var(--gold)'} onMouseLeave={e=>e.currentTarget.style.color='var(--muted)'}>
              ← Back to Gallery
            </a>
          </nav>

          <div style={{ padding:'1.2rem 1.6rem', borderTop:'.5px solid var(--border)', display:'flex', alignItems:'center', gap:'.8rem' }}>
            <div style={{ width:'30px', height:'30px', border:'.5px solid var(--border2)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Cormorant Garamond',serif", fontSize:'.75rem', color:'var(--gold)', flexShrink:0 }}>
              {user?.name?.[0] || 'A'}
            </div>
            <div style={{ minWidth:0 }}>
              <span style={{ fontSize:'.58rem', color:'var(--cream)', display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.name}</span>
              <span style={{ fontSize:'.48rem', letterSpacing:'.12em', textTransform:'uppercase', color:'var(--muted)' }}>Artist</span>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <main style={{ flex:1, padding:'2.5rem', overflowY:'auto', minWidth:0 }}>

          {/* ══ DASHBOARD ══ */}
          {tab === 'dashboard' && (
            <>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'2rem', paddingBottom:'1.5rem', borderBottom:'.5px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize:'.58rem', letterSpacing:'.3em', textTransform:'uppercase', color:'var(--gold3)', marginBottom:'.4rem' }}>Welcome back</div>
                  <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'2rem', fontWeight:300, color:'var(--cream)' }}>
                    {artist?.name?.split(' ')[0]}'s <em style={{ fontStyle:'italic', color:'var(--gold)' }}>Studio</em>
                  </h1>
                </div>
                <button onClick={() => setTab('artworks')}
                  style={goldBtn}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--gold2)'}
                  onMouseLeave={e=>e.currentTarget.style.background='var(--gold)'}>
                  + Add Artwork
                </button>
              </div>

              {/* Stats */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1px', background:'#1a1712', marginBottom:'2rem' }}>
                {[
                  ['My Artworks',  stats?.total_artworks ?? '—', 'Active on gallery'],
                  ['Units Sold',   stats?.total_sold     ?? '—', 'Total pieces sold'],
                  ['Revenue Earned', stats ? `₹ ${Number(stats.total_revenue).toLocaleString()}` : '—', 'Total earnings'],
                ].map(([label, val, sub]) => (
                  <div key={label} style={{ background:'var(--surface2)', padding:'1.8rem 1.6rem', transition:'background .3s' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
                    onMouseLeave={e=>e.currentTarget.style.background='var(--surface2)'}>
                    <div style={{ fontSize:'.52rem', letterSpacing:'.24em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'.6rem' }}>{label}</div>
                    <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'2rem', fontWeight:300, color:'var(--cream)', lineHeight:1, marginBottom:'.3rem' }}>{val}</div>
                    <div style={{ fontSize:'.54rem', letterSpacing:'.1em', color:'var(--muted2)' }}>{sub}</div>
                  </div>
                ))}
              </div>

              {/* Revenue chart */}
              <div style={{ background:'var(--surface2)', border:'.5px solid var(--border)', padding:'1.5rem', marginBottom:'2rem' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
                  <div style={{ fontSize:'.58rem', letterSpacing:'.22em', textTransform:'uppercase', color:'var(--muted)' }}>My Monthly Revenue</div>
                  <div style={{ fontSize:'.54rem', letterSpacing:'.12em', color:'var(--muted2)' }}>Last 12 months</div>
                </div>
                {monthly.length === 0 ? (
                  <div style={{ height:'80px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.65rem', color:'var(--muted)', letterSpacing:'.14em' }}>No sales data yet</div>
                ) : (
                  <div style={{ display:'flex', alignItems:'flex-end', gap:'.4rem', height:'80px' }}>
                    {monthly.map((m, i) => {
                      const h = Math.round((Number(m.revenue) / maxRev) * 100) || 2;
                      return (
                        <div key={i} title={`${m.month}: ₹${Number(m.revenue).toLocaleString()}`}
                          style={{ flex:1, height:`${h}%`, background:'rgba(201,168,76,.18)', borderTop:'.5px solid var(--gold3)', transition:'background .3s', cursor:'none' }}
                          onMouseEnter={e=>e.currentTarget.style.background='rgba(201,168,76,.38)'}
                          onMouseLeave={e=>e.currentTarget.style.background='rgba(201,168,76,.18)'} />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick artworks preview */}
              <div style={{ background:'var(--surface2)', border:'.5px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.2rem 1.4rem', borderBottom:'.5px solid var(--border)' }}>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.1rem', color:'var(--cream)' }}>My Artworks</div>
                  <button onClick={() => setTab('artworks')} style={{ fontSize:'.54rem', letterSpacing:'.16em', textTransform:'uppercase', color:'var(--muted)', background:'none', border:'none', cursor:'none', transition:'color .3s' }}
                    onMouseEnter={e=>e.target.style.color='var(--gold)'} onMouseLeave={e=>e.target.style.color='var(--muted)'}>Manage All →</button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'1px', background:'#1a1712' }}>
                  {artworks.slice(0,6).map(a => {
                    const imgStyle = getProductImageStyle(a);
                    const bg = getBgClass(a.id);
                    return (
                      <div key={a.id} style={{ background:'var(--surface2)', cursor:'none', transition:'background .3s' }}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
                        onMouseLeave={e=>e.currentTarget.style.background='var(--surface2)'}>
                        <div className={a.image_url ? '' : `prod-img-bg ${bg}`}
                          style={{ height:'100px', ...imgStyle }} />
                        <div style={{ padding:'.6rem .8rem' }}>
                          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'.85rem', color:'var(--cream)', marginBottom:'.2rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.title}</div>
                          <div style={{ fontSize:'.54rem', color:'var(--gold)', fontFamily:"'Cormorant Garamond',serif" }}>₹ {Number(a.price).toLocaleString()}</div>
                        </div>
                      </div>
                    );
                  })}
                  {artworks.length === 0 && (
                    <div style={{ gridColumn:'1/-1', padding:'2.5rem', textAlign:'center', color:'var(--muted)', fontSize:'.65rem', letterSpacing:'.12em' }}>
                      No artworks yet. <button onClick={() => { setTab('artworks'); setTimeout(()=>setModal('add'),100); }} style={{ color:'var(--gold)', background:'none', border:'none', cursor:'none', fontSize:'.65rem', letterSpacing:'.12em', textDecoration:'underline' }}>Add your first artwork</button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ══ MY ARTWORKS ══ */}
          {tab === 'artworks' && (
            <>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.5rem', paddingBottom:'1.5rem', borderBottom:'.5px solid var(--border)' }}>
                <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.8rem', fontWeight:300, color:'var(--cream)' }}>
                  My <em style={{ fontStyle:'italic', color:'var(--gold)' }}>Artworks</em>
                </h1>
                <button onClick={() => setModal('add')} style={goldBtn}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--gold2)'} onMouseLeave={e=>e.currentTarget.style.background='var(--gold)'}>
                  + Add Artwork
                </button>
              </div>

              <div style={{ display:'flex', marginBottom:'1.5rem', border:'.5px solid var(--border2)', maxWidth:'380px' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key==='Enter' && loadArtworks()}
                  placeholder="Search your artworks…" style={{ ...inp, border:'none', flex:1 }} />
                <button onClick={loadArtworks} style={{ ...goldBtn, padding:'.65rem 1rem' }}>Search</button>
              </div>

              {loading ? (
                <div style={{ color:'var(--muted)', fontSize:'.65rem', letterSpacing:'.14em', padding:'3rem 0' }}>Loading…</div>
              ) : (
                <div style={{ background:'var(--surface2)', border:'.5px solid var(--border)', overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr>{['Artwork','Category','Price','Stock','Units Sold','Revenue','Status','Actions'].map(h=><th key={h} style={th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {artworks.length === 0 && (
                        <tr><td colSpan={8} style={{ ...td, textAlign:'center', color:'var(--muted)', padding:'3rem' }}>
                          No artworks yet. Click + Add Artwork to get started.
                        </td></tr>
                      )}
                      {artworks.map(a => {
                        const imgStyle = getProductImageStyle(a);
                        const bg = getBgClass(a.id);
                        return (
                          <tr key={a.id} style={{ transition:'background .2s', opacity: a.is_active ? 1 : 0.55 }}
                            onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
                            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                            <td style={td}>
                              <div style={{ display:'flex', alignItems:'center', gap:'.8rem' }}>
                                <div className={a.image_url ? '' : `prod-img-bg ${bg}`}
                                  style={{ width:'40px', height:'40px', flexShrink:0, ...imgStyle,
                                    ...(a.image_url?{backgroundSize:'cover',backgroundPosition:'center'}:{}) }} />
                                <div>
                                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'.9rem', color:'var(--cream)' }}>{a.title}</div>
                                  {a.medium && <div style={{ fontSize:'.52rem', color:'var(--muted)', letterSpacing:'.1em' }}>{a.medium}</div>}
                                </div>
                              </div>
                            </td>
                            <td style={td}>{a.category_name}</td>
                            <td style={{ ...td, fontFamily:"'Cormorant Garamond',serif", color:'var(--gold)' }}>₹ {Number(a.price).toLocaleString()}</td>
                            <td style={td}>{a.stock}</td>
                            <td style={td}>{a.units_sold || 0}</td>
                            <td style={{ ...td, color:'#4a8c5c' }}>₹ {Number(a.revenue || 0).toLocaleString()}</td>
                            <td style={td}>
                              <span style={{ fontSize:'.5rem', letterSpacing:'.12em', textTransform:'uppercase', padding:'.22rem .6rem', border:'.5px solid',
                                color:       a.is_active ? '#4a8c5c' : 'var(--muted)',
                                borderColor: a.is_active ? 'rgba(74,140,92,.4)' : 'var(--border)' }}>
                                {a.is_active ? 'Active' : 'Hidden'}
                              </span>
                            </td>
                            <td style={td}>
                              <button onClick={() => setModal(a)} style={outBtn('var(--gold3)')}>Edit</button>
                              {a.is_active && <button onClick={() => deleteArtwork(a)} style={outBtn('#c05050')}>Remove</button>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ══ MY SALES ══ */}
          {tab === 'sales' && (
            <>
              <div style={{ marginBottom:'1.5rem', paddingBottom:'1.5rem', borderBottom:'.5px solid var(--border)' }}>
                <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.8rem', fontWeight:300, color:'var(--cream)' }}>
                  My <em style={{ fontStyle:'italic', color:'var(--gold)' }}>Sales</em>
                </h1>
                <div style={{ fontSize:'.62rem', color:'var(--muted)', letterSpacing:'.1em', marginTop:'.5rem' }}>
                  Read-only — order status is managed by the gallery admin
                </div>
              </div>

              {loading ? (
                <div style={{ color:'var(--muted)', fontSize:'.65rem', letterSpacing:'.14em', padding:'3rem 0' }}>Loading sales…</div>
              ) : (
                <div style={{ background:'var(--surface2)', border:'.5px solid var(--border)', overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr>{['Order #','Artwork','Collector','Qty','Earned','Date','Status'].map(h=><th key={h} style={th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {sales.length === 0 && (
                        <tr><td colSpan={7} style={{ ...td, textAlign:'center', color:'var(--muted)', padding:'3rem' }}>
                          No sales yet. Add artworks to start selling.
                        </td></tr>
                      )}
                      {sales.map((s, i) => (
                        <tr key={i} style={{ transition:'background .2s' }}
                          onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <td style={{ ...td, fontFamily:"'Cormorant Garamond',serif", color:'var(--cream)' }}>#{s.order_number}</td>
                          <td style={td}>{s.artwork_title}</td>
                          <td style={td}>{s.collector_name}</td>
                          <td style={td}>{s.quantity}</td>
                          <td style={{ ...td, fontFamily:"'Cormorant Garamond',serif", color:'#4a8c5c' }}>₹ {Number(s.earned).toLocaleString()}</td>
                          <td style={td}>{new Date(s.placed_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</td>
                          <td style={td}>
                            <span style={{ fontSize:'.5rem', letterSpacing:'.14em', textTransform:'uppercase', padding:'.22rem .6rem', border:'.5px solid',
                              color:       STATUS_COLOR[s.status] || 'var(--muted)',
                              borderColor: `${STATUS_COLOR[s.status] || 'var(--muted)'}55` }}>
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

        </main>
      </div>
    </>
  );
}
