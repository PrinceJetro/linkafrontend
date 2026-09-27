# 🌍 Linka Frontend

The user interface for Linka — Africa's B2B partnership network. Built with Next.js and styled with a custom vanilla CSS design system for a premium, snappy, and intuitive experience.

## 🚀 Tech Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Vanilla CSS (`globals.css`) + minimal Tailwind for rapid utility prototyping
- **Icons**: Lucide React
- **Mapping**: React Leaflet + OpenStreetMap
- **Package Manager**: pnpm

## ⚙️ Prerequisites

- Node.js 18+
- pnpm (install via `npm install -g pnpm`)

## 🛠️ Local Setup

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Environment Variables:**
   By default, the frontend is configured to talk to the local Django backend running on port 8000. 
   If you need to point it to a production backend, edit `lib/api.ts` or set an environment variable if configured.

3. **Start the development server:**
   ```bash
   pnpm dev
   ```
   The application will be available at `http://localhost:3000/`.

## 🎨 Design System & Architecture

- **`app/globals.css`**: The core of the app's visual identity. It contains all the CSS variables, layout classes (like `.app-shell`, `.sidebar`, `.main-area`), typography, custom form styling, request cards, and modal animations.
- **`app/page.tsx`**: The main authenticated dashboard. It handles navigation state (`activeNav`) and renders different views like the Opportunity Map, AI Matcher, Intent Wall, and Direct Messages.
- **`lib/api.ts`**: The central API client handling all requests to the Django backend, including JWT token management.

## 🧩 Key Features

- **Capability Profiles**: Users define their business identity, offers, and needs.
- **AI Matcher**: A natural language search interface that finds partners based on semantic intent rather than just keywords.
- **Opportunity Map**: An interactive map visualising where capabilities are distributed across Africa.
- **Partnership Workflows**: Send requests, accept connections, draft AI-generated MOUs, and leave endorsements.
- **Intent Wall**: A reverse marketplace for broadcasting urgent demand to the network.

## 🚢 Deployment

The frontend is deployed on **Vercel**.
- Connect the GitHub repository to a Vercel project.
- The build command is `pnpm build`.
- Make sure `pnpm-lock.yaml` is up to date before pushing to avoid deployment failures (`pnpm install --lockfile-only`).
