export default function LogoBadge({ className = '' }: { className?: string }) {
  return (
    <div className={`logo-badge ${className}`} role="img" aria-label="Kickoff Star badge">
      <img src="./kickoff-logo.jpg" alt="" draggable={false} />
    </div>
  )
}
