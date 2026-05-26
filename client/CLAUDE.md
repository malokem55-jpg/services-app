# CLAUDE.md — Frontend (client)

Rules for the React frontend. Also follow the root CLAUDE.md.

## Stack

- React with TypeScript, built with Vite
- Styling: Tailwind CSS
- Data fetching and state: TanStack Query (React Query)
- Routing: React Router
- PWA: vite-plugin-pwa (see ../docs/pwa-setup.md)

## UI Rules

- The UI language is Arabic. Lay out pages right-to-left: set `dir="rtl"`.
- All UIs must be responsive and work on both phone and desktop screens.
- Design mobile-first: build the phone layout first, then expand for larger
  screens using Tailwind responsive prefixes (md:, lg:).
- Keep components small and focused. One component per file.

## Data Rules

- Route all API calls through TanStack Query. Do not call `fetch` directly
  inside components.
- Keep the API base URL and the shared fetch setup in `src/lib/`.
- Attach the JWT token to requests via a shared request helper.
- Show clear loading and error states for every data request.

## Folder Layout (inside client/src)

- components/  Reusable UI components
- pages/       Application pages (one per route)
- hooks/       Custom React hooks
- lib/         API setup and helper functions

## Reminders

- Do not use localStorage for app state; use React state. (A JWT token may be
  stored, but discuss the approach first.)
- After building a page, verify it renders correctly on a narrow phone width.
