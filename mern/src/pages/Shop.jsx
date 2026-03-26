import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ProductsAPI } from '../services/api';
import ProductCard from '../components/common/ProductCard';

const FILTERS = [
  { label: 'All',         value: 'all' },
  { label: 'Painting',    value: 'paintings' },
  { label: 'Sculpture',   value: 'sculptures' },
  { label: 'Sketch',      value: 'sketches' },
  { label: 'Watercolour', value: 'watercolours' },
];

const SORTS = [
  { label: 'Featured',        value: 'newest'     },
  { label: 'Price: Low–High', value: 'price_asc'  },
  { label: 'Price: High–Low', value: 'price_desc' },
  { label: 'Newest',          value: 'newest'     },
];

const ALL_PRODUCTS = [
  { id:1,  title:'Molten Hour',    medium:'Oil Painting',  price:52000, tag:'Featured' },
  { id:2,  title:'Cerulean Deep',  medium:'Acrylic',        price:28500, tag:''        },
  { id:3,  title:'Emerald Hush',   medium:'Watercolour',    price:14000, tag:'New'     },
  { id:4,  title:'Crimson Quiet',  medium:'Oil on Board',   price:19000, tag:''        },
  { id:5,  title:'Violet Reverie', medium:'Mixed Media',    price:22000, tag:''        },
  { id:6,  title:'Amber Dusk',     medium:'Oil on Canvas',  price:38000, tag:'Featured'},
  { id:7,  title:'Midnight Drift', medium:'Charcoal',       price:12000, tag:''        },
  { id:8,  title:'Dusk Reverie',   medium:'Watercolour',    price:16500, tag:'New'     },
  { id:9,  title:'Silent Grove',   medium:'Acrylic',        price:31000, tag:''        },
  { id:10, title:'Bronze Ancestor',medium:'Bronze',         price:65000, tag:'Featured'},
  { id:11, title:'Paper City',     medium:'Graphite',       price:9500,  tag:''        },
  { id:12, title:'Ochre Plains',   medium:'Oil on Linen',   price:78000, tag:'New'     },
];

