# CollabCanvas MVP

A real-time collaborative design canvas with multiplayer capabilities.

## Current Status

**PR #1 Complete:** ✅ Setup + Authentication
- Firebase initialized
- User registration and login working
- Auth state persistence
- Protected routing

**Next:** PR #2 - Canvas + Shapes

## Setup Instructions

### Prerequisites
- Node.js (v18+ recommended)
- Firebase account

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env.local` file with your Firebase credentials:
   ```
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Tech Stack

- **Frontend:** React + Vite
- **Canvas:** Konva.js
- **Backend:** Firebase (Auth + Firestore)
- **State:** React Context

## Features (MVP)

- [x] Authentication (Email/Password)
- [ ] Canvas with pan/zoom
- [ ] Shape creation & manipulation
- [ ] Real-time synchronization
- [ ] Multiplayer cursors
- [ ] Presence awareness
- [ ] State persistence
- [ ] Deployment

## Development Timeline

- **Day 1:** MVP (8 core features)
- **Days 2-5:** Polish & enhancements (Realtime DB, additional features)

## License

MIT
