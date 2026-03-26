import { useEffect, useState } from 'react';
import Navbar    from './Navbar';
import Cursor    from '../common/Cursor';
import Particles from '../common/Particles';

export default function Layout({ children }) {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <Cursor />
      <Particles />
      <Navbar />
      <main style={{ position: 'relative', zIndex: 1 }}>{children}</main>
      <button className={`back-top ${showTop ? 'show' : ''}`} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
      </button>
    </>
  );
}
