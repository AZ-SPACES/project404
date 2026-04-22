interface WaitlistSuccessProps {
  show: boolean;
}

const celebrationDelays = ["0s", "0.15s", "0.3s"];

export function WaitlistSuccess({ show }: WaitlistSuccessProps) {
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center rounded-xl transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
        show
          ? "opacity-100 scale-100 animate-success-pulse animate-success-glow"
          : "opacity-0 scale-95 pointer-events-none"
      }`}
      style={{ backgroundColor: "#10b981" }}
    >
      {show && celebrationDelays.map((delay, i) => (
        <div
          key={i}
          className="absolute top-1/2 left-1/2 w-full h-full rounded-full border-2 animate-ring"
          style={{ borderColor: `rgba(167,243,208,${1 - i * 0.25})`, animationDelay: delay }}
        />
      ))}

      <div className={`flex items-center gap-2 text-white font-semibold text-lg ${show ? "animate-bounce-in" : ""}`}>
        <div className="bg-white/20 p-1 rounded-full">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              className={show ? "animate-checkmark" : ""}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <span>You&apos;re on the Aza waitlist!</span>
      </div>
    </div>
  );
}
