import { DeckShell } from "@/components/deck/DeckShell";

import { CoverSlide as InvestorCover } from "@/components/slides/investor/CoverSlide";
import { ProblemSlide as InvestorProblem } from "@/components/slides/investor/ProblemSlide";
import { ProductSlide } from "@/components/slides/investor/ProductSlide";
import { BuiltSlide } from "@/components/slides/investor/BuiltSlide";
import { CashNetworkSlide } from "@/components/slides/investor/CashNetworkSlide";
import { SafeguardingSlide as InvestorSafeguarding } from "@/components/slides/investor/SafeguardingSlide";
import { FlywheelSlide } from "@/components/slides/investor/FlywheelSlide";
import { UnitEconomicsSlide } from "@/components/slides/investor/UnitEconomicsSlide";
import { ConsumerFeesSlide } from "@/components/slides/investor/ConsumerFeesSlide";
import { MerchantFeesSlide } from "@/components/slides/investor/MerchantFeesSlide";
import { TreasuryFeesSlide } from "@/components/slides/investor/TreasuryFeesSlide";
import { AgentEconomicsSlide } from "@/components/slides/investor/AgentEconomicsSlide";
import { BrandSlide } from "@/components/slides/investor/BrandSlide";
import { RoadmapSlide } from "@/components/slides/investor/RoadmapSlide";
import { CloseSlide as InvestorClose } from "@/components/slides/investor/CloseSlide";

import { CoverSlide as PartnerCover } from "@/components/slides/partner/CoverSlide";
import { PositionSlide } from "@/components/slides/partner/PositionSlide";
import { ClosedLoopSlide } from "@/components/slides/partner/ClosedLoopSlide";
import { SafeguardingSlide as PartnerSafeguarding } from "@/components/slides/partner/SafeguardingSlide";
import { ControlsSlide } from "@/components/slides/partner/ControlsSlide";
import { AgentControlsSlide } from "@/components/slides/partner/AgentControlsSlide";
import { KycRiskSlide } from "@/components/slides/partner/KycRiskSlide";
import { MakerCheckerSlide } from "@/components/slides/partner/MakerCheckerSlide";
import { AuditSlide } from "@/components/slides/partner/AuditSlide";
import { SecuritySlide } from "@/components/slides/partner/SecuritySlide";
import { CloseSlide as PartnerClose } from "@/components/slides/partner/CloseSlide";

import { CoverSlide as AcademicCover } from "@/components/slides/academic/CoverSlide";
import { ProblemSlide as AcademicProblem } from "@/components/slides/academic/ProblemSlide";
import { GapSlide } from "@/components/slides/academic/GapSlide";
import { ObjectivesSlide } from "@/components/slides/academic/ObjectivesSlide";
import { ScopeSlide } from "@/components/slides/academic/ScopeSlide";
import { ArtefactSlide } from "@/components/slides/academic/ArtefactSlide";
import { ArchitectureSlide } from "@/components/slides/academic/ArchitectureSlide";
import { MoneyEngineSlide } from "@/components/slides/academic/MoneyEngineSlide";
import { InvariantsSlide } from "@/components/slides/academic/InvariantsSlide";
import { InvariantFourSlide } from "@/components/slides/academic/InvariantFourSlide";
import { E2eeSlide } from "@/components/slides/academic/E2eeSlide";
import { TestingSlide } from "@/components/slides/academic/TestingSlide";
import { ConcurrencySlide } from "@/components/slides/academic/ConcurrencySlide";
import { DeliverySlide } from "@/components/slides/academic/DeliverySlide";
import { ResultsSlide } from "@/components/slides/academic/ResultsSlide";
import { ContributionsSlide } from "@/components/slides/academic/ContributionsSlide";
import { LimitationsSlide } from "@/components/slides/academic/LimitationsSlide";
import { CloseSlide as AcademicClose } from "@/components/slides/academic/CloseSlide";

/**
 * Three running orders. Each must stay in step with its array in `src/lib/deck.ts` —
 * that list drives the rail, the counter and the keyboard jumps, and it matches these
 * by position, not by id.
 */
export default function Page() {
  return (
    <DeckShell
      investor={
        <>
          <InvestorCover />
          <InvestorProblem />
          <ProductSlide />
          <BuiltSlide />
          <CashNetworkSlide />
          <InvestorSafeguarding />
          <FlywheelSlide />
          <UnitEconomicsSlide />
          <ConsumerFeesSlide />
          <MerchantFeesSlide />
          <TreasuryFeesSlide />
          <AgentEconomicsSlide />
          <BrandSlide />
          <RoadmapSlide />
          <InvestorClose />
        </>
      }
      partner={
        <>
          <PartnerCover />
          <PositionSlide />
          <ClosedLoopSlide />
          <PartnerSafeguarding />
          <ControlsSlide />
          <AgentControlsSlide />
          <KycRiskSlide />
          <MakerCheckerSlide />
          <AuditSlide />
          <SecuritySlide />
          <PartnerClose />
        </>
      }
      academic={
        <>
          <AcademicCover />
          <AcademicProblem />
          <GapSlide />
          <ObjectivesSlide />
          <ScopeSlide />
          <ArtefactSlide />
          <ArchitectureSlide />
          <MoneyEngineSlide />
          <InvariantsSlide />
          <InvariantFourSlide />
          <E2eeSlide />
          <TestingSlide />
          <ConcurrencySlide />
          <DeliverySlide />
          <ResultsSlide />
          <ContributionsSlide />
          <LimitationsSlide />
          <AcademicClose />
        </>
      }
    />
  );
}
