# PWA Setup

How to make the frontend installable on iPhone as a Progressive Web App.

## Plugin

Use `vite-plugin-pwa` in the Vite config. It generates the service worker
and wires up the manifest.

## Manifest

The web app manifest must include:
- name and short_name (the app name)
- icons at 192x192 and 512x512 pixels
- theme_color and background_color
- display set to "standalone" (runs full-screen, no browser bar)
- start_url set to "/"

## Service Worker

- Let vite-plugin-pwa generate the service worker.
- It enables caching of assets and basic offline support.

## iPhone Notes

- PWAs require HTTPS. The deployed site provides this automatically.
- For local testing on a real iPhone, use a tunnel such as ngrok to get an
  HTTPS URL.
- Installing on iPhone is manual: the user opens the site in Safari, taps the
  Share button, then chooses "Add to Home Screen".
- There is no automatic install prompt on iOS like there is on Android.

## Icons

- Place the icon files in the client `public/` folder.
- Provide at least the 192px and 512px sizes; an Apple touch icon is also
  recommended for a clean home-screen icon.

## Testing Checklist

- Manifest loads without errors (check browser dev tools).
- The app opens full-screen after being added to the home screen.
- Static assets still load when offline.
