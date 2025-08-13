// service-worker.js

const CACHE_NAME = 'omr-grader-cache-v1.1';
// Offline အလုပ်လုပ်ရန် လိုအပ်သော ဖိုင်များ
const urlsToCache = [
  '/',
  'index.html',
  'style.css',
  'script.js',
  'scanner.js',
  'opencv.js', // This file must be available
  'manifest.json',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png'
];

// Install event - caching the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching files');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serving files from cache
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // If the file is in the cache, return it.
        if (response) {
          return response;
        }
        // Otherwise, fetch it from the network.
        return fetch(event.request);
      })
  );
});



