import React from 'react'

export default function BrandLogo({ surface = 'auto', className = '' }) {
  return <span className={`brand-wordmark ${className}`.trim()} data-surface={surface} role="img" aria-label="BTL Portfolio">
    <img
      className="brand-wordmark-on-light"
      src="/brand/btlportfolio-logo-horizontal-1024w.png"
      alt=""
      aria-hidden="true"
    />
    <img
      className="brand-wordmark-on-dark"
      src="/brand/btlportfolio-logo-horizontal-on-dark-1024w.png"
      alt=""
      aria-hidden="true"
    />
  </span>
}
