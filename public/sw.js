const VERSION = "cham-toan-nhanh-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))),
      ),
    ]),
  );
});

// Không lưu ảnh bài làm, API điểm hay trang đã đăng nhập trong bộ nhớ đệm.
self.addEventListener("fetch", () => {});
