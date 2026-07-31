// 飲水紀錄 App - Service Worker
// 負責接收伺服器推播並顯示系統通知，即使 App 沒有開啟也能運作

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = { title: '喝水提醒', body: '該補充水分囉！' }
  try {
    if (event.data) data = event.data.json()
  } catch {
    /* 使用預設內容 */
  }

  event.waitUntil(
    self.registration.showNotification(data.title || '喝水提醒', {
      body: data.body || '該補充水分囉！',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'water-reminder',
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if ('focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow('/')
    })
  )
})
