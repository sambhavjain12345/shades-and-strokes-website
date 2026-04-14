import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getBgClass } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import Cursor from '../components/common/Cursor';

// ── API helper using token ────────────────────────────────────
const adminFetch = (url, opts = {}) => {
  const token = localStorage.getItem('ss_token');
  return fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...opts.headers,
    },
  }).then(r => r.json());
};

// ── Shared styles ─────────────────────────────────────────────
const inp = {
  width: '100%',
  background: 'rgba(201,168,76,.04)',
  border: '.5px solid var(--border2)',
  outline: 'none',
  padding: '.7rem 1rem',
  fontFamily: "'Josefin Sans',sans-serif",
  fontSize: '.72rem',
  fontWeight: 300,
  letterSpacing: '.08em',
  color: 'var(--cream)',
  caretColor: 'var(--gold)',
  transition: 'border-color .3s',
  boxSizing: 'border-box',
};
const lbl = {
  fontSize: '.54rem',
  letterSpacing: '.26em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  display: 'block',
  marginBottom: '.5rem',
};
const th = {
  fontSize: '.52rem', letterSpacing: '.22em', textTransform: 'uppercase',
  color: 'var(--muted)', padding: '.85rem 1.2rem', textAlign: 'left',
  borderBottom: '.5px solid var(--border)', fontWeight: 300, whiteSpace: 'nowrap',
};
const td = {
  padding: '.8rem 1.2rem', borderBottom: '.5px solid var(--border)',
  fontSize: '.7rem', color: 'var(--cream2)', verticalAlign: 'middle',
};
const goldBtn = {
  background: 'var(--gold)', color: 'var(--ink)', border: 'none',
  padding: '.6rem 1.3rem', cursor: 'none',
  fontFamily: "'Josefin Sans',sans-serif",
  fontSize: '.58rem', letterSpacing: '.18em', textTransform: 'uppercase',
  transition: 'background .3s',
};
const outlineBtn = (color = 'var(--muted)') => ({
  background: 'none', border: `.5px solid ${color}55`,
  color, padding: '.28rem .65rem', cursor: 'none',
  fontFamily: "'Josefin Sans',sans-serif",
  fontSize: '.5rem', letterSpacing: '.14em', textTransform: 'uppercase',
  transition: 'all .25s', marginRight: '.4rem',
});

const STATUS_OPTS  = ['pending','confirmed','packaging','shipped','delivered','cancelled'];
const STATUS_COLOR = { confirmed:'#4a8c5c', packaging:'var(--gold3)', shipped:'var(--gold3)', delivered:'var(--muted)', cancelled:'#c05050', pending:'var(--muted2)' };

