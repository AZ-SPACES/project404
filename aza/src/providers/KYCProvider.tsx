import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from 'react';
import * as api from '../services/api';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from '../lib/queryKeys';

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

  // -- Backend Status --
  status: string; // 'NOT_STARTED', 'PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED'
  rejectionReason?: string;
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
  status: 'NOT_STARTED',
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

  // Step-by-step methods
  recordConsent: () => Promise<void>;
  submitFundsSource: (funds: FundsSource[], otherText?: string) => Promise<void>;
  submitIdentity: (backImageUri?: string) => Promise<void>;
  submitSelfie: (selfieUri?: string) => Promise<void>;
  submitPepStatus: (isPep: boolean, status?: PEPStatus, role?: string) => Promise<void>;
  submitPepDetails: (purpose?: PEPAccountPurpose, volume?: PEPMonthlyVolume, wealthSource?: string) => Promise<void>;
  submitProofOfWealth: (documentUri?: string, documentName?: string) => Promise<void>;
  refreshStatus: () => Promise<string>;
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

  const recordConsent = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await api.recordKycConsent();
      update({ biometricConsent: true });
    } finally {
      setIsSubmitting(false);
    }
  }, [update]);

  const submitFundsSource = useCallback(async (funds: FundsSource[], otherText?: string) => {
    setIsSubmitting(true);
    try {
      const sourceMap: Record<string, string> = {
        'Salary/Employment Income': 'salary',
        'Business Profits': 'business',
        'Personal Savings': 'savings',
        'Inheritance or Gifts': 'gift',
        'Sale of Assets': 'asset_sale',
        'Investment Dividends': 'investment',
        'Pension / Retirement Distributions': 'pension',
        'Other': 'other'
      };
      const mappedFunds = funds.map(f => sourceMap[f] || f);
      const fundsStr = mappedFunds.join(',');
      await api.submitFundsSource(fundsStr, otherText);
      update({ fundsSource: funds, otherFundsText: otherText || '' });
    } finally {
      setIsSubmitting(false);
    }
  }, [update]);

  const submitIdentity = useCallback(async (backImageUri?: string) => {
    setIsSubmitting(true);
    try {
      const finalBackUri = backImageUri || data.idBackImageUri;
      if (!data.idType || !data.idNumber || !data.idFrontImageUri || !finalBackUri) {
        throw new Error('Identity data incomplete');
      }

      // Convert local URIs to the format expected by FormData
      const frontFile = {
        uri: data.idFrontImageUri,
        name: 'front.jpg',
        type: 'image/jpeg',
      };
      const backFile = {
        uri: finalBackUri,
        name: 'back.jpg',
        type: 'image/jpeg',
      };

      await api.submitIdentity(data.idType, data.idNumber, frontFile, backFile);
    } finally {
      setIsSubmitting(false);
    }
  }, [data.idType, data.idNumber, data.idFrontImageUri, data.idBackImageUri]);

  const submitSelfie = useCallback(async (selfieUri?: string) => {
    setIsSubmitting(true);
    try {
      const finalSelfieUri = selfieUri || data.selfieImageUri;
      if (!finalSelfieUri) throw new Error('Selfie missing');

      const selfieFile = {
        uri: finalSelfieUri,
        name: 'selfie.jpg',
        type: 'image/jpeg',
      };

      await api.submitSelfie(selfieFile);
    } finally {
      setIsSubmitting(false);
    }
  }, [data.selfieImageUri]);

  const submitPepStatus = useCallback(async (isPep: boolean, status?: PEPStatus, role?: string) => {
    setIsSubmitting(true);
    try {
      await api.submitPepScreening(isPep, status || undefined, role || undefined);
      update({ isPEP: isPep, pepStatus: status || null, pepRole: role || '' });
    } finally {
      setIsSubmitting(false);
    }
  }, [update]);

  const submitPepDetails = useCallback(async (purpose?: PEPAccountPurpose, volume?: PEPMonthlyVolume, wealthSource?: string) => {
    setIsSubmitting(true);
    try {
      const finalPurpose = purpose || data.pepAccountPurpose;
      const finalVolume = volume || data.pepMonthlyVolume;
      const finalWealthSource = wealthSource || data.pepWealthSource;

      if (!finalPurpose || !finalVolume || !finalWealthSource) {
        throw new Error('PEP details incomplete');
      }
      
      // Map frontend types to backend expected strings if needed
      const purposeMap: Record<string, string> = {
        'Day-to-day spending': 'day_to_day',
        'Savings & Investments': 'savings',
        'Business transactions': 'business',
        'Salary receiving': 'salary'
      };

      const volumeMap: Record<string, string> = {
        'Less than GH₵ 10,000': 'below_10k',
        'GH₵ 10,000 - 50,000': '10k_50k',
        'GH₵ 50,000 - 100,000': '50k_100k',
        'More than GH₵ 100,000': 'above_100k'
      };

      await api.submitPepDetails(
        purposeMap[finalPurpose] || finalPurpose,
        volumeMap[finalVolume] || finalVolume,
        finalWealthSource
      );
      
      update({
        pepAccountPurpose: finalPurpose,
        pepMonthlyVolume: finalVolume,
        pepWealthSource: finalWealthSource
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [data.pepAccountPurpose, data.pepMonthlyVolume, data.pepWealthSource, update]);

  const submitProofOfWealth = useCallback(async (documentUri?: string, documentName?: string) => {
    setIsSubmitting(true);
    try {
      const finalUri = documentUri || data.pepProofDocumentUri;
      const finalName = documentName || data.pepProofDocumentName;

      if (!finalUri) throw new Error('Proof document missing');

      const docFile = {
        uri: finalUri,
        name: finalName || 'document.pdf',
        type: 'application/pdf', // Assuming PDF for now
      };

      await api.submitProofOfWealth(docFile);
      
      update({
        pepProofDocumentUri: finalUri,
        pepProofDocumentName: finalName
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [data.pepProofDocumentUri, data.pepProofDocumentName, update]);

  const submit = useCallback(async (latestFields?: Partial<KYCData>) => {
    setIsSubmitting(true);
    try {
      const response = await api.submitKycFinal();
      if (response.data?.status) {
        update({ status: response.data.status });
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [update]);

  const refreshStatus = useCallback(async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: queryKeys.kycStatus() });
      const response = await api.getKycStatus();
      if (response.data?.status) {
        update({
          status: response.data.status,
          rejectionReason: response.data.rejectionReason
        });
        return response.data.status;
      }
      return 'NOT_STARTED';
    } catch (error) {
      console.error('Failed to refresh KYC status:', error);
      return 'NOT_STARTED';
    }
  }, [update]);

  return (
    <KYCContext.Provider value={{ 
      data, update, submit, reset, isSubmitting,
      recordConsent, submitFundsSource, submitIdentity,
      submitSelfie, submitPepStatus, submitPepDetails, submitProofOfWealth,
      refreshStatus
    }}>
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
