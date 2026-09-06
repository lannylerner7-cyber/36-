type DepSlipMarkProps = {
  compact?: boolean;
  className?: string;
};

export function DepSlipMark({ compact = false, className = '' }: DepSlipMarkProps) {
  return (
    <svg
      aria-label="DepSlip"
      className={className}
      role="img"
      viewBox="0 0 48 48"
      width={compact ? 34 : 42}
      height={compact ? 34 : 42}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="1" y="1" width="46" height="46" rx="13" fill="currentColor" fillOpacity=".12" />
      <path d="M14 12.5h14.2L34 18.3v16.9H14V12.5Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M28 12.5v6h6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M18.5 24h11M18.5 28h7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m17.2 20.2 2 1.8 3.4-3.8" stroke="hsl(32 69% 58%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 35.5h26" stroke="currentColor" strokeOpacity=".5" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}