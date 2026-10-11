import React, { useEffect, useMemo, useState } from 'react'
import { formatRentCycleDate, rentCycleForDate, scheduledRentAmountForDate } from './rentProgress.js'
import './RentMonthDial.css'

const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })

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


export default function RentMonthDial({ tenants = [], properties = [] }) {
  const today = useLocalToday()
  const cycle = useMemo(() => rentCycleForDate(tenants, properties, today), [tenants, properties, today])
  const previousAmount = scheduledRentAmountForDate(tenants, properties, cycle.previousDueDate)
  const nextAmount = scheduledRentAmountForDate(tenants, properties, cycle.nextDueDate)
  const previousAmountLabel = previousAmount == null ? '—' : money.format(previousAmount)
  const nextAmountLabel = nextAmount == null ? '—' : money.format(nextAmount)
  const circumference = 2 * Math.PI * 50
  const markerAngle = cycle.progress * Math.PI * 2

  return <section className="rent-schedule-card rent-progress-layout" aria-label="Rent clock">
    <div className="rent-progress-widget" role="img" aria-label={[
      cycle.daysUntil == null ? 'No upcoming scheduled rent' : cycle.daysUntil === 0 ? 'Rent due today' : cycle.daysUntil + ' days until next scheduled rent',
      'Last scheduled rent ' + formatRentCycleDate(cycle.previousDueDate) + ', expected ' + previousAmountLabel,
      'Next scheduled rent ' + formatRentCycleDate(cycle.nextDueDate) + ', expected ' + nextAmountLabel,
    ].join('. ')}>
      <div className="rent-progress-wheel">
        <svg className="rent-progress-svg" viewBox="0 0 120 120" focusable="false" aria-hidden="true">
          <circle className="rent-progress-track" cx="60" cy="60" r="50" />
          {cycle.nextDueDate && <>
            <circle className="rent-progress-fill" cx="60" cy="60" r="50" strokeDasharray={[cycle.progress * circumference, circumference].join(' ')} />
            <circle className="rent-progress-marker" cx={60 + 50 * Math.sin(markerAngle)} cy={60 - 50 * Math.cos(markerAngle)} r="3.5" />
          </>}
        </svg>
        <div className="rent-progress-centre">
          {cycle.daysUntil == null ? <>
            <strong className="rent-progress-count">—</strong>
            <span className="rent-progress-unit">No rent due</span>
          </> : cycle.daysUntil === 0 ? <>
            <strong className="rent-progress-today">Due</strong>
            <span className="rent-progress-unit">today</span>
          </> : <>
            <strong className="rent-progress-count">{cycle.daysUntil}</strong>
            <span className="rent-progress-unit">{cycle.daysUntil === 1 ? 'day to rent' : 'days to rent'}</span>
          </>}
        </div>
      </div>
      <div className="rent-progress-range">
        <div className="rent-progress-range-item">
          <span>Last rent</span>
          <div className="rent-progress-range-details"><strong>{formatRentCycleDate(cycle.previousDueDate)}</strong><b>{previousAmountLabel}</b></div>
        </div>
        <div className="rent-progress-range-item">
          <span>Next rent</span>
          <div className="rent-progress-range-details"><strong>{formatRentCycleDate(cycle.nextDueDate)}</strong><b>{nextAmountLabel}</b></div>
        </div>
      </div>
    </div>
  </section>
}
