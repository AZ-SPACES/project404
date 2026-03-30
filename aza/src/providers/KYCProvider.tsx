import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type IdType =
  | 'ghana_card'
  | 'passport'
  | 'voter_id'
  | 'drivers_license';

export type PEPStatus = 'self' | 'family_associate';

export type FundsSource =
  | 'Salary/Employment Income'
  | 'Business Profits'
  | 'Personal Savings'
  | 'Inheritance or Gifts'
  | 'Sale of Assets'
  | 'Investment Dividends'
  | 'Pension / Retirement Distributions'
  | 'Other';

export type PEPAccountPurpose =
  | 'Day-to-day spending'
  | 'Savings & Investments'
  | 'Business transactions'
  | 'Salary receiving';

export type PEPMonthlyVolume =
  | 'Below GH₵10,000'
  | 'GH₵10,000 – GH₵50,000'
  | 'GH₵50,000 – GH₵100,000'
  | 'Above GH₵100,000';

export type PEPProofDocType =
  | 'Asset Declaration Form'
  | 'Bank Statement'
  | 'Recent Payslip'
  | 'Tax Return';

export type KYCData = {
  // ── Consent ──────────────────────────────────────────────────────────────
  biometricConsent: boolean;

  // ── Source of funds ───────────────────────────────────────────────────────
  fundsSource: FundsSource[];
  otherFundsText: string;

  // ── ID document ───────────────────────────────────────────────────────────
  idType: IdType | null;
  idLabel: string;
  idNumber: string;

  // ── Captured images (local file URIs) ────────────────────────────────────
  idFrontImageUri: string | null;
  idBackImageUri: string | null;
  selfieImageUri: string | null;

  // ── PEP screening ────────────────────────────────────────────────────────
  isPEP: boolean;
  pepStatus: PEPStatus | null;

  // ── PEP – enhanced due diligence ─────────────────────────────────────────
  pepRole: string;
  pepWealthSource: string;

  // ── PEP – account purpose ─────────────────────────────────────────────────
  pepAccountPurpose: PEPAccountPurpose | null;
  pepMonthlyVolume: PEPMonthlyVolume | null;

  // ── PEP – proof of wealth document ───────────────────────────────────────
  pepProofDocType: PEPProofDocType | null;
  pepProofDocumentUri: string | null;
  pepProofDocumentName: string | null;
};

// ─── Submission payload (what the backend receives) ───────────────────────────

export type KYCPayload = {
  biometricConsent: boolean;
  fundsSource: string[];
  otherFundsText?: string;
  idType: IdType;
  idNumber: string;
  /** After upload these become URLs; pre-upload they are local file:// URIs */
  idFrontImageUri: string;
  idBackImageUri: string;
  selfieImageUri: string;
  isPEP: boolean;
  pepStatus?: PEPStatus;
  pepRole?: string;
  pepWealthSource?: string;
  pepAccountPurpose?: PEPAccountPurpose;
  pepMonthlyVolume?: PEPMonthlyVolume;
  pepProofDocType?: PEPProofDocType;
  pepProofDocumentUri?: string;
  pepProofDocumentName?: string;
};

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_DATA: KYCData = {
  biometricConsent: false,
  fundsSource: [],
  otherFundsText: '',
  idType: null,
  idLabel: '',
  idNumber: '',
  idFrontImageUri: null,
  idBackImageUri: null,
  selfieImageUri: null,
  isPEP: false,
  pepStatus: null,
  pepRole: '',
  pepWealthSource: '',
  pepAccountPurpose: null,
  pepMonthlyVolume: null,
  pepProofDocType: null,
  pepProofDocumentUri: null,
  pepProofDocumentName: null,
};

// ─── Context ──────────────────────────────────────────────────────────────────

