# 🌿 FoodCycle AI – Smart Expiry-Based Rescue Network

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/vnagaarjun06-byte/foodcycle-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org)
[![Google Maps](https://img.shields.io/badge/Google_Maps-Platform-4285F4.svg)](https://mapsplatform.google.com/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-AI_Copilot-9B51E0.svg)](https://ai.google.dev/)

> **Key Value Proposition:**  
> **Sell it before waste &rarr; Donate it when urgent &rarr; Recycle it when unsafe.**

---

## 📌 Problem Statement
Large quantities of fresh and packaged food are wasted every day across catering services, marriage halls, bakeries, and college canteens. Due to the lack of real-time connectivity and proper expiry monitoring, perfectly usable food often ends up in landfills.

**FoodCycle AI** solves this by closing the complete food-life cycle:
1. **Dynamic Discount Stage (9 Days to Expiry):** Automated price drops (20% &rarr; 50% &rarr; 70%) for supermarket & bakery items.
2. **Smart SOS Donation Stage (&le; 5 Hours / 5 Days to Expiry):** Automated trigger switching near-expiry food to donation mode, prioritizing nearby orphanages & old age homes using geospatial Leaflet routing.
3. **Recycling & Composting Stage (Expired / Unsafe):** Unusable food is diverted into biogas generation (clean energy) and organic fertilizer/compost.
4. **Corporate ESG & Impact:** Automated 80G tax benefit receipt generation and live carbon footprint (CO2e) offset scoring.

---

## 🚀 Live Demo & Hackathon Pitch Features

- **⚡ 3-Minute Live Demo Pitch Mode:** Dedicated live simulation modal to fast-forward time (+24h, Urgent SOS trigger, Compost expiry) so judges see all 3 lifecycle stages in 60 seconds.
- **🗺️ Interactive Geospatial Map:** Leaflet + OpenStreetMap engine showing real-time donor locations, orphanage markers, and emergency route polylines with ETA calculations.
- **🧾 Instant 80G Tax Exemption Receipts:** Printable/downloadable compliance certificates for corporate & marriage hall donors.
- **📊 Real-Time ESG Impact:** Computes total meals rescued, kg CO2e diverted from landfills, and cubic meters of clean biogas generated.

---

## 🛠️ Tech Stack

- **Backend:** Node.js + Express.js
- **Frontend:** Responsive Single-Page Application (HTML5, Modern CSS, Leaflet JS, FontAwesome)
- **Maps & Geolocation:** Leaflet + OpenStreetMap + Haversine Distance Matrix
- **Lifecycle Engine:** Rules-based AI expiry prediction + automated interval transition worker
- **Cloud Deployment:** Production-ready for Render (`render.yaml` included)

---

## 🏃 Local Setup & Run

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```

### 3. Open in Browser
Visit [http://localhost:3000](http://localhost:3000)

---

## 🐙 Step-by-Step: Push to GitHub & Deploy to Render

### Step 1: Create a Repository on GitHub
1. Go to [https://github.com/new](https://github.com/new).
2. Set repository name as `foodcycle-ai`.
3. Choose **Public** (or Private) and click **Create repository**.

### Step 2: Push your Code to GitHub
Open your terminal in the `foodcycle-ai` folder and run:

```bash
git init
git add .
git commit -m "Initial commit: FoodCycle AI Smart Expiry Rescue Network"
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/foodcycle-ai.git
git push -u origin main
```

*(Replace `<YOUR_GITHUB_USERNAME>` with your GitHub username)*

---

### Step 3: Deploy to Render for Free (Live Website)

1. Open [https://dashboard.render.com](https://dashboard.render.com) and sign in with GitHub.
2. Click **New +** &rarr; **Web Service**.
3. Choose **Build and deploy from a Git repository**.
4. Select your `foodcycle-ai` repository.
5. Fill in the details:
   - **Name:** `foodcycle-ai`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free
6. Click **Create Web Service**.

Render will automatically build and publish your website with a free HTTPS URL (e.g., `https://foodcycle-ai.onrender.com`)! 🚀
