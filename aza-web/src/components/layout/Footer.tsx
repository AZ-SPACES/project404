const productLinks = [
  { label: "Features",      href: "#features"     },
  { label: "How it works",  href: "#how-it-works"  },
  { label: "Mini-App Hub",  href: "#hub"           },
  { label: "Security",      href: "#security"      },
  { label: "Download",      href: "#download"      },
];
const companyLinks = ["About", "Careers", "Blog", "Press"];
const supportLinks = ["Help Center", "Contact Us", "Chat with Us", "System Status"];
const legalLinks   = ["Privacy Policy", "Terms of Service", "Cookie Policy", "Compliance"];

const socials = [
  {
    label: "Twitter/X",
    svg: <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />,
    fill: true,
  },
  {
    label: "Instagram",
    svg: <><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></>,
    fill: false,
  },
  {
    label: "LinkedIn",
    svg: <><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" /><circle cx="4" cy="4" r="2" /></>,
    fill: true,
  },
];

export function Footer() {
  return (
    <footer style={{ background: "var(--aza-surface)", borderTop: "1px solid var(--aza-border)", padding: "80px 0 24px" }}>
      <div className="max-w-[1160px] mx-auto px-4 sm:px-6">
        <div
          className="footer-grid grid gap-8 md:gap-12 mb-12"
          style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr" }}
        >
          {/* Brand */}
          <div className="footer-brand-col">
            <a
              href="#"
              className="flex items-center gap-2 font-extrabold text-[1.2rem] mb-2"
              style={{ letterSpacing: "-0.04em", color: "var(--aza-text)" }}
            >
              <span
                className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[0.9rem] font-black"
                style={{ background: "#B7EE7A", color: "#174717" }}
              >
                A
              </span>
              aza
            </a>
            <p className="text-[0.875rem] mt-2 mb-4" style={{ color: "var(--aza-text-secondary)" }}>
              Send money. Effortlessly.
            </p>
            <div className="flex gap-2">
              {socials.map(({ label, svg, fill }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="social-link w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "var(--aza-surface-2)", color: "var(--aza-text-secondary)" }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill={fill ? "currentColor" : "none"}
                    stroke={fill ? "none" : "currentColor"}
                    strokeWidth={fill ? undefined : 2}
                    aria-hidden="true"
                  >
                    {svg}
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-[0.875rem] font-semibold mb-4" style={{ color: "var(--aza-text)" }}>Product</h4>
            {productLinks.map(({ label, href }) => (
              <a key={label} href={href} className="block text-[0.875rem] mb-2 transition-colors hover:text-[#174717]" style={{ color: "var(--aza-text-secondary)" }}>
                {label}
              </a>
            ))}
          </div>

          {/* Company */}
          <div>
            <h4 className="text-[0.875rem] font-semibold mb-4" style={{ color: "var(--aza-text)" }}>Company</h4>
            {companyLinks.map((l) => (
              <a key={l} href="#" className="block text-[0.875rem] mb-2 transition-colors hover:text-[#174717]" style={{ color: "var(--aza-text-secondary)" }}>{l}</a>
            ))}
          </div>

          {/* Support */}
          <div>
            <h4 className="text-[0.875rem] font-semibold mb-4" style={{ color: "var(--aza-text)" }}>Support</h4>
            {supportLinks.map((l) => (
              <a key={l} href="#" className="block text-[0.875rem] mb-2 transition-colors hover:text-[#174717]" style={{ color: "var(--aza-text-secondary)" }}>{l}</a>
            ))}
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-[0.875rem] font-semibold mb-4" style={{ color: "var(--aza-text)" }}>Legal</h4>
            {legalLinks.map((l) => (
              <a key={l} href="#" className="block text-[0.875rem] mb-2 transition-colors hover:text-[#174717]" style={{ color: "var(--aza-text-secondary)" }}>{l}</a>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center flex-wrap gap-2 pt-6" style={{ borderTop: "1px solid var(--aza-border)" }}>
          <p className="text-[0.8rem] m-0" style={{ color: "var(--aza-text-secondary)" }}>© 2026 JumpSpaces, Inc. All rights reserved.</p>
          <p className="text-[0.8rem] m-0" style={{ color: "var(--aza-text-secondary)" }}>Available in 150+ countries.</p>
        </div>
      </div>
    </footer>
  );
}
