interface Props {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: { width: 96, height: 36 },
  md: { width: 128, height: 48 },
  lg: { width: 160, height: 60 },
}

export default function Logo({ size = 'md', className = '' }: Props) {
  const { width, height } = sizes[size]
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 160 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="كيان"
      role="img"
    >
      {/* Outer border */}
      <rect x="1" y="1" width="158" height="58" rx="3" stroke="#c4c4c4" strokeWidth="1.5" />

      {/* Left half — black background with KAYAN */}
      <rect x="2" y="2" width="77" height="56" fill="#111111" />

      {/* Right half — blue gradient with كيان */}
      <defs>
        <linearGradient id="blueGrad" x1="79" y1="2" x2="158" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3b9ed9" />
          <stop offset="100%" stopColor="#1a7cbf" />
        </linearGradient>
      </defs>
      <rect x="79" y="2" width="79" height="56" fill="url(#blueGrad)" />

      {/* Divider line between halves */}
      <line x1="79" y1="2" x2="79" y2="58" stroke="#c4c4c4" strokeWidth="1" />

      {/* KAYAN text on black side */}
      <text
        x="40"
        y="36"
        textAnchor="middle"
        fill="white"
        fontSize="16"
        fontFamily="'Arial', sans-serif"
        fontWeight="700"
        letterSpacing="3"
      >
        KAYAN
      </text>
      {/* Decorative dot under first A */}
      <circle cx="24" cy="42" r="1.5" fill="white" opacity="0.6" />

      {/* كيان text on blue side */}
      <text
        x="119"
        y="37"
        textAnchor="middle"
        fill="white"
        fontSize="18"
        fontFamily="'Cairo', 'Arial', sans-serif"
        fontWeight="700"
      >
        كيان
      </text>
    </svg>
  )
}
