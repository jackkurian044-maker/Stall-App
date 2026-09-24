import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2, CheckCircle2 } from "lucide-react";
import { db } from "./firebase";
import { COLORS } from "./constants";

const money = (value) => Number.isFinite(Number(value)) ? "₹" + Number(value).toFixed(0) : "Price on request";

export function DirectOrderingPage({ listingId, onBack, embedded = false }) {
  const [listing,setListing]=useState(null), [items,setItems]=useState([]), [cart,setCart]=useState({});
  const [loading,setLoading]=useState(true), [placing,setPlacing]=useState(false), [placed,setPlaced]=useState(null);
  const [customer,setCustomer]=useState({name:"",phone:"",type:"pickup",address:"",notes:""});

  useEffect(()=>{(async()=>{
    try {
      const s=await getDoc(doc(db,"vendors",listingId));
      if(!s.exists()){setLoading(false);return;}
      setListing({id:s.id,...s.data()});
      const q=query(collection(db,"vendors",listingId,"direct_menu"),orderBy("sortOrder","asc"));
      const ms=await getDocs(q);
      setItems(ms.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.active!==false));
    } catch(e){ console.error(e); } finally { setLoading(false); }
  })()},[listingId]);

  const cartItems=useMemo(()=>items.filter(i=>cart[i.id]).map(i=>({...i,qty:cart[i.id]})),[items,cart]);
  const total=cartItems.reduce((s,i)=>s+(Number(i.price)||0)*i.qty,0);
  const setQty=(id,delta)=>setCart(c=>{const n=(c[id]||0)+delta; const next={...c}; if(n<=0) delete next[id]; else next[id]=n; return next;});

  async function placeOrder(e){
    e.preventDefault();
    if(!cartItems.length || !customer.name.trim() || !customer.phone.trim()) return;
    if(customer.type==="delivery" && !customer.address.trim()) return;
    setPlacing(true);
    try{
      const ref=await addDoc(collection(db,"direct_orders"),{
        vendorId:listingId, vendorName:listing.name||"", customerName:customer.name.trim(),
        customerPhone:customer.phone.trim(), fulfillmentType:customer.type,
        deliveryAddress:customer.type==="delivery"?customer.address.trim():"", notes:customer.notes.trim(),
        items:cartItems.map(i=>({itemId:i.id,name:i.name,price:Number(i.price)||0,qty:i.qty})),
        subtotal:total, total, paymentMethod:"pay_at_store", paymentStatus:"pending",
        status:"new", createdAt:serverTimestamp()
      });
      setPlaced({id:ref.id}); setCart({});
    }catch(err){ alert("Could not place the order. Please try again."); }
    finally{setPlacing(false);}
  }

  if(loading) return <div style={embedded ? embeddedShell : page}><div style={embeddedCard}>Loading menu…</div></div>;
  if(!listing) return <div style={embedded ? embeddedShell : page}><div style={embeddedCard}><h2>Store not found</h2><button style={button} onClick={onBack}>Back</button></div></div>;
  if (!(listing.planKey === "growth_setup" || (listing.isPremium && listing.subscriptionTier === "growth_setup") || listing.testGrowthSetupActive === true || listing.testGrowthSetupActive === true)) return <div style={embedded ? embeddedShell : page}><div style={embeddedCard}><h2>STall Direct is not active</h2><p style={muted}>This store needs an eligible STall Growth plan before customers can order or book directly.</p><button style={button} onClick={onBack}>Back to store</button></div></div>;

  if(placed) return <section id={embedded ? "stall-direct-order" : undefined} className="direct-order-shell" style={embedded ? embeddedShell : page}>
    <div style={embeddedSuccess}>
      <div style={successIcon}><CheckCircle2 size={28}/></div>
      <div style={eyebrow}>ORDER CONFIRMED</div>
      <h2 style={{margin:"7px 0 8px",fontSize:"clamp(26px,4vw,38px)",letterSpacing:"-.04em"}}>Order received</h2>
      <p style={{...muted,maxWidth:560,margin:"0 auto 12px"}}>Your order has been received by {listing.name}. The store can now prepare it for you.</p>
      <div style={orderMeta}>
        <span>Order <strong>#{placed.id.slice(-8).toUpperCase()}</strong></span>
        <span>•</span>
        <span>Pay at store</span>
      </div>
      <button style={{...button,marginTop:18}} onClick={onBack}>Done · Back to {listing.name}</button>
    </div>
  </section>;

  const content = <section id={embedded ? "stall-direct-order" : undefined} className="direct-order-shell" style={embedded ? embeddedShell : page}>
    {!embedded && <div style={{maxWidth:1000,margin:"0 auto",padding:"18px 14px 50px"}}>
      <button onClick={onBack} style={back}><ArrowLeft size={15}/> Back to store</button>
    </div>}
    <div style={embedded ? embeddedInner : {maxWidth:1000,margin:"0 auto",padding:"0 14px 50px"}}>
      <header className="direct-header" style={directHeader}>
        <div>
          <div style={eyebrow}><ShoppingBag size={14}/> STALL DIRECT</div>
          <h2 className="direct-title" style={directTitle}>Order directly from the menu</h2>
          <p className="direct-subtitle" style={directSubtitle}>Choose what you want, review your order, and send it straight to the store.</p>
        </div>
        <div className="direct-badge" style={directBadge}>PAY AT STORE</div>
      </header>

      {!items.length ? <div style={emptyState}><div style={emptyIcon}><ShoppingBag size={22}/></div><h3>Ordering is being set up</h3><p style={muted}>The store has not published its STall Direct menu yet.</p></div> :
      <div className="direct-order-grid" style={directGrid}>
        <section style={menuCard}>
          <div style={cardHeader}>
            <div><div style={cardEyebrow}>MENU</div><h3 style={cardTitle}>Available to order</h3></div>
            <span style={itemCount}>{items.length} {items.length===1?"item":"items"}</span>
          </div>
          <div>
            {items.map(i=><article key={i.id} className="direct-menu-item" style={menuItem}>
              <div style={{minWidth:0}}>
                <div style={menuItemName}>{i.name}</div>
                {i.description && <div className="menu-item-description" style={menuItemDescription}>{i.description}</div>}
                <div style={menuItemPrice}>{money(i.price)}</div>
              </div>
              <div className="stepper" style={stepper}>
                <button aria-label={"Decrease "+i.name} onClick={()=>setQty(i.id,-1)} style={stepButton}><Minus size={14}/></button>
                <span style={qty}>{cart[i.id]||0}</span>
                <button aria-label={"Increase "+i.name} onClick={()=>setQty(i.id,1)} style={stepButton}><Plus size={14}/></button>
              </div>
            </article>)}
          </div>
        </section>

        <aside style={orderCard}>
          <div style={cardHeader}>
            <div><div style={cardEyebrow}>CHECKOUT</div><h3 style={cardTitle}>Your order</h3></div>
            <ShoppingBag size={18} color={COLORS.teal}/>
          </div>

          {!cartItems.length ? <div style={cartEmpty}><p style={{margin:0}}>Select an item to begin.</p><span>Quantity and total will appear here.</span></div> :
          <>
            <div style={cartList}>
              {cartItems.map(i=><div key={i.id} style={cartRow}><div><strong>{i.name}</strong><span>× {i.qty}</span></div><strong>{money((Number(i.price)||0)*i.qty)}</strong></div>)}
            </div>
            <div style={totalRowPremium}><span>Total</span><strong>{money(total)}</strong></div>
            <form onSubmit={placeOrder} style={checkoutForm}>
              <div style={formLabel}>YOUR DETAILS</div>
              <input className="premium-input" required placeholder="Full name" value={customer.name} onChange={e=>setCustomer({...customer,name:e.target.value})} style={premiumInput}/>
              <input className="premium-input" required placeholder="Phone number" inputMode="tel" value={customer.phone} onChange={e=>setCustomer({...customer,phone:e.target.value})} style={premiumInput}/>
              <div className="segmented" style={segmented}>
                <button type="button" onClick={()=>setCustomer({...customer,type:"pickup"})} style={customer.type==="pickup"?segmentActive:segment}>Pickup</button>
                <button type="button" onClick={()=>setCustomer({...customer,type:"delivery"})} style={customer.type==="delivery"?segmentActive:segment}>Delivery</button>
              </div>
              {customer.type==="delivery" && <textarea className="premium-input" required placeholder="Delivery address" value={customer.address} onChange={e=>setCustomer({...customer,address:e.target.value})} style={{...premiumInput,minHeight:72,resize:"vertical"}}/>}
              <textarea className="premium-input" placeholder="Notes (optional)" value={customer.notes} onChange={e=>setCustomer({...customer,notes:e.target.value})} style={{...premiumInput,minHeight:58,resize:"vertical"}}/>
              <button className="premium-place-button" disabled={placing} style={{...premiumPlaceButton,opacity:placing?.7:1}}>{placing?"Sending order…":"Place order · "+money(total)}</button>
            </form>
          </>}
        </aside>
      </div>}
    </div>
  </section>;

  return content;
}

