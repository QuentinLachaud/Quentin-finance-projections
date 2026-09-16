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

const timingLabel = (dueDay, currentDay) => {
  if (dueDay === currentDay) return 'Due today'
  return dueDay < currentDay ? 'Earlier this month' : 'Upcoming'
}

const propertyNames = (group) => group?.events.map((event) => event.propertyName).filter(Boolean).join(' + ') || ''

export default function RentMonthDial({ tenants = [], properties = [] }) {
  const today = useLocalToday()
  const schedule = useMemo(() => rentScheduleForMonth(tenants, properties, today), [tenants, properties, today])
  const groups = useMemo(() => dueGroups(schedule.events), [schedule.events])
  const currentDay = Math.min(today.getDate(), schedule.daysInMonth)
  const handAngle = ((currentDay - 1) / schedule.daysInMonth) * 360
  const dashGap = Math.max(0.01, schedule.daysInMonth - 0.72)
  const dueToday = groups.find((group) => group.dueDay === currentDay) || null
  const nextDue = groups.find((group) => group.dueDay > currentDay) || null
  const focusDue = dueToday || nextDue
  const accessibleDue = groups.length
    ? groups.map((group) => `${formatOrdinalDay(group.dueDay)} ${money.format(group.amount)} ${propertyNames(group)}`).join(', ')
    : 'no scheduled rent dates'

  return <section className="rent-schedule-card" aria-label={`Expected rent schedule for ${longMonthName.format(today)}: ${accessibleDue}`}>
    <div className="rent-schedule-summary">
      <span className="rent-schedule-eyebrow">Rent schedule</span>
      <div className="rent-schedule-month-line">
        <div>
          <h3>{longMonthName.format(today)}</h3>
          <p>Expected rent from active tenancies</p>
        </div>
        <span className="rent-schedule-payment-count">{schedule.events.length} payment{schedule.events.length === 1 ? '' : 's'}</span>
      </div>

      <div className="rent-schedule-total">
        <strong>{money.format(schedule.scheduledRent)}</strong>
        <span>scheduled this month</span>
      </div>

      <div className={`rent-schedule-focus ${dueToday ? 'today' : ''}`}>
        <span>{dueToday ? 'DUE TODAY' : nextDue ? 'NEXT DUE' : groups.length ? 'THIS MONTH' : 'SETUP NEEDED'}</span>
        {focusDue
          ? <><b>{formatOrdinalDay(focusDue.dueDay)} · {money.format(focusDue.amount)}</b><small>{propertyNames(focusDue)}</small></>
          : <><b>{groups.length ? 'No more scheduled dates' : 'No rent dates scheduled'}</b><small>{groups.length ? 'All expected dates are earlier this month.' : 'Add payment days in Tenants.'}</small></>}
      </div>

      {schedule.missingTenants.length > 0 && <small className="rent-schedule-warning">{schedule.missingTenants.length} active tenant{schedule.missingTenants.length === 1 ? '' : 's'} still need{schedule.missingTenants.length === 1 ? 's' : ''} a rent payment day.</small>}
    </div>

    <div className="rent-schedule-visual" aria-hidden="true">
      <svg viewBox="0 0 120 120" focusable="false">
        <circle className="rent-schedule-track" cx="60" cy="60" r="50" />
        {Array.from({ length: schedule.daysInMonth }, (_, index) => {
          const angle = (index / schedule.daysInMonth) * 360
          const major = index === 0 || (index + 1) % 5 === 0
          return <line key={index} className={major ? 'rent-schedule-tick major' : 'rent-schedule-tick'} x1="60" y1="8" x2="60" y2={major ? '13' : '10.5'} transform={`rotate(${angle} 60 60)`} />
        })}
        {groups.map((group) => <circle
          key={group.dueDay}
          className={`rent-schedule-band ${group.dueDay === currentDay ? 'today' : ''}`}
          cx="60"
          cy="60"
          r="50"
          pathLength={schedule.daysInMonth}
          strokeDasharray={`0.72 ${dashGap}`}
          strokeDashoffset={-(group.dueDay - 1)}
          transform="rotate(-90 60 60)"
        />)}
        <line className="rent-schedule-hand" x1="60" y1="60" x2="60" y2="17" transform={`rotate(${handAngle} 60 60)`} />
        <circle className="rent-schedule-centre-dot" cx="60" cy="60" r="3" />
      </svg>
      <span className="rent-schedule-centre"><small>Today</small><strong>{currentDay}</strong><b>{monthName.format(today).toUpperCase()}</b></span>
    </div>

    <div className="rent-schedule-agenda">
      <header>
        <div><span>Payment dates</span><h4>Expected rent</h4></div>
        <b>{groups.length}</b>
      </header>
      <div className="rent-schedule-list" role="list" aria-label="Expected rent payment dates">
        {groups.map((group) => <div className={`rent-schedule-row ${group.dueDay === currentDay ? 'today' : ''}`} role="listitem" key={group.dueDay}>
          <span className="rent-schedule-date"><b>{group.dueDay}</b><small>{monthName.format(today).toUpperCase()}</small></span>
          <span className="rent-schedule-property"><b>{propertyNames(group) || 'Rent payment'}</b><small>{timingLabel(group.dueDay, currentDay)}</small></span>
          <span className="rent-schedule-amount"><b>{money.format(group.amount)}</b><small>{formatOrdinalDay(group.dueDay)}</small></span>
        </div>)}
        {!groups.length && <div className="rent-schedule-empty"><b>No scheduled rent dates</b><span>Add a rent payment day to each active tenancy.</span></div>}
      </div>
    </div>
  </section>
}
