import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ProductsAPI, CartAPI, WishlistAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../hooks/useToast';
import ProductCard from '../components/common/ProductCard';

/* ── Marquee items ─────────────────────────────────────────── */
const ITEMS = ['Paintings','Sketches','Sculptures','Watercolours','Charcoal Works','Mixed Media','Printmaking','Photography'];

/* ── Fallback products (shown when backend is offline) ───────── */
const FALLBACK = [
  {id:1,title:'Molten Hour',   medium:'Oil Painting', price:52000, tag:'Featured'},
  {id:2,title:'Cerulean Deep', medium:'Acrylic',      price:28500, tag:''},
  {id:3,title:'Emerald Hush',  medium:'Watercolour',  price:14000, tag:'New'},
  {id:4,title:'Crimson Quiet', medium:'Oil on Board', price:19000, tag:''},
  {id:5,title:'Violet Reverie',medium:'Mixed Media',  price:22000, tag:''},
];

/* ── Mini product card used only on Home ─────────────────────── */
function HomeCard({ product }) {
  const { user }          = useAuth();
  const { refreshCounts } = useCart();
  const { showToast }     = useToast();
  const navigate          = useNavigate();
  const bg       = getBgClass(product.id);
  const imgStyle = getProductImageStyle(product);
  const hasImage = !!product.image_url;

  const addCart = async (e) => {
    e.stopPropagation();
    if (user) {
      try { await CartAPI.add(product.id, 1); showToast('Added to cart', 'success'); refreshCounts(); }
      catch (err) { showToast(err.message, 'error'); }
    } else {
      const c = JSON.parse(localStorage.getItem('ss_cart') || '[]');
      if (!c.find(i => i.id === product.id))
        c.push({ id: product.id, name: product.title, price: product.price, qty: 1 });
      localStorage.setItem('ss_cart', JSON.stringify(c));
      showToast('Added to cart'); refreshCounts();
    }
  };

  const addWish = async (e) => {
    e.stopPropagation();
    if (!user) { showToast('Sign in to save works'); navigate('/login'); return; }
    try { await WishlistAPI.add(product.id); showToast('Added to wishlist', 'success'); refreshCounts(); }
    catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <div
      onClick={() => navigate(`/product/${product.id}`)}
      style={{ background:'var(--surface2)', position:'relative', overflow:'hidden', cursor:'none' }}
    >
      {product.tag && (
        <div style={{ position:'absolute', top:'1rem', left:'1rem', zIndex:3, fontSize:'.5rem', letterSpacing:'.22em', textTransform:'uppercase', color:'var(--gold)', border:'.5px solid var(--border2)', padding:'.25rem .65rem', background:'rgba(8,7,6,.55)', backdropFilter:'blur(6px)' }}>
          {product.tag}
        </div>
      )}
      <div style={{ position:'relative', overflow:'hidden', height:'280px' }}>
        <div
          className={hasImage ? '' : bg}
          style={{
            width:'100%', height:'100%',
            transition:'transform .8s cubic-bezier(.25,.46,.45,.94)',
            ...(hasImage ? {
              backgroundImage: `url(${product.image_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            } : {})
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.07)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        />
        {/* Hover overlay */}
        <div className="home-card-overlay">
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.1rem', color:'var(--cream)', marginBottom:'.25rem', transform:'translateY(10px)', transition:'transform .4s .05s' }} className="ov-title">{product.title}</div>
          <div style={{ fontSize:'.55rem', letterSpacing:'.2em', textTransform:'uppercase', color:'var(--gold)', marginBottom:'1rem', transform:'translateY(10px)', transition:'transform .4s .1s' }} className="ov-type">{product.medium}</div>
          <div style={{ display:'flex', gap:'.6rem', transform:'translateY(14px)', transition:'transform .4s .15s' }} className="ov-actions">
            <button
              onClick={e => { e.stopPropagation(); navigate(`/product/${product.id}`); }}
              style={{ fontSize:'.58rem', letterSpacing:'.2em', textTransform:'uppercase', color:'var(--ink)', background:'var(--gold)', padding:'.6rem 1.2rem', border:'none', cursor:'none', fontFamily:"'Josefin Sans',sans-serif", fontWeight:400, transition:'background .25s' }}
              onMouseEnter={e => e.currentTarget.style.background='var(--gold2)'}
              onMouseLeave={e => e.currentTarget.style.background='var(--gold)'}
            >View Work</button>
            <button
              onClick={addCart}
              style={{ fontSize:'.58rem', letterSpacing:'.2em', textTransform:'uppercase', color:'var(--ink)', background:'var(--gold)', padding:'.6rem 1.2rem', border:'none', cursor:'none', fontFamily:"'Josefin Sans',sans-serif", fontWeight:400, transition:'background .25s' }}
              onMouseEnter={e => e.currentTarget.style.background='var(--gold2)'}
              onMouseLeave={e => e.currentTarget.style.background='var(--gold)'}
            >Add to Cart</button>
            <button
              onClick={addWish}
              style={{ width:'36px', height:'36px', border:'.5px solid var(--border2)', background:'rgba(8,7,6,.5)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'none', transition:'all .2s', flexShrink:0 }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(201,168,76,.15)'; e.currentTarget.style.borderColor='var(--gold)'; }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(8,7,6,.5)'; e.currentTarget.style.borderColor='var(--border2)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" stroke="var(--gold)" fill="none" strokeWidth="1.4">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div style={{ padding:'1.3rem 1.5rem', borderTop:'.5px solid var(--border)', background:'var(--surface2)' }}>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.05rem', fontWeight:400, color:'var(--cream)', marginBottom:'.3rem' }}>{product.title}</div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:'.56rem', letterSpacing:'.18em', textTransform:'uppercase', color:'var(--muted)' }}>{product.medium}</span>
          <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1rem', color:'var(--gold)' }}>₹ {Number(product.price).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Hero art card ───────────────────────────────────────────── */
function HeroArtCard({ artwork, bg, isActive, onClick, small }) {
  return (
    <div
      onClick={onClick}
      style={{ position:'relative', overflow:'hidden', cursor:'none', ...(small ? {} : { gridColumn:'1/3' }) }}
    >
      <div
        className={bg}
        style={{ position:'absolute', inset:0, transition:'transform .9s cubic-bezier(.25,.46,.45,.94)', transform: isActive ? 'scale(1.06)' : 'scale(1)' }}
      />
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(8,7,6,.72) 0%,transparent 45%)', zIndex:1 }} />
      <div style={{ position:'absolute', top:'1.3rem', right:'1.3rem', zIndex:3, fontFamily:"'Cormorant Garamond',serif", fontSize:'.9rem', color:'var(--cream)', letterSpacing:'.06em' }}>{artwork.price}</div>
      <div style={{ position:'absolute', bottom:'1.4rem', left:'1.4rem', zIndex:3 }}>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.1rem', color:'var(--cream)', marginBottom:'.1rem' }}>{artwork.title}</div>
        <div style={{ fontSize:'.55rem', letterSpacing:'.2em', textTransform:'uppercase', color:'var(--gold)', opacity:.9 }}>{artwork.sub}</div>
      </div>
    </div>
  );
}

/* ── Main Home component ─────────────────────────────────────── */
export default function Home() {
  const [featured,  setFeatured]  = useState([]);
  const [activeBg,  setActiveBg]  = useState(0);
  const [siteStats, setSiteStats] = useState({
    products: '...', artists: '...', orders: '...',
  });

  /* Load real stats from public API */
  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || '/api';
    fetch(`${apiBase}/products/stats/public`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setSiteStats({
            products: d.stats.total_products || 0,
            artists:  d.stats.total_artists  || 0,
          });
        }
      })
      .catch(() => {}); // keep default '...' if API fails
  }, []);

  const heroArtworks = [
    { title:'Amber Dusk',    sub:'Oil on Canvas · 2024', price:'₹ 38,000' },
    { title:'Midnight Drift',sub:'Acrylic · 2023',        price:'₹ 24,500' },
    { title:'Verdant Still', sub:'Watercolour · 2024',    price:'₹ 17,000' },
  ];
  const heroBgs = ['bg1','bg6','bg3'];

  /* Auto-rotate hero artwork every 4s */
  useEffect(() => {
    const t = setInterval(() => setActiveBg(a => (a + 1) % 3), 4000);
    return () => clearInterval(t);
  }, []);

  /* Load real products — fallback only if API fails */
  useEffect(() => {
    ProductsAPI.getAll({ featured: true, limit: 5 })
      .then(d => {
        if (d.products?.length) setFeatured(d.products);
        else setFeatured(FALLBACK); // only use fallback if no featured products
      })
      .catch(() => setFeatured(FALLBACK));
  }, []);

  const testimonials = [
    { initials:'RK', name:'Rohan Kapoor',  role:'Art Collector · Mumbai', text:"Acquiring Amber Dusk was one of the most effortless and elegant experiences I've had. The platform feels like a private gallery — intimate, curated, and deeply respectful of the art." },
    { initials:'PM', name:'Priya Mehta',   role:'Artist · Delhi',          text:"As an artist, Shades & Strokes gave my work the gravitas it deserved. The provenance tracking and collector communication is unlike anything I've experienced elsewhere." },
    { initials:'AS', name:'Aditi Shah',    role:'Interior Architect · Pune',text:"The curation here is extraordinary. Every work speaks to a rare sensibility — as if the platform itself understands what it means to live with beautiful things." },
  ];

  const features = [
    { num:'01', title:'Verified Authentication', desc:'Every work carries certified provenance. Secure, role-based accounts for artists, collectors, and curators — trust woven into the foundation.' },
    { num:'02', title:'Wishlist & Collection',   desc:'Curate your own private gallery of desired works. Revisit, compare, and acquire on your own unhurried timeline.' },
    { num:'03', title:'White-Glove Tracking',    desc:'From studio to your wall — real-time order updates with complete provenance documentation for every acquired piece.' },
    { num:'04', title:'Scalable Infrastructure', desc:'Docker-containerised, React & Node.js powered. Built with the modularity of a world-class institution — ready to grow.' },
  ];

  /* ── Grid layout for 5 products ──────────────────────────────
     Product 0 → spans 2 rows on the left (large)
     Products 1-4 → 2×2 on the right
  ─────────────────────────────────────────────────────────────── */
  const gridStyle = {
    display:'grid',
    gridTemplateColumns:'2.2fr 1fr 1fr',
    gridTemplateRows:'auto auto',
    gap:'1px',
    background:'var(--border)',
  };

  return (
    <>
      {/* ── HERO ──────────────────────────────────────────────── */}
      <section style={{ minHeight:'100vh', display:'grid', gridTemplateColumns:'1fr 1fr', paddingTop:'88px', position:'relative', overflow:'hidden', zIndex:1 }}>
        {/* ambient glow */}
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 80% 30%,rgba(201,168,76,.06) 0%,transparent 55%)', pointerEvents:'none', zIndex:0 }} />

        {/* Left copy */}
        <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', padding:'6rem 3.5rem 6rem 5rem', position:'relative', zIndex:2 }}>
          {/* eyebrow */}
          <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'2.2rem' }}>
            <div style={{ height:'.5px', width:'50px', background:'linear-gradient(90deg,transparent,var(--gold))' }} />
            <span style={{ fontSize:'.58rem', letterSpacing:'.42em', textTransform:'uppercase', color:'var(--gold)', fontWeight:200 }}>Est. 2024 · Fine Art Marketplace</span>
            <div style={{ width:'5px', height:'5px', background:'var(--gold)', transform:'rotate(45deg)' }} />
          </div>

          {/* Title */}
          <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontWeight:300, lineHeight:.98, color:'var(--cream)', fontSize:'clamp(3.8rem,6vw,6.5rem)', marginBottom:'2rem' }}>
            <div style={{ overflow:'hidden' }}><span style={{ display:'block', animation:'slideUp 1s cubic-bezier(.16,1,.3,1) .1s both' }}>Where Art</span></div>
            <div style={{ overflow:'hidden' }}><span style={{ display:'block', animation:'slideUp 1s cubic-bezier(.16,1,.3,1) .25s both', fontStyle:'italic', color:'var(--gold)', fontFamily:"'IM Fell English',serif" }}>Finds Its</span></div>
            <div style={{ overflow:'hidden' }}><span style={{ display:'block', animation:'slideUp 1s cubic-bezier(.16,1,.3,1) .4s both' }}>Collector</span></div>
          </h1>

          <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(.95rem,1.5vw,1.25rem)', fontStyle:'italic', fontWeight:300, color:'var(--muted)', marginBottom:'3rem', lineHeight:1.75, maxWidth:'380px', animation:'fadeUp 1.2s .6s ease both' }}>
            A curated sanctuary for original paintings, sketches, and sculptures — where every acquisition tells a story.
          </p>

          <div style={{ display:'flex', alignItems:'center', gap:'2.5rem', animation:'fadeUp 1.2s .8s ease both' }}>
            <Link to="/shop" className="btn-primary">Explore Gallery</Link>
            <Link to="/shop" className="btn-ghost">View Collections</Link>
          </div>
        </div>

        {/* Right — artwork grid */}
        <div style={{ position:'relative', display:'grid', gridTemplateColumns:'1fr 1fr', gridTemplateRows:'62% 38%', gap:'1px', background:'var(--border)', zIndex:2 }}>
          {heroArtworks.map((art, i) => (
            <HeroArtCard
              key={i}
              artwork={art}
              bg={heroBgs[i]}
              isActive={activeBg === i}
              onClick={() => setActiveBg(i)}
              small={i > 0}
            />
          ))}

          {/* Stats bar */}
          <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:4, display:'flex', borderTop:'.5px solid var(--border)', background:'rgba(8,7,6,.75)', backdropFilter:'blur(12px)' }}>
            {[['1,240+','Artworks'],[320,'Artists'],[18,'Mediums'],['4.9★','Rating']].map(([n,l],i) => (
              <div key={i} style={{ flex:1, padding:'1.1rem 1rem', borderRight:i<3?'.5px solid var(--border)':'none', textAlign:'center' }}>
                <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.6rem', fontWeight:300, color:'var(--gold)', display:'block', lineHeight:1 }}>{n}</span>
                <span style={{ fontSize:'.54rem', letterSpacing:'.2em', textTransform:'uppercase', color:'var(--muted)', marginTop:'.3rem', display:'block' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Gold bottom line */}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'1px', background:'linear-gradient(90deg,transparent,var(--gold3),var(--gold),var(--gold3),transparent)', zIndex:3 }} />
      </section>

      {/* ── MARQUEE ───────────────────────────────────────────── */}
      <div style={{ position:'relative', overflow:'hidden', borderTop:'.5px solid var(--border)', borderBottom:'.5px solid var(--border)', background:'var(--surface2)', zIndex:1 }}>
        <div style={{ display:'flex', whiteSpace:'nowrap', padding:'.8rem 0' }}>
          <div style={{ display:'inline-flex', animation:'marquee 24s linear infinite', flexShrink:0 }}>
            {[...ITEMS,...ITEMS].map((item,i) => (
              <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:'1.8rem', padding:'0 2rem', fontSize:'.6rem', letterSpacing:'.28em', textTransform:'uppercase', color:'var(--muted2)' }}>
                {item}
                <span style={{ width:'3px', height:'3px', background:'var(--gold3)', borderRadius:'50%', opacity:.5 }} />
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── FEATURED WORKS ────────────────────────────────────── */}
      <section style={{ padding:'5rem 5rem 7rem', position:'relative', zIndex:1 }}>
        {/* Ornament */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'1.4rem', marginBottom:'4rem' }}>
          <div style={{ flex:1, height:'.5px', background:'linear-gradient(90deg,transparent,var(--border2))' }} />
          <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.6rem', color:'var(--gold3)', fontStyle:'italic', opacity:.6 }}>✦</span>
          <div style={{ flex:1, height:'.5px', background:'linear-gradient(-90deg,transparent,var(--border2))' }} />
        </div>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:'3.5rem', paddingBottom:'2rem', borderBottom:'.5px solid var(--border)' }}>
          <div>
            <div style={{ fontSize:'.58rem', letterSpacing:'.38em', textTransform:'uppercase', color:'var(--gold3)', marginBottom:'.8rem', display:'flex', alignItems:'center', gap:'.9rem' }}>
              <span style={{ width:'20px', height:'.5px', background:'var(--gold3)', display:'inline-block' }} />Curated Selection
            </div>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(2.2rem,3.8vw,3.4rem)', fontWeight:300, color:'var(--cream)', lineHeight:1.05 }}>
              Featured <em style={{ fontStyle:'italic', color:'var(--gold)' }}>Works</em>
            </h2>
          </div>
          <Link to="/shop" style={{ fontSize:'.6rem', letterSpacing:'.24em', textTransform:'uppercase', color:'var(--muted)', background:'none', border:'.5px solid var(--border2)', padding:'.75rem 1.6rem', textDecoration:'none', transition:'all .3s', fontFamily:"'Josefin Sans',sans-serif" }}
            onMouseEnter={e => { e.currentTarget.style.color='var(--gold)'; e.currentTarget.style.borderColor='var(--border3)'; }}
            onMouseLeave={e => { e.currentTarget.style.color='var(--muted)'; e.currentTarget.style.borderColor='var(--border2)'; }}>
            Browse All Works
          </Link>
        </div>

        {/* Products grid */}
        <div style={gridStyle}>
          {featured.map((p, i) => (
            <div key={p.id} style={{ gridRow: i === 0 ? '1/3' : 'auto' }}>
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────── */}
      <section style={{ padding:'5rem 5rem 7rem', background:'var(--surface2)', position:'relative', zIndex:1 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'1.4rem', marginBottom:'4rem' }}>
          <div style={{ flex:1, height:'.5px', background:'linear-gradient(90deg,transparent,var(--border2))' }} />
          <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.6rem', color:'var(--gold3)', fontStyle:'italic', opacity:.6 }}>✦</span>
          <div style={{ flex:1, height:'.5px', background:'linear-gradient(-90deg,transparent,var(--border2))' }} />
        </div>
        <div style={{ marginBottom:'3.5rem' }}>
          <div style={{ fontSize:'.58rem', letterSpacing:'.38em', textTransform:'uppercase', color:'var(--gold3)', marginBottom:'.8rem', display:'flex', alignItems:'center', gap:'.9rem' }}>
            <span style={{ width:'20px', height:'.5px', background:'var(--gold3)', display:'inline-block' }} />Collector Stories
          </div>
          <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(2.2rem,3.8vw,3.4rem)', fontWeight:300, color:'var(--cream)' }}>
            Voices of <em style={{ fontStyle:'italic', color:'var(--gold)' }}>Connoisseurs</em>
          </h2>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1px', background:'var(--border)' }}>
          {testimonials.map((t,i) => (
            <div key={i} style={{ background:'var(--surface2)', padding:'2.8rem 2.2rem', borderRight:i<2?'.5px solid var(--border)':'none', position:'relative', transition:'background .3s' }}
              onMouseEnter={e => e.currentTarget.style.background='var(--surface3)'}
              onMouseLeave={e => e.currentTarget.style.background='var(--surface2)'}>
              <div style={{ position:'absolute', top:'2.2rem', right:'2rem', fontSize:'.6rem', color:'var(--gold)', letterSpacing:'.1em' }}>★ ★ ★ ★ ★</div>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'3.5rem', color:'var(--gold3)', lineHeight:.5, marginBottom:'1.2rem', fontStyle:'italic', opacity:.6 }}>"</div>
              <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1rem', fontStyle:'italic', fontWeight:300, color:'var(--cream2)', lineHeight:1.8, marginBottom:'2rem' }}>{t.text}</p>
              <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
                <div style={{ width:'36px', height:'36px', border:'.5px solid var(--border2)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Cormorant Garamond',serif", fontSize:'.85rem', color:'var(--gold)', flexShrink:0 }}>{t.initials}</div>
                <div>
                  <span style={{ fontSize:'.65rem', letterSpacing:'.18em', textTransform:'uppercase', color:'var(--cream)', display:'block' }}>{t.name}</span>
                  <span style={{ fontSize:'.54rem', letterSpacing:'.14em', textTransform:'uppercase', color:'var(--muted)' }}>{t.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────── */}
      <section style={{ padding:'5rem 5rem 7rem', background:'var(--surface)', position:'relative', zIndex:1 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'1.4rem', marginBottom:'4rem' }}>
          <div style={{ flex:1, height:'.5px', background:'linear-gradient(90deg,transparent,var(--border2))' }} />
          <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.6rem', color:'var(--gold3)', fontStyle:'italic', opacity:.6 }}>✦</span>
          <div style={{ flex:1, height:'.5px', background:'linear-gradient(-90deg,transparent,var(--border2))' }} />
        </div>
        <div style={{ marginBottom:'3.5rem' }}>
          <div style={{ fontSize:'.58rem', letterSpacing:'.38em', textTransform:'uppercase', color:'var(--gold3)', marginBottom:'.8rem', display:'flex', alignItems:'center', gap:'.9rem' }}>
            <span style={{ width:'20px', height:'.5px', background:'var(--gold3)', display:'inline-block' }} />The Platform
          </div>
          <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(2.2rem,3.8vw,3.4rem)', fontWeight:300, color:'var(--cream)' }}>
            Crafted for <em style={{ fontStyle:'italic', color:'var(--gold)' }}>Discerning</em> Collectors
          </h2>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1px', background:'var(--border)' }}>
          {features.map((f,i) => (
            <div key={i} style={{ background:'var(--surface)', padding:'3rem 2.2rem', borderRight:i<3?'.5px solid var(--border)':'none', position:'relative', overflow:'hidden', transition:'background .4s' }}
              onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background='var(--surface)'}>
              <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'2rem' }}>
                <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'2.8rem', fontWeight:300, color:'var(--border2)', lineHeight:1 }}>{f.num}</span>
              </div>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.15rem', color:'var(--cream)', marginBottom:'1rem', lineHeight:1.3 }}>{f.title}</div>
              <p style={{ fontSize:'.7rem', lineHeight:1.9, color:'var(--muted)', letterSpacing:'.03em' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── QUOTE STRIP ───────────────────────────────────────── */}
      <section style={{ padding:'8rem 5rem', background:'var(--surface2)', display:'grid', gridTemplateColumns:'1fr 1.3fr', gap:'6rem', alignItems:'center', position:'relative', zIndex:1 }}>
        <div>
          <span style={{ fontFamily:"'IM Fell English',serif", fontSize:'8rem', color:'var(--border2)', lineHeight:.6, marginBottom:'1.5rem', display:'block' }}>"</span>
          <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(1.5rem,2.4vw,2.1rem)', fontWeight:300, fontStyle:'italic', color:'var(--cream)', lineHeight:1.5, marginBottom:'2rem' }}>Art is not what you see, but what you make others see.</p>
          <div style={{ display:'flex', alignItems:'center', gap:'1.2rem' }}>
            <div style={{ width:'30px', height:'.5px', background:'var(--gold3)' }} />
            <cite style={{ fontSize:'.62rem', letterSpacing:'.22em', textTransform:'uppercase', color:'var(--muted)', fontStyle:'normal' }}>Edgar Degas</cite>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1px', background:'var(--border)' }}>
          {[
            [siteStats.products, 'Original Works'],
            [siteStats.artists,  'Artists'],
            ['4.9★',             'Average Rating'],
            ['48hr',             'Avg. Dispatch'],
          ].map(([n,l],i) => (
            <div key={i} style={{ background:'var(--surface3)', padding:'2.5rem 2rem', borderBottom:i<2?'.5px solid var(--border)':'none' }}>
              <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'3.2rem', fontWeight:300, color:'var(--gold)', lineHeight:1, marginBottom:'.4rem', display:'block' }}>{n}</span>
              <span style={{ fontSize:'.58rem', letterSpacing:'.2em', textTransform:'uppercase', color:'var(--muted)' }}>{l}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── NEWSLETTER ────────────────────────────────────────── */}
      <section style={{ padding:'6rem 5rem', background:'var(--surface)', textAlign:'center', borderTop:'.5px solid var(--border)', borderBottom:'.5px solid var(--border)', position:'relative', zIndex:1 }}>
        <div style={{ fontSize:'.58rem', letterSpacing:'.38em', textTransform:'uppercase', color:'var(--gold3)', marginBottom:'1.2rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'.9rem' }}>
          <span style={{ width:'20px', height:'.5px', background:'var(--gold3)', display:'inline-block' }} />Private Access
        </div>
        <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(1.8rem,3vw,2.8rem)', fontWeight:300, color:'var(--cream)', marginBottom:'.8rem' }}>
          Join the <em style={{ fontStyle:'italic', color:'var(--gold)' }}>Inner Circle</em>
        </h2>
        <p style={{ fontSize:'.68rem', letterSpacing:'.12em', color:'var(--muted)', marginBottom:'2.5rem' }}>New acquisitions, artist profiles, and exclusive previews — delivered with discretion.</p>
        <div style={{ display:'flex', maxWidth:'440px', margin:'0 auto', border:'.5px solid var(--border2)' }}>
          <input type="email" placeholder="Your email address"
            style={{ flex:1, background:'rgba(201,168,76,.03)', border:'none', outline:'none', padding:'1rem 1.4rem', fontFamily:"'Josefin Sans',sans-serif", fontSize:'.68rem', fontWeight:300, letterSpacing:'.1em', color:'var(--cream)', caretColor:'var(--gold)' }} />
          <button style={{ background:'var(--gold)', color:'var(--ink)', border:'none', padding:'1rem 1.8rem', cursor:'none', fontFamily:"'Josefin Sans',sans-serif", fontSize:'.62rem', fontWeight:400, letterSpacing:'.22em', textTransform:'uppercase', transition:'background .3s', flexShrink:0 }}
            onMouseEnter={e => e.currentTarget.style.background='var(--gold2)'}
            onMouseLeave={e => e.currentTarget.style.background='var(--gold)'}>
            Subscribe
          </button>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer style={{ background:'var(--surface2)', padding:'4rem 5rem 2.5rem', position:'relative', zIndex:1 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr 1fr 1fr', gap:'4rem', paddingBottom:'3rem', borderBottom:'.5px solid var(--border)', marginBottom:'2.5rem' }}>
          <div>
            <Link to="/" style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.3rem', fontWeight:500, letterSpacing:'.12em', color:'var(--gold)', marginBottom:'1rem', display:'block', textDecoration:'none' }}>
              Shades <span style={{ fontStyle:'italic', fontWeight:300, color:'var(--cream2)' }}>&amp; Strokes 2.0</span>
            </Link>
            <p style={{ fontSize:'.65rem', fontStyle:'italic', fontFamily:"'Cormorant Garamond',serif", color:'var(--muted)', lineHeight:1.7 }}>A curated sanctuary where art and collector find each other across the silence of great beauty.</p>
          </div>
          {[
            ['Gallery', [
              { label:'Paintings',    to:'/shop?category=paintings'    },
              { label:'Sculptures',   to:'/shop?category=sculptures'   },
              { label:'Sketches',     to:'/shop?category=sketches'     },
              { label:'Watercolours', to:'/shop?category=watercolours' },
              { label:'Mixed Media',  to:'/shop?category=mixed-media'  },
            ]],
            ['Account', [
              { label:'Sign In',      to:'/login'    },
              { label:'My Profile',   to:'/profile'  },
              { label:'My Orders',    to:'/orders'   },
              { label:'My Wishlist',  to:'/wishlist' },
              { label:'My Cart',      to:'/cart'     },
            ]],
            ['Support', [
              { label:'Browse Gallery',     to:'/shop'    },
              { label:'About Us',           to:'/#about'  },
              { label:'Contact Us',         to:'/login'   },
              { label:'Shipping & Returns', to:'/#support'},
            ]],
          ].map(([title, links]) => (
            <div key={title}>
              <div style={{ fontSize:'.58rem', letterSpacing:'.3em', textTransform:'uppercase', color:'var(--gold3)', marginBottom:'1.4rem', paddingBottom:'.8rem', borderBottom:'.5px solid var(--border)' }}>{title}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'.7rem' }}>
                {links.map(l => (
                  <Link key={l.label} to={l.to} style={{ fontSize:'.65rem', letterSpacing:'.1em', color:'var(--muted)', textDecoration:'none', transition:'color .3s' }}
                    onMouseEnter={e => e.target.style.color='var(--gold)'}
                    onMouseLeave={e => e.target.style.color='var(--muted)'}>{l.label}</Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:'.56rem', letterSpacing:'.12em', color:'var(--muted2)' }}>© 2025 Shades &amp; Strokes. All rights reserved.</div>
          <div style={{ display:'flex', gap:'2rem' }}>
            {['Privacy Policy','Terms of Service','Cookie Policy'].map(l => (
              <a key={l} href="#" style={{ fontSize:'.56rem', letterSpacing:'.12em', color:'var(--muted2)', textDecoration:'none' }}>{l}</a>
            ))}
          </div>
        </div>
      </footer>

      {/* ── Inline keyframes ──────────────────────────────────── */}
      <style>{`
        @keyframes marquee   { from { transform:translateX(0) } to { transform:translateX(-50%) } }
        @keyframes slideUp   { from { transform:translateY(110%);opacity:0 } to { transform:translateY(0);opacity:1 } }
        @keyframes fadeUp    { from { opacity:0;transform:translateY(20px) } to { opacity:1;transform:translateY(0) } }
        @keyframes artPan    { from { transform:scale(1.04) translate(0,0) } to { transform:scale(1.08) translate(-1%,1.5%) } }

        .home-card-overlay {
          position:absolute; inset:0; z-index:3;
          display:flex; flex-direction:column; justify-content:flex-end; padding:1.5rem;
          background:linear-gradient(to top,rgba(8,7,6,.9) 0%,rgba(8,7,6,.2) 50%,transparent 100%);
          opacity:0; transition:opacity .45s;
        }
        .home-card-overlay:hover,
        .home-card-overlay:focus-within { opacity:1; }

        /* Show overlay on card hover — parent hover trick */
        div:hover > div > .home-card-overlay { opacity:1; }
        div:hover > div > .home-card-overlay .ov-title  { transform:translateY(0) !important; }
        div:hover > div > .home-card-overlay .ov-type   { transform:translateY(0) !important; }
        div:hover > div > .home-card-overlay .ov-actions{ transform:translateY(0) !important; }
      `}</style>
    </>
  );
}