export function DirectMenuManager({ listingId, user, onBack }) {
  const [listing,setListing]=useState(null),[items,setItems]=useState([]),[form,setForm]=useState({name:"",description:"",price:"",sortOrder:0}),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
  useEffect(()=>{(async()=>{try{const s=await getDoc(doc(db,"vendors",listingId));if(!s.exists()){setLoading(false);return;}const v={id:s.id,...s.data()};if(v.ownerId!==user?.uid){setLoading(false);return;}setListing(v);const ms=await getDocs(query(collection(db,"vendors",listingId,"direct_menu"),orderBy("sortOrder","asc")));setItems(ms.docs.map(d=>({id:d.id,...d.data()})));}finally{setLoading(false);}})()},[listingId,user]);
  async function addItem(e){e.preventDefault();if(!form.name.trim())return;setSaving(true);try{const r=await addDoc(collection(db,"vendors",listingId,"direct_menu"),{name:form.name.trim(),description:form.description.trim(),price:Number(form.price)||0,sortOrder:Number(form.sortOrder)||0,active:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});setItems(x=>[...x,{id:r.id,...form,price:Number(form.price)||0,sortOrder:Number(form.sortOrder)||0,active:true}].sort((a,b)=>a.sortOrder-b.sortOrder));setForm({name:"",description:"",price:"",sortOrder:items.length+1});}finally{setSaving(false);}}
  async function removeItem(id){await deleteDoc(doc(db,"vendors",listingId,"direct_menu",id));setItems(x=>x.filter(i=>i.id!==id));}
  if(loading)return <div style={page}><div style={box}>Loading…</div></div>;
  if(!listing)return <div style={page}><div style={box}>You do not have access to this menu.</div></div>;
  if (!(listing.planKey === "growth_setup" || (listing.isPremium && listing.subscriptionTier === "growth_setup") || listing.testGrowthSetupActive === true || listing.testGrowthSetupActive === true))return <div style={page}><div style={box}><h3>STall Direct is available on the eligible Growth plan.</h3></div></div>;
  return <div style={page}><div style={{maxWidth:820,margin:"0 auto",padding:20}}><button onClick={onBack} style={back}><ArrowLeft size={15}/> Back</button><div style={box}><div style={pill}>STall Direct · Menu</div><h1>{listing.name}</h1><p style={muted}>Add the items customers can order directly from your STall page.</p><form onSubmit={addItem} style={{display:"grid",gap:8}}><input required placeholder="Item name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={input}/><input placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} style={input}/><input required type="number" min="0" placeholder="Price" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} style={input}/><button disabled={saving} style={button}>{saving?"Adding…":"Add menu item"}</button></form></div><div style={{...box,marginTop:12}}>{items.map(i=><div key={i.id} style={item}><div><b>{i.name}</b><div style={{fontSize:12,color:"#666"}}>{i.description}</div><div style={{fontWeight:800,marginTop:4}}>{money(i.price)}</div></div><button onClick={()=>removeItem(i.id)} style={{background:"none",border:0,cursor:"pointer",color:COLORS.brick}}><Trash2 size={16}/></button></div>)}{!items.length&&<p style={muted}>No menu items yet.</p>}</div></div></div>;
}

