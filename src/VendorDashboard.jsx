import React, { useEffect, useRef, useState } from "react";
import {
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  getDocs, serverTimestamp,
} from "firebase/firestore";
import { Plus, Trash2, KeyRound, RefreshCw, Star, Zap, BarChart2, Eye, Phone, MessageCircle, Navigation } from "lucide-react";
import { db } from "./firebase";
import { CATEGORIES, COLORS } from "./constants";
import LocationSearch from "./LocationSearch";
import ImageUpload from "./ImageUpload";
import { autoRefreshStale, isRatingStale } from "./ratingSync";
import { uid, toDateInputValue } from "./geo";
import { findDuplicateVendor } from "./duplicateCheck";
import QuickOfferModal from "./QuickOfferModal";
import VendorPremiumWorkspace from "./VendorPremiumWorkspace";

const emptyForm = {
  name: "", category: CATEGORIES[0], description: "", products: "",
  address: "", phone: "", lat: "", lng: "", website: null, mapsUrl: null, placeId: null,
  rating: null, ratingsCount: null, hours: "", photos: [], preferredLink: null,
  offer: "", offerExpiresAt: "",
};

const cardStyle = {
  background: "#fff",
  border: `2px solid ${COLORS.ink}`,
  borderRadius: 12,
  padding: 18,
};

export default function VendorDashboard({ user, agent }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [claimCode, setClaimCode] = useState("");
  const [claimMsg, setClaimMsg] = useState("");
  const [tempId] = useState(() => uid(10));
  const [dashTab, setDashTab] = useState(() => {
    try {
      const intent = window.sessionStorage.getItem("stallPremiumIntent");
      if (intent === "1") {
        window.sessionStorage.removeItem("stallPremiumIntent");
        return "premium";
      }
    } catch {}
    return "listings";
  });
  const [quickOfferListing, setQuickOfferListing] = useState(null);
  const [vendorDigests, setVendorDigests] = useState({});
  const refreshedRef = useRef(new Set());

  useEffect(() => {
    if (listings.length === 0) return;
    const unsubs = listings.map((l) => onSnapshot(doc(db, "vendor_digests", l.id), (d) => {
      setVendorDigests((prev) => ({ ...prev, [l.id]: d.exists() ? d.data() : null }));
    }));
    return () => unsubs.forEach((u) => u());
  }, [listings]);

  const dismissVendorDigest = (vendorId) => {
    updateDoc(doc(db, "vendor_digests", vendorId), { read: true });
    setVendorDigests((prev) => ({ ...prev, [vendorId]: null }));
  };

  useEffect(() => {
    const q = query(collection(db, "vendors"), where("ownerId", "==", user.uid));
    return onSnapshot(q, (snap) => {
      setListings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
  }, [user.uid]);

  useEffect(() => { autoRefreshStale(listings, refreshedRef.current); }, [listings]);

  const inputStyle = {
    width: "100%", padding: "9px 10px", borderRadius: 7,
    border: `1.5px solid ${COLORS.ink}`, fontSize: 13, background: "#fff", boxSizing: "border-box",
  };

  const field = (label, node) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", fontWeight: 700, marginBottom: 5 }}>{label}</label>
      {node}
    </div>
  );