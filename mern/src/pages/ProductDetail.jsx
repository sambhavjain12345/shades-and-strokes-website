// ── ProductDetail ─────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProductsAPI, CartAPI, WishlistAPI, getBgClass, getProductImageStyle } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../hooks/useToast';

export function ProductDetail() {
  const { id }            = useParams();
  const { user }          = useAuth();
  const { refreshCounts } = useCart();
  const { showToast }     = useToast();
  const navigate          = useNavigate();
  const [product, setProduct] = useState(null);
  const [qty,     setQty]     = useState(1);
  const [wished,  setWished]  = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const bg = getBgClass(Number(id));
  const bgs = [getBgClass(Number(id)), 'bg2', 'bg3', 'bg4'];
  const hasImage = !!product?.image_url;

  useEffect(() => {
    ProductsAPI.getOne(id).then(d => { setProduct(d.product); })
      .catch(() => setProduct({ id:Number(id), title:'Molten Hour', artist_name:'Arjun Sharma', price:52000, medium:'Oil on Canvas', dimensions:'90 × 120 cm', year:2024, edition:'1 of 1 (Original)', artist_bio:'Works in the tradition of expressive oil painting.', artist_location:'Mumbai, India' }));
    if (user) WishlistAPI.check(id).then(d => setWished(d.inWishlist)).catch(()=>{});
  }, [id, user]);

  const handleCart = async () => {
    if (user) {
      try { await CartAPI.add(Number(id), qty); showToast('Added to cart', 'success'); refreshCounts(); }
      catch (e) { showToast(e.message, 'error'); }
    } else {
      const c = JSON.parse(localStorage.getItem('ss_cart')||'[]');
      const ex = c.find(i=>i.id===Number(id));
      if (ex) ex.qty += qty; else c.push({ id:Number(id), name:product.title, price:product.price, qty });
      localStorage.setItem('ss_cart', JSON.stringify(c));
      showToast('Added to cart'); refreshCounts();
    }
  };

  const handleWish = async () => {
    if (!user) { showToast('Sign in to save works'); navigate('/login'); return; }
    try {
      if (wished) { await WishlistAPI.remove(id); setWished(false); }
      else { await WishlistAPI.add(Number(id)); setWished(true); }
      refreshCounts();
    } catch (e) { showToast(e.message, 'error'); }
  };

  if (!product) return <div style={{ padding:'12rem 5rem', color:'var(--muted)', fontSize:'.7rem', letterSpacing:'.2em', textTransform:'uppercase' }}>Loading…</div>;

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', padding:'7rem 5rem 6rem', gap:0, minHeight:'80vh', alignItems:'start', position:'relative', zIndex:1 }}>
      {/* Gallery */}
      <div style={{ position:'sticky', top:'100px' }}>
        <div style={{ height:'520px', position:'relative', overflow:'hidden', border:'.5px solid var(--border)', marginBottom:'1px', cursor:'zoom-in' }}>
          <div
            className={hasImage ? '' : `prod-img-bg ${bgs[activeImg]}`}
            style={{
              width:'100%', height:'100%', transition:'transform 12s ease-in-out',
              ...(hasImage ? { backgroundImage:`url(${product.image_url})`, backgroundSize:'cover', backgroundPosition:'center' } : {})
            }}
            onMouseEnter={e=>e.currentTarget.style.transform='scale(1.08)'}
            onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'} />
          <div style={{ position:'absolute', bottom:'1rem', right:'1rem', fontSize:'.5rem', letterSpacing:'.2em', textTransform:'uppercase', color:'var(--gold)', border:'.5px solid var(--border2)', padding:'.25rem .65rem', background:'rgba(8,7,6,.55)', backdropFilter:'blur(6px)' }}>Hover to Explore</div>
        </div>
        <div style={{ display:'flex', gap:'1px', background:'var(--border)' }}>
          {bgs.map((bgc,i) => (
            <div key={i} onClick={() => setActiveImg(i)} style={{ flex:1, height:'80px', cursor:'none', border:`.5px solid ${activeImg===i?'var(--gold)':'transparent'}`, overflow:'hidden', transition:'border-color .3s' }}>
              <div
                className={hasImage ? '' : `prod-img-bg ${bgc}`}
                style={{ width:'100%', height:'100%', ...(hasImage && i===0 ? { backgroundImage:`url(${product.image_url})`, backgroundSize:'cover', backgroundPosition:'center' } : {}) }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Details */}
      <div style={{ padding:'1rem 0 1rem 4rem' }}>
        <div className="section-label">Original Work · Authenticated</div>
        <h1 style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'clamp(2.2rem,3.5vw,3.2rem)', fontWeight:300, color:'var(--cream)', lineHeight:1.05, marginBottom:'.5rem' }}>
          {product.title.split(' ').map((w,i)=>i===1?<em key={i} style={{fontStyle:'italic',color:'var(--gold)',fontFamily:"'IM Fell English',serif"}}>{w} </em>:<span key={i}>{w} </span>)}
        </h1>
        <div style={{ fontSize:'.62rem', letterSpacing:'.18em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'2rem' }}>by {product.artist_name}</div>
        <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'2.2rem', fontWeight:300, color: product.stock === 0 ? 'var(--muted)' : 'var(--gold)', marginBottom:'.5rem' }}>
          {product.stock === 0 ? <span style={{ textDecoration:'line-through', opacity:.6 }}>₹ {Number(product.price).toLocaleString()}</span> : `₹ ${Number(product.price).toLocaleString()}`}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'.6rem', fontSize:'.56rem', letterSpacing:'.2em', textTransform:'uppercase', color: product.stock === 0 ? '#c05050' : 'var(--muted)', marginBottom:'2.5rem' }}>
          <span style={{ width:'6px', height:'6px', background: product.stock === 0 ? '#c05050' : '#4a8c5c', borderRadius:'50%' }} />
          {product.stock === 0 ? 'Sold Out · Not available' : `Available · ${product.stock} in stock · Ships in 48 hours`}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0, background:'var(--border)', marginBottom:'2.5rem' }}>
          {[['Medium', product.medium],['Dimensions', product.dimensions||'—'],['Year', product.year||'—'],['Edition', product.edition||'1 of 1']].map(([k,v],i)=>(
            <div key={k} style={{ background:'var(--surface2)', padding:'1rem 1.2rem', borderRight: i%2===0?'.5px solid var(--border)':'none', borderBottom: i<2?'.5px solid var(--border)':'none' }}>
              <div style={{ fontSize:'.52rem', letterSpacing:'.22em', textTransform:'uppercase', color:'var(--muted)', marginBottom:'.3rem' }}>{k}</div>
              <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'.95rem', color:'var(--cream)' }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'1.2rem', marginBottom:'1.5rem' }}>
          <span style={{ fontSize:'.56rem', letterSpacing:'.24em', textTransform:'uppercase', color:'var(--muted)' }}>Quantity</span>
          <div style={{ display:'flex', alignItems:'center', border:'.5px solid var(--border2)' }}>
            <button onClick={() => setQty(q=>Math.max(1,q-1))} style={{ width:'34px', height:'34px', background:'none', border:'none', cursor:'none', color:'var(--muted)', fontSize:'1rem', transition:'color .3s' }}>−</button>
            <span style={{ width:'40px', textAlign:'center', fontFamily:'Cormorant Garamond,serif', fontSize:'1rem', color:'var(--cream)', borderLeft:'.5px solid var(--border)', borderRight:'.5px solid var(--border)', padding:'.4rem 0', display:'inline-block' }}>{qty}</span>
            <button onClick={() => setQty(q=>q+1)} style={{ width:'34px', height:'34px', background:'none', border:'none', cursor:'none', color:'var(--muted)', fontSize:'1rem', transition:'color .3s' }}>+</button>
          </div>
        </div>

        <div style={{ display:'flex', gap:'.8rem', marginBottom:'2rem' }}>
          {product.stock === 0 ? (
            <button className="btn-primary" style={{ flex:1, opacity:.5, cursor:'not-allowed', background:'var(--muted2)' }} disabled>
              Sold Out
            </button>
          ) : (
            <button className="btn-primary" style={{ flex:1 }} onClick={handleCart}>Add to Cart</button>
          )}
          <button
            onClick={handleWish}
            title={wished ? 'Remove from wishlist' : 'Add to wishlist'}
            style={{ width:'50px', height:'50px', border:`.5px solid ${wished?'var(--gold)':'var(--border2)'}`, background: wished?'rgba(201,168,76,.12)':'none', cursor:'none', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .3s', flexShrink:0 }}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(201,168,76,.15)';e.currentTarget.style.borderColor='var(--gold)';}}
            onMouseLeave={e=>{e.currentTarget.style.background=wished?'rgba(201,168,76,.12)':'none';e.currentTarget.style.borderColor=wished?'var(--gold)':'var(--border2)';}}>
            <svg width="16" height="16" viewBox="0 0 24 24" stroke="var(--gold)" fill={wished?'var(--gold)':'none'} strokeWidth="1.4">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          </button>
        </div>
        {wished && (
          <div style={{ fontSize:'.56rem', letterSpacing:'.16em', textTransform:'uppercase', color:'var(--gold3)', marginBottom:'1.5rem', display:'flex', alignItems:'center', gap:'.6rem' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" stroke="var(--gold3)" fill="var(--gold3)" strokeWidth="1"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
            Saved to your wishlist · <button onClick={handleWish} style={{ background:'none', border:'none', cursor:'none', color:'var(--muted)', fontSize:'.56rem', letterSpacing:'.16em', textTransform:'uppercase', textDecoration:'underline', padding:0 }}>Remove</button>
          </div>
        )}

        <div style={{ borderTop:'.5px solid var(--border)', paddingTop:'2rem', marginTop:'2rem' }}>
          <div style={{ fontSize:'.54rem', letterSpacing:'.3em', textTransform:'uppercase', color:'var(--gold3)', marginBottom:'1.2rem' }}>About the Artist</div>
          <div style={{ display:'flex', alignItems:'center', gap:'1.2rem', marginBottom:'1.2rem' }}>
            <div style={{ width:'48px', height:'48px', border:'.5px solid var(--border2)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Cormorant Garamond,serif', fontSize:'1rem', color:'var(--gold)', flexShrink:0 }}>
              {(product.artist_name||'').split(' ').map(w=>w[0]).join('').slice(0,2)}
            </div>
            <div>
              <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'1.05rem', color:'var(--cream)' }}>{product.artist_name}</div>
              <div style={{ fontSize:'.54rem', letterSpacing:'.16em', textTransform:'uppercase', color:'var(--muted)' }}>Artist · {product.artist_location||'India'}</div>
            </div>
          </div>
          <p style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'.9rem', fontStyle:'italic', color:'var(--muted)', lineHeight:1.8 }}>{product.artist_bio}</p>
        </div>
      </div>
    </div>
  );
}
