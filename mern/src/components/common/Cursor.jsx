import { useEffect, useRef } from 'react';

export default function Cursor() {
  const dotRef  = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    // Hide system cursor once custom cursor is ready
    document.body.style.cursor = 'none';

    let mx = 0, my = 0, rx = 0, ry = 0;
    const move = (e) => { mx = e.clientX; my = e.clientY; };
    document.addEventListener('mousemove', move);

    let raf;
    const loop = () => {
      rx += (mx - rx) * 0.12;
      ry += (my - ry) * 0.12;
      if (dotRef.current)  { dotRef.current.style.left  = mx + 'px'; dotRef.current.style.top  = my + 'px'; }
      if (ringRef.current) { ringRef.current.style.left = rx + 'px'; ringRef.current.style.top = ry + 'px'; }
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      document.body.style.cursor = 'default';
      document.removeEventListener('mousemove', move);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div className="cursor" ref={dotRef}><div className="cursor-dot" /></div>
      <div className="cursor" ref={ringRef}><div className="cursor-ring" /></div>
    </>
  );
}
