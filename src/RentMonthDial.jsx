import React, { useEffect, useMemo, useState } from 'react'
import { formatOrdinalDay, rentScheduleForMonth } from './rentSchedule.js'

const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })
const monthName = new Intl.DateTimeFormat('en-GB', { month: 'short' })
const longMonthName = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })

function useLocalToday() {
  const [today, setToday] = useState(() => new Date())
  useEffect(() => {
    let timer = 0
    const scheduleMidnightRefresh = () => {
      const now = new Date()
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0)
      timer = window.setTimeout(() => {
        setToday(new Date())
        scheduleMidnightRefresh()
      }, Math.max(1_000, next.getTime() - now.getTime()))
    }
    scheduleMidnightRefresh()
    return () => window.clearTimeout(timer)
  }, [])
  return today
}

const dueGroups = (events) => {
  const groups = new Map()
  events.forEach((event) => {
    const current = groups.get(event.dueDay) || { dueDay: event.dueDay, amount: 0, events: [] }
    current.amount += event.amount
    current.events.push(event)
    groups.set(event.dueDay, current)
  })
  return [...groups.values()].sort((left, right) => left.dueDay - right.dueDay)
}

export default function RentMonthDial({ tenants = [], properties = [] }) {
  const today = useLocalToday()
  const schedule = useMemo(() => rentScheduleForMonth(tenants, properties, today), [tenants, properties, today])
  const groups = useMemo(() => dueGroups(schedule.events), [schedule.events])
  const currentDay = Math.min(today.getDate(), schedule.daysInMonth)
  const handAngle = ((currentDay - 1) / schedule.daysInMonth) * 360
  const dashGap = Math.max(0.01, schedule.daysInMonth - 0.72)
  const accessibleDue = groups.length
    ? groups.map((group) => `${formatOrdinalDay(group.dueDay)} ${money.format(group.amount)}`).join(', ')
    : 'no scheduled rent dates'

  return <section className="rent-month-dial-shell" aria-label={`Expected rent schedule for ${longMonthName.format(today)}: ${accessibleDue}`}>
    <div className="rent-month-dial-copy">
      <span className="kicker">RENT CALENDAR</span>
      <strong>{money.format(schedule.scheduledRent)} <small>scheduled</small></strong>
      <p>One due event per active tenancy for this calendar month.</p>
      {schedule.missingTenants.length > 0 && <small className="rent-month-dial-warning">{schedule.missingTenants.length} active tenant{schedule.missingTenants.length === 1 ? '' : 's'} need{schedule.missingTenants.length === 1 ? 's' : ''} a rent payment day.</small>}
    </div>

    <div className="rent-month-dial-visual" aria-hidden="true">
      <svg viewBox="0 0 120 120" focusable="false">
        <circle className="rent-month-dial-track" cx="60" cy="60" r="50" />
        {Array.from({ length: schedule.daysInMonth }, (_, index) => {
          const angle = (index / schedule.daysInMonth) * 360
          const major = index === 0 || (index + 1) % 5 === 0
          return <line key={index} className={major ? 'rent-month-dial-tick major' : 'rent-month-dial-tick'} x1="60" y1="8" x2="60" y2={major ? '12.5' : '10.5'} transform={`rotate(${angle} 60 60)`} />
        })}
        {groups.map((group) => <circle
          key={group.dueDay}
          className="rent-month-dial-band"
          cx="60"
          cy="60"
          r="50"
          pathLength={schedule.daysInMonth}
          strokeDasharray={`0.72 ${dashGap}`}
          strokeDashoffset={-(group.dueDay - 1)}
          transform="rotate(-90 60 60)"
        />)}
        <line className="rent-month-dial-hand" x1="60" y1="60" x2="60" y2="17" transform={`rotate(${handAngle} 60 60)`} />
        <circle className="rent-month-dial-centre-dot" cx="60" cy="60" r="3" />
      </svg>
      <span className="rent-month-dial-centre"><b>{monthName.format(today).toUpperCase()}</b><strong>{currentDay}</strong></span>
    </div>

    <div className="rent-month-dial-due-list">
      {groups.map((group) => <div key={group.dueDay}>
        <span><i aria-hidden="true" />{formatOrdinalDay(group.dueDay)}</span>
        <b>{money.format(group.amount)}</b>
        <small>{group.events.map((event) => event.propertyName).join(' + ')}</small>
      </div>)}
      {!groups.length && <div className="empty"><span>No scheduled rent</span><small>Add payment days in Tenants.</small></div>}
    </div>
  </section>
}
