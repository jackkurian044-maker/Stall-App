import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2, CheckCircle2 } from "lucide-react";
import { db } from "./firebase";
import { COLORS } from "./constants";

const money = (value) => Number.isFinite(Number(value)) ? "₹" + Number(value).toFixed(0) : "Price on request";

export function DirectOrderingPage({ listingId, onBack }) {
  const [listing,setListing]=useState(null), [items,setItems]=useState([]), [cart,setCart]=useState({});
  const [loading,setLoading]=useState(true), [placing,setPlacing]=useState(false), [placed,setPlaced]=useState(null);
  const [customer,setCustomer]=useState({name:"",phone:"",type:"pickup",address:"",notes:""});

  useEffect(()=>{(async()=>{
    try {
      const s=await getDoc(doc(db,"vendors",listingId));
      if(!s.exists()){setLoading(false);return;}
      setListing({id:s.id,...s.data()});
      const q=query(collection(db,"vendors",listingId,"direct_menu"),orderBy("sortOrder","asc"));
      const ms=await getDocs(q); setItems(ms.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.active!==false));
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

  if(loading) return <div style={page}><div style={box}>Loading STall Direct…</div></div>;
  if(!listing) return <div style={page}><div style={box}><h2>Store not found</h2><button style={button} onClick={onBack}>Back</button></div></div>;
  if (!(listing.planKey === "growth_setup" || (listing.isPremium && listing.subscriptionTier === "growth_setup"))) return <div style={page}><div style={{...box,maxWidth:560,margin:"40px auto"}}><h2>STall Direct is not active</h2><p style={muted}>This store needs an eligible STall Growth plan before customers can order or book directly.</p><button style={button} onClick={onBack}>Back to store</button></div></div>;
  if(placed) return <div style={page}><div style={{...box,textAlign:"center",maxWidth:560,margin:"40px auto"}}><CheckCircle2 size={48} color={COLORS.teal}/><h1>Order received</h1><p style={muted}>Your order has been sent to {listing.name}. Order ID: <strong>{placed.id.slice(-8).toUpperCase()}</strong></p><p style={muted}>Payment: Pay at store.</p><button style={button} onClick={onBack}>Back to {listing.name}</button></div></div>;

  return <div style={page}><div style={{maxWidth:1000,margin:"0 auto",padding:"18px 14px 50px"}}>
    <button onClick={onBack} style={back}><ArrowLeft size={15}/> Back to store</button>
    <div style={{...box,marginBottom:12}}><div style={pill}>STall Direct</div><h1 style={{margin:"10px 0 4px"}}>{listing.name}</h1><p style={muted}>Order directly through STall.</p></div>
    {!items.length ? <div style={box}><h3>Online ordering is being set up</h3><p style={muted}>This store has not published its STall Direct menu yet.</p></div> :
    <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.4fr) minmax(300px,.8fr)",gap:12,alignItems:"start"}}>
      <section style={{...box}}><h2 style={{marginTop:0}}>Menu</h2>{items.map(i=><div key={i.id} style={item}><div><div style={{fontWeight:800}}>{i.name}</div>{i.description&&<div style={{fontSize:12,color:"#666",marginTop:3}}>{i.description}</div>}<div style={{fontWeight:800,marginTop:7}}>{money(i.price)}</div></div><div style={stepper}><button onClick={()=>setQty(i.id,-1)}><Minus size={14}/></button><b>{cart[i.id]||0}</b><button onClick={()=>setQty(i.id,1)}><Plus size={14}/></button></div></div>)}</section>
      <section style={{...box,position:"sticky",top:12}}><h2 style={{marginTop:0,display:"flex",gap:7,alignItems:"center"}}><ShoppingBag size={19}/> Your order</h2>
        {!cartItems.length?<p style={muted}>Add items from the menu.</p>:<>{cartItems.map(i=><div key={i.id} style={{display:"flex",justifyContent:"space-between",gap:8,padding:"7px 0"}}><span>{i.name} × {i.qty}</span><span>{money((Number(i.price)||0)*i.qty)}</span></div>)}<div style={totalRow}><b>Total</b><b>{money(total)}</b></div>
        <form onSubmit={placeOrder}><input required placeholder="Your name" value={customer.name} onChange={e=>setCustomer({...customer,name:e.target.value})} style={input}/><input required placeholder="Phone number" value={customer.phone} onChange={e=>setCustomer({...customer,phone:e.target.value})} style={input}/><select value={customer.type} onChange={e=>setCustomer({...customer,type:e.target.value})} style={input}><option value="pickup">Pickup</option><option value="delivery">Delivery</option></select>{customer.type==="delivery"&&<textarea required placeholder="Delivery address" value={customer.address} onChange={e=>setCustomer({...customer,address:e.target.value})} style={{...input,minHeight:70}}/>}<textarea placeholder="Notes (optional)" value={customer.notes} onChange={e=>setCustomer({...customer,notes:e.target.value})} style={{...input,minHeight:60}}/><button disabled={placing} style={{...button,width:"100%",justifyContent:"center"}}>{placing?"Sending…":"Place order"}</button></form></>}
      </section>
    </div>}
  </div></div>;
}

export function DirectMenuManager({ listingId, user, onBack }) {
  const [listing,setListing]=useState(null),[items,setItems]=useState([]),[form,setForm]=useState({name:"",description:"",price:"",sortOrder:0}),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
  useEffect(()=>{(async()=>{try{const s=await getDoc(doc(db,"vendors",listingId));if(!s.exists()){setLoading(false);return;}const v={id:s.id,...s.data()};if(v.ownerId!==user?.uid){setLoading(false);return;}setListing(v);const ms=await getDocs(query(collection(db,"vendors",listingId,"direct_menu"),orderBy("sortOrder","asc")));setItems(ms.docs.map(d=>({id:d.id,...d.data()})));}finally{setLoading(false);}})()},[listingId,user]);
  async function addItem(e){e.preventDefault();if(!form.name.trim())return;setSaving(true);try{const r=await addDoc(collection(db,"vendors",listingId,"direct_menu"),{name:form.name.trim(),description:form.description.trim(),price:Number(form.price)||0,sortOrder:Number(form.sortOrder)||0,active:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});setItems(x=>[...x,{id:r.id,...form,price:Number(form.price)||0,sortOrder:Number(form.sortOrder)||0,active:true}].sort((a,b)=>a.sortOrder-b.sortOrder));setForm({name:"",description:"",price:"",sortOrder:items.length+1});}finally{setSaving(false);}}
  async function removeItem(id){await deleteDoc(doc(db,"vendors",listingId,"direct_menu",id));setItems(x=>x.filter(i=>i.id!==id));}
  if(loading)return <div style={page}><div style={box}>Loading…</div></div>;
  if(!listing)return <div style={page}><div style={box}>You do not have access to this menu.</div></div>;
  if (!(listing.planKey === "growth_setup" || (listing.isPremium && listing.subscriptionTier === "growth_setup")))return <div style={page}><div style={box}><h3>STall Direct is available on the eligible Growth plan.</h3></div></div>;
  return <div style={page}><div style={{maxWidth:820,margin:"0 auto",padding:20}}><button onClick={onBack} style={back}><ArrowLeft size={15}/> Back</button><div style={box}><div style={pill}>STall Direct · Menu</div><h1>{listing.name}</h1><p style={muted}>Add the items customers can order directly from your STall page.</p><form onSubmit={addItem} style={{display:"grid",gap:8}}><input required placeholder="Item name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={input}/><input placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} style={input}/><input required type="number" min="0" placeholder="Price" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} style={input}/><button disabled={saving} style={button}>{saving?"Adding…":"Add menu item"}</button></form></div><div style={{...box,marginTop:12}}>{items.map(i=><div key={i.id} style={item}><div><b>{i.name}</b><div style={{fontSize:12,color:"#666"}}>{i.description}</div><div style={{fontWeight:800,marginTop:4}}>{money(i.price)}</div></div><button onClick={()=>removeItem(i.id)} style={{background:"none",border:0,cursor:"pointer",color:COLORS.brick}}><Trash2 size={16}/></button></div>)}{!items.length&&<p style={muted}>No menu items yet.</p>}</div></div></div>;
}

const page={minHeight:"100vh",background:"#f7f3eb",color:COLORS.ink},box={background:"#fff",border:"2px solid "+COLORS.ink,borderRadius:16,padding:20,boxShadow:"0 8px 25px rgba(0,0,0,.05)"},button={display:"inline-flex",alignItems:"center",gap:7,background:COLORS.ink,color:"#fff",border:0,borderRadius:9,padding:"11px 15px",fontWeight:800,cursor:"pointer"},back={background:"transparent",border:0,padding:"4px 0 14px",color:"#666",cursor:"pointer",display:"flex",gap:6,alignItems:"center"},pill={display:"inline-flex",padding:"5px 9px",borderRadius:999,background:COLORS.ink,color:"#fff",fontSize:10,fontWeight:900},item={display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",padding:"13px 0",borderBottom:"1px solid #eee"},stepper={display:"flex",alignItems:"center",gap:10},totalRow={display:"flex",justifyContent:"space-between",borderTop:"2px solid "+COLORS.ink,paddingTop:10,marginTop:8},input={width:"100%",boxSizing:"border-box",padding:"10px 11px",border:"1.5px solid #bbb",borderRadius:8,font: "inherit",background:"#fff"},muted={color:"#666",lineHeight:1.5};
