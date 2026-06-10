import { CinematicHero } from "@/components/ui/cinematic-landing-hero";
import { Navbar } from "@/components/Navbar";
import { ScrollReveal } from "@/components/ScrollReveal";
import { HeroSection } from "@/components/sections/HeroSection";
import { FeaturesSection } from "@/components/sections/FeaturesSection";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { SecuritySection } from "@/components/sections/SecuritySection";
import { HubSection } from "@/components/sections/HubSection";
import { DownloadSection } from "@/components/sections/DownloadSection";
import { WaitlistSection } from "@/components/sections/Waitlist";
import { CinematicFooter } from "@/components/ui/motion-footer";

export default function Home() {
  return (
    <>
      <ScrollReveal />
      <Navbar />

      <main className="relative z-10 bg-background rounded-b-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
        <CinematicHero tagline1="Send money." tagline2="Effortlessly." />
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <SecuritySection />
        <HubSection />
        <DownloadSection />
        <WaitlistSection />
      </main>

      <CinematicFooter />
    </>
  );
}
