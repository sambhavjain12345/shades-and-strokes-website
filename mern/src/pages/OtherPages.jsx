// ─────────────────────────────────────────────────────────────
//  Cart Page
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CartAPI, WishlistAPI, OrdersAPI, AuthAPI, getBgClass } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../hooks/useToast';

export function Cart() {
  const { user }          = useAuth();
  const { refreshCounts } = useCart();
  const { showToast }     = useToast();
  const navigate          = useNavigate();
  const [items, setItems] = useState([]);
  const [subtotal, setSub] = useState(0);

  const load = async () => {
    if (user) {
      try { const d = await CartAPI.get(); setItems(d.items); setSub(d.subtotal); }
      catch { loadLocal(); }
    } else loadLocal();
  };
  const loadLocal = () => {
    const c = JSON.parse(localStorage.getItem('ss_cart')||'[]');
    setItems(c.map(i=>({...i, product_id:i.id, title:i.name, quantity:i.qty, artist_name:''})));
    setSub(c.reduce((s,i)=>s+(i.price||0)*i.qty, 0));
  };

  useEffect(() => { load(); }, [user]);

  const change = async (item, d) => {
    const newQty = item.quantity + d;
    if (newQty < 1) { remove(item); return; }
    if (user) {
      try { await CartAPI.update(item.id, newQty); await load(); refreshCounts(); }
      catch (e) { showToast(e.message,'error'); }
    } else {
      const c = JSON.parse(localStorage.getItem('ss_cart')||'[]');
      const it = c.find(i=>i.id===item.product_id);
      if (it) it.qty = newQty;
      localStorage.setItem('ss_cart', JSON.stringify(c));
      loadLocal(); refreshCounts();
    }
  };

  const remove = async (item) => {
    if (user) {
      try { await CartAPI.remove(item.id); await load(); refreshCounts(); }
      catch (e) { showToast(e.message,'error'); }
    } else {
      const c = JSON.parse(localStorage.getItem('ss_cart')||'[]').filter(i=>i.id!==item.product_id);
      localStorage.setItem('ss_cart', JSON.stringify(c));
      loadLocal(); refreshCounts();
    }
  };

  const checkout = () => {
    if (!user) { showToast('Sign in to checkout'); navigate('/login'); return; }
    if (items.length === 0) { showToast('Your cart is empty', 'error'); return; }
    navigate('/checkout');
  };

  const empty = items.length === 0;

  return (
    <div className="page-wrap">
      <div style={{ marginBottom:'3rem', paddingBottom:'2rem', borderBottom:'.5px solid var(--border)' }}>
        <div className="page-label">Your Selection</div>
        <h1 className="page-title">Shopping <em>Cart</em></h1>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 360px', gap:'3rem', alignItems:'start' }}>
        <div>
          {empty ? (
            <div style={{ textAlign:'center', padding:'5rem 2rem', background:'var(--surface2)', border:'.5px solid var(--border)' }}>
              <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'1.5rem', fontWeight:300, color:'var(--cream)', marginBottom:'.5rem' }}>Your cart is empty</div>
              <div style={{ fontSize:'.62rem', letterSpacing:'.12em', color:'var(--muted)', marginBottom:'1.5rem' }}>Discover works that move you</div>
              <Link to="/shop" className="btn-primary">Browse Gallery</Link>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'1px', background:'var(--border)' }}>
              {items.map(item => (
                <div key={item.id} style={{ display:'grid', gridTemplateColumns:'80px 1fr auto', gap:'1.5rem', alignItems:'center', background:'var(--surface2)', padding:'1.5rem', transition:'background .3s' }}>
                  <div
                    className={item.image_url ? '' : getBgClass(item.product_id)}
                    style={{
                      height:'80px', border:'.5px solid var(--border)',
                      ...(item.image_url ? {
                        backgroundImage: `url(${item.image_url})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      } : {})
                    }}
                  />
                  <div>
                    <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'1.05rem', color:'var(--cream)', marginBottom:'.25rem' }}>{item.title}</div>
                    <div style={{ fontSize:'.55rem', letterSpacing:'.18em', textTransform:'uppercase', color:'var(--muted)' }}>by {item.artist_name} · Authenticated</div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'.8rem' }}>
                    <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'1.05rem', color:'var(--gold)' }}>₹ {(Number(item.price)*item.quantity).toLocaleString()}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
                      <button onClick={()=>change(item,-1)} style={{ width:'28px', height:'28px', background:'none', border:'.5px solid var(--border2)', cursor:'none', color:'var(--muted)', fontSize:'.9rem', transition:'all .3s' }}>−</button>
                      <span style={{ fontSize:'.75rem', color:'var(--cream)', minWidth:'24px', textAlign:'center' }}>{item.quantity}</span>
                      <button onClick={()=>change(item,1)} style={{ width:'28px', height:'28px', background:'none', border:'.5px solid var(--border2)', cursor:'none', color:'var(--muted)', fontSize:'.9rem', transition:'all .3s' }}>+</button>
                    </div>
                    <button onClick={()=>remove(item)} style={{ fontSize:'.5rem', letterSpacing:'.2em', textTransform:'uppercase', color:'var(--muted)', background:'none', border:'none', cursor:'none', transition:'color .3s' }}
                      onMouseEnter={e=>e.target.style.color='#c05050'} onMouseLeave={e=>e.target.style.color='var(--muted)'}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        <div style={{ background:'var(--surface2)', border:'.5px solid var(--border)', padding:'2rem', position:'sticky', top:'100px' }}>
          <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'1.3rem', fontWeight:300, color:'var(--cream)', marginBottom:'1.8rem', paddingBottom:'1.2rem', borderBottom:'.5px solid var(--border)' }}>Order Summary</div>
          {[['Subtotal',`₹ ${Number(subtotal).toLocaleString()}`],['Shipping','Complimentary'],['Insurance','Included']].map(([l,v])=>(
            <div key={l} style={{ display:'flex', justifyContent:'space-between', marginBottom:'1rem', fontSize:'.68rem', letterSpacing:'.1em' }}>
              <span style={{ color:'var(--muted)' }}>{l}</span>
              <span style={{ color:'var(--cream)', fontFamily:'Cormorant Garamond,serif', fontSize:'.9rem' }}>{v}</span>
            </div>
          ))}
          <div style={{ height:'.5px', background:'var(--border)', margin:'1.2rem 0' }} />
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem' }}>
            <span style={{ fontSize:'.62rem', letterSpacing:'.22em', textTransform:'uppercase', color:'var(--muted)' }}>Total</span>
            <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'1.5rem', color:'var(--gold)' }}>₹ {Number(subtotal).toLocaleString()}</span>
          </div>
          <button className="btn-primary" style={{ width:'100%', marginBottom:'1rem' }} onClick={checkout}>Proceed to Checkout</button>
          <Link to="/shop" style={{ display:'block', textAlign:'center', fontSize:'.58rem', letterSpacing:'.18em', textTransform:'uppercase', color:'var(--muted)', textDecoration:'none' }}>← Continue Browsing</Link>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Wishlist Page
// ─────────────────────────────────────────────────────────────
export function Wishlist() {
  const { user }          = useAuth();
  const { refreshCounts } = useCart();
  const { showToast }     = useToast();
  const [items, setItems] = useState([]);

  const load = async () => {
    if (user) {
      try { const d = await WishlistAPI.get(); setItems(d.items); }
      catch { loadLocal(); }
    } else loadLocal();
  };
  const loadLocal = () => {
    const w = JSON.parse(localStorage.getItem('ss_wish')||'[]');
    setItems(w.map(i=>({...i, product_id:i.id, title:i.name})));
  };
  useEffect(() => { load(); }, [user]);

  const handleCart = async (item) => {
    if (user) {
      try { await CartAPI.add(item.product_id, 1); showToast('Added to cart','success'); refreshCounts(); }
      catch (e) { showToast(e.message,'error'); }
    } else {
      const c = JSON.parse(localStorage.getItem('ss_cart')||'[]');
      if (!c.find(i=>i.id===item.product_id)) c.push({ id:item.product_id, name:item.title, price:item.price, qty:1 });
      localStorage.setItem('ss_cart', JSON.stringify(c));
      showToast('Added to cart'); refreshCounts();
    }
  };

  const handleRemove = async (item) => {
    if (user) {
      try { await WishlistAPI.remove(item.product_id); await load(); refreshCounts(); }
      catch (e) { showToast(e.message,'error'); }
    } else {
      const w = JSON.parse(localStorage.getItem('ss_wish')||'[]').filter(i=>i.id!==item.product_id);
      localStorage.setItem('ss_wish', JSON.stringify(w));
      loadLocal(); refreshCounts();
    }
  };

  return (
    <div className="page-wrap">
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:'3rem', paddingBottom:'2rem', borderBottom:'.5px solid var(--border)' }}>
        <div><div className="page-label">Saved Works</div><h1 className="page-title">Your <em>Wishlist</em></h1></div>
        <span style={{ fontSize:'.58rem', letterSpacing:'.18em', textTransform:'uppercase', color:'var(--muted)' }}>{items.length} works saved</span>
      </div>
      {items.length === 0 ? (
        <div style={{ textAlign:'center', padding:'5rem', background:'var(--surface2)', border:'.5px solid var(--border)' }}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.5rem', color:'var(--cream)', marginBottom:'.5rem' }}>No saved works yet</div>
          <div style={{ fontSize:'.62rem', color:'var(--muted)', marginBottom:'1.5rem', letterSpacing:'.12em' }}>Heart the works that speak to you</div>
          <Link to="/shop" className="btn-primary">Browse Gallery</Link>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1px', background:'var(--border)' }}>
          {items.map(item => (
            <div key={item.id||item.product_id} style={{ background:'var(--surface2)', position:'relative', overflow:'hidden' }}>
              <div style={{ height:'260px', position:'relative', overflow:'hidden' }}
                onClick={() => window.location.href=`/product/${item.product_id}`}
                onMouseEnter={e => e.currentTarget.querySelector('.wish-img-bg').style.transform='scale(1.07)'}
                onMouseLeave={e => e.currentTarget.querySelector('.wish-img-bg').style.transform='scale(1)'}>
                <div
                  className={item.image_url ? 'wish-img-bg' : `wish-img-bg ${getBgClass(item.product_id)}`}
                  style={{
                    width:'100%', height:'100%',
                    transition:'transform .8s cubic-bezier(.25,.46,.45,.94)', cursor:'none',
                    ...(item.image_url ? {
                      backgroundImage: `url(${item.image_url})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    } : {})
                  }} />
                <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(8,7,6,.5) 0%,transparent 60%)' }} />
              </div>
              <div style={{ padding:'1.2rem 1.4rem', borderTop:'.5px solid var(--border)', background:'var(--surface2)' }}>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1rem', fontWeight:400, color:'var(--cream)', marginBottom:'.5rem' }}>{item.title}</div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
                  <span style={{ fontSize:'.56rem', letterSpacing:'.18em', textTransform:'uppercase', color:'var(--muted)' }}>{item.medium||'Original Work'}</span>
                  <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1rem', color:'var(--gold)' }}>₹ {Number(item.price).toLocaleString()}</span>
                </div>
                <div style={{ display:'flex', gap:'.6rem' }}>
                  <button
                    onClick={() => handleCart(item)}
                    style={{ flex:1, fontSize:'.58rem', letterSpacing:'.18em', textTransform:'uppercase', color:'var(--ink)', background:'var(--gold)', border:'none', padding:'.6rem .8rem', cursor:'none', fontFamily:"'Josefin Sans',sans-serif", fontWeight:400, transition:'background .25s' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--gold2)'}
                    onMouseLeave={e=>e.currentTarget.style.background='var(--gold)'}>
                    Add to Cart
                  </button>
                  <Link to={`/product/${item.product_id}`}
                    style={{ fontSize:'.58rem', letterSpacing:'.18em', textTransform:'uppercase', color:'var(--gold)', border:'.5px solid var(--border2)', padding:'.6rem .8rem', textDecoration:'none', fontFamily:"'Josefin Sans',sans-serif", display:'flex', alignItems:'center', transition:'all .3s' }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--gold)';e.currentTarget.style.background='rgba(201,168,76,.06)'}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border2)';e.currentTarget.style.background='transparent'}}>
                    View
                  </Link>
                  <button
                    onClick={() => handleRemove(item)}
                    title="Remove from wishlist"
                    style={{ width:'36px', flexShrink:0, border:'.5px solid rgba(192,80,80,.35)', background:'rgba(192,80,80,.08)', cursor:'none', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .25s' }}
                    onMouseEnter={e=>{e.currentTarget.style.background='rgba(192,80,80,.2)';e.currentTarget.style.borderColor='rgba(192,80,80,.6)'}}
                    onMouseLeave={e=>{e.currentTarget.style.background='rgba(192,80,80,.08)';e.currentTarget.style.borderColor='rgba(192,80,80,.35)'}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" stroke="#c05050" fill="none" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Orders Page
// ─────────────────────────────────────────────────────────────
export function Orders() {
  const { user }      = useAuth();
  const { showToast } = useToast();
  const navigate      = useNavigate();
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [open, setOpen]         = useState({});
  const [details, setDetails]   = useState({});
  const [returning, setReturning] = useState({});

  const STATUS_LABEL = {
    confirmed:        'Confirmed',
    packaging:        'Packaging',
    shipped:          'In Transit',
    delivered:        'Delivered',
    cancelled:        'Cancelled',
    pending:          'Pending',
    return_requested: 'Return Requested',
    returned:         'Returned',
  };
  const STATUS_COLOR = {
    confirmed:        '#4a8c5c',
    packaging:        'var(--gold3)',
    shipped:          'var(--gold)',
    delivered:        'var(--muted)',
    cancelled:        '#c05050',
    return_requested: '#c07830',
    returned:         '#8c6a4a',
  };
  const STEPS = ['confirmed','packaging','shipped','delivered'];

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    OrdersAPI.getAll()
      .then(d => { setOrders(d.orders); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  const toggle = async (orderId) => {
    setOpen(o => ({ ...o, [orderId]: !o[orderId] }));
    if (!open[orderId] && !details[orderId]) {
      try {
        const d = await OrdersAPI.getOne(orderId);
        setDetails(prev => ({ ...prev, [orderId]: d.order }));
      } catch {}
    }
  };

  const handleReturn = async (orderId) => {
    const reason = window.prompt('Please tell us why you want to return this order (optional):');
    if (reason === null) return; // user cancelled the prompt
    setReturning(r => ({ ...r, [orderId]: true }));
    try {
      await OrdersAPI.requestReturn(orderId, reason);
      showToast('Return request submitted! Our team will contact you shortly.', 'success');
      // Refresh orders list
      const d = await OrdersAPI.getAll();
      setOrders(d.orders);
      // Clear cached details so it reloads
      setDetails(prev => { const n = {...prev}; delete n[orderId]; return n; });
    } catch (e) {
      showToast(e.message || 'Failed to submit return request', 'error');
    } finally {
      setReturning(r => ({ ...r, [orderId]: false }));
    }
  };

  if (!user) return (
    <div className="page-wrap" style={{ textAlign:'center', paddingTop:'12rem' }}>
      <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'1.5rem', color:'var(--cream)', marginBottom:'1rem' }}>Sign in to view your orders</div>
      <button className="btn-primary" onClick={() => navigate('/login')}>Sign In</button>
    </div>
  );

  return (
    <div className="page-wrap" style={{ maxWidth:'900px' }}>
      <div className="page-label">Collector History</div>
      <h1 className="page-title" style={{ marginBottom:'3rem', paddingBottom:'2rem', borderBottom:'.5px solid var(--border)' }}>Your <em>Orders</em></h1>
      {loading && <div style={{ color:'var(--muted)', fontSize:'.65rem', letterSpacing:'.16em' }}>Loading orders…</div>}
      {!loading && orders.length === 0 && (
        <div style={{ textAlign:'center', padding:'4rem', background:'var(--surface2)', border:'.5px solid var(--border)' }}>
          <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'1.3rem', color:'var(--cream)', marginBottom:'1rem', fontStyle:'italic' }}>No orders yet. Start exploring the gallery.</div>
          <Link to="/shop" className="btn-primary">Browse Gallery</Link>
        </div>
      )}
      {orders.map(order => {
        const det = details[order.id];
        const curIdx = STEPS.indexOf(order.status);
        const isDelivered = order.status === 'delivered';
        const isReturnRequested = order.status === 'return_requested';
        const isReturned = order.status === 'returned';

        return (
          <div key={order.id} style={{ background:'var(--surface2)', border:'.5px solid var(--border)', marginBottom:'1px', overflow:'hidden' }}>
            {/* Order header row */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.5rem 2rem', cursor:'none', borderBottom: open[order.id]?'.5px solid var(--border)':'none' }}
              onClick={() => toggle(order.id)}>
              <div>
                <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'1rem', color:'var(--cream)' }}>Order #{order.order_number}</div>
                <div style={{ fontSize:'.56rem', letterSpacing:'.16em', textTransform:'uppercase', color:'var(--muted)', marginTop:'.2rem' }}>
                  Placed {new Date(order.placed_at).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}
                </div>
              </div>
              <div style={{ fontSize:'.54rem', letterSpacing:'.2em', textTransform:'uppercase', padding:'.3rem .8rem', border:'.5px solid', color: STATUS_COLOR[order.status]||'var(--muted)', borderColor:`${STATUS_COLOR[order.status]||'var(--muted)'}55` }}>
                {STATUS_LABEL[order.status]||order.status}
              </div>
              <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'1rem', color:'var(--gold)' }}>₹ {Number(order.total_amount).toLocaleString()}</div>
              <span style={{ color:'var(--muted)', fontSize:'1rem' }}>{open[order.id]?'−':'+'}</span>
            </div>

            {/* Expanded details */}
            {open[order.id] && (
              <div style={{ padding:'2rem' }}>
                {!det ? <div style={{ color:'var(--muted)', fontSize:'.65rem', letterSpacing:'.12em' }}>Loading details…</div> : (
                  <>
                    {/* Timeline */}
                    <div style={{ position:'relative', paddingLeft:'2rem' }}>
                      <div style={{ position:'absolute', left:'.35rem', top:'.4rem', bottom:'.4rem', width:'.5px', background:'var(--border)' }} />
                      {STEPS.map((step,i) => {
                        const tl = det.timeline?.find(t=>t.status===step);
                        const done = i < curIdx, active = i === curIdx;
                        return (
                          <div key={step} style={{ position:'relative', marginBottom: i<STEPS.length-1?'2rem':0 }}>
                            <div style={{ position:'absolute', left:'-1.65rem', top:'.2rem', width:'10px', height:'10px', borderRadius:'50%', border:`.5px solid ${done||active?'var(--gold)':'var(--border2)'}`, background: done?'var(--gold)':active?'transparent':'var(--surface)', transition:'all .3s' }} />
                            <div style={{ fontSize:'.6rem', letterSpacing:'.22em', textTransform:'uppercase', color: done||active?'var(--gold3)':'var(--muted)', marginBottom:'.3rem' }}>{STATUS_LABEL[step]||step}</div>
                            <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'.9rem', color:'var(--cream2)' }}>{tl?.description||'Pending'}</div>
                            <div style={{ fontSize:'.52rem', letterSpacing:'.14em', color:'var(--muted2)', marginTop:'.2rem' }}>{tl?new Date(tl.created_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'—'}</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Return request status banner */}
                    {isReturnRequested && (
                      <div style={{ marginTop:'2rem', padding:'1rem 1.5rem', background:'rgba(192,120,48,.08)', border:'.5px solid rgba(192,120,48,.3)', display:'flex', alignItems:'center', gap:'.8rem' }}>
                        <span style={{ fontSize:'.6rem', letterSpacing:'.18em', textTransform:'uppercase', color:'#c07830' }}>⏳ Return request submitted — our team will contact you within 2-3 business days.</span>
                      </div>
                    )}
                    {isReturned && (
                      <div style={{ marginTop:'2rem', padding:'1rem 1.5rem', background:'rgba(140,106,74,.08)', border:'.5px solid rgba(140,106,74,.3)' }}>
                        <span style={{ fontSize:'.6rem', letterSpacing:'.18em', textTransform:'uppercase', color:'#8c6a4a' }}>✓ This order has been returned and refunded.</span>
                      </div>
                    )}

                    {/* Items */}
                    {det.items?.map(it => (
                      <div key={it.id} style={{ display:'flex', alignItems:'center', gap:'1rem', marginTop:'2rem', paddingTop:'2rem', borderTop:'.5px solid var(--border)' }}>
                        <div
                          className={it.image_url ? '' : getBgClass(it.product_id)}
                          style={{
                            width:'60px', height:'60px', border:'.5px solid var(--border)', flexShrink:0,
                            ...(it.image_url ? {
                              backgroundImage: `url(${it.image_url})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            } : {})
                          }}
                        />
                        <div>
                          <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'1rem', color:'var(--cream)', marginBottom:'.2rem' }}>{it.title}</div>
                          <div style={{ fontSize:'.55rem', letterSpacing:'.16em', textTransform:'uppercase', color:'var(--muted)' }}>Qty {it.quantity} · ₹ {Number(it.unit_price).toLocaleString()}</div>
                        </div>
                      </div>
                    ))}

                    {/* Return button — only shown for delivered orders */}
                    {isDelivered && (
                      <div style={{ marginTop:'2rem', paddingTop:'2rem', borderTop:'.5px solid var(--border)' }}>
                        <div style={{ fontSize:'.56rem', letterSpacing:'.14em', color:'var(--muted)', marginBottom:'1rem' }}>
                          Not satisfied with your purchase? You can request a return within 7 days of delivery.
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleReturn(order.id); }}
                          disabled={returning[order.id]}
                          style={{
                            fontSize:'.58rem', letterSpacing:'.18em', textTransform:'uppercase',
                            color:'#c05050', background:'rgba(192,80,80,.06)',
                            border:'.5px solid rgba(192,80,80,.35)',
                            padding:'.7rem 1.5rem', cursor:'none',
                            fontFamily:"'Josefin Sans',sans-serif",
                            transition:'all .25s',
                            opacity: returning[order.id] ? 0.6 : 1,
                          }}
                          onMouseEnter={e=>{ e.currentTarget.style.background='rgba(192,80,80,.15)'; e.currentTarget.style.borderColor='rgba(192,80,80,.6)'; }}
                          onMouseLeave={e=>{ e.currentTarget.style.background='rgba(192,80,80,.06)'; e.currentTarget.style.borderColor='rgba(192,80,80,.35)'; }}>
                          {returning[order.id] ? 'Submitting…' : '↩ Request Return'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Profile Page
// ─────────────────────────────────────────────────────────────
export function Profile() {
  const { user, logout, updateUser } = useAuth();
  const { showToast }                = useToast();
  const navigate                     = useNavigate();
  const [form, setForm]   = useState({ name:'', phone:'', address:'', email:'' });
  const [saving, setSaving] = useState(false);
  const [wishCount, setWC]  = useState(0);
  const [orderCount, setOC] = useState(0);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    setForm({ name:user.name||'', phone:user.phone||'', address:user.address||'', email:user.email||'' });
    WishlistAPI.get().then(d=>setWC(d.items.length)).catch(()=>{});
    OrdersAPI.getAll().then(d=>setOC(d.total)).catch(()=>{});
  }, [user]);

  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await AuthAPI.updateProfile({ name:form.name, phone:form.phone, address:form.address });
      updateUser({ name:form.name, phone:form.phone, address:form.address });
      showToast('Profile saved','success');
    } catch (err) { showToast(err.message,'error'); }
    finally { setSaving(false); }
  };

  const initials = user?.name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?';
  const navLinks = [
    { label:'Profile', to:'/profile' }, { label:'Orders', to:'/orders' }, { label:'Wishlist', to:'/wishlist' },
  ];

  return (
    <div className="page-wrap">
      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:'3rem', alignItems:'start' }}>
        {/* Sidebar */}
        <div style={{ position:'sticky', top:'100px' }}>
          <div style={{ textAlign:'center', padding:'2.5rem 2rem', background:'var(--surface2)', border:'.5px solid var(--border)', marginBottom:'1px' }}>
            <div style={{ width:'80px', height:'80px', border:'.5px solid var(--border2)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Cormorant Garamond,serif', fontSize:'1.8rem', color:'var(--gold)', margin:'0 auto 1.2rem', animation:'pulse 3s ease infinite' }}>{initials}</div>
            <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'1.2rem', color:'var(--cream)', marginBottom:'.3rem' }}>{user?.name}</div>
            <div style={{ fontSize:'.54rem', letterSpacing:'.22em', textTransform:'uppercase', color:'var(--gold3)' }}>
              {user?.role?.charAt(0).toUpperCase()+user?.role?.slice(1)} · Member since {user?.created_at?new Date(user.created_at).getFullYear():'2024'}
            </div>
          </div>
          <div style={{ background:'var(--surface2)', border:'.5px solid var(--border)', borderTop:'none' }}>
            {navLinks.map(n => (
              <Link key={n.to} to={n.to} style={{ display:'flex', alignItems:'center', gap:'.8rem', padding:'1rem 1.5rem', borderBottom:'.5px solid var(--border)', textDecoration:'none', color:'var(--muted)', fontSize:'.6rem', letterSpacing:'.2em', textTransform:'uppercase', transition:'all .3s' }}
                onMouseEnter={e=>{e.currentTarget.style.color='var(--gold)';e.currentTarget.style.background='rgba(201,168,76,.04)'}}
                onMouseLeave={e=>{e.currentTarget.style.color='var(--muted)';e.currentTarget.style.background='transparent'}}>{n.label}</Link>
            ))}
            <button onClick={() => { logout(); navigate('/'); }}
              style={{ display:'flex', alignItems:'center', gap:'.8rem', padding:'1rem 1.5rem', width:'100%', background:'none', border:'none', cursor:'none', color:'var(--muted)', fontSize:'.6rem', letterSpacing:'.2em', textTransform:'uppercase', textAlign:'left', transition:'all .3s' }}
              onMouseEnter={e=>e.currentTarget.style.color='#c05050'}
              onMouseLeave={e=>e.currentTarget.style.color='var(--muted)'}>Sign Out</button>
          </div>
        </div>

        {/* Main */}
        <div>
          <div style={{ marginBottom:'2rem', paddingBottom:'1.5rem', borderBottom:'.5px solid var(--border)' }}>
            <div className="section-label">Your Account</div>
            <h1 className="page-title">Collector <em>Profile</em></h1>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1px', background:'var(--border)', marginBottom:'2.5rem' }}>
            {[[orderCount,'Orders Placed'],[wishCount,'Saved Works'],['2024','Member Since']].map(([v,l])=>(
              <div key={l} style={{ background:'var(--surface2)', padding:'1.5rem 1.8rem', textAlign:'center' }}>
                <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'2.2rem', fontWeight:300, color:'var(--gold)', display:'block', lineHeight:1 }}>{v}</span>
                <span style={{ fontSize:'.54rem', letterSpacing:'.2em', textTransform:'uppercase', color:'var(--muted)', marginTop:'.4rem', display:'block' }}>{l}</span>
              </div>
            ))}
          </div>
          <form onSubmit={save}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem 2rem' }}>
              {[['Full Name','text','name'],['Email','email','email'],['Phone','tel','phone']].map(([label,type,key])=>(
                <div key={key}>
                  <label style={{ fontSize:'.54rem', letterSpacing:'.26em', textTransform:'uppercase', color:'var(--muted)', display:'block', marginBottom:'.6rem' }}>{label}</label>
                  <input value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} type={type} disabled={key==='email'}
                    style={{ width:'100%', background:'transparent', border:'none', borderBottom:'.5px solid var(--border2)', outline:'none', padding:'.7rem 0', fontFamily:'Josefin Sans,sans-serif', fontSize:'.78rem', fontWeight:300, letterSpacing:'.1em', color: key==='email'?'var(--muted)':'var(--cream)', caretColor:'var(--gold)', transition:'border-color .3s' }} />
                </div>
              ))}
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ fontSize:'.54rem', letterSpacing:'.26em', textTransform:'uppercase', color:'var(--muted)', display:'block', marginBottom:'.6rem' }}>Shipping Address</label>
                <input value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} type="text"
                  style={{ width:'100%', background:'transparent', border:'none', borderBottom:'.5px solid var(--border2)', outline:'none', padding:'.7rem 0', fontFamily:'Josefin Sans,sans-serif', fontSize:'.78rem', fontWeight:300, letterSpacing:'.1em', color:'var(--cream)', caretColor:'var(--gold)' }} />
              </div>
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop:'2rem' }} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(201,168,76,.2)}50%{box-shadow:0 0 0 8px rgba(201,168,76,0)}}`}</style>
    </div>
  );
}
