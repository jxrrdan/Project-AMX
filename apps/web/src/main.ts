import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));

// Register the PWA service worker only for production builds. In development the
// dev-server's live reload and un-hashed assets make an SW more trouble than it's
// worth; the IndexedDB offline-data layer (which is plain app code) still works in
// dev, so offline PDI capture is fully testable without it.
if (environment.production && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => console.error('SW registration failed', err));
  });
}
