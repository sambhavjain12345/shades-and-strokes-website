import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';

export default function Navbar() {
  const [scrolled,     setScrolled]     = useState(false);
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [searchQuery,  setSearchQuery]  = useState('');
  const { user, logout }                = useAuth();
  const { cartCount, wishCount }        = useCart();
  const searchRef                       = useRef(null);
  const navigate                        = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 380);
  }, [searchOpen]);

  const handleSearch = (e) => {
    if ((e.key === 'Enter' || e.key === undefined) && searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`, { replace: false });
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
      <Link to="/" className="nav-logo">Shades <span>& Strokes</span></Link>

      <div className="nav-center">
        <NavLink to="/shop" end className={({ isActive }) => isActive ? 'active' : ''}>Gallery</NavLink>
        <NavLink to="/shop?category=paintings" className={({ isActive }) => isActive ? 'active' : ''}>Collections</NavLink>
        <NavLink to="/artists" className={({ isActive }) => isActive ? 'active' : ''}>Artists</NavLink>
        <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>About</NavLink>
      </div>

      <div className="nav-right">
        {/* Search */}
        <div className="nav-search">
          <button className="search-toggle" onClick={() => setSearchOpen(o => !o)}>
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          <div className={`search-box ${searchOpen ? 'open' : ''}`}>
            <input
              ref={searchRef}
              className="search-input"
              type="text"
              placeholder="Search artworks…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
            />
            <button className="search-submit" onClick={() => handleSearch({ key: 'Enter' })}>
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
          </div>
        </div>

        {/* Wishlist */}
        <Link to="/wishlist" className="nav-icon-btn">
          <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
          {wishCount > 0 && <span className="nav-badge">{wishCount}</span>}
        </Link>

        {/* Cart */}
        <Link to="/cart" className="nav-icon-btn">
          <svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
          {cartCount > 0 && <span className="nav-badge">{cartCount}</span>}
        </Link>

        {/* Auth */}
        {user ? (
          <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
            {user.role === 'admin' && (
              <a href="/admin"
                style={{ fontSize:'.58rem', letterSpacing:'.2em', textTransform:'uppercase', color:'var(--gold3)', textDecoration:'none', border:'.5px solid var(--border2)', padding:'.5rem 1rem', transition:'all .3s' }}
                onMouseEnter={e=>{e.currentTarget.style.color='var(--gold)';e.currentTarget.style.borderColor='var(--gold)';}}
                onMouseLeave={e=>{e.currentTarget.style.color='var(--gold3)';e.currentTarget.style.borderColor='var(--border2)';}}>
                Admin
              </a>
            )}
            {user.role === 'artist' && (
              <a href="/studio"
                style={{ fontSize:'.58rem', letterSpacing:'.2em', textTransform:'uppercase', color:'var(--gold3)', textDecoration:'none', border:'.5px solid var(--border2)', padding:'.5rem 1rem', transition:'all .3s' }}
                onMouseEnter={e=>{e.currentTarget.style.color='var(--gold)';e.currentTarget.style.borderColor='var(--gold)';}}
                onMouseLeave={e=>{e.currentTarget.style.color='var(--gold3)';e.currentTarget.style.borderColor='var(--border2)';}}>
                My Studio
              </a>
            )}
            <Link to="/profile" className="nav-cta">{user.name.split(' ')[0]}</Link>
          </div>
        ) : (
          <Link to="/login" className="nav-cta">Sign In</Link>
        )}
      </div>
    </nav>
  );
}
