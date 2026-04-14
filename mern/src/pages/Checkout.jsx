import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CartAPI, OrdersAPI, getBgClass, getProductImageStyle } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../hooks/useToast';

export default function Checkout() {
  const { user }          = useAuth();
  const { refreshCounts } = useCart();
  const { showToast }     = useToast();
  const navigate          = useNavigate();

  const [step,     setStep]     = useState(1); // 1=shipping, 2=review, 3=confirmed
  const [items,    setItems]    = useState([]);
  const [subtotal, setSubtotal] = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [order,    setOrder]    = useState(null);

  const [form, setForm] = useState({
    shipping_name:  user?.name  || '',
    shipping_phone: user?.phone || '',
    shipping_addr:  user?.address || '',
    notes: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    CartAPI.get()
      .then(d => { setItems(d.items); setSubtotal(d.subtotal); })
      .catch(() => navigate('/cart'));
  }, [user]);

  const placeOrder = async () => {
    if (!form.shipping_name || !form.shipping_addr || !form.shipping_phone) {
      showToast('Please fill all shipping details', 'error'); return;
    }
    setLoading(true);
    try {
      const orderItems = items.map(i => ({ product_id: i.product_id, quantity: i.quantity }));
      const d = await OrdersAPI.place({
        items:          orderItems,
        shipping_name:  form.shipping_name,
        shipping_addr:  form.shipping_addr,
        shipping_phone: form.shipping_phone,
        notes:          form.notes,
      });
      if (!d.success) throw new Error(d.message);
      setOrder(d.order);
      setStep(3);
      refreshCounts();
    } catch (e) {
      showToast(e.message || 'Order failed — please try again', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Shared styles ─────────────────────────────────────────
  const inp = {
    width: '100%', background: 'rgba(201,168,76,.03)',
    border: 'none', borderBottom: '.5px solid var(--border2)',
    outline: 'none', padding: '.75rem 0',
    fontFamily: "'Josefin Sans',sans-serif", fontSize: '.8rem',
    fontWeight: 300, letterSpacing: '.1em',
    color: 'var(--cream)', caretColor: 'var(--gold)',
    transition: 'border-color .3s', boxSizing: 'border-box',
  };
  const lbl = {
    fontSize: '.54rem', letterSpacing: '.26em',
    textTransform: 'uppercase', color: 'var(--muted)',
    display: 'block', marginBottom: '.6rem',
  };

  return (
    <div className="page-wrap">

      {/* ── Step indicator ── */}
      <div style={{ marginBottom: '3rem', paddingBottom: '2rem', borderBottom: '.5px solid var(--border)' }}>
        <div className="page-label">Secure Checkout</div>
        <h1 className="page-title">
          {step === 1 && <>Shipping <em>Details</em></>}
          {step === 2 && <>Review <em>Order</em></>}
          {step === 3 && <>Order <em>Confirmed</em></>}
        </h1>

        {/* Step bar */}
        {step < 3 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginTop: '2rem', maxWidth: '400px' }}>
            {['Shipping', 'Review', 'Confirm'].map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.3rem' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    border: `.5px solid ${step > i ? 'var(--gold)' : step === i+1 ? 'var(--gold)' : 'var(--border2)'}`,
                    background: step > i ? 'var(--gold)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '.55rem', color: step > i ? 'var(--ink)' : step === i+1 ? 'var(--gold)' : 'var(--muted)',
                    fontFamily: "'Josefin Sans',sans-serif", fontWeight: 500,
                    transition: 'all .3s',
                  }}>
                    {step > i ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: '.52rem', letterSpacing: '.14em', textTransform: 'uppercase', color: step === i+1 ? 'var(--gold)' : 'var(--muted)' }}>{s}</span>
                </div>
                {i < 2 && <div style={{ flex: 1, height: '.5px', background: step > i+1 ? 'var(--gold)' : 'var(--border)', margin: '-1rem .5rem 0', transition: 'background .3s' }} />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ STEP 1 — Shipping ══ */}
      {step === 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '3rem', alignItems: 'start' }}>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '1.2rem', color: 'var(--cream)', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '.5px solid var(--border)' }}>
              Delivery Information
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem 2rem' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Full Name *</label>
                <input style={inp} value={form.shipping_name} onChange={e => set('shipping_name', e.target.value)}
                  placeholder="Recipient full name"
                  onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                  onBlur={e  => e.target.style.borderColor = 'var(--border2)'} />
              </div>
              <div>
                <label style={lbl}>Phone Number *</label>
                <input style={inp} type="tel" value={form.shipping_phone} onChange={e => set('shipping_phone', e.target.value)}
                  placeholder="+91 98765 43210"
                  onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                  onBlur={e  => e.target.style.borderColor = 'var(--border2)'} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Delivery Address *</label>
                <textarea value={form.shipping_addr} onChange={e => set('shipping_addr', e.target.value)}
                  placeholder="House/Flat No, Street, City, State, PIN"
                  rows={3}
                  style={{ ...inp, resize: 'vertical', lineHeight: 1.7, borderBottom: 'none', border: '.5px solid var(--border2)', padding: '.75rem 1rem' }}
                  onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                  onBlur={e  => e.target.style.borderColor = 'var(--border2)'} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Special Instructions <span style={{ color: 'var(--muted2)', fontSize: '.46rem' }}>(optional)</span></label>
                <input style={inp} value={form.notes} onChange={e => set('notes', e.target.value)}
                  placeholder="Any special delivery instructions…"
                  onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                  onBlur={e  => e.target.style.borderColor = 'var(--border2)'} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
              <Link to="/cart" style={{ fontSize: '.58rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', border: '.5px solid var(--border)', padding: '.8rem 1.6rem', textDecoration: 'none', transition: 'all .3s', fontFamily: "'Josefin Sans',sans-serif" }}>
                ← Back to Cart
              </Link>
              <button
                onClick={() => {
                  if (!form.shipping_name || !form.shipping_addr || !form.shipping_phone) {
                    showToast('Please fill all required fields', 'error'); return;
                  }
                  setStep(2);
                }}
                className="btn-primary">
                Continue to Review →
              </button>
            </div>
          </div>

          {/* Order summary sidebar */}
          <OrderSummary items={items} subtotal={subtotal} />
        </div>
      )}

      {/* ══ STEP 2 — Review ══ */}
      {step === 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '3rem', alignItems: 'start' }}>
          <div>
            {/* Shipping summary */}
            <div style={{ background: 'var(--surface2)', border: '.5px solid var(--border)', padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: '.58rem', letterSpacing: '.26em', textTransform: 'uppercase', color: 'var(--gold3)' }}>Shipping To</div>
                <button onClick={() => setStep(1)} style={{ fontSize: '.54rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'none', textDecoration: 'underline' }}>Edit</button>
              </div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '1rem', color: 'var(--cream)', marginBottom: '.3rem' }}>{form.shipping_name}</div>
              <div style={{ fontSize: '.65rem', color: 'var(--muted)', lineHeight: 1.7 }}>{form.shipping_phone}</div>
              <div style={{ fontSize: '.65rem', color: 'var(--muted)', lineHeight: 1.7 }}>{form.shipping_addr}</div>
              {form.notes && <div style={{ fontSize: '.62rem', color: 'var(--muted2)', marginTop: '.5rem', fontStyle: 'italic' }}>Note: {form.notes}</div>}
            </div>

            {/* Items list */}
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '1.1rem', color: 'var(--cream)', marginBottom: '1rem' }}>Your Artworks</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border)', marginBottom: '2rem' }}>
              {items.map(item => {
                const imgStyle = getProductImageStyle(item);
                const bg = getBgClass(item.product_id);
                return (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '70px 1fr auto', gap: '1.2rem', alignItems: 'center', background: 'var(--surface2)', padding: '1.2rem' }}>
                    <div
                      className={item.image_url ? '' : bg}
                      style={{ height: '70px', border: '.5px solid var(--border)', ...imgStyle }}
                    />
                    <div>
                      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '.95rem', color: 'var(--cream)', marginBottom: '.2rem' }}>{item.title}</div>
                      <div style={{ fontSize: '.54rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>by {item.artist_name} · Qty {item.quantity}</div>
                    </div>
                    <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '.95rem', color: 'var(--gold)', textAlign: 'right' }}>
                      ₹ {(Number(item.price) * item.quantity).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setStep(1)}
                style={{ fontSize: '.58rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', border: '.5px solid var(--border)', padding: '.8rem 1.6rem', background: 'none', cursor: 'none', fontFamily: "'Josefin Sans',sans-serif", transition: 'all .3s' }}>
                ← Edit Shipping
              </button>
              <button onClick={placeOrder} className="btn-primary" disabled={loading}
                style={{ opacity: loading ? .7 : 1 }}>
                {loading ? 'Placing Order…' : `Confirm & Place Order — ₹ ${Number(subtotal).toLocaleString()}`}
              </button>
            </div>
          </div>

          <OrderSummary items={items} subtotal={subtotal} />
        </div>
      )}

      {/* ══ STEP 3 — Confirmed ══ */}
      {step === 3 && order && (
        <div style={{ maxWidth: '650px', margin: '0 auto', textAlign: 'center' }}>
          {/* Success icon */}
          <div style={{ width: '80px', height: '80px', border: '.5px solid var(--gold)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', animation: 'pulse 2s ease infinite' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" stroke="var(--gold)" fill="none" strokeWidth="1.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>

          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '2.5rem', fontWeight: 300, color: 'var(--cream)', marginBottom: '.5rem' }}>
            Order <em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>Confirmed!</em>
          </div>
          <p style={{ fontSize: '.7rem', letterSpacing: '.1em', color: 'var(--muted)', lineHeight: 1.8, marginBottom: '2.5rem' }}>
            Thank you for your acquisition. Your artwork is being prepared with care.<br/>
            {user?.email && `A confirmation has been sent to ${user.email}`}
          </p>

          {/* Order details box */}
          <div style={{ background: 'var(--surface2)', border: '.5px solid var(--border2)', padding: '2rem', marginBottom: '2rem', textAlign: 'left' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {[
                ['Order Number',   `#${order.order_number}`],
                ['Status',         'Confirmed'],
                ['Shipping To',    form.shipping_name],
                ['Total Amount',   `₹ ${Number(order.total_amount).toLocaleString()}`],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: '.52rem', letterSpacing: '.24em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '.3rem' }}>{label}</div>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '1rem', color: label === 'Total Amount' ? 'var(--gold)' : label === 'Status' ? '#4a8c5c' : 'var(--cream)' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link to="/orders" className="btn-primary">Track My Order</Link>
            <Link to="/shop" style={{ fontSize: '.6rem', letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--muted)', border: '.5px solid var(--border)', padding: '.9rem 2rem', textDecoration: 'none', fontFamily: "'Josefin Sans',sans-serif", transition: 'all .3s' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--gold)'; e.currentTarget.style.borderColor = 'var(--border2)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
              Continue Shopping
            </Link>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(201,168,76,.2)}50%{box-shadow:0 0 0 12px rgba(201,168,76,0)}}`}</style>
    </div>
  );
}

/* ── Order summary sidebar ─────────────────────────────────── */
function OrderSummary({ items, subtotal }) {
  return (
    <div style={{ background: 'var(--surface2)', border: '.5px solid var(--border)', padding: '1.8rem', position: 'sticky', top: '100px' }}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '1.2rem', fontWeight: 300, color: 'var(--cream)', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '.5px solid var(--border)' }}>
        Order Summary
      </div>

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.8rem', marginBottom: '1.5rem' }}>
        {items.map(item => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.8rem', minWidth: 0 }}>
              <div
                className={item.image_url ? '' : getBgClass(item.product_id)}
                style={{
                  width: '40px', height: '40px', flexShrink: 0, border: '.5px solid var(--border)',
                  ...(item.image_url ? { backgroundImage: `url(${item.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {})
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '.65rem', color: 'var(--cream)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                <div style={{ fontSize: '.54rem', color: 'var(--muted)', letterSpacing: '.1em' }}>Qty: {item.quantity}</div>
              </div>
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '.9rem', color: 'var(--gold)', flexShrink: 0 }}>
              ₹ {(Number(item.price) * item.quantity).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '.5px solid var(--border)', paddingTop: '1rem' }}>
        {[
          ['Subtotal',   `₹ ${Number(subtotal).toLocaleString()}`],
          ['Shipping',   'Complimentary'],
          ['Insurance',  'Included'],
        ].map(([l, v]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.8rem', fontSize: '.65rem', letterSpacing: '.08em' }}>
            <span style={{ color: 'var(--muted)' }}>{l}</span>
            <span style={{ color: 'var(--cream)', fontFamily: "'Cormorant Garamond',serif" }}>{v}</span>
          </div>
        ))}
        <div style={{ height: '.5px', background: 'var(--border)', margin: '.8rem 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '.6rem', letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--muted)' }}>Total</span>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '1.4rem', color: 'var(--gold)' }}>₹ {Number(subtotal).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
