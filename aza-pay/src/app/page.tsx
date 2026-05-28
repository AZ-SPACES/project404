export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="flex items-center justify-center mx-auto mb-5">
          <img src="/logo.png" alt="Aza Pay" className="h-10 w-auto" />
        </div>
        <p className="text-sm text-white/40">
          This is the AZA secure checkout. You need a payment link to make a payment.
        </p>
      </div>
      <p className="absolute bottom-6 text-[11px] text-white/20">pay.aza.systems</p>
    </div>
  );
}
