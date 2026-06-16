type Status = "idle" | "loading" | "success";

interface WaitlistFormProps {
  email: string;
  status: Status;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

// The error message is rendered by WaitlistHero below the form
export function WaitlistForm({ email, status, onChange, onSubmit }: WaitlistFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className={`relative w-full h-full transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
        status === "success"
          ? "opacity-0 scale-95 pointer-events-none"
          : "opacity-100 scale-100"
      }`}
    >
      <input
        id="waitlist-email"
        type="email"
        required
        placeholder="name@email.com"
        value={email}
        disabled={status === "loading"}
        onChange={onChange}
        aria-label="Email address"
        className="w-full h-[60px] pl-6 pr-[150px] rounded-xl outline-none transition-all duration-200 placeholder-zinc-500 disabled:opacity-70 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#B7EE7A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#27272a]"
        style={{
          backgroundColor: "#27272a",
          color: "#ffffff",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)",
        }}
      />
      <div className="absolute top-[6px] right-[6px] bottom-[6px]">
        <button
          type="submit"
          disabled={status === "loading"}
          className="h-full px-6 rounded-xl font-semibold transition-all active:scale-95 hover:opacity-90 disabled:hover:opacity-100 disabled:active:scale-100 disabled:cursor-wait flex items-center justify-center min-w-[130px]"
          style={{ backgroundColor: "#174717", color: "#B7EE7A" }}
        >
          {status === "loading" ? (
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-label="Joining…"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            "Join waitlist"
          )}
        </button>
      </div>
    </form>
  );
}
