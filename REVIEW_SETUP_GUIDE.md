# Stall App — Google Review Auto-Responder Setup Guide

## Files to add to your repo

| File | Where to put it |
|------|----------------|
| `ReviewAutoResponder.jsx` | `src/ReviewAutoResponder.jsx` |
| `reviewFunctions.js` | `functions/index.js` (merge with existing) |

---

## Step 1 — Google OAuth Setup (Google Cloud Console)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → select `stall-app-1aab7`
2. **APIs & Services → Library** → enable:
   - `My Business Account Management API`
   - `My Business Business Information API`
   - `My Business Reviews API`
3. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs: add both:
     - `http://localhost:5173/oauthCallback` (local dev)
     - `https://jackkurian044-maker.github.io/Stall-App/oauthCallback` (production)
     - `https://<region>-stall-app-1aab7.cloudfunctions.net/oauthCallback` (Cloud Function)
4. Copy the **Client ID** and **Client Secret**

---

## Step 2 — Add environment variables

In your `.env.local`, add:
```
VITE_GOOGLE_OAUTH_CLIENT_ID=your_client_id_here
VITE_GOOGLE_OAUTH_REDIRECT_URI=https://<region>-stall-app-1aab7.cloudfunctions.net/oauthCallback
```

In GitHub repo secrets (Settings → Secrets → Actions), add same two variables.

---

## Step 3 — Set Firebase Functions config

```bash
firebase functions:config:set \
  google.client_id="YOUR_CLIENT_ID" \
  google.client_secret="YOUR_CLIENT_SECRET" \
  google.redirect_uri="https://<region>-stall-app-1aab7.cloudfunctions.net/oauthCallback" \
  anthropic.api_key="YOUR_CLAUDE_API_KEY"
```

---

## Step 4 — Install Functions dependencies

```bash
cd functions
npm install axios firebase-admin firebase-functions
```

---

## Step 5 — Add to Firestore security rules

Add to your `firestore.rules`:

```
match /gbp_connections/{vendorId} {
  allow read, write: if request.auth != null && request.auth.uid == vendorId;
}

match /review_responses/{responseId} {
  allow read: if request.auth != null && 
    resource.data.vendorId == request.auth.uid;
  allow write: if request.auth != null && 
    request.resource.data.vendorId == request.auth.uid;
}
```

---

## Step 6 — Wire into VendorDashboard.jsx

In your `VendorDashboard.jsx`, import and add the component:

```jsx
import ReviewAutoResponder from "./ReviewAutoResponder";

// Inside your vendor dashboard JSX, add a new tab:
{isPremium && (
  <ReviewAutoResponder listing={vendorListing} />
)}
```

To mark a vendor as premium, add `isPremium: true` to their Firestore document 
or create a `premium_vendors` collection.

---

## Step 7 — Deploy functions

```bash
firebase deploy --only functions
```

---

## Step 8 — Apply for Google My Business API access

This is required before the live API works. Do this in parallel:

1. Go to [Google API Console](https://console.developers.google.com)
2. Navigate to your project → **OAuth consent screen**
3. Fill in: App name, support email, developer contact
4. Add scopes: `business.manage`, `plus.business.manage`
5. Add your live domain to **Authorized domains**
6. Submit for **Google verification** (required for production access)
7. Record a short demo video showing: login → connect GBP → auto-response being generated
8. Estimated approval: 1–4 weeks

---

## How it works — data flow

```
Vendor connects GBP
    ↓
Google OAuth → Cloud Function oauthCallback
    ↓
Tokens stored in Firestore: gbp_connections/{vendorId}
    ↓
Cloud Function pollReviews runs every 30 mins
    ↓
Fetches new reviews from Google My Business API
    ↓
For each unanswered review:
  → generateAIResponse() calls Claude API
  → Claude uses: business name, category, star rating, review text, tone settings
  → Posts response to Google via My Business API
  → Saves to Firestore: review_responses/{vendorId}_{reviewId}
    ↓
Vendor sees full log in ReviewAutoResponder dashboard
```

---

## Testing without Google API approval

While waiting for Google approval, you can test the full UI and AI engine:

1. Manually insert test documents into Firestore:

```js
// In Firebase Console → Firestore → review_responses collection
{
  vendorId: "YOUR_VENDOR_UID",
  reviewerName: "Priya Sharma",
  reviewText: "Amazing place! The food was incredible and staff so friendly.",
  starRating: 5,
  receivedAt: Timestamp.now(),
  status: "pending",
  aiResponse: null,
  postedAt: null
}
```

2. The `ReviewAutoResponder.jsx` UI will display it
3. You can test the AI generator independently by calling `generateAIResponse()` directly

---

## Estimated costs (Blaze plan)

| Service | Usage | Cost |
|---------|-------|------|
| Cloud Functions | 48 runs/day × 30 vendors | ~₹0 (free tier) |
| Firestore reads | ~1,000/day | ~₹0 (free tier) |
| Claude API | ~100 responses/day × 300 tokens | ~₹200/month |
| Google My Business API | Free | ₹0 |

Well within your ₹28,320 credit.

---

## Premium feature flag

To enable/disable per vendor, add to their Firestore listing document:
```js
{ isPremium: true, premiumSince: Timestamp.now() }
```

Future: add Razorpay subscription to automate this.
