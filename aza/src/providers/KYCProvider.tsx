import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from 'react';
import { useAuth } from './AuthProvider';

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
  submit: () => Promise<void>;
  reset: () => void;
  isSubmitting: boolean;
};

const KYCContext = createContext<KYCContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function KYCProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<KYCData>(INITIAL_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { completeKYC } = useAuth();

  const update = useCallback((fields: Partial<KYCData>) => {
    setData((prev) => ({ ...prev, ...fields }));
  }, []);

  const reset = useCallback(() => {
    setData(INITIAL_DATA);
  }, []);

  const submit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      // Validate that required fields are present before submitting
      if (
        !data.idType ||
        !data.idFrontImageUri ||
        !data.idBackImageUri ||
        !data.selfieImageUri
      ) {
        throw new Error('Incomplete KYC data');
      }

      const payload: KYCPayload = {
        biometricConsent: data.biometricConsent,
        fundsSource: data.fundsSource,
        ...(data.otherFundsText ? { otherFundsText: data.otherFundsText } : {}),
        idType: data.idType,
        idNumber: data.idNumber,
        idFrontImageUri: data.idFrontImageUri,
        idBackImageUri: data.idBackImageUri,
        selfieImageUri: data.selfieImageUri,
        isPEP: data.isPEP,
        ...(data.isPEP && {
          ...(data.pepStatus != null && { pepStatus: data.pepStatus }),
          ...(data.pepRole && { pepRole: data.pepRole }),
          ...(data.pepWealthSource && { pepWealthSource: data.pepWealthSource }),
          ...(data.pepAccountPurpose != null && { pepAccountPurpose: data.pepAccountPurpose }),
          ...(data.pepMonthlyVolume != null && { pepMonthlyVolume: data.pepMonthlyVolume }),
          ...(data.pepProofDocType != null && { pepProofDocType: data.pepProofDocType }),
          ...(data.pepProofDocumentUri != null && { pepProofDocumentUri: data.pepProofDocumentUri }),
          ...(data.pepProofDocumentName != null && { pepProofDocumentName: data.pepProofDocumentName }),
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
      //
      // Step 3 – mark KYC complete in AuthProvider:
      completeKYC();
    } finally {
      setIsSubmitting(false);
    }
  }, [data, completeKYC]);

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
