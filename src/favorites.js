import { doc, setDoc, deleteDoc, collection, onSnapshot } from "firebase/firestore";

/**
 * Favorites are stored per-user at users/{uid}/favorites/{vendorId} rather
 * than as an array field on the user doc, so toggling one favorite never
 * requires reading/rewriting the whole list (avoids write conflicts if
 * someone has the app open on two devices).
 */
export async function addFavorite(db, uid, vendorId) {
  return setDoc(doc(db, "users", uid, "favorites", vendorId), { addedAt: new Date() });
}

export async function removeFavorite(db, uid, vendorId) {
  return deleteDoc(doc(db, "users", uid, "favorites", vendorId));
}

export async function toggleFavorite(db, uid, vendorId, isFavorited) {
  return isFavorited ? removeFavorite(db, uid, vendorId) : addFavorite(db, uid, vendorId);
}

/**
 * Subscribes to a user's favorite vendor IDs in real time. Returns an
 * unsubscribe function, matching the onSnapshot pattern already used
 * elsewhere in this app (see VendorDashboard.jsx / AdminDashboard.jsx).
 */
export function watchFavorites(db, uid, callback) {
  return onSnapshot(collection(db, "users", uid, "favorites"), (snap) => {
    callback(new Set(snap.docs.map((d) => d.id)));
  });
}
