import { ArrowLeft, ArrowRight, Banknote, PartyPopper } from "lucide-react";

const messages = [
  { side: "left",  bg: "#E6ECE1", color: "#0E0F0C", text: "Hey! Can you send me the ₵120?",  Icon: null },
  { side: "right", bg: "#174717", color: "#fff",     text: "Sure! Just sent it ",              Icon: Banknote },
  { side: "left",  bg: "#E6ECE1", color: "#0E0F0C", text: "Got it, thanks! ",                  Icon: PartyPopper },
  { side: "right", bg: "#174717", color: "#fff",     text: "Anytime!",                         Icon: null },
] as const;

export function ChatScreen() {
  return (
    <div className="phone-slide screen--chat">
      <div className="flex items-center gap-[10px] mb-4">
        <ArrowLeft size={18} className="cursor-pointer" style={{ color: "#174717" }} />
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
            style={{ background: "#B7EE7A", color: "#174717" }}
          >
            M
          </div>
          <span className="text-[15px] font-bold" style={{ color: "#0E0F0C" }}>Maya</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-2 overflow-hidden">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[75%] px-3 py-2 text-[11px] leading-[1.4] flex items-center gap-1 ${
              m.side === "right"
                ? "self-end rounded-2xl rounded-br-[4px]"
                : "self-start rounded-2xl rounded-bl-[4px]"
            }`}
            style={{ background: m.bg, color: m.color }}
          >
            {m.text}
            {m.Icon && <m.Icon size={12} />}
          </div>
        ))}
      </div>

      <div className="flex gap-2 p-2 mt-auto border-t" style={{ borderColor: "#DADCE0" }}>
        <div
          className="flex-1 rounded-full px-3 py-2 text-[11px]"
          style={{ background: "#ECEEF0", color: "#5F6368" }}
        >
          Message...
        </div>
        <button
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: "#174717", color: "#B7EE7A" }}
          aria-label="Send message"
        >
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