const embeddedShell={marginTop:20,background:"linear-gradient(135deg,#f3eee4 0%,#fffdf8 48%,#edf5f2 100%)",borderRadius:30,padding:"28px",border:"1px solid rgba(23,23,23,.08)",boxShadow:"0 24px 70px rgba(23,23,23,.09)",color:COLORS.ink};
const embeddedInner={maxWidth:1120,margin:"0 auto"};
const embeddedCard={maxWidth:620,margin:"0 auto",padding:"30px",background:"#fff",borderRadius:22,boxShadow:"0 14px 45px rgba(0,0,0,.07)",textAlign:"center"};
const embeddedSuccess={maxWidth:650,margin:"0 auto",padding:"48px 24px",background:"#fff",borderRadius:24,textAlign:"center",boxShadow:"0 16px 45px rgba(0,0,0,.07)"};
const orderMeta={display:"flex",justifyContent:"center",alignItems:"center",flexWrap:"wrap",gap:9,marginTop:14,padding:"11px 14px",borderRadius:12,background:"#f7f3eb",color:"#4f4f4f",fontSize:12,fontWeight:800};
const successIcon={width:56,height:56,borderRadius:"50%",margin:"0 auto 14px",display:"flex",alignItems:"center",justifyContent:"center",background:"#e7f5ef",color:COLORS.teal};
const eyebrow={display:"inline-flex",alignItems:"center",gap:6,fontSize:10,letterSpacing:".14em",fontWeight:950,color:COLORS.teal};
const directHeader={display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:20,marginBottom:22};
const directTitle={margin:"7px 0 6px",fontSize:"clamp(28px,4vw,42px)",lineHeight:1,letterSpacing:"-.045em",fontWeight:950};
const directSubtitle={margin:0,maxWidth:650,color:"#68635d",fontSize:14,lineHeight:1.6};
const directBadge={flex:"0 0 auto",padding:"8px 11px",borderRadius:999,background:"#173d35",color:"#fff",fontSize:9,letterSpacing:".1em",fontWeight:900};
const directGrid={display:"grid",gridTemplateColumns:"minmax(0,1.45fr) minmax(320px,.8fr)",gap:16,alignItems:"start"};
const menuCard={background:"rgba(255,255,255,.9)",border:"1px solid rgba(23,23,23,.09)",borderRadius:24,padding:"22px",boxShadow:"0 12px 35px rgba(0,0,0,.05)"};
const orderCard={background:"#173d35",color:"#fff",borderRadius:24,padding:"22px",position:"sticky",top:18,boxShadow:"0 18px 45px rgba(23,23,23,.16)"};
const cardHeader={display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:8};
const cardEyebrow={fontSize:9,letterSpacing:".13em",fontWeight:950,color:"var(--teal)"};
const cardTitle={margin:"3px 0 0",fontSize:22,letterSpacing:"-.035em",fontWeight:950};
const itemCount={fontSize:10,fontWeight:850,color:"#777",padding:"6px 9px",borderRadius:999,background:"#f5f2ec"};
const menuItem={display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,padding:"17px 0",borderTop:"1px solid rgba(23,23,23,.08)"};
const menuItemName={fontSize:16,fontWeight:900,letterSpacing:"-.02em"};
const menuItemDescription={fontSize:12,color:"#716d66",marginTop:4,lineHeight:1.45,maxWidth:560};
const menuItemPrice={fontSize:14,fontWeight:950,marginTop:7,color:"#8a5d15"};
const stepper={display:"flex",alignItems:"center",gap:9,flex:"0 0 auto"};
const stepButton={width:34,height:34,borderRadius:10,border:"1px solid rgba(23,23,23,.14)",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:COLORS.ink};
const qty={minWidth:18,textAlign:"center",fontWeight:950};
const cartEmpty={padding:"18px 0",borderTop:"1px solid rgba(255,255,255,.15)",color:"rgba(255,255,255,.72)",fontSize:13};
const cartEmptySpan={fontSize:11,display:"block",marginTop:5,opacity:.65};
const cartList={borderTop:"1px solid rgba(255,255,255,.15)",paddingTop:5};
const cartRow={display:"flex",justifyContent:"space-between",gap:10,padding:"10px 0",fontSize:13};
const totalRowPremium={display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"1px solid rgba(255,255,255,.2)",paddingTop:14,marginTop:5,fontSize:13};
const checkoutForm={display:"grid",gap:9,marginTop:18};
const formLabel={fontSize:9,letterSpacing:".13em",fontWeight:950,color:"rgba(255,255,255,.6)",marginBottom:2};
const premiumInput={width:"100%",boxSizing:"border-box",padding:"11px 12px",border:"1px solid rgba(255,255,255,.2)",borderRadius:11,font:"inherit",background:"rgba(255,255,255,.1)",color:"#fff",outline:"none"};
const segmented={display:"grid",gridTemplateColumns:"1fr 1fr",gap:7};
const segment={border:"1px solid rgba(255,255,255,.18)",background:"transparent",color:"rgba(255,255,255,.75)",borderRadius:10,padding:"10px",fontWeight:850,cursor:"pointer"};
const segmentActive={...segment,background:"#fff",color:"#173d35"};
const premiumPlaceButton={border:0,borderRadius:12,padding:"13px 14px",background:"#d8a23a",color:"#171717",fontWeight:950,cursor:"pointer",fontSize:13};
const emptyState={padding:"42px 24px",background:"#fff",borderRadius:22,textAlign:"center"};
const emptyIcon={width:48,height:48,borderRadius:16,margin:"0 auto 10px",display:"flex",alignItems:"center",justifyContent:"center",background:"#f2ede4",color:COLORS.teal};
const page={minHeight:"100vh",background:"#f7f3eb",color:COLORS.ink},box={background:"#fff",border:"2px solid "+COLORS.ink,borderRadius:16,padding:20,boxShadow:"0 8px 25px rgba(0,0,0,.05)"},button={display:"inline-flex",alignItems:"center",gap:7,background:COLORS.ink,color:"#fff",border:0,borderRadius:9,padding:"11px 15px",fontWeight:800,cursor:"pointer"},back={background:"transparent",border:0,padding:"4px 0 14px",color:"#666",cursor:"pointer",display:"flex",gap:6,alignItems:"center"},pill={display:"inline-flex",padding:"5px 9px",borderRadius:999,background:COLORS.ink,color:"#fff",fontSize:10,fontWeight:900},item={display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",padding:"13px 0",borderBottom:"1px solid #eee"},legacyStepper={display:"flex",alignItems:"center",gap:10},totalRow={display:"flex",justifyContent:"space-between",borderTop:"2px solid "+COLORS.ink,paddingTop:10,marginTop:8},input={width:"100%",boxSizing:"border-box",padding:"10px 11px",border:"1.5px solid #bbb",borderRadius:8,font: "inherit",background:"#fff"},muted={color:"#666",lineHeight:1.5};
