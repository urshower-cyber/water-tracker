import webpush from 'web-push'

// 由 GitHub Actions 每 5 分鐘呼叫一次，檢查是否有人的提醒時間到了並推播
export default async function handler(req, res) {
  const secret = req.query.secret || req.headers['x-cron-secret']
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const appsScriptUrl = process.env.APPS_SCRIPT_URL
  if (!appsScriptUrl) {
    return res.status(500).json({ error: 'APPS_SCRIPT_URL 尚未設定' })
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:example@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )

  const subsRes = await fetch(`${appsScriptUrl}?mode=subscriptions`)
  const subscriptions = await subsRes.json()

  const now = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' })
  )
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const windowStart = nowMinutes - 5

  const results = []

  for (const sub of subscriptions) {
    const due = (sub.reminders || []).filter((r) => {
      if (!r.enabled) return false
      const [h, m] = r.time.split(':').map(Number)
      const mins = h * 60 + m
      const key = r.id + '-' + now.toISOString().slice(0, 10)
      if ((sub.firedToday || []).includes(key)) return false
      return mins > windowStart && mins <= nowMinutes
    })

    for (const reminder of due) {
      try {
        await webpush.sendNotification(
          sub.subscription,
          JSON.stringify({
            title: '喝水提醒',
            body: `目標 ${sub.goal || 2000}cc，記得補充水分！`,
          })
        )
        const key = reminder.id + '-' + now.toISOString().slice(0, 10)
        await fetch(appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            kind: 'mark-fired',
            endpoint: sub.endpoint,
            fireKey: key,
          }),
        })
        results.push({ endpoint: sub.endpoint, reminder: reminder.id, sent: true })
      } catch (err) {
        results.push({ endpoint: sub.endpoint, reminder: reminder.id, sent: false, error: String(err) })
      }
    }
  }

  return res.status(200).json({ checked: subscriptions.length, results })
}
