import React from 'react'
import './BrandLoadingScreen.css'

// The approved V5 assembly: clockwise house outline, ascending bars, then a single text fade.
// Mounted once across session verification and portfolio hydration to avoid a second splash.
export default function BrandLoadingScreen() {
  return (
    <div className="brand-loader-screen" role="status" aria-live="polite">
      <span className="brand-loader-sr-only">Loading BTL Portfolio</span>
      <svg
        className="brand-loader-art"
        viewBox="0 0 840 445"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id="brand-loader-tile" x1="0" x2="1" y1="0" y2="1">
            <stop stopColor="#0a2023" />
            <stop offset="1" stopColor="#102b2b" />
          </linearGradient>
          <linearGradient id="brand-loader-bars" x1="0" x2="1" y1="1" y2="0">
            <stop stopColor="#2bb999" />
            <stop offset="1" stopColor="#55caa4" />
          </linearGradient>
        </defs>

        <g transform="translate(291 0)">
          <rect className="brand-loader-tile" x="18" y="18" width="222" height="216" rx="49" />
          <path
            className="brand-loader-house"
            d="M59 177 L59 121 Q59 116 63 113 L125 64 Q129 61 133 64 L195 114 Q200 118 200 123 L200 177"
          />
          <rect className="brand-loader-bar one" x="84" y="157" width="22" height="34" rx="4" />
          <rect className="brand-loader-bar two" x="116" y="140" width="22" height="51" rx="4" />
          <rect className="brand-loader-bar three" x="149" y="119" width="22" height="72" rx="4" />
        </g>

        <g className="brand-loader-wordmark" transform="translate(-215 225)" fontFamily="Inter, Arial, sans-serif">
          <g className="brand-loader-btl">
            <text x="285" y="180">B</text>
            <text x="380" y="180">T</text>
            <text x="468" y="180">L</text>
          </g>
          <g className="brand-loader-portfolio">
            <text x="560" y="180">P</text>
            <text x="621" y="180">o</text>
            <text x="680" y="180">r</text>
            <text x="719" y="180">t</text>
            <text x="754" y="180">f</text>
            <text x="785" y="180">o</text>
            <text x="846" y="180">l</text>
            <text x="868" y="180">i</text>
            <text x="890" y="180">o</text>
          </g>
        </g>
      </svg>
    </div>
  )
}
