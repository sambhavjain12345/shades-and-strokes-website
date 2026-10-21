import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArtistAPI } from '../services/api';

const FALLBACK_ARTISTS = [
  { id: 1, name: 'Arjun Sharma', location: 'Mumbai, India', bio: 'Expressive oil paintings inspired by the landscapes of western India.', product_count: 4 },
  { id: 2, name: 'Kavya Nair', location: 'Kerala, India', bio: 'Botanically inspired watercolours and quiet coastal studies.', product_count: 2 },
  { id: 3, name: 'Rohan Das', location: 'Delhi, India', bio: 'Mixed-media works exploring urban memory and cultural identity.', product_count: 2 },
  { id: 4, name: 'Meera Pillai', location: 'Bangalore, India', bio: 'Sculpture in bronze and reclaimed wood rooted in South Asian mythology.', product_count: 1 },
  { id: 5, name: 'Vikram Sood', location: 'Jaipur, India', bio: 'Charcoal and graphite studies of disappearing urban spaces.', product_count: 2 },
];

export default function Artists() {
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    ArtistAPI.getPublic()
      .then(data => active && setArtists(data.artists || []))
      .catch(() => active && setArtists(FALLBACK_ARTISTS))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return (
    <div className="page-wrap">
      <div style={{ marginBottom:'3rem', paddingBottom:'2rem', borderBottom:'.5px solid var(--border)' }}>
        <div className="page-label">The Makers</div>
        <h1 className="page-title">Meet the <em>Artists</em></h1>
      </div>

      {loading ? (
        <div style={{ padding:'5rem', textAlign:'center', color:'var(--muted)', fontSize:'.65rem', letterSpacing:'.2em', textTransform:'uppercase' }}>Loading artists…</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:'1px', background:'var(--border)' }}>
          {artists.map((artist, index) => {
            const initials = artist.name.split(' ').map(word => word[0]).join('').slice(0, 2);
            return (
              <article key={artist.id} style={{ background:'var(--surface2)', padding:'2.4rem', minHeight:'280px', display:'flex', flexDirection:'column' }}>
                <div style={{ width:'64px', height:'64px', border:'.5px solid var(--border2)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--gold)', fontFamily:"'Cormorant Garamond',serif", fontSize:'1.3rem', marginBottom:'1.5rem' }}>
                  {initials || String(index + 1).padStart(2, '0')}
                </div>
                <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontWeight:300, fontSize:'1.6rem', color:'var(--cream)', marginBottom:'.4rem' }}>{artist.name}</h2>
                <div style={{ fontSize:'.55rem', letterSpacing:'.18em', textTransform:'uppercase', color:'var(--gold3)', marginBottom:'1.2rem' }}>{artist.location || 'India'}</div>
                <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'.95rem', lineHeight:1.7, color:'var(--muted)', flex:1 }}>{artist.bio || 'Discover original works from this artist.'}</p>
                <Link to={`/shop?search=${encodeURIComponent(artist.name)}`} style={{ marginTop:'1.5rem', color:'var(--gold)', fontSize:'.58rem', letterSpacing:'.18em', textTransform:'uppercase', textDecoration:'none' }}>
                  View {Number(artist.product_count) || 0} work{Number(artist.product_count) === 1 ? '' : 's'} →
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