// Client-side filter for fallback mode
function filterFallback(list, search, category, sort) {
  let result = [...list];
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.medium.toLowerCase().includes(q)
    );
  }
  if (category && category !== 'all') {
    const map = { paintings:'oil|acrylic|linen|board|canvas', watercolours:'watercolour', sketches:'charcoal|graphite', sculptures:'bronze' };
    const pattern = map[category];
    if (pattern) result = result.filter(p => new RegExp(pattern,'i').test(p.medium));
  }
  if (sort === 'price_asc')  result.sort((a,b) => a.price - b.price);
  if (sort === 'price_desc') result.sort((a,b) => b.price - a.price);
  return result;
}

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState(searchParams.get('category') || 'all');
  const [sort,     setSort]     = useState('newest');
  const [page,     setPage]     = useState(1);
  const [cols,     setCols]     = useState(3);
  const [hasMore,  setHasMore]  = useState(false);
  const [localSearch, setLocalSearch] = useState(searchParams.get('search') || '');

  const searchQuery = searchParams.get('search') || '';

  const load = useCallback(async (reset = true) => {
    setLoading(true);
    const currentPage = reset ? 1 : page;
    const params = { sort, page: currentPage, limit: 12 };
    if (filter !== 'all') params.category = filter;
    if (searchQuery)      params.search   = searchQuery;

    try {
      const data = await ProductsAPI.getAll(params);
      setProducts(prev => reset ? data.products : [...prev, ...data.products]);
      setTotal(data.total);
      setHasMore(currentPage < data.pages);
      if (!reset) setPage(p => p + 1);
      else        setPage(2);
    } catch {
      // Backend offline — filter fallback data client-side
      const filtered = filterFallback(ALL_PRODUCTS, searchQuery, filter, sort);
      setProducts(reset ? filtered : prev => [...prev, ...filtered]);
      setTotal(filtered.length);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [filter, sort, searchQuery, page]);

  // Re-run whenever filter, sort or search changes
  useEffect(() => {
    setPage(1);
    load(true);
  }, [filter, sort, searchQuery]);

  // Sync local search input with URL param
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  const handleSearchSubmit = () => {
    const q = localSearch.trim();
    if (q) {
      setSearchParams({ search: q });
    } else {
      setSearchParams({});
    }
  };

  const handleFilterChange = (val) => {
    setFilter(val);
    // Keep search param if present
    const params = {};
    if (searchQuery)   params.search   = searchQuery;
    if (val !== 'all') params.category = val;
    setSearchParams(params);
  };

  const clearSearch = () => {
    setLocalSearch('');
    setSearchParams(filter !== 'all' ? { category: filter } : {});
  };

  const gridStyle = {
    display: 'grid',
    gap: '1px',
    background: 'var(--border)',
    gridTemplateColumns:
      cols === 2 ? '1fr 1fr' :
      cols === 4 ? 'repeat(4,1fr)' :
                   'repeat(3,1fr)',
  };

  return (
    <>
      {/* ── Page header ── */}
      <section style={{ padding:'9rem 5rem 4rem', position:'relative', zIndex:1, borderBottom:'.5px solid var(--border)' }}>
        <div style={{ fontSize:'.58rem', letterSpacing:'.38em', textTransform:'uppercase', color:'var(--gold3)', marginBottom:'.8rem', display:'flex', alignItems:'center', gap:'.9rem' }}>
          <span style={{ width:'20px', height:'.5px', background:'var(--gold3)', display:'inline-block' }}/>The Collection
        </div>
        <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(3rem,5vw,5rem)', fontWeight:300, color:'var(--cream)', lineHeight:1 }}>
          {searchQuery
            ? <>Results for <em style={{ fontStyle:'italic', color:'var(--gold)' }}>"{searchQuery}"</em></>
            : <>Original <em style={{ fontStyle:'italic', color:'var(--gold)' }}>Works</em></>}
        </h1>
        <div style={{ display:'flex', alignItems:'center', gap:'1.5rem', marginTop:'1.5rem' }}>
          <span style={{ fontSize:'.62rem', letterSpacing:'.2em', textTransform:'uppercase', color:'var(--muted)' }}>
            {loading ? 'Searching…' : `${total} work${total !== 1 ? 's' : ''} found`}
          </span>
          {searchQuery && (
            <button onClick={clearSearch}
              style={{ fontSize:'.56rem', letterSpacing:'.16em', textTransform:'uppercase', color:'var(--muted)', background:'none', border:'.5px solid var(--border)', padding:'.3rem .8rem', cursor:'none', fontFamily:"'Josefin Sans',sans-serif", transition:'all .3s' }}
              onMouseEnter={e=>{e.currentTarget.style.color='var(--gold)';e.currentTarget.style.borderColor='var(--border2)';}}
              onMouseLeave={e=>{e.currentTarget.style.color='var(--muted)';e.currentTarget.style.borderColor='var(--border)';}}>
              ✕ Clear search
            </button>
          )}
        </div>

        {/* ── Inline search bar on shop page ── */}
        <div style={{ display:'flex', marginTop:'2rem', maxWidth:'480px', border:'.5px solid var(--border2)' }}>
          <input
            type="text"
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearchSubmit()}
            placeholder="Search by title or medium…"
            style={{ flex:1, background:'rgba(201,168,76,.03)', border:'none', outline:'none', padding:'.8rem 1.2rem', fontFamily:"'Josefin Sans',sans-serif", fontSize:'.68rem', fontWeight:300, letterSpacing:'.1em', color:'var(--cream)', caretColor:'var(--gold)' }}
          />
          <button onClick={handleSearchSubmit}
            style={{ background:'var(--gold)', color:'var(--ink)', border:'none', padding:'.8rem 1.4rem', cursor:'none', fontFamily:"'Josefin Sans',sans-serif", fontSize:'.6rem', letterSpacing:'.2em', textTransform:'uppercase', fontWeight:400, transition:'background .3s', flexShrink:0 }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--gold2)'}
            onMouseLeave={e=>e.currentTarget.style.background='var(--gold)'}>
            Search
          </button>
        </div>
      </section>

      {/* ── Filter bar ── */}
      <div style={{ padding:'1.2rem 5rem', borderBottom:'.5px solid var(--border)', background:'var(--surface2)', position:'sticky', top:'68px', zIndex:100, display:'flex', alignItems:'center', gap:'2rem', flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:'.6rem', alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:'.54rem', letterSpacing:'.28em', textTransform:'uppercase', color:'var(--muted2)' }}>Medium</span>
          {FILTERS.map(f => (
            <button key={f.value} onClick={() => handleFilterChange(f.value)}
              style={{ fontSize:'.56rem', letterSpacing:'.18em', textTransform:'uppercase', padding:'.4rem .9rem', border:'.5px solid', cursor:'none', fontFamily:"'Josefin Sans',sans-serif", transition:'all .3s',
                borderColor: filter===f.value ? 'var(--border2)' : 'var(--border)',
                background:  filter===f.value ? 'rgba(201,168,76,.05)' : 'none',
                color:       filter===f.value ? 'var(--gold)' : 'var(--muted)' }}>
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ width:'.5px', height:'20px', background:'var(--border)', flexShrink:0 }} />

        <div style={{ display:'flex', alignItems:'center', gap:'.6rem' }}>
          <span style={{ fontSize:'.54rem', letterSpacing:'.28em', textTransform:'uppercase', color:'var(--muted2)' }}>Sort</span>
          <select value={sort} onChange={e => setSort(e.target.value)}
            style={{ background:'none', border:'none', outline:'none', fontFamily:"'Josefin Sans',sans-serif", fontSize:'.58rem', letterSpacing:'.14em', textTransform:'uppercase', color:'var(--muted)', cursor:'none', padding:'.4rem .6rem' }}>
            {SORTS.map(s => <option key={s.value+s.label} value={s.value} style={{ background:'var(--surface2)', color:'var(--cream)' }}>{s.label}</option>)}
          </select>
        </div>

        {/* Grid toggle */}
        <div style={{ marginLeft:'auto', display:'flex', gap:'.4rem' }}>
          {[2,3,4].map(c => (
            <button key={c} onClick={() => setCols(c)}
              style={{ width:'28px', height:'28px', border:'.5px solid', cursor:'none', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .3s',
                borderColor: cols===c ? 'var(--border2)' : 'var(--border)',
                background:  cols===c ? 'rgba(201,168,76,.05)' : 'none' }}>
              <span style={{ fontSize:'.5rem', color: cols===c ? 'var(--gold)' : 'var(--muted)' }}>{c}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Product grid ── */}
      <div style={{ padding:'3rem 5rem 6rem', position:'relative', zIndex:1 }}>
        {loading && products.length === 0 ? (
          <div style={{ textAlign:'center', padding:'6rem', fontSize:'.7rem', letterSpacing:'.2em', color:'var(--muted)', textTransform:'uppercase' }}>
            {searchQuery ? `Searching for "${searchQuery}"…` : 'Loading gallery…'}
          </div>
        ) : products.length === 0 ? (
          <div style={{ textAlign:'center', padding:'6rem', background:'var(--surface2)', border:'.5px solid var(--border)' }}>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.5rem', color:'var(--cream)', marginBottom:'.8rem' }}>
              No works found{searchQuery ? ` for "${searchQuery}"` : ''}
            </div>
            <div style={{ fontSize:'.62rem', letterSpacing:'.12em', color:'var(--muted)', marginBottom:'1.5rem' }}>
              Try a different search term or browse all works
            </div>
            <button className="btn-primary" onClick={clearSearch}>Browse All Works</button>
          </div>
        ) : (
          <>
            <div style={gridStyle}>
              {products.map(p => <ProductCard key={p.id} product={p} />)}
            </div>

            {hasMore && (
              <div style={{ textAlign:'center', padding:'3rem 0' }}>
                <button className="btn-primary" onClick={() => load(false)} style={{ opacity: loading ? 0.6 : 1 }}>
                  {loading ? 'Loading…' : 'Load More Works'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
