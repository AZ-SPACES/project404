import { ArrowLeft, Pizza } from "lucide-react";

export function SendScreen() {
  return (
    <div className="phone-slide screen--send">
      <div className="flex items-center gap-[10px] mb-4">
        <ArrowLeft size={18} className="cursor-pointer" style={{ color: "#174717" }} />
        <span className="text-[15px] font-bold" style={{ color: "#0E0F0C" }}>Send Money</span>
      </div>

      <div className="text-center py-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-[22px] font-bold mx-auto mb-2"
          style={{ background: "#174717", color: "#B7EE7A" }}
        >
          J
        </div>
        <p className="text-[15px] font-bold m-0" style={{ color: "#0E0F0C" }}>Jordan K.</p>
        <p className="text-[11px] m-0" style={{ color: "#5F6368" }}>@jordank</p>
      </div>

      <div className="flex items-center justify-center gap-1 py-4">
        <span className="text-[24px] font-bold" style={{ color: "#5F6368" }}>$</span>
        <span className="text-[42px] font-black" style={{ color: "#0E0F0C", letterSpacing: "-0.03em" }}>
          45.00
        </span>
      </div>

      <div className="px-2 pb-4">
        <div
          className="w-full rounded-xl px-3 py-[10px] text-[12px] flex items-center gap-1"
          style={{ background: "#ECEEF0", color: "#5F6368" }}
        >
          Dinner last night <Pizza size={12} />
        </div>
      </div>

      <button
        className="w-[calc(100%-16px)] mx-2 text-white rounded-full py-[14px] text-[13px] font-bold"
        style={{ background: "#174717" }}
      >
        Send $45.00
      </button>
    </div>
  );
}
