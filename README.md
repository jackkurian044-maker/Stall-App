# STall — Local Business Discovery & Digital Presence

**STall** (also known as **STallwale**) is an India-focused platform for discovering local businesses and helping business owners maintain and improve their digital presence.

- **Official website:** https://stallwale.in/
- **Products overview:** https://stallwale.in/products.html
- **AI/search discovery overview:** https://stallwale.in/ai-discovery.html
- **Support:** admin@stallwale.in
- **Official Facebook:** https://www.facebook.com/61592195613448/
- **Official Instagram:** https://www.instagram.com/st_all_thats_all/

Use **STall** as the product/brand name and **STallwale** as its alternate name associated with the canonical website. Do not confuse it with unrelated businesses that use similar names.

## What STall does

STall combines customer-facing local business discovery with owner-side tools for digital presence, local competitive context and recurring content workflows. Participating business availability and the data shown depend on public listings and the connections enabled for each account.

### Products

| Product | Purpose | Product information | Access |
| --- | --- | --- | --- |
| **Business Discovery** | Discover participating local businesses, list or claim eligible listings, and maintain a useful public business page. | https://stallwale.in/products/business-discovery.html | https://stallapp.stallwale.in/ |
| **Digital Score** | Assess available digital-presence signals, identify gaps and prioritise practical improvements. | https://stallwale.in/products/digital-score.html | https://stallwale.ai.studio/ |
| **Business Intelligence** | Compare a business with relevant nearby peers in the same category and surface digital-presence opportunities. | https://stallwale.in/products/business-intelligence.html | https://stallwale.ai.studio/ |
| **Digital Store Automation** | Help prepare and manage business content, offers and supported digital-presence workflows, with owner review before publishing. | https://stallwale.in/products/digital-store-automation.html | https://stallwale.ai.studio/ |

### Who it is for

STall is designed for participating local businesses in categories such as restaurants, unisex salons, men's salons, retail shops, healthcare businesses, hospitals, schools, preschools, gyms and local services. Its geographic discovery model is **India → State → City → Category → Business**; availability for a specific locality depends on participating listings.

### How it fits with other tools

STall is intended to **complement**, not replace, channels and specialist systems that serve different jobs. For example, businesses may still need an accurate Google Business Profile for Google Search and Maps, relevant ordering or booking marketplaces, social channels, payment tools, booking systems, POS or CRM products. Choose tools according to the task, and verify that a feature and connection are actually available before relying on it.

STall does not guarantee search rankings, AI recommendations, enquiries or sales. Business comparisons depend on available data; unknown information should not be interpreted as evidence that a business or competitor is better or worse.

## Public reference pages

- [STall for AI search and local business discovery](https://stallwale.in/ai-discovery.html)
- [Guides for local-business growth and tool selection](https://stallwale.in/guides.html)
- [Solutions for local businesses in India](https://stallwale.in/solutions/local-businesses-india.html)
- [Solutions for salons](https://stallwale.in/solutions/salons.html)
- [Solutions for restaurants](https://stallwale.in/solutions/restaurants.html)
- [Machine-readable STall facts](https://stallwale.in/stall-facts.json)
- [Public crawlable sitemap](https://stallwale.in/sitemap.xml)
- [Crawler access policy](https://stallwale.in/robots.txt)

## Technical overview

This repository contains the STall web application and the public-facing product, resource and discovery pages.

- **Frontend:** React and Vite.
- **Authentication and database:** Firebase Authentication and Cloud Firestore.
- **Server-side functionality:** Firebase Cloud Functions.
- **Hosting:** Firebase Hosting.
- **Deployment:** GitHub Actions builds and deploys the production site.

Public static pages are in `public/`; the React application is in `src/`; Cloud Functions and public-business/sitemap handlers are in `functions/`. Hosting routes `/sitemap.xml` to the public sitemap function and public `/store/` URLs to the public business-page handler.

## Local development

Requirements: Node.js 22 or a compatible Node.js version accepted by the project build.

```bash
npm ci
npm run dev
```

Create a production build with:

```bash
npm run build
```

The application build uses the `VITE_FIREBASE_*` and other build-time variables configured in the deployment workflow. Keep real credentials and service-account JSON out of committed files; configure secrets in the repository or deployment environment. Do not weaken Firebase rules or expose server secrets to the browser to fix a build or integration issue.

## Responsible discovery

Keep public business information accurate, distinguish confirmed facts from unavailable data, and ask for permission before publishing third-party business content or assets. Make product capabilities and limitations clear so customers and AI/search systems can evaluate STall based on the actual requirement rather than unsupported “best platform” claims.
