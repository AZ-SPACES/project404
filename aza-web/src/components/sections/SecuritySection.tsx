import { Lock, Fingerprint, ShieldCheck, Smartphone, LockKeyhole } from "lucide-react";

const items = [
  {
    icon: <Lock size={24} />,
    title: "End-to-End Encryption",
    desc: "Every message and transaction is fully encrypted in transit and at rest.",
  },
  {
    icon: <Fingerprint size={24} />,
    title: "Biometric Authentication",
    desc: "Face ID and fingerprint login keep your account locked to you — literally.",
  },
  {
    icon: <ShieldCheck size={24} />,
    title: "KYC Verification",
    desc: "We verify every user with ID and face scan so your money only goes where you send it.",
  },
  {
    icon: <Smartphone size={24} />,
    title: "Device Management",
    desc: "Monitor and control all devices logged into your account from one place.",
  },
];

const badges = ["256-bit AES", "TLS 1.3", "2FA", "Biometrics", "KYC", "PEP Screening"];

export function SecuritySection() {
  return (
    <section id="security" className="section-py" style={{ background: "var(--aza-surface)" }}>
      <div className="security-grid max-w-[1160px] mx-auto px-4 sm:px-6 grid gap-12 lg:gap-[80px] items-center" style={{ gridTemplateColumns: "1fr 1fr" }}>

        {/* Content */}
        <div className="reveal-x-left">
          <p className="text-[0.8rem] font-semibold mb-2" style={{ color: "#174717" }}>Built for trust</p>
          <h2 className="text-[clamp(1.8rem,3.5vw,2.5rem)] font-bold tracking-[-0.02em] mb-4" style={{ color: "var(--aza-text)" }}>
            Your money is safe with us
          </h2>
          <p className="text-[1.05rem] leading-[1.7] mb-8" style={{ color: "var(--aza-text-secondary)" }}>
            Aza uses bank-level security at every layer — from biometrics to end-to-end encryption.
          </p>
          <div className="flex flex-col gap-6">
            {items.map((item, i) => (
              <div key={item.title} className="reveal flex gap-4 items-start" data-delay={String(i * 80 + 200)}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-[1.5rem] shrink-0" style={{ background: "var(--aza-surface-2)" }}>
                  {item.icon}
                </div>
                <div>
                  <h4 className="text-[1rem] font-semibold mb-1" style={{ color: "var(--aza-text)" }}>{item.title}</h4>
                  <p className="text-[0.875rem] leading-[1.5]" style={{ color: "var(--aza-text-secondary)" }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="reveal-x-right flex justify-center">
          <div className="rounded-xl p-12 text-center max-w-[340px] w-full" style={{ background: "#174717", boxShadow: "0 2px 8px rgba(23,71,23,0.12)" }}>
            <div className="text-[3rem] mb-4 flex justify-center"><LockKeyhole size={48} color="#B7EE7A" /></div>
            <h3 className="text-[1.2rem] font-semibold text-white mb-6">Protected by design</h3>
            <div className="flex flex-wrap gap-2 justify-center">
              {badges.map((b, i) => (
                <span
                  key={b}
                  className="reveal px-[14px] py-[6px] rounded-md text-[0.8rem] font-semibold"
                  data-delay={String(i * 60 + 400)}
                  style={{ background: "rgba(183,238,122,0.15)", border: "1px solid rgba(183,238,122,0.3)", color: "#B7EE7A" }}
                >
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
