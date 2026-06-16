import { SmoothScroll } from "@/components/SmoothScroll";
import { CinematicHero } from "@/components/ui/cinematic-landing-hero";
import { Navbar } from "@/components/layout/Navbar";
import { ScrollReveal } from "@/components/layout/ScrollReveal";
import { HeroSection } from "@/components/sections/HeroSection";
import { PressSection } from "@/components/sections/PressSection";
import { StatsBannerSection } from "@/components/sections/StatsBannerSection";
import { FeatureSpotlightSection } from "@/components/sections/FeatureSpotlightSection";
import { ComparisonSection } from "@/components/sections/ComparisonSection";
import { UseCasesSection } from "@/components/sections/UseCasesSection";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { AvailabilitySection } from "@/components/sections/AvailabilitySection";
import { SecuritySection } from "@/components/sections/SecuritySection";
import { PartnerBarSection } from "@/components/sections/PartnerBarSection";
import { MerchantSection } from "@/components/sections/MerchantSection";
import { DemoSection } from "@/components/sections/DemoSection";
import { FAQSection } from "@/components/sections/FAQSection";
import { HubSection } from "@/components/sections/HubSection";
import { TestimonialsSection } from "@/components/sections/TestimonialsSection";
import { BlogSection } from "@/components/sections/BlogSection";
import { DownloadSection } from "@/components/sections/DownloadSection";
import { WaitlistSection } from "@/components/sections/Waitlist";
import { CinematicFooter } from "@/components/ui/motion-footer";
import { FloatingCTA } from "@/components/FloatingCTA";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://aza.systems";

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Aza",
            operatingSystem: "iOS, Android",
            applicationCategory: "FinanceApplication",
            url: siteUrl,
            offers: { "@type": "Offer", price: "0", priceCurrency: "GHS" },
            description: "Send and request money, chat with friends, scan QR codes, and access powerful mini-apps — all in one secure platform.",
          }),
        }}
      />
      <SmoothScroll />
      <ScrollReveal />
      <Navbar />
      <FloatingCTA />

      <main className="relative z-10 bg-background rounded-b-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
        <CinematicHero tagline1="Send money." tagline2="Effortlessly." />
        <HeroSection />
        <PressSection />
        <StatsBannerSection />
        <FeatureSpotlightSection />
        <DemoSection />
        <ComparisonSection />
        <UseCasesSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <SecuritySection />
        <PartnerBarSection />
        <AvailabilitySection />
        <MerchantSection />
        <HubSection />
        <BlogSection />
        <FAQSection />
        <WaitlistSection />
        <DownloadSection />
      </main>

      <CinematicFooter />
    </>
  );
}
