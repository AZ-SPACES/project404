import { Hand, ArrowUp, ArrowDown, ScanLine } from "lucide-react";

const transactions = [
  { bg: "#4285F4", letter: "J", name: "Jordan",  date: "Today",     amount: "-₵45.00",  out: true },
  { bg: "#B7EE7A", color: "#174717", letter: "M", name: "Maya", date: "Yesterday", amount: "+₵120.00", out: false },
  { bg: "#FF6D00", letter: "S", name: "Sam",     date: "Mon",       amount: "-₵30.00",  out: true },
] as const;

const actions = [
  { Icon: ArrowUp,   label: "Send"    },
  { Icon: ArrowDown, label: "Request" },
  { Icon: ScanLine,  label: "Scan"    },
] as const;

export function HomeScreen() {
  return (
    <div className="phone-slide screen--home active">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-[11px] m-0" style={{ color: "#5F6368" }}>Good morning,</p>
          <p className="text-[15px] font-bold m-0 flex items-center gap-1" style={{ color: "#0E0F0C" }}>
            Alex <Hand size={15} />
          </p>
        </div>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-[14px] font-bold"
          style={{ background: "#174717", color: "#B7EE7A" }}
        >
          A
        </div>
      </div>

      <div className="rounded-2xl p-[18px] mb-4" style={{ background: "#174717" }}>
        <p className="text-[11px] m-0" style={{ color: "rgba(255,255,255,0.7)" }}>Total Balance</p>
        <h2
          className="text-[26px] font-black tracking-tight my-1 m-0"
          style={{ color: "#fff", letterSpacing: "-0.03em" }}
        >
          ₵4,280.50
        </h2>
        <p className="text-[11px] m-0" style={{ color: "#B7EE7A" }}>+₵120.00 this week</p>
      </div>

      <div className="flex gap-2 mb-4">
        {actions.map(({ Icon, label }) => (
          <div
            key={label}
            className="flex-1 bg-white rounded-xl p-[10px_6px] flex flex-col items-center gap-1 text-[10px] font-semibold shadow-sm"
            style={{ color: "#174717" }}
          >
            <Icon size={16} />
            {label}
          </div>
        ))}
      </div>

      <p className="text-[12px] font-bold mb-[10px]" style={{ color: "#0E0F0C" }}>Recent</p>
      {transactions.map((tx) => (
        <div key={tx.name} className="flex items-center gap-[10px] py-2 border-b border-black/[0.06]">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
            style={{ background: tx.bg, color: "color" in tx ? tx.color : "#fff" }}
          >
            {tx.letter}
          </div>
          <div className="flex-1">
            <span className="block text-[11px] font-semibold" style={{ color: "#0E0F0C" }}>{tx.name}</span>
            <span className="block text-[10px]" style={{ color: "#5F6368" }}>{tx.date}</span>
          </div>
          <span className="text-[12px] font-bold" style={{ color: tx.out ? "#EA4335" : "#34A853" }}>
            {tx.amount}
          </span>
        </div>
      ))}
    </div>
  );
}