type KYCContextType = {
  data: KYCData;
  update: (fields: Partial<KYCData>) => void;
  /** Pass `latestFields` for any fields you just called `update()` on —
   *  this avoids the stale-closure problem where React state hasn't flushed yet. */
  submit: (latestFields?: Partial<KYCData>) => Promise<void>;
  reset: () => void;
  isSubmitting: boolean;
};

const KYCContext = createContext<KYCContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function KYCProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<KYCData>(INITIAL_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = useCallback((fields: Partial<KYCData>) => {
    setData((prev) => ({ ...prev, ...fields }));
  }, []);

  const reset = useCallback(() => {
    setData(INITIAL_DATA);
  }, []);

  const submit = useCallback(async (latestFields?: Partial<KYCData>) => {
    setIsSubmitting(true);
    // Merge any just-set fields so we don't hit a stale-closure on fields
    // that were updated via `update()` immediately before calling `submit()`.
    // React state (data) may not have flushed yet at the time submit() runs.
    const merged: KYCData = latestFields ? { ...data, ...latestFields } : data;
    try {
      // Validate that required fields are present before submitting
      if (
        !merged.idType ||
        !merged.idFrontImageUri ||
        !merged.idBackImageUri ||
        !merged.selfieImageUri
      ) {
        throw new Error('Incomplete KYC data');
      }

      const payload: KYCPayload = {
        biometricConsent: merged.biometricConsent,
        fundsSource: merged.fundsSource,
        ...(merged.otherFundsText ? { otherFundsText: merged.otherFundsText } : {}),
        idType: merged.idType,
        idNumber: merged.idNumber,
        idFrontImageUri: merged.idFrontImageUri,
        idBackImageUri: merged.idBackImageUri,
        selfieImageUri: merged.selfieImageUri,
        isPEP: merged.isPEP,
        ...(merged.isPEP && {
          ...(merged.pepStatus != null && { pepStatus: merged.pepStatus }),
          ...(merged.pepRole && { pepRole: merged.pepRole }),
          ...(merged.pepWealthSource && { pepWealthSource: merged.pepWealthSource }),
          ...(merged.pepAccountPurpose != null && { pepAccountPurpose: merged.pepAccountPurpose }),
          ...(merged.pepMonthlyVolume != null && { pepMonthlyVolume: merged.pepMonthlyVolume }),
          ...(merged.pepProofDocType != null && { pepProofDocType: merged.pepProofDocType }),
          ...(merged.pepProofDocumentUri != null && { pepProofDocumentUri: merged.pepProofDocumentUri }),
          ...(merged.pepProofDocumentName != null && { pepProofDocumentName: merged.pepProofDocumentName }),
        }),
      };

      // TODO: replace with real API call
      // Step 1 – upload images and swap URIs for backend URLs:
      //   const [frontUrl, backUrl, selfieUrl] = await Promise.all([
      //     uploadImage(payload.idFrontImageUri),
      //     uploadImage(payload.idBackImageUri),
      //     uploadImage(payload.selfieImageUri),
      //   ]);
      //   payload.idFrontImageUri = frontUrl;
      //   payload.idBackImageUri  = backUrl;
      //   payload.selfieImageUri  = selfieUrl;
      //
      // Step 2 – submit full KYC payload:
      //   await api.post('/kyc/submit', payload);

      // NOTE: Do NOT call completeKYC() here. Doing so sets isKYCVerified: true
      // immediately, which causes RootNavigator to swap KYCNavigator → AppNavigator
      // before KYCSuccess / CreatingAccount / AccountReady screens can render.
      // AccountReadyScreen already calls completeKYC() on the final "Go to Home" tap.
    } finally {
      setIsSubmitting(false);
    }
  }, [data]);

  return (
    <KYCContext.Provider value={{ data, update, submit, reset, isSubmitting }}>
      {children}
    </KYCContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useKYC(): KYCContextType {
  const ctx = useContext(KYCContext);
  if (!ctx) throw new Error('useKYC must be used within a KYCProvider');
  return ctx;
}
