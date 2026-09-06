import React, { useState } from 'react'
import { currency } from './calculations.js'
import {
  balanceAxis, balanceCoordinates, balanceMonthTicks, formatAxisMoney,
  formatBalanceDate, nearestBalancePoint, xForBalanceDate,
} from './bankingChart.js'

const DESKTOP = { width: 960, height: 320, pad: { top: 24, right: 24, bottom: 50, left: 72 } }
const MOBILE = { width: 340, height: 196, pad: { top: 16, right: 10, bottom: 34, left: 48 } }
const amountTone = (value) => Number(value || 0) >= 0 ? 'positive' : 'negative'
const preciseMoney = (value) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value || 0))

const linePath = (coordinates) => coordinates.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')

export function BalanceChart({ points = [] }) {
  const [hovered, setHovered] = useState(null)
  if (points.length < 2) return <div className="bank-empty-chart"><span>Balance history will appear after transactions are synced.</span></div>

  const desktopAxis = balanceAxis(points, 5)
  const desktopCoordinates = balanceCoordinates(points, desktopAxis, DESKTOP)
  const desktopMonths = balanceMonthTicks(points, 6)
  const desktopLine = linePath(desktopCoordinates)
  const desktopBottom = DESKTOP.height - DESKTOP.pad.bottom
  const desktopArea = `${desktopLine} L${desktopCoordinates.at(-1).x.toFixed(1)},${desktopBottom} L${desktopCoordinates[0].x.toFixed(1)},${desktopBottom} Z`
  const tooltipWidth = 154
  const tooltipHeight = 54
  const tooltipX = hovered ? Math.min(DESKTOP.width - DESKTOP.pad.right - tooltipWidth, Math.max(DESKTOP.pad.left, hovered.x + 12)) : 0
  const tooltipY = hovered ? Math.max(DESKTOP.pad.top, hovered.y - tooltipHeight - 10) : 0

  const handlePointerMove = (event) => {
    const svg = event.currentTarget.ownerSVGElement
    const bounds = svg?.getBoundingClientRect()
    if (!bounds?.width) return
    const viewX = (event.clientX - bounds.left) / bounds.width * DESKTOP.width
    setHovered(nearestBalancePoint(desktopCoordinates, viewX))
  }

  const mobileAxis = balanceAxis(points, 4)
  const mobileCoordinates = balanceCoordinates(points, mobileAxis, MOBILE)
  const mobileMonths = balanceMonthTicks(points, 3)
  const mobileLine = linePath(mobileCoordinates)

  return <>
    <div className="bank-chart-desktop bank-balance-desktop">
      <svg className="balance-chart-pro" viewBox={`0 0 ${DESKTOP.width} ${DESKTOP.height}`} role="img" aria-label="Connected bank balance over time with rounded value and calendar month axes">
        <defs><linearGradient id="bank-balance-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="bank-balance-area-start" /><stop offset="1" className="bank-balance-area-end" /></linearGradient></defs>
        {desktopAxis.ticks.map((tick) => {
          const y = DESKTOP.pad.top + (desktopAxis.max - tick) / Math.max(1, desktopAxis.max - desktopAxis.min) * (DESKTOP.height - DESKTOP.pad.top - DESKTOP.pad.bottom)
          return <g key={`y-${tick}`}><line className="bank-balance-grid" x1={DESKTOP.pad.left} y1={y} x2={DESKTOP.width - DESKTOP.pad.right} y2={y} /><text className="bank-balance-axis-label" x={DESKTOP.pad.left - 12} y={y + 4} textAnchor="end">{formatAxisMoney(tick)}</text></g>
        })}
        {desktopMonths.map((tick) => {
          const x = xForBalanceDate(tick.date, points, DESKTOP)
          return <g key={`x-${tick.date}`}><line className="bank-balance-month-tick" x1={x} y1={desktopBottom} x2={x} y2={desktopBottom + 5} /><text className="bank-balance-month-label" x={x} y={DESKTOP.height - 16} textAnchor="middle">{tick.label}</text></g>
        })}
        <path d={desktopArea} className="bank-balance-area" />
        <path d={desktopLine} className="bank-balance-line" />
        {hovered && <g className="bank-balance-hover" pointerEvents="none">
          <line className="bank-balance-hover-guide" x1={hovered.x} y1={DESKTOP.pad.top} x2={hovered.x} y2={desktopBottom} />
          <circle className="bank-balance-hover-dot" cx={hovered.x} cy={hovered.y} r="5" />
          <g transform={`translate(${tooltipX},${tooltipY})`}>
            <rect className="bank-balance-tooltip-card" width={tooltipWidth} height={tooltipHeight} rx="11" />
            <text className="bank-balance-tooltip-value" x="12" y="22">{preciseMoney(hovered.balance)}</text>
            <text className="bank-balance-tooltip-date" x="12" y="40">{formatBalanceDate(hovered.date)}</text>
          </g>
        </g>}
        <rect className="bank-balance-hit-area" x={DESKTOP.pad.left} y={DESKTOP.pad.top} width={DESKTOP.width - DESKTOP.pad.left - DESKTOP.pad.right} height={DESKTOP.height - DESKTOP.pad.top - DESKTOP.pad.bottom} onPointerMove={handlePointerMove} onPointerLeave={() => setHovered(null)} />
      </svg>
    </div>

    <div className="bank-balance-mobile">
      <div className="bank-mobile-chart-head"><div><span>Current balance</span><strong>{currency(points.at(-1).balance)}</strong></div></div>
      <svg viewBox={`0 0 ${MOBILE.width} ${MOBILE.height}`} role="img" aria-label="Mobile connected bank balance history">
        {mobileAxis.ticks.map((tick) => {
          const y = MOBILE.pad.top + (mobileAxis.max - tick) / Math.max(1, mobileAxis.max - mobileAxis.min) * (MOBILE.height - MOBILE.pad.top - MOBILE.pad.bottom)
          return <g key={`my-${tick}`}><line className="bank-balance-grid" x1={MOBILE.pad.left} y1={y} x2={MOBILE.width - MOBILE.pad.right} y2={y} /><text className="bank-balance-axis-label" x={MOBILE.pad.left - 7} y={y + 3} textAnchor="end">{formatAxisMoney(tick)}</text></g>
        })}
        {mobileMonths.map((tick) => {
          const x = xForBalanceDate(tick.date, points, MOBILE)
          return <text className="bank-balance-month-label" key={`mx-${tick.date}`} x={x} y={MOBILE.height - 8} textAnchor="middle">{tick.label}</text>
        })}
        <path d={mobileLine} className="bank-balance-line" />
        <circle cx={mobileCoordinates.at(-1).x} cy={mobileCoordinates.at(-1).y} r="4" className="bank-mobile-latest-dot" />
      </svg>
    </div>
  </>
}

