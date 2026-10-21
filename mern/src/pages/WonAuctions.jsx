import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {AuctionsAPI,getBgClass} from '../services/api';
import {useToast} from '../hooks/useToast';

const money=value=>`₹ ${Number(value||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;

export default function WonAuctions(){
  const{showToast}=useToast();const[auctions,setAuctions]=useState([]);const[loading,setLoading]=useState(true);const[busy,setBusy]=useState(null);const[error,setError]=useState('');
  const load=()=>AuctionsAPI.getWon().then(data=>setAuctions(data.auctions||[])).catch(err=>setError(err.message)).finally(()=>setLoading(false));
  useEffect(()=>{load();},[]); // eslint-disable-line react-hooks/exhaustive-deps
  const decline=async auction=>{if(!window.confirm(auction.active_bidder_rank===1?'Declining as the original winner forfeits your deposit. Continue?':'Decline this offer and refund your deposit?'))return;setBusy(auction.id);try{const data=await AuctionsAPI.decline(auction.id);showToast(data.message,'success');await load();}catch(err){showToast(err.message,'error');}finally{setBusy(null);}};
  return <main className="page-wrap"><div className="page-label">Auction Settlement</div><h1 className="page-title">Auction <em>Activity</em></h1><p style={{color:'var(--muted)',marginBottom:'2.5rem'}}>Payment offers, backup-bidder positions, and deposit outcomes.</p>
    {loading&&<div style={{color:'var(--muted)'}}>Loading auction activity…</div>}{error&&<div style={{color:'#c05050'}}>{error}</div>}{!loading&&!error&&auctions.length===0&&<div style={{border:'.5px solid var(--border)',padding:'2rem',color:'var(--muted)'}}>You have no settled auction activity. <Link to="/auctions" style={{color:'var(--gold)'}}>Browse active auctions</Link></div>}
    <div style={{display:'grid',gap:'1rem'}}>{auctions.map(auction=><article key={auction.id} style={{display:'grid',gridTemplateColumns:'110px 1fr auto',gap:'1.5rem',alignItems:'center',border:'.5px solid var(--border)',padding:'1rem'}}>
      <div className={!auction.image_url?getBgClass(auction.product_id):''} style={{height:'110px',backgroundImage:auction.image_url?`url(${auction.image_url})`:undefined,backgroundSize:'cover',backgroundPosition:'center'}}/>
      <div><div style={{fontSize:'.52rem',letterSpacing:'.22em',textTransform:'uppercase',color:'var(--gold3)'}}>{auction.is_active_buyer?(auction.settlement_status==='SECOND_CHANCE'?'SECOND_CHANCE':'AWAITING_PAYMENT'):auction.candidate_status||auction.settlement_status}</div><Link to={`/product/${auction.product_id}`} style={{display:'block',fontFamily:'Cormorant Garamond,serif',fontSize:'1.5rem',color:'var(--cream)',textDecoration:'none',margin:'.35rem 0'}}>{auction.title}</Link><div style={{color:'var(--muted)',fontSize:'.7rem'}}>{auction.artist_name}{auction.bidder_rank?` · Bidder #${auction.bidder_rank}`:''}</div><div style={{color:'var(--gold)',marginTop:'.6rem'}}>Your final bid: {money(auction.final_bid||auction.active_bid_amount||auction.winning_bid)}</div><div style={{color:'var(--muted)',fontSize:'.65rem'}}>Deposit: {money(auction.deposit_amount)} · {auction.deposit_status}</div>{auction.is_active_buyer&&<><div style={{color:'var(--cream)',fontSize:'.7rem',marginTop:'.4rem'}}>Balance due: {money(auction.amount_due)}</div><div style={{color:'var(--muted)',fontSize:'.65rem'}}>Deadline: {new Date(auction.payment_due_at).toLocaleString()}</div></>}{auction.order_number&&<div style={{color:'var(--muted)',fontSize:'.65rem',marginTop:'.35rem'}}>Order {auction.order_number}</div>}</div>
      <div style={{display:'flex',flexDirection:'column',gap:'.6rem'}}>{auction.is_active_buyer&&auction.status==='payment_pending'?<><Link className="btn-primary" to={`/checkout?auction=${auction.id}`}>Pay Balance</Link><button disabled={busy===auction.id} onClick={()=>decline(auction)} style={{background:'transparent',border:'.5px solid var(--border)',color:'var(--muted)',padding:'.7rem'}}>Decline Offer</button></>:auction.status==='sold'?<Link to="/orders" style={{color:'var(--gold)',textDecoration:'none',fontSize:'.62rem',letterSpacing:'.15em',textTransform:'uppercase'}}>View Order</Link>:null}</div>
    </article>)}</div>
  </main>;
}
