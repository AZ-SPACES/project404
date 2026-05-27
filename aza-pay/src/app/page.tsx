export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-[#F5A623] flex items-center justify-center mx-auto mb-5">
          <span className="text-black font-bold text-2xl">A</span>
        </div>
        <h1 className="text-xl font-semibold text-white mb-2">AZA Pay</h1>
        <p className="text-sm text-white/40">
          This is the AZA secure checkout. You need a payment link to make a payment.
        </p>
      </div>
      <p className="absolute bottom-6 text-[11px] text-white/20">pay.aza.systems</p>
    </div>
  );
}