export function BankSummary({ reportingBalance, reportingAccountCount, cashSummary }) {
  return <section className="bank-summary-grid" aria-label="Banking summary">
    <article className="bank-summary-card primary"><span>Cash balance</span><strong>{currency(reportingBalance)}</strong><small>{reportingAccountCount} selected GBP account{reportingAccountCount === 1 ? '' : 's'}</small></article>
    <article className={`bank-summary-card ${amountTone(cashSummary.companyFreeCashFlow)}`}><span>Business cash generated</span><strong>{currency(cashSummary.companyFreeCashFlow)}</strong><small>Selected period · owner funding excluded</small></article>
    <article className={`bank-summary-card ${cashSummary.reviewCount ? 'attention' : ''}`}><span>Needs review</span><strong>{cashSummary.reviewCount}</strong><small>{cashSummary.reviewCount ? `${currency(cashSummary.reviewAbsolute)} awaiting classification` : 'All transactions classified'}</small></article>
  </section>
}

export function CashFlowReconciliation({ cashSummary }) {
  const otherMovement = Number(cashSummary.reviewNet || 0) + Number(cashSummary.excludedNet || 0)
  const breakdown = [
    ['Property operations', cashSummary.operatingCashFlow, 'Rent and property running costs'],
    ['Company-level cash', cashSummary.companyOnlyCashFlow, 'Tax, salary and other company-level movements'],
    ['Financing', cashSummary.financingCashFlow, 'Mortgage and financing movements'],
    ['Owner / DLA funding', cashSummary.ownerFundingNet, 'DLA injections minus repayments'],
    ['Needs review', cashSummary.reviewNet, `${cashSummary.reviewCount} transaction${cashSummary.reviewCount === 1 ? '' : 's'} awaiting classification`],
    ['Excluded from analysis', cashSummary.excludedNet, `${cashSummary.excludedCount} explicitly excluded transaction${cashSummary.excludedCount === 1 ? '' : 's'}`],
  ]
  return <section className="panel bank-reconciliation" aria-label="Cash flow reconciliation">
    <header><div><h2>How bank movement is explained</h2><p>Start with cash generated by the business, then add owner funding and bank-only movement.</p></div></header>
    <div className="bank-reconcile-equation">
      <article><span>Business cash generated</span><strong className={amountTone(cashSummary.companyFreeCashFlow)}>{currency(cashSummary.companyFreeCashFlow)}</strong><small>Operations + company-level cash + financing</small></article>
      <i aria-hidden="true">+</i>
      <article><span>Owner funding</span><strong className={amountTone(cashSummary.ownerFundingNet)}>{currency(cashSummary.ownerFundingNet)}</strong><small>DLA injected minus DLA repaid</small></article>
      <i aria-hidden="true">+</i>
      <article><span>Other bank movement</span><strong className={amountTone(otherMovement)}>{currency(otherMovement)}</strong><small>{cashSummary.reviewCount} to review · {cashSummary.excludedCount} excluded</small></article>
      <i aria-hidden="true">=</i>
      <article className="total"><span>Net bank movement</span><strong className={amountTone(cashSummary.netBankMovement)}>{currency(cashSummary.netBankMovement)}</strong><small>Selected period · internal transfers ignored</small></article>
    </div>
    <details className="bank-reconcile-details"><summary>Show detailed breakdown</summary><div>{breakdown.map(([label, value, note]) => <div className="bank-reconcile-row" key={label}><span><b>{label}</b><small>{note}</small></span><strong className={amountTone(value)}>{currency(value)}</strong></div>)}<div className="bank-reconcile-row muted"><span><b>Internal transfers ignored</b><small>{cashSummary.internalTransferCount} transfer{cashSummary.internalTransferCount === 1 ? '' : 's'} excluded from movement</small></span><strong>{currency(cashSummary.internalTransferAbsolute)}</strong></div></div></details>
  </section>
}