// ── Confirm Dialog ────────────────────────────────────────────
function Confirm({ msg, onOk, onCancel }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:9100, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'var(--surface2)', border:'.5px solid var(--border2)', padding:'2.5rem', maxWidth:'420px', width:'90%' }}>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.2rem', color:'var(--cream)', marginBottom:'1rem' }}>Confirm</div>
        <p style={{ fontSize:'.7rem', color:'var(--muted)', lineHeight:1.7, marginBottom:'2rem' }}>{msg}</p>
        <div style={{ display:'flex', gap:'.8rem', justifyContent:'flex-end' }}>
          <button onClick={onCancel} style={{ ...outlineBtn('var(--muted)'), padding:'.6rem 1.4rem', fontSize:'.6rem' }}>Cancel</button>
          <button onClick={onOk} style={{ background:'#c05050', color:'#fff', border:'none', padding:'.6rem 1.4rem', cursor:'none', fontFamily:"'Josefin Sans',sans-serif", fontSize:'.6rem', letterSpacing:'.18em', textTransform:'uppercase' }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ── Product Modal ─────────────────────────────────────────────
function ProductModal({ product, artists, categories, onSave, onClose }) {
  const [form, setForm] = useState({
    title:       product?.title       || '',
    price:       product?.price       || '',
    stock:       product?.stock       || 1,
    medium:      product?.medium      || '',
    dimensions:  product?.dimensions  || '',
    year:        product?.year        || new Date().getFullYear(),
    tag:         product?.tag         || '',
    description: product?.description || '',
    artist_id:   product?.artist_id   || (artists[0]?.id || ''),
    category_id: product?.category_id || (categories[0]?.id || ''),
    is_featured: !!product?.is_featured,
    image_url:   product?.image_url   || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:9100, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem', overflowY:'auto' }}>
      <div style={{ background:'var(--surface2)', border:'.5px solid var(--border2)', padding:'2.5rem', width:'100%', maxWidth:'580px' }}>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.4rem', color:'var(--cream)', marginBottom:'2rem' }}>
          {product ? 'Edit Artwork' : 'Add New Artwork'}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.2rem 1.6rem' }}>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={lbl}>
              Image URL
              <span style={{ color:'var(--muted2)', fontSize:'.48rem', marginLeft:'.5rem' }}>(optional — paste any image link)</span>
            </label>
            <input style={inp} value={form.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://images.unsplash.com/photo-..."
              onFocus={e=>e.target.style.borderColor='var(--gold)'} onBlur={e=>e.target.style.borderColor='var(--border2)'} />
            {form.image_url ? (
              <div style={{ marginTop:'.6rem', position:'relative' }}>
                <div style={{ width:'100%', height:'120px', backgroundImage:`url(${form.image_url})`, backgroundSize:'cover', backgroundPosition:'center', border:'.5px solid var(--border2)' }} />
                <button type="button" onClick={() => set('image_url', 'CLEAR')}
                  style={{ position:'absolute', top:'.4rem', right:'.4rem', background:'rgba(192,80,80,.8)', color:'#fff', border:'none', padding:'.3rem .7rem', cursor:'none', fontSize:'.5rem', letterSpacing:'.12em', textTransform:'uppercase' }}>
                  ✕ Clear
                </button>
              </div>
            ) : product?.image_url ? (
              <div style={{ fontSize:'.56rem', color:'var(--gold3)', letterSpacing:'.1em', marginTop:'.4rem' }}>
                ⚠ Existing image will be kept — paste new URL to replace it
              </div>
            ) : null}
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={lbl}>Title *</label>
            <input style={inp} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Artwork title"
              onFocus={e=>e.target.style.borderColor='var(--gold)'} onBlur={e=>e.target.style.borderColor='var(--border2)'} />
          </div>
          <div>
            <label style={lbl}>Artist *</label>
            <select value={form.artist_id} onChange={e => set('artist_id', e.target.value)} style={{ ...inp, appearance:'none' }}>
              <option value="">— Select artist —</option>
              {artists.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Category *</label>
            <select value={form.category_id} onChange={e => set('category_id', e.target.value)} style={{ ...inp, appearance:'none' }}>
              <option value="">— Select category —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Price (₹) *</label>
            <input style={inp} type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0"
              onFocus={e=>e.target.style.borderColor='var(--gold)'} onBlur={e=>e.target.style.borderColor='var(--border2)'} />
          </div>
          <div>
            <label style={lbl}>
              Quantity Available
              <span style={{ color:'var(--muted2)', fontSize:'.46rem', marginLeft:'.4rem', textTransform:'none', letterSpacing:0 }}>
                (0 = sold out)
              </span>
            </label>
            <input style={inp} type="number" min="0" value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="1"
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
            <label style={lbl}>Tag</label>
            <input style={inp} value={form.tag} onChange={e => set('tag', e.target.value)} placeholder="Featured / New"
              onFocus={e=>e.target.style.borderColor='var(--gold)'} onBlur={e=>e.target.style.borderColor='var(--border2)'} />
          </div>
          <div style={{ gridColumn:'1/-1', display:'flex', alignItems:'center', gap:'.8rem' }}>
            <input type="checkbox" id="feat" checked={form.is_featured} onChange={e => set('is_featured', e.target.checked)}
              style={{ width:'14px', height:'14px', accentColor:'var(--gold)', cursor:'none' }} />
            <label htmlFor="feat" style={{ ...lbl, margin:0, cursor:'none' }}>Mark as Featured</label>
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={lbl}>Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
              placeholder="Artwork description…" style={{ ...inp, resize:'vertical', lineHeight:1.6 }}
              onFocus={e=>e.target.style.borderColor='var(--gold)'} onBlur={e=>e.target.style.borderColor='var(--border2)'} />
          </div>
        </div>
        <div style={{ display:'flex', gap:'.8rem', justifyContent:'flex-end', marginTop:'2rem', paddingTop:'1.5rem', borderTop:'.5px solid var(--border)' }}>
          <button onClick={onClose} style={{ ...outlineBtn('var(--muted)'), padding:'.7rem 1.6rem', fontSize:'.6rem' }}>Cancel</button>
          <button onClick={() => onSave(form)} style={{ ...goldBtn, padding:'.7rem 1.8rem', fontSize:'.62rem' }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--gold2)'}
            onMouseLeave={e=>e.currentTarget.style.background='var(--gold)'}>
            {product ? 'Save Changes' : 'Add Artwork'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Artist Modal ──────────────────────────────────────────────
function ArtistModal({ artist, users, onSave, onClose }) {
  const [form, setForm] = useState({
    name:     artist?.name     || '',
    bio:      artist?.bio      || '',
    location: artist?.location || '',
    website:  artist?.website  || '',
    user_id:  artist?.user_id  || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:9100, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ background:'var(--surface2)', border:'.5px solid var(--border2)', padding:'2.5rem', width:'100%', maxWidth:'500px' }}>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.4rem', color:'var(--cream)', marginBottom:'2rem' }}>
          {artist ? 'Edit Artist' : 'Add New Artist'}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'1.2rem' }}>
          {[['Name *','name','Artist full name'],['Location','location','Mumbai, India'],['Website','website','https://artist.com']].map(([label,key,ph])=>(
            <div key={key}>
              <label style={lbl}>{label}</label>
              <input style={inp} value={form[key]} onChange={e=>set(key,e.target.value)} placeholder={ph}
                onFocus={e=>e.target.style.borderColor='var(--gold)'} onBlur={e=>e.target.style.borderColor='var(--border2)'} />
            </div>
          ))}

          {/* Link to user account */}
          <div>
            <label style={lbl}>
              Link to User Account
              <span style={{ color:'var(--muted2)', fontSize:'.46rem', marginLeft:'.5rem', textTransform:'none', letterSpacing:0 }}>
                — gives them Artist Studio access
              </span>
            </label>
            <select value={form.user_id} onChange={e=>set('user_id',e.target.value)} style={{ ...inp, appearance:'none' }}>
              <option value="">— No linked account —</option>
              {(users||[]).map(u => (
                <option key={u.id} value={u.id} style={{ background:'var(--surface2)' }}>
                  {u.name} ({u.email}) — {u.role}
                </option>
              ))}
            </select>
            {form.user_id && (
              <div style={{ fontSize:'.56rem', color:'#4a8c5c', letterSpacing:'.1em', marginTop:'.4rem' }}>
                ✓ This user will become role=artist and can access the Artist Studio portal
              </div>
            )}
          </div>

          <div>
            <label style={lbl}>Bio</label>
            <textarea value={form.bio} onChange={e=>set('bio',e.target.value)} rows={4} placeholder="Artist biography…"
              style={{ ...inp, resize:'vertical', lineHeight:1.6 }}
              onFocus={e=>e.target.style.borderColor='var(--gold)'} onBlur={e=>e.target.style.borderColor='var(--border2)'} />
          </div>
        </div>
        <div style={{ display:'flex', gap:'.8rem', justifyContent:'flex-end', marginTop:'2rem', paddingTop:'1.5rem', borderTop:'.5px solid var(--border)' }}>
          <button onClick={onClose} style={{ ...outlineBtn('var(--muted)'), padding:'.7rem 1.6rem', fontSize:'.6rem' }}>Cancel</button>
          <button onClick={() => onSave(form)} style={{ ...goldBtn, padding:'.7rem 1.8rem', fontSize:'.62rem' }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--gold2)'}
            onMouseLeave={e=>e.currentTarget.style.background='var(--gold)'}>
            {artist ? 'Save Changes' : 'Add Artist'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Admin ────────────────────────────────────────────────
export default function Admin() {
  const { user }      = useAuth();
  const { showToast } = useToast();
  const navigate      = useNavigate();

  const [tab,        setTab]        = useState('dashboard');
  const [stats,      setStats]      = useState(null);
  const [orders,     setOrders]     = useState([]);
  const [monthly,    setMonthly]    = useState([]);
  const [products,   setProducts]   = useState([]);
  const [artists,    setArtists]    = useState([]);
  const [categories, setCategories] = useState([]);
  const [allUsers,   setAllUsers]   = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [prodSearch, setProdSearch] = useState('');
  const [artSearch,  setArtSearch]  = useState('');

  const [productModal, setProductModal] = useState(null);
  const [artistModal,  setArtistModal]  = useState(null);
  const [confirm,      setConfirm]      = useState(null);

  // Redirect non-admins
  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/');
  }, [user]);

  // Load dashboard data on mount
  useEffect(() => {
    loadDashboard();
    loadCategories();
    loadArtists();
  }, []);

  // Load tab data when tab changes
  useEffect(() => {
    if (tab === 'products') loadProducts();
    if (tab === 'artists')  loadArtists();
    if (tab === 'orders')   loadAllOrders();
  }, [tab]);

  const loadDashboard = async () => {
    try {
      const d = await adminFetch('/api/admin/stats');
      if (d.success) { setStats(d.stats); setMonthly(d.monthly_revenue || []); }
      const o = await adminFetch('/api/admin/orders?limit=8');
      if (o.success) setOrders(o.orders || []);
    } catch (e) { console.error('Dashboard load failed:', e); }
  };

  const loadAllOrders = async () => {
    try {
      const o = await adminFetch('/api/admin/orders?limit=50');
      if (o.success) setOrders(o.orders || []);
    } catch {}
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const d = await adminFetch(`/api/admin/products?search=${encodeURIComponent(prodSearch)}&limit=50`);
      if (d.success) setProducts(d.products || []);
      else setProducts([]);
    } catch (e) { console.error('Products load failed:', e); setProducts([]); }
    finally { setLoading(false); }
  };

  const loadArtists = async () => {
    setLoading(true);
    try {
      const d = await adminFetch(`/api/admin/artists?search=${encodeURIComponent(artSearch)}`);
      if (d.success) setArtists(d.artists || []);
      else setArtists([]);
    } catch (e) { console.error('Artists load failed:', e); setArtists([]); }
    finally { setLoading(false); }
  };

  const loadCategories = async () => {
    try {
      const d = await adminFetch('/api/admin/categories');
      if (d.success) setCategories(d.categories || []);
      // Also load all users for artist linking dropdown
      const u = await adminFetch('/api/admin/users/all');
      if (u.success) setAllUsers(u.users || []);
    } catch {}
  };

  // ── Product CRUD ──────────────────────────────────────────
  const saveProduct = async (form) => {
    if (!form.title || !form.artist_id || !form.category_id || !form.price) {
      showToast('Title, artist, category and price are required', 'error'); return;
    }
    const isEdit = productModal && typeof productModal === 'object';
    try {
      const d = await adminFetch(
        isEdit ? `/api/admin/products/${productModal.id}` : '/api/admin/products',
        { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(form) }
      );
      if (!d.success) throw new Error(d.message);
      showToast(isEdit ? 'Artwork updated ✓' : 'Artwork added ✓', 'success');
      setProductModal(null); loadProducts(); loadDashboard();
    } catch (e) { showToast(e.message, 'error'); }
  };

  const deleteProduct = (p) => setConfirm({
    msg: `Remove "${p.title}" from the gallery?`,
    onOk: async () => {
      try {
        const d = await adminFetch(`/api/admin/products/${p.id}`, { method:'DELETE' });
        if (!d.success) throw new Error(d.message);
        showToast('Artwork removed', 'success'); loadProducts(); loadDashboard();
      } catch (e) { showToast(e.message, 'error'); }
      setConfirm(null);
    }
  });

  const restoreProduct = async (p) => {
    try {
      await adminFetch(`/api/admin/products/${p.id}/restore`, { method:'PUT' });
      showToast('Artwork restored', 'success'); loadProducts();
    } catch { showToast('Failed', 'error'); }
  };

  // ── Artist CRUD ───────────────────────────────────────────
  const saveArtist = async (form) => {
    if (!form.name) { showToast('Artist name is required', 'error'); return; }
    const isEdit = artistModal && typeof artistModal === 'object';
    try {
      const d = await adminFetch(
        isEdit ? `/api/admin/artists/${artistModal.id}` : '/api/admin/artists',
        { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(form) }
      );
      if (!d.success) throw new Error(d.message);
      showToast(isEdit ? 'Artist updated ✓' : 'Artist added ✓', 'success');
      setArtistModal(null); loadArtists();
    } catch (e) { showToast(e.message, 'error'); }
  };

  const deleteArtist = (a) => setConfirm({
    msg: `Delete artist "${a.name}"? This will fail if they have active artworks.`,
    onOk: async () => {
      try {
        const d = await adminFetch(`/api/admin/artists/${a.id}`, { method:'DELETE' });
        if (!d.success) throw new Error(d.message);
        showToast('Artist deleted', 'success'); loadArtists();
      } catch (e) { showToast(e.message, 'error'); }
      setConfirm(null);
    }
  });

  // ── Order status update ───────────────────────────────────
  const updateStatus = async (orderId, status) => {
    try {
      const d = await adminFetch(`/api/orders/${orderId}/status`, { method:'PUT', body: JSON.stringify({ status, description: `Status updated to ${status}` }) });
      if (!d.success) throw new Error(d.message);
      showToast('Status updated ✓', 'success');
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    } catch (e) { showToast(e.message, 'error'); }
  };

  const maxRev = Math.max(...monthly.map(m => Number(m.revenue) || 0), 1);
  const sideItems = [
    { key:'dashboard', label:'Dashboard'  },
    { key:'products',  label:'Artworks'   },
    { key:'artists',   label:'Artists'    },
    { key:'orders',    label:'Orders'     },
  ];

  return (
    <>
      <Cursor />

      {/* Modals */}
      {confirm && <Confirm msg={confirm.msg} onOk={confirm.onOk} onCancel={() => setConfirm(null)} />}
      {productModal !== null && (
        <ProductModal
          product={typeof productModal === 'object' ? productModal : null}
          artists={artists}
          categories={categories}
          onSave={saveProduct}
          onClose={() => setProductModal(null)}
        />
      )}
      {artistModal !== null && (
        <ArtistModal
          artist={typeof artistModal === 'object' ? artistModal : null}
          users={allUsers}
          onSave={saveArtist}
          onClose={() => setArtistModal(null)}
        />
      )}

      <div style={{ display:'flex', minHeight:'100vh', position:'relative', zIndex:1, background:'var(--surface)' }}>

        {/* ── Sidebar ── */}
        <aside style={{ width:'210px', flexShrink:0, background:'var(--surface2)', borderRight:'.5px solid var(--border)', display:'flex', flexDirection:'column', position:'sticky', top:0, height:'100vh', zIndex:10 }}>
          <div style={{ padding:'1.6rem 1.4rem', borderBottom:'.5px solid var(--border)' }}>
            <Link to="/" style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.1rem', fontWeight:500, letterSpacing:'.15em', color:'var(--gold)', textDecoration:'none', display:'block', marginBottom:'.4rem' }}>
              Shades <span style={{ fontStyle:'italic', fontWeight:300, color:'var(--cream2)' }}>&amp; Strokes</span>
            </Link>
            <span style={{ fontSize:'.48rem', letterSpacing:'.22em', textTransform:'uppercase', color:'var(--gold3)', border:'.5px solid var(--border)', padding:'.18rem .55rem', display:'inline-block' }}>Admin Panel</span>
          </div>

          <nav style={{ flex:1, padding:'.8rem 0' }}>
            {sideItems.map(item => (
              <button key={item.key} onClick={() => setTab(item.key)}
                style={{ display:'block', width:'100%', textAlign:'left', padding:'.8rem 1.4rem', fontSize:'.6rem', letterSpacing:'.2em', textTransform:'uppercase', border:'none', cursor:'none', fontFamily:"'Josefin Sans',sans-serif", transition:'all .25s', position:'relative',
                  color:      tab === item.key ? 'var(--gold)'          : 'var(--muted)',
                  background: tab === item.key ? 'rgba(201,168,76,.07)' : 'none',
                }}>
                {tab === item.key && <span style={{ position:'absolute', left:0, top:0, bottom:0, width:'2px', background:'var(--gold)' }} />}
                {item.label}
              </button>
            ))}
            <div style={{ height:'.5px', background:'#1a1712', margin:'.8rem 0' }} />
            <Link to="/" style={{ display:'block', padding:'.8rem 1.4rem', fontSize:'.58rem', letterSpacing:'.18em', textTransform:'uppercase', color:'var(--muted)', textDecoration:'none' }}
              onMouseEnter={e=>e.currentTarget.style.color='var(--gold)'} onMouseLeave={e=>e.currentTarget.style.color='var(--muted)'}>
              ← Back to Site
            </Link>
          </nav>

          <div style={{ padding:'1.2rem 1.4rem', borderTop:'.5px solid var(--border)', display:'flex', alignItems:'center', gap:'.8rem' }}>
            <div style={{ width:'30px', height:'30px', border:'.5px solid var(--border2)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Cormorant Garamond',serif", fontSize:'.75rem', color:'var(--gold)', flexShrink:0 }}>
              {user?.name?.[0] || 'A'}
            </div>
            <div style={{ minWidth:0 }}>
              <span style={{ fontSize:'.58rem', letterSpacing:'.08em', color:'var(--cream)', display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.name}</span>
              <span style={{ fontSize:'.48rem', letterSpacing:'.12em', textTransform:'uppercase', color:'var(--muted)' }}>Admin</span>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <main style={{ flex:1, padding:'2.5rem', overflowY:'auto', minWidth:0, background:'var(--surface)' }}>

          {/* ══ DASHBOARD ══ */}
          {tab === 'dashboard' && (
            <>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'2rem', paddingBottom:'1.5rem', borderBottom:'.5px solid var(--border)' }}>
                <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.8rem', fontWeight:300, color:'var(--cream)' }}>
                  Dashboard <em style={{ fontStyle:'italic', color:'var(--gold)' }}>Overview</em>
                </h1>
                <div style={{ display:'flex', gap:'.6rem' }}>
                  <button onClick={() => { setTab('products'); setTimeout(() => setProductModal('add'), 200); }}
                    style={goldBtn} onMouseEnter={e=>e.currentTarget.style.background='var(--gold2)'} onMouseLeave={e=>e.currentTarget.style.background='var(--gold)'}>
                    + Add Artwork
                  </button>
                  <button onClick={() => { setTab('artists'); setTimeout(() => setArtistModal('add'), 200); }}
                    style={{ ...outlineBtn('var(--gold3)'), padding:'.6rem 1.3rem', fontSize:'.58rem' }}>
                    + Add Artist
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1px', background:'#1a1712', marginBottom:'2rem' }}>
                {[
                  ['Total Revenue', stats ? `₹ ${(stats.total_revenue/100000).toFixed(1)}L` : '—'],
                  ['Active Orders', stats?.active_orders ?? '—'],
                  ['Artworks',      stats?.total_products ?? '—'],
                  ['Collectors',    stats?.total_users ?? '—'],
                ].map(([label, val]) => (
                  <div key={label} style={{ background:'var(--surface2)', padding:'1.5rem 1.4rem', transition:'background .3s' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
                    onMouseLeave={e=>e.currentTarget.style.background='var(--surface2)'}>
                    <div style={{ fontSize:'.52rem', letterSpacing:'.24em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'.6rem' }}>{label}</div>
                    <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.8rem', fontWeight:300, color:'var(--cream)' }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Revenue chart */}
              <div style={{ background:'var(--surface2)', border:'.5px solid var(--border)', padding:'1.5rem', marginBottom:'2rem' }}>
                <div style={{ fontSize:'.58rem', letterSpacing:'.22em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'1rem' }}>Monthly Revenue</div>
                {monthly.length === 0 ? (
                  <div style={{ height:'90px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.65rem', letterSpacing:'.14em', color:'var(--muted2)' }}>
                    No revenue data yet — chart will appear once orders are placed
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'flex-end', gap:'.4rem', height:'90px' }}>
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

              {/* Orders table */}
              <div style={{ background:'var(--surface2)', border:'.5px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.2rem 1.4rem', borderBottom:'.5px solid var(--border)' }}>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.1rem', color:'var(--cream)' }}>Recent Orders</div>
                  <button onClick={() => setTab('orders')} style={{ fontSize:'.54rem', letterSpacing:'.16em', textTransform:'uppercase', color:'var(--muted)', background:'none', border:'none', cursor:'none', transition:'color .3s' }}
                    onMouseEnter={e=>e.target.style.color='var(--gold)'} onMouseLeave={e=>e.target.style.color='var(--muted)'}>View All →</button>
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead><tr>{['Order #','Collector','Amount','Status','Update Status'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {orders.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign:'center', color:'var(--muted)', padding:'2rem' }}>No orders yet</td></tr>}
                      {orders.map(o => (
                        <tr key={o.id} style={{ transition:'background .2s' }}
                          onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <td style={td}><span style={{ fontFamily:"'Cormorant Garamond',serif", color:'var(--cream)' }}>#{o.order_number}</span></td>
                          <td style={td}>{o.collector_name}</td>
                          <td style={{ ...td, fontFamily:"'Cormorant Garamond',serif", color:'var(--gold)' }}>₹ {Number(o.total_amount).toLocaleString()}</td>
                          <td style={td}>
                            <span style={{ fontSize:'.5rem', letterSpacing:'.14em', textTransform:'uppercase', padding:'.22rem .6rem', border:'.5px solid', color:STATUS_COLOR[o.status]||'var(--muted)', borderColor:`${STATUS_COLOR[o.status]||'var(--muted)'}55` }}>{o.status}</span>
                          </td>
                          <td style={td}>
                            <select value={o.status} onChange={e => updateStatus(o.id, e.target.value)}
                              style={{ background:'var(--surface3)', border:'.5px solid var(--border2)', color:'var(--cream)', fontSize:'.58rem', padding:'.3rem .5rem', cursor:'none', fontFamily:"'Josefin Sans',sans-serif", outline:'none' }}>
                              {STATUS_OPTS.map(s => <option key={s} value={s} style={{ background:'var(--surface2)' }}>{s}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ══ ARTWORKS ══ */}
          {tab === 'products' && (
            <>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.5rem', paddingBottom:'1.5rem', borderBottom:'.5px solid var(--border)' }}>
                <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.8rem', fontWeight:300, color:'var(--cream)' }}>
                  Artworks <em style={{ fontStyle:'italic', color:'var(--gold)' }}>Management</em>
                </h1>
                <button onClick={() => setProductModal('add')} style={goldBtn}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--gold2)'} onMouseLeave={e=>e.currentTarget.style.background='var(--gold)'}>
                  + Add Artwork
                </button>
              </div>

              <div style={{ display:'flex', marginBottom:'1.5rem', border:'.5px solid var(--border2)', maxWidth:'380px' }}>
                <input value={prodSearch} onChange={e => setProdSearch(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && loadProducts()}
                  placeholder="Search artworks…" style={{ ...inp, border:'none', flex:1 }} />
                <button onClick={loadProducts} style={{ ...goldBtn, padding:'.65rem 1rem' }}>Search</button>
              </div>

              {loading ? (
                <div style={{ color:'var(--muted)', fontSize:'.65rem', letterSpacing:'.14em', padding:'3rem 0' }}>Loading artworks…</div>
              ) : (
                <div style={{ background:'var(--surface2)', border:'.5px solid var(--border)', overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead><tr>{['Artwork','Artist','Category','Price','Stock','Status','Actions'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {products.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign:'center', color:'var(--muted)', padding:'3rem' }}>No artworks found</td></tr>}
                      {products.map(p => (
                        <tr key={p.id} style={{ transition:'background .2s', opacity: p.is_active ? 1 : 0.55 }}
                          onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <td style={td}>
                            <div style={{ display:'flex', alignItems:'center', gap:'.8rem' }}>
                              <div className={getBgClass(p.id)} style={{ width:'34px', height:'34px', flexShrink:0 }} />
                              <div>
                                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'.9rem', color:'var(--cream)' }}>{p.title}</div>
                                {p.tag && <span style={{ fontSize:'.48rem', letterSpacing:'.12em', textTransform:'uppercase', color:'var(--gold3)' }}>{p.tag}</span>}
                              </div>
                            </div>
                          </td>
                          <td style={td}>{p.artist_name}</td>
                          <td style={td}>{p.category_name}</td>
                          <td style={{ ...td, fontFamily:"'Cormorant Garamond',serif", color:'var(--gold)' }}>₹ {Number(p.price).toLocaleString()}</td>
                          <td style={td}>{p.stock}</td>
                          <td style={td}>
                            <span style={{ fontSize:'.5rem', letterSpacing:'.12em', textTransform:'uppercase', padding:'.22rem .6rem', border:'.5px solid',
                              color:       p.is_active ? '#4a8c5c' : 'var(--muted)',
                              borderColor: p.is_active ? 'rgba(74,140,92,.4)' : 'var(--border)' }}>
                              {p.is_active ? 'Active' : 'Hidden'}
                            </span>
                          </td>
                          <td style={td}>
                            <button onClick={() => setProductModal(p)} style={outlineBtn('var(--gold3)')}>Edit</button>
                            {p.is_active
                              ? <button onClick={() => deleteProduct(p)}  style={outlineBtn('#c05050')}>Remove</button>
                              : <button onClick={() => restoreProduct(p)} style={outlineBtn('#4a8c5c')}>Restore</button>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ══ ARTISTS ══ */}
          {tab === 'artists' && (
            <>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.5rem', paddingBottom:'1.5rem', borderBottom:'.5px solid var(--border)' }}>
                <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.8rem', fontWeight:300, color:'var(--cream)' }}>
                  Artists <em style={{ fontStyle:'italic', color:'var(--gold)' }}>Management</em>
                </h1>
                <button onClick={() => setArtistModal('add')} style={goldBtn}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--gold2)'} onMouseLeave={e=>e.currentTarget.style.background='var(--gold)'}>
                  + Add Artist
                </button>
              </div>

              <div style={{ display:'flex', marginBottom:'1.5rem', border:'.5px solid var(--border2)', maxWidth:'380px' }}>
                <input value={artSearch} onChange={e => setArtSearch(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && loadArtists()}
                  placeholder="Search artists…" style={{ ...inp, border:'none', flex:1 }} />
                <button onClick={loadArtists} style={{ ...goldBtn, padding:'.65rem 1rem' }}>Search</button>
              </div>

              {loading ? (
                <div style={{ color:'var(--muted)', fontSize:'.65rem', letterSpacing:'.14em', padding:'3rem 0' }}>Loading artists…</div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'1px', background:'#1a1712' }}>
                  {artists.length === 0 && <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'4rem', background:'var(--surface2)', color:'var(--muted)', fontSize:'.65rem', letterSpacing:'.14em' }}>No artists found</div>}
                  {artists.map(a => (
                    <div key={a.id} style={{ background:'var(--surface2)', padding:'1.5rem', transition:'background .3s' }}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
                      onMouseLeave={e=>e.currentTarget.style.background='var(--surface2)'}>
                      <div style={{ display:'flex', alignItems:'center', gap:'1px', background:'#1a1712', marginBottom:'.8rem' }}>
                        <div style={{ width:'42px', height:'42px', border:'.5px solid var(--border2)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Cormorant Garamond',serif", fontSize:'.95rem', color:'var(--gold)', flexShrink:0 }}>
                          {a.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1rem', color:'var(--cream)', marginBottom:'.1rem' }}>{a.name}</div>
                          <div style={{ fontSize:'.54rem', letterSpacing:'.12em', textTransform:'uppercase', color:'var(--muted)' }}>{a.location || 'India'}</div>
                        </div>
                      </div>
                      {a.bio && <p style={{ fontSize:'.65rem', color:'var(--muted)', lineHeight:1.65, marginBottom:'1rem', letterSpacing:'.04em' }}>{a.bio.slice(0,100)}{a.bio.length>100?'…':''}</p>}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:'.8rem', borderTop:'.5px solid var(--border)' }}>
                        <span style={{ fontSize:'.54rem', letterSpacing:'.12em', textTransform:'uppercase', color:'var(--gold3)' }}>{a.product_count||0} artwork{a.product_count!==1?'s':''}</span>
                        <div>
                          <button onClick={() => setArtistModal(a)} style={outlineBtn('var(--gold3)')}>Edit</button>
                          <button onClick={() => deleteArtist(a)}   style={outlineBtn('#c05050')}>Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ══ ORDERS ══ */}
          {tab === 'orders' && (
            <>
              <div style={{ marginBottom:'1.5rem', paddingBottom:'1.5rem', borderBottom:'.5px solid var(--border)' }}>
                <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.8rem', fontWeight:300, color:'var(--cream)' }}>
                  All <em style={{ fontStyle:'italic', color:'var(--gold)' }}>Orders</em>
                </h1>
              </div>
              <div style={{ background:'var(--surface2)', border:'.5px solid var(--border)', overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr>{['Order #','Collector','Email','Amount','Date','Status','Update'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {orders.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign:'center', color:'var(--muted)', padding:'3rem' }}>No orders yet</td></tr>}
                    {orders.map(o => (
                      <tr key={o.id} style={{ transition:'background .2s' }}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{ ...td, fontFamily:"'Cormorant Garamond',serif", color:'var(--cream)' }}>#{o.order_number}</td>
                        <td style={td}>{o.collector_name}</td>
                        <td style={{ ...td, color:'var(--muted)' }}>{o.collector_email}</td>
                        <td style={{ ...td, fontFamily:"'Cormorant Garamond',serif", color:'var(--gold)' }}>₹ {Number(o.total_amount).toLocaleString()}</td>
                        <td style={td}>{new Date(o.placed_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</td>
                        <td style={td}>
                          <span style={{ fontSize:'.5rem', letterSpacing:'.14em', textTransform:'uppercase', padding:'.22rem .6rem', border:'.5px solid', color:STATUS_COLOR[o.status]||'var(--muted)', borderColor:`${STATUS_COLOR[o.status]||'var(--muted)'}55` }}>{o.status}</span>
                        </td>
                        <td style={td}>
                          <select value={o.status} onChange={e => updateStatus(o.id, e.target.value)}
                            style={{ background:'var(--surface3)', border:'.5px solid var(--border2)', color:'var(--cream)', fontSize:'.58rem', padding:'.3rem .5rem', cursor:'none', fontFamily:"'Josefin Sans',sans-serif", outline:'none' }}>
                            {STATUS_OPTS.map(s => <option key={s} value={s} style={{ background:'var(--surface2)' }}>{s}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

        </main>
      </div>
    </>
  );
}
