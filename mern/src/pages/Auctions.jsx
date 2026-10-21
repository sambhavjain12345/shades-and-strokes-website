import { useEffect, useState } from 'react';
import ProductCard from '../components/common/ProductCard';
import { AuctionsAPI } from '../services/api';

const remaining = (startsAt, endsAt) => {
  const now = Date.now();
  const target = now < new Date(startsAt).getTime() ? new Date(startsAt).getTime() : new Date(endsAt).getTime();
  const seconds = Math.max(0, Math.floor((target - now) / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${days ? `${days}d ` : ''}${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
};

export default function Auctions() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, tick] = useState(0);

  useEffect(() => {
    AuctionsAPI.getActive().then(data => setAuctions(data.auctions || [])).catch(() => setAuctions([])).finally(() => setLoading(false));
    const timer = setInterval(() => tick(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  return <main style={{ padding:'10rem 5vw 6rem', minHeight:'80vh' }}>
    <div style={{ maxWidth:'1280px', margin:'0 auto' }}>
      <div style={{ fontSize:'.56rem', letterSpacing:'.35em', textTransform:'uppercase', color:'var(--gold3)', marginBottom:'1rem' }}>Live & Upcoming</div>
      <h1 style={{ fontFamily:'Cormorant Garamond,serif', color:'var(--cream)', fontWeight:300, fontSize:'clamp(2.6rem,6vw,5rem)', margin:'0 0 1rem' }}>Art <em style={{ color:'var(--gold)' }}>Auctions</em></h1>
      <p style={{ color:'var(--muted)', maxWidth:'620px', lineHeight:1.8, marginBottom:'3rem' }}>Discover selected works offered by auction. Open an artwork to review bidding details and place your bid.</p>
      {loading ? <p style={{ color:'var(--muted)' }}>Loading auctions…</p> : auctions.length === 0 ? <p style={{ color:'var(--muted)' }}>There are no active auctions right now.</p> :
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:'2rem' }}>
          {auctions.map(auction => <div key={auction.auction_id}>
            <ProductCard product={auction} />
            <div style={{ border:'.5px solid var(--border)', borderTop:0, padding:'.8rem 1rem', display:'flex', justifyContent:'space-between', color:'var(--gold3)', fontSize:'.58rem', letterSpacing:'.12em', textTransform:'uppercase' }}>
              <span>{auction.status === 'scheduled' ? 'Starts in' : 'Ends in'}</span><span>{remaining(auction.starts_at, auction.ends_at)}</span>
            </div>
          </div>)}
        </div>}
    </div>
  </main>;
}
