import { useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'water_v1'
const QUICK_AMOUNTS = [100, 200, 500]

function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function nowHHMM() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function nowTimeLabel() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY)
  const defaults = {
    goal: 2000,
    date: todayStr(),
    total: 0,
    entries: [],
    reminders: [
      { id: 'r1', time: '09:00', enabled: true },
      { id: 'r2', time: '13:00', enabled: true },
      { id: 'r3', time: '19:00', enabled: true },
    ],
    sheetsUrl: '',
    firedToday: [],
  }
  if (!raw) return defaults
  try {
    const parsed = JSON.parse(raw)
    return { ...defaults, ...parsed }
  } catch {
    return defaults
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function pushHistory(dayRecord) {
  const raw = localStorage.getItem('water_history_pending')
  const list = raw ? JSON.parse(raw) : []
  list.push(dayRecord)
  localStorage.setItem('water_history_pending', JSON.stringify(list))
}

export default function App() {
  const [state, setState] = useState(loadState)
  const [showSettings, setShowSettings] = useState(false)
  const [lastEntry, setLastEntry] = useState(null)
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )
  const [syncStatus, setSyncStatus] = useState('')
  const stateRef = useRef(state)
  stateRef.current = state

  // 每次狀態變動就存檔
  useEffect(() => {
    saveState(state)
  }, [state])

  // 檢查是否跨日，跨日就把昨天的資料存進待同步佇列並歸零
  useEffect(() => {
    const check = () => {
      const t = todayStr()
      if (stateRef.current.date !== t) {
        setState((prev) => {
          if (prev.total > 0 || prev.entries.length > 0) {
            pushHistory({ date: prev.date, total: prev.total, goal: prev.goal, entries: prev.entries })
          }
          return { ...prev, date: t, total: 0, entries: [], firedToday: [] }
        })
      }
    }
    check()
    const id = setInterval(check, 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // 提醒通知檢查（每20秒檢查一次目前時間是否符合設定的提醒時間）
  useEffect(() => {
    const id = setInterval(() => {
      const s = stateRef.current
      if (Notification.permission !== 'granted') return
      const hhmm = nowHHMM()
      const due = s.reminders.filter((r) => r.enabled && r.time === hhmm && !s.firedToday.includes(r.id + hhmm))
      if (due.length > 0) {
        due.forEach((r) => {
          try {
            new Notification('喝水提醒', {
              body: `目前已喝 ${s.total}cc，目標 ${s.goal}cc，記得補充水分！`,
              tag: r.id,
            })
          } catch {
            /* 通知失敗就略過 */
          }
        })
        setState((prev) => ({
          ...prev,
          firedToday: [...prev.firedToday, ...due.map((r) => r.id + hhmm)],
        }))
      }
    }, 20 * 1000)
    return () => clearInterval(id)
  }, [])

  const addWater = (amount) => {
    const entry = { time: nowTimeLabel(), amount }
    setState((prev) => ({
      ...prev,
      total: prev.total + amount,
      entries: [entry, ...prev.entries],
    }))
    setLastEntry(entry)
  }

  const undoLast = () => {
    setState((prev) => {
      if (prev.entries.length === 0) return prev
      const [first, ...rest] = prev.entries
      return { ...prev, total: Math.max(0, prev.total - first.amount), entries: rest }
    })
    setLastEntry(null)
  }

  const percent = Math.min(100, Math.round((state.total / state.goal) * 100))

  const syncToSheets = async () => {
    if (!state.sheetsUrl) return
    setSyncStatus('同步中…')
    try {
      const raw = localStorage.getItem('water_history_pending')
      const pending = raw ? JSON.parse(raw) : []
      const payload = {
        today: { date: state.date, total: state.total, goal: state.goal, entries: state.entries },
        history: pending,
      }
      await fetch(state.sheetsUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
      })
      localStorage.removeItem('water_history_pending')
      setSyncStatus('已同步 ✓')
    } catch {
      setSyncStatus('同步失敗，請檢查網址')
    }
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">飲水紀錄</div>
        <button className="icon-btn" onClick={() => setShowSettings(true)} aria-label="設定">
          ⚙
        </button>
      </div>

      <div className="tank-wrap">
        <div className="tank-water" style={{ height: `${percent}%` }} />
        <div className="tank-percent">{percent}%</div>
        <div className="tank-readout">
          <div className="tank-number">{state.total}</div>
          <div className="tank-goal">/ {state.goal} cc</div>
        </div>
      </div>

      <div className="quick-row">
        {QUICK_AMOUNTS.map((amt) => (
          <button key={amt} className="quick-btn" onClick={() => addWater(amt)}>
            <span className="amt">+{amt}</span>
            <span className="unit">cc</span>
          </button>
        ))}
      </div>

      <div className="undo-row">
        {lastEntry && state.entries[0] === lastEntry && (
          <button className="undo-btn" onClick={undoLast}>
            復原剛剛新增的 {lastEntry.amount}cc
          </button>
        )}
      </div>

      <div className="log-section">
        <div className="log-title">今日紀錄</div>
        {state.entries.length === 0 ? (
          <div className="log-empty">還沒有紀錄，點上面的按鈕開始記錄喝水量吧</div>
        ) : (
          <div className="log-list">
            {state.entries.map((e, i) => (
              <div className="log-item" key={i}>
                <span className="time">{e.time}</span>
                <span>{e.amount} cc</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showSettings && (
        <SettingsPanel
          state={state}
          setState={setState}
          notifPermission={notifPermission}
          setNotifPermission={setNotifPermission}
          onClose={() => setShowSettings(false)}
          onSync={syncToSheets}
          syncStatus={syncStatus}
        />
      )}
    </div>
  )
}

function SettingsPanel({ state, setState, notifPermission, setNotifPermission, onClose, onSync, syncStatus }) {
  const [goalInput, setGoalInput] = useState(state.goal)
  const [sheetsInput, setSheetsInput] = useState(state.sheetsUrl)

  const saveGoal = () => {
    const n = parseInt(goalInput, 10)
    if (!isNaN(n) && n > 0) {
      setState((prev) => ({ ...prev, goal: n }))
    }
  }

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') return
    const p = await Notification.requestPermission()
    setNotifPermission(p)
  }

  const addReminder = () => {
    const id = 'r' + Date.now()
    setState((prev) => ({
      ...prev,
      reminders: [...prev.reminders, { id, time: '12:00', enabled: true }],
    }))
  }

  const updateReminder = (id, patch) => {
    setState((prev) => ({
      ...prev,
      reminders: prev.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }))
  }

  const removeReminder = (id) => {
    setState((prev) => ({ ...prev, reminders: prev.reminders.filter((r) => r.id !== id) }))
  }

  const saveSheetsUrl = () => {
    setState((prev) => ({ ...prev, sheetsUrl: sheetsInput.trim() }))
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>設定</h2>
          <button className="icon-btn" onClick={onClose} aria-label="關閉">
            ✕
          </button>
        </div>

        <div className="field-group">
          <label className="field-label">每日飲水目標</label>
          <div className="goal-input-row">
            <input
              type="number"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onBlur={saveGoal}
              inputMode="numeric"
            />
            <span className="goal-unit">cc</span>
          </div>
        </div>

        <div className="field-group">
          <label className="field-label">提醒時間</label>
          <div className="reminder-list">
            {state.reminders.map((r) => (
              <div className="reminder-item" key={r.id}>
                <input
                  type="time"
                  value={r.time}
                  onChange={(e) => updateReminder(r.id, { time: e.target.value })}
                />
                <button
                  className={`toggle ${r.enabled ? 'on' : 'off'}`}
                  onClick={() => updateReminder(r.id, { enabled: !r.enabled })}
                  aria-label="開關提醒"
                />
                <button className="remove-btn" onClick={() => removeReminder(r.id)} aria-label="刪除">
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button className="add-reminder-btn" onClick={addReminder}>
            ＋ 新增提醒時間
          </button>

          {notifPermission !== 'granted' && (
            <>
              <div className="notif-status warn">
                通知權限尚未開啟，提醒不會跳出。請先允許通知權限。
              </div>
              <button className="secondary-btn" onClick={requestPermission}>
                開啟通知權限
              </button>
            </>
          )}
          {notifPermission === 'granted' && (
            <div className="notif-status">
              通知權限已開啟。提醒需要 Brave 保持在背景執行才會準時跳出，若手機把 App 完全關閉可能不會提醒。
            </div>
          )}
        </div>

        <div className="field-group">
          <label className="field-label">Google Sheets 備份網址</label>
          <input
            type="url"
            placeholder="貼上 Apps Script Web App 網址"
            value={sheetsInput}
            onChange={(e) => setSheetsInput(e.target.value)}
            onBlur={saveSheetsUrl}
          />
          <button className="primary-btn" onClick={onSync}>
            立即同步
          </button>
          {syncStatus && <div className="sync-status">{syncStatus}</div>}
        </div>
      </div>
    </div>
  )
}
