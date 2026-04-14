import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { CartAPI, WishlistAPI, getBgClass, getProductImageStyle } from '../../services/api';
import { useToast } from '../../hooks/useToast';

export default function ProductCard({ product, style = {} }) {
  const navigate = useNavigate();
  const { user }          = useAuth();
  const { refreshCounts } = useCart();
  const { showToast }     = useToast();

  const bg       = getBgClass(product.id);
  const imgStyle = getProductImageStyle(product);
  const hasImage = !!product.image_url;
  const soldOut  = product.stock === 0 || product.stock === '0';

  const handleCart = async (e) => {
    e.stopPropagation();
    if (soldOut) { showToast('This artwork is sold out', 'error'); return; }
    if (user) {
      try { await CartAPI.add(product.id, 1); showToast('Added to cart', 'success'); refreshCounts(); }
      catch (err) { showToast(err.message, 'error'); }
    } else {
      const c = JSON.parse(localStorage.getItem('ss_cart') || '[]');
      if (!c.find(i => i.id === product.id)) c.push({ id: product.id, name: product.title, price: product.price, qty: 1 });
      localStorage.setItem('ss_cart', JSON.stringify(c));
      showToast('Added to cart'); refreshCounts();
    }
  };

  const handleWish = async (e) => {
    e.stopPropagation();
    if (!user) { showToast('Sign in to save works'); navigate('/login'); return; }
    try { await WishlistAPI.add(product.id); showToast('Added to wishlist', 'success'); refreshCounts(); }
    catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <div
      className="prod-card"
      style={{ ...style, opacity: soldOut ? 0.75 : 1 }}
      onClick={() => navigate(`/product/${product.id}`)}
    >
      {/* Sold Out badge */}
      {soldOut && (
        <div style={{
          position:'absolute', top:0, left:0, right:0, zIndex:10,
          background:'rgba(8,7,6,.85)', backdropFilter:'blur(6px)',
          borderBottom:'.5px solid rgba(192,80,80,.5)',
          display:'flex', alignItems:'center', justifyContent:'center',
          padding:'.5rem', gap:'.6rem',
        }}>
          <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#c05050', flexShrink:0 }} />
          <span style={{ fontSize:'.58rem', letterSpacing:'.32em', textTransform:'uppercase', color:'#c05050', fontFamily:"'Josefin Sans',sans-serif" }}>
            Sold Out
          </span>
        </div>
      )}

      {/* Regular tag (Featured / New) */}
      {product.tag && !soldOut && (
        <div className="prod-tag">{product.tag}</div>
      )}

      <div className="prod-img" style={{ height: style.height || '280px' }}>
        <div
          className={hasImage ? '' : `prod-img-bg ${bg}`}
          style={{ width:'100%', height:'100%', ...imgStyle }}
        />
        <div className="prod-overlay">
          <div className="overlay-title">{product.title}</div>
          <div className="overlay-type">{product.medium || product.category_name}</div>
          <div className="overlay-actions">
            <button className="overlay-btn" onClick={(e) => { e.stopPropagation(); navigate(`/product/${product.id}`); }}>
              View Work
            </button>
            {soldOut ? (
              <button className="overlay-btn" style={{ opacity:.5, cursor:'not-allowed' }} onClick={e => e.stopPropagation()}>
                Sold Out
              </button>
            ) : (
              <button className="overlay-btn" onClick={handleCart}>Add to Cart</button>
            )}
            <button className="overlay-wish" onClick={handleWish}>
              <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
            </button>
          </div>
        </div>
      </div>

      <div className="prod-info">
        <div className="prod-name">{product.title}</div>
        <div className="prod-meta">
          <span className="prod-type">{product.medium || product.category_name}</span>
          {soldOut
            ? <span style={{ fontSize:'.56rem', letterSpacing:'.16em', textTransform:'uppercase', color:'#c05050', fontFamily:"'Josefin Sans',sans-serif" }}>Sold Out</span>
            : <span className="prod-price">₹ {Number(product.price).toLocaleString()}</span>
          }
        </div>
      </div>
    </div>
  );
}
