"use client";

interface WaitlistSuccessProps {
  show: boolean;
  position?: number;
}

const celebrationDelays = ["0s", "0.15s", "0.3s"];

const SHARE_TEXT = (pos?: number) =>
  pos
    ? `I just joined the Aza waitlist — I'm #${pos.toLocaleString()} in line. Send money effortlessly with @azafintech 🚀`
    : "Just joined the Aza waitlist — the money app built for Africa. Send money instantly, zero fees. @azafintech 🚀";

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.263 5.633 5.901-5.633Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function WaitlistSuccess({ show, position }: WaitlistSuccessProps) {
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center rounded-xl transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
        show
          ? "opacity-100 scale-100"
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

      <div className={`relative z-10 flex items-center gap-2 text-white font-semibold text-[0.9rem] ${show ? "animate-bounce-in" : ""}`}>
        <div className="bg-white/20 p-1 rounded-full shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              className={show ? "animate-checkmark" : ""}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <span>
          {position ? `You're #${position.toLocaleString()} on the list!` : "You're on the Aza waitlist!"}
        </span>
      </div>
    </div>
  );
}

export function WaitlistSharePrompt({ show, position }: WaitlistSuccessProps) {
  if (!show) return null;

  const shareText = SHARE_TEXT(position);
  const shareUrl = "https://aza.systems";
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;

  return (
    <div
      className="w-full max-w-md text-center animate-fade-in-up"
      style={{ animationDelay: "0.4s", animationFillMode: "both" }}
    >
      <p className="text-[0.8rem] font-medium mb-3" style={{ color: "rgba(255,255,255,0.6)" }}>
        Know someone who&apos;d love Aza? Share your spot.
      </p>
      <div className="flex gap-2 justify-center">
        <a
          href={twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[0.8rem] font-semibold transition-opacity hover:opacity-80"
          style={{ background: "rgba(255,255,255,0.12)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.2)" }}
        >
          <XIcon />
          Share on X
        </a>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[0.8rem] font-semibold transition-opacity hover:opacity-80"
          style={{ background: "rgba(255,255,255,0.12)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.2)" }}
        >
          <WhatsAppIcon />
          Share on WhatsApp
        </a>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fadeInUp 0.5s ease-out; }
      `}</style>
    </div>
  );
}
