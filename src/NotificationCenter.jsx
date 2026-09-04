import React, { useEffect } from 'react'
import { Bell, CalendarClock, Clock3, X } from 'lucide-react'
import { notificationDateLabel } from './notifications.js'

export function NotificationBell({ count = 0, enabled = true, open = false, onClick }) {
  return <button
    type="button"
    className={`notification-bell ${open ? 'active' : ''}`}
    aria-label={count > 0 ? `Notifications, ${count} upcoming` : 'Notifications'}
    aria-expanded={open}
    aria-haspopup="dialog"
    onClick={onClick}
    title="Notifications"
  >
    <Bell size={17} />
    {enabled && count > 0 && <span className="notification-badge" aria-hidden="true">{count > 9 ? '9+' : count}</span>}
  </button>
}

const relativeCopy = (item) => {
  if (item.type === 'remortgage') return item.daysUntil === 0 ? 'Remortgage date today' : `Rate window open · ${item.daysUntil} days to remortgage`
  if (item.daysUntil === 0) return 'Due today'
  if (item.daysUntil === 1) return 'Due tomorrow'
  return `Due in ${item.daysUntil} days`
}

export default function NotificationCenter({ open, enabled, items, onClose, onSnooze, onDismiss, onOpenSettings }) {
  useEffect(() => {
    if (!open) return undefined
    const close = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [open, onClose])

  if (!open) return null
  return <div className="notification-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="notification-center" role="dialog" aria-modal="false" aria-labelledby="notification-center-title" onMouseDown={(event) => event.stopPropagation()}>
      <header>
        <div><span className="kicker">UPCOMING</span><h2 id="notification-center-title">Notifications</h2></div>
        <button type="button" className="notification-close" onClick={onClose} aria-label="Close notifications"><X size={18} /></button>
      </header>
      {!enabled ? <div className="notification-empty">
        <Bell size={21} />
        <b>Notifications are off</b>
        <span>Turn them on in Settings when you want compliance and remortgage reminders.</span>
        <button type="button" className="text-button" onClick={onOpenSettings}>Open settings</button>
      </div> : items.length === 0 ? <div className="notification-empty">
        <CalendarClock size={21} />
        <b>Nothing due soon</b>
        <span>Remortgages appear three months ahead; compliance dates appear two weeks ahead.</span>
      </div> : <div className="notification-items">
        {items.map((item) => <article className="notification-item" key={item.key}>
          <span className={`notification-item-icon ${item.type === 'remortgage' ? 'finance' : 'compliance'}`}><CalendarClock size={17} /></span>
          <div className="notification-item-copy">
            <div><b>{item.type === 'remortgage' ? 'Remortgage rate window' : item.label}</b><small>{item.propertyName}</small></div>
            <span><Clock3 size={13} />{relativeCopy(item)} · {notificationDateLabel(item.dueDate)}</span>
            <div className="notification-item-actions">
              <button type="button" onClick={() => onSnooze(item)}>Snooze 1 week</button>
              <button type="button" onClick={() => onDismiss(item)}>Dismiss</button>
            </div>
          </div>
        </article>)}
      </div>}
    </section>
  </div>
}
