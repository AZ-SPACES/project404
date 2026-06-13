"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMerchantById,
  getMerchantKyb,
  reviewMerchantKyb,
  setMerchantStatus,
  updateMerchantFeeRate,
  getMerchantPayouts,
  getMerchantSessions,
  getMerchantInvoices,
  getMerchantSettlements,
  getMerchantCustomers,
  getMerchantDisputesByMerchant,
  getMerchantBulkTransfers,
  getMerchantAuditLogByMerchant,
  getMerchantWebhookDeliveries,
  resetUserRateLimit,
  AdminMerchant,
  MerchantKyb,
  MerchantPayout,
  MerchantSession,
  MerchantInvoice,
  MerchantSettlement,
  MerchantCustomer,
  MerchantBulkTransfer,
  MerchantAuditLogEntry,
  WebhookDeliveryRow,
  Dispute,
  Page,
} from "@/lib/admin-api";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Key,
  Webhook,
  User,
  Users,
  ShieldCheck,
  Store,
  Ban,
  RefreshCw,
  ExternalLink,
  X,
  Percent,
  CreditCard,
  ArrowDownToLine,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  TrendingUp,
  Scale,
  ScrollText,
  Image as ImageIcon,
} from "lucide-react";

function fmtAmount(n: number, currency = "GHS") {
  return `${currency === "GHS" ? "GH₵" : currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtFee(bps: number) {
  return `${(bps / 100).toFixed(2)}%`;
}

function fmtBytes(n: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_CFG: Record<string, { cls: string; label: string }> = {
  ACTIVE:            { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Active" },
  PENDING_KYB:       { cls: "text-amber-400 bg-amber-500/10 border-amber-500/20",       label: "Pending KYB" },
  KYB_SUBMITTED:     { cls: "text-blue-400 bg-blue-500/10 border-blue-500/20",           label: "KYB Submitted" },
  KYB_UNDER_REVIEW:  { cls: "text-blue-400 bg-blue-500/10 border-blue-500/20",           label: "Under Review" },
  MORE_INFO_REQUIRED:{ cls: "text-orange-400 bg-orange-500/10 border-orange-500/20",    label: "More Info Needed" },
  SUSPENDED:         { cls: "text-red-400 bg-red-500/10 border-red-500/20",              label: "Suspended" },
  REJECTED:          { cls: "text-red-400 bg-red-500/10 border-red-500/20",              label: "Rejected" },
};

const KYB_STATUS_CFG: Record<string, { cls: string; label: string }> = {
  PENDING:            { cls: "text-foreground/40 bg-muted/30 border-border",               label: "Pending" },
  SUBMITTED:          { cls: "text-blue-400 bg-blue-500/10 border-blue-500/20",          label: "Submitted" },
  UNDER_REVIEW:       { cls: "text-blue-400 bg-blue-500/10 border-blue-500/20",          label: "Under Review" },
  APPROVED:           { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Approved" },
  REJECTED:           { cls: "text-red-400 bg-red-500/10 border-red-500/20",             label: "Rejected" },
  MORE_INFO_REQUIRED: { cls: "text-orange-400 bg-orange-500/10 border-orange-500/20",   label: "More Info" },
};

const SESSION_STATUS_CFG: Record<string, { cls: string; label: string }> = {
  PENDING:   { cls: "text-amber-400 bg-amber-500/10 border-amber-500/20",      label: "Pending" },
  COMPLETED: { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",label: "Completed" },
  EXPIRED:   { cls: "text-foreground/35 bg-muted/30 border-border",             label: "Expired" },
  CANCELLED: { cls: "text-red-400 bg-red-500/10 border-red-500/20",            label: "Cancelled" },
};

const PAYOUT_STATUS_CFG: Record<string, { cls: string; label: string }> = {
  PENDING:   { cls: "text-amber-400 bg-amber-500/10 border-amber-500/20",      label: "Pending" },
  COMPLETED: { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",label: "Completed" },
  FAILED:    { cls: "text-red-400 bg-red-500/10 border-red-500/20",            label: "Failed" },
};

const INVOICE_STATUS_CFG: Record<string, { cls: string; label: string }> = {
  DRAFT:     { cls: "text-foreground/40 bg-muted/30 border-border",               label: "Draft" },
  SENT:      { cls: "text-blue-400 bg-blue-500/10 border-blue-500/20",          label: "Sent" },
  PAID:      { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Paid" },
  CANCELLED: { cls: "text-red-400 bg-red-500/10 border-red-500/20",             label: "Cancelled" },
  OVERDUE:   { cls: "text-orange-400 bg-orange-500/10 border-orange-500/20",    label: "Overdue" },
};

const SETTLEMENT_STATUS_CFG: Record<string, { cls: string; label: string }> = {
  PENDING: { cls: "text-amber-400 bg-amber-500/10 border-amber-500/20",      label: "Pending" },
  SETTLED: { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",label: "Settled" },
};

const BULK_STATUS_CFG: Record<string, { cls: string; label: string }> = {
  PENDING:             { cls: "text-amber-400 bg-amber-500/10 border-amber-500/20",      label: "Pending" },
  PROCESSING:          { cls: "text-blue-400 bg-blue-500/10 border-blue-500/20",          label: "Processing" },
  COMPLETED:           { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Completed" },
  PARTIALLY_COMPLETED: { cls: "text-orange-400 bg-orange-500/10 border-orange-500/20",   label: "Partial" },
  FAILED:              { cls: "text-red-400 bg-red-500/10 border-red-500/20",             label: "Failed" },
};

const DISPUTE_STATUS_CFG: Record<string, { cls: string; label: string }> = {
  OPEN:              { cls: "text-amber-400 bg-amber-500/10 border-amber-500/20",      label: "Open" },
  UNDER_REVIEW:      { cls: "text-blue-400 bg-blue-500/10 border-blue-500/20",          label: "Under Review" },
  RESOLVED_APPROVED: { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Approved" },
  RESOLVED_DENIED:   { cls: "text-red-400 bg-red-500/10 border-red-500/20",             label: "Denied" },
};

function Badge({ cfg }: { cfg: { cls: string; label: string } }) {
  return <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${cfg.cls}`}>{cfg.label}</span>;
}

function SmBadge({ cfg }: { cfg: { cls: string; label: string } }) {
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${cfg.cls}`}>{cfg.label}</span>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-foreground/40 flex-shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right">{value ?? "—"}</span>
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex justify-between items-center gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-foreground/40 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-mono text-foreground/50 truncate max-w-[180px]">{value}</span>
        <button onClick={copy} className="text-foreground/25 hover:text-foreground/60 transition-colors flex-shrink-0">
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  );
}

type Modal = "kyb_approve" | "kyb_reject" | "kyb_more_info" | "suspend" | "activate" | "reject_merchant" | "fee_rate" | null;
type Tab = "overview" | "kyb" | "payouts" | "sessions" | "invoices" | "settlements" | "customers" | "disputes" | "bulk-transfers" | "webhooks" | "audit-log";

export default function MerchantDetailPage() {
  const { merchantId } = useParams<{ merchantId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [modal, setModal] = useState<Modal>(null);
  const [inputText, setInputText] = useState("");
  const [feeInput, setFeeInput] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState<string | null>(null);

  // Per-tab page numbers
  const [payoutsPage, setPayoutsPage] = useState(0);
  const [sessionsPage, setSessionsPage] = useState(0);
  const [invoicesPage, setInvoicesPage] = useState(0);
  const [settlementsPage, setSettlementsPage] = useState(0);
  const [customersPage, setCustomersPage] = useState(0);
  const [merchantDisputesPage, setMerchantDisputesPage] = useState(0);
  const [bulkTransfersPage, setBulkTransfersPage] = useState(0);
  const [webhooksPage, setWebhooksPage] = useState(0);
  const [auditLogPage, setAuditLogPage] = useState(0);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Core data
  const { data: merchant, isLoading: loading, error: loadError } = useQuery<AdminMerchant>({
    queryKey: ["merchant", merchantId],
    queryFn: () => getMerchantById(merchantId),
  });

  const { data: kyb } = useQuery<MerchantKyb | null>({
    queryKey: ["merchantKyb", merchantId],
    queryFn: () => getMerchantKyb(merchantId).catch(() => null),
    enabled: !!merchantId,
  });

  // Auto-switch to KYB tab when the merchant needs review action
  useEffect(() => {
    if (merchant && ["KYB_UNDER_REVIEW", "KYB_SUBMITTED", "MORE_INFO_REQUIRED"].includes(merchant.status)) {
      setTab("kyb");
    }
  }, [merchant?.status]);

  // Tab data queries — only fetch when the relevant tab is active
  const { data: payouts, isLoading: payoutsLoading } = useQuery({
    queryKey: ["merchantPayouts", merchantId, payoutsPage],
    queryFn: () => getMerchantPayouts(merchantId, payoutsPage),
    enabled: tab === "payouts",
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["merchantSessions", merchantId, sessionsPage],
    queryFn: () => getMerchantSessions(merchantId, sessionsPage),
    enabled: tab === "sessions",
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["merchantInvoices", merchantId, invoicesPage],
    queryFn: () => getMerchantInvoices(merchantId, invoicesPage),
    enabled: tab === "invoices",
  });

  const { data: settlements, isLoading: settlementsLoading } = useQuery({
    queryKey: ["merchantSettlements", merchantId, settlementsPage],
    queryFn: () => getMerchantSettlements(merchantId, settlementsPage),
    enabled: tab === "settlements",
  });

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ["merchantCustomers", merchantId, customersPage],
    queryFn: () => getMerchantCustomers(merchantId, customersPage),
    enabled: tab === "customers",
  });

  const { data: merchantDisputes, isLoading: merchantDisputesLoading } = useQuery({
    queryKey: ["merchantDisputes", merchantId, merchantDisputesPage],
    queryFn: () => getMerchantDisputesByMerchant(merchantId, merchantDisputesPage),
    enabled: tab === "disputes",
  });

  const { data: bulkTransfers, isLoading: bulkTransfersLoading } = useQuery({
    queryKey: ["merchantBulkTransfers", merchantId, bulkTransfersPage],
    queryFn: () => getMerchantBulkTransfers(merchantId, bulkTransfersPage),
    enabled: tab === "bulk-transfers",
  });

  const { data: auditLog, isLoading: auditLogLoading } = useQuery({
    queryKey: ["merchantAuditLog", merchantId, auditLogPage],
    queryFn: () => getMerchantAuditLogByMerchant(merchantId, auditLogPage),
    enabled: tab === "audit-log",
  });

  const { data: webhookDeliveries, isLoading: webhooksLoading } = useQuery<Page<WebhookDeliveryRow>>({
    queryKey: ["merchantWebhooks", merchantId, webhooksPage],
    queryFn: () => getMerchantWebhookDeliveries(merchantId, webhooksPage),
    enabled: tab === "webhooks",
  });

  // Mutations
  const kybMutation = useMutation({
    mutationFn: ({ approve, rejectionReason, moreInfoRequest }: { approve: boolean; rejectionReason?: string; moreInfoRequest?: string }) =>
      reviewMerchantKyb(merchantId, approve, rejectionReason, moreInfoRequest),
    onSuccess: (updated, { approve }) => {
      queryClient.setQueryData(["merchantKyb", merchantId], updated);
      queryClient.invalidateQueries({ queryKey: ["merchant", merchantId] });
      setModal(null);
      setInputText("");
      showToast(approve ? "KYB approved — merchant activated" : "KYB decision saved");
    },
    onError: (e: Error) => setError(e.message ?? "KYB review failed"),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => setMerchantStatus(merchantId, status),
    onSuccess: (updated) => {
      queryClient.setQueryData(["merchant", merchantId], updated);
      setModal(null);
      setInputText("");
      showToast(`Merchant status set to ${updated.status.toLowerCase()}`);
    },
    onError: (e: Error) => setError(e.message ?? "Status change failed"),
  });

  const feeMutation = useMutation({
    mutationFn: (bps: number) => updateMerchantFeeRate(merchantId, bps),
    onSuccess: (updated, bps) => {
      queryClient.setQueryData(["merchant", merchantId], updated);
      setModal(null);
      setFeeInput("");
      showToast(`Fee rate updated to ${fmtFee(bps)}`);
    },
    onError: (e: Error) => setError(e.message ?? "Fee rate update failed"),
  });

  const rateLimitMutation = useMutation({
    mutationFn: () => resetUserRateLimit(merchant!.userId),
    onSuccess: () => showToast("Rate limits cleared for merchant's user account"),
    onError: (e: Error) => setError(e.message ?? "Failed to reset rate limits"),
  });

  const actionLoading = kybMutation.isPending || statusMutation.isPending || feeMutation.isPending;

  const handleKybReview = (approve: boolean, rejectionReason?: string, moreInfoRequest?: string) => {
    kybMutation.mutate({ approve, rejectionReason, moreInfoRequest });
  };

  const handleStatusChange = (status: string) => statusMutation.mutate(status);

  const handleFeeRateUpdate = () => {
    const bps = Math.round(parseFloat(feeInput) * 100);
    if (isNaN(bps) || bps < 0 || bps > 10000) {
      setError("Enter a valid fee rate between 0% and 100%");
      return;
    }
    feeMutation.mutate(bps);
  };

  const handleResetRateLimit = () => rateLimitMutation.mutate();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-foreground/30" size={24} />
      </div>
    );
  }

  if (loadError && !merchant) {
    return (
      <div className="max-w-2xl mx-auto mt-10">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={16} />{(loadError as Error).message}
        </div>
      </div>
    );
  }

  if (!merchant) return null;

  const statusCfg = STATUS_CFG[merchant.status] ?? { cls: "text-foreground/40 bg-muted/30 border-border", label: merchant.status };
  const kybReviewable = kyb && !["APPROVED", "PENDING"].includes(kyb.status) && kyb.ownerFullName != null;
  const canSuspend = merchant.status === "ACTIVE";
  const canActivate = merchant.status === "SUSPENDED";

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview",       label: "Overview",       icon: Store },
    { id: "kyb",            label: "KYB",            icon: ShieldCheck },
    { id: "payouts",        label: "Payouts",        icon: ArrowDownToLine },
    { id: "sessions",       label: "Sessions",       icon: CreditCard },
    { id: "invoices",       label: "Invoices",       icon: FileText },
    { id: "settlements",    label: "Settlements",    icon: TrendingUp },
    { id: "customers",      label: "Customers",      icon: Users },
    { id: "disputes",       label: "Disputes",       icon: Scale },
    { id: "bulk-transfers", label: "Bulk Transfers", icon: ArrowLeftRight },
    { id: "webhooks",       label: "Webhooks",       icon: Webhook },
    { id: "audit-log",      label: "Audit Log",      icon: ScrollText },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm px-4 py-3 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl text-foreground/40 hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {merchant.logoUrl && (
            <img
              src={merchant.logoUrl}
              alt={merchant.businessName}
              className="w-10 h-10 rounded-xl object-cover border border-border flex-shrink-0"
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold text-foreground truncate">{merchant.businessName}</h1>
              <Badge cfg={statusCfg} />
            </div>
            <p className="text-foreground/35 text-sm mt-0.5 font-mono">@{merchant.businessHandle}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={16} />{error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Balance", value: fmtAmount(merchant.balance, merchant.currency), color: "text-foreground" },
          { label: "Total Volume", value: fmtAmount(merchant.totalVolume, merchant.currency), color: "text-emerald-400" },
          { label: "Platform Fee", value: fmtFee(merchant.feeRateBps), color: "text-[#B7EE7A]" },
          { label: "Created", value: fmtDate(merchant.createdAt).split(",")[0], color: "text-foreground/60" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-[10px] text-foreground/35 uppercase tracking-wider font-medium mb-1">{label}</p>
            <p className={`text-lg font-semibold ${color} truncate`}>{value}</p>
          </div>
        ))}
      </div>

      {/* KYB action banner — shown regardless of active tab */}
      {kybReviewable && tab !== "kyb" && (
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-amber-400 flex-shrink-0" />
            <span className="text-sm text-amber-300">
              KYB submission awaiting review
              {kyb?.status === "MORE_INFO_REQUIRED" && " — merchant responded to info request"}
            </span>
          </div>
          <button
            onClick={() => setTab("kyb")}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-semibold hover:bg-amber-500/25 transition-all"
          >
            <CheckCircle2 size={12} /> Review KYB
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/30 p-1 rounded-xl overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id ? "bg-[#B7EE7A] text-black" : "text-foreground/50 hover:text-foreground"
            }`}
          >
            <Icon size={14} />
            {label}
            {id === "kyb" && kybReviewable && tab !== "kyb" && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === "overview" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Business Info */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Store size={16} className="text-foreground/40" />
                <h2 className="text-sm font-semibold text-foreground">Business Details</h2>
              </div>
              <CopyField label="Merchant ID" value={merchant.id} />
              <div className="flex justify-between items-center gap-4 py-2.5 border-b border-border">
                <span className="text-sm text-foreground/40 flex-shrink-0">Owner</span>
                <button
                  onClick={() => router.push(`/users/${merchant.userId}`)}
                  className="flex items-center gap-1.5 text-xs text-[#B7EE7A] hover:underline font-mono"
                >
                  <User size={11} />
                  {merchant.userId.slice(0, 8)}…
                </button>
              </div>
              <Field label="Category" value={merchant.category?.replace(/_/g, " ") ?? "—"} />
              <Field label="Email" value={merchant.businessEmail} />
              <Field label="Phone" value={merchant.businessPhone} />
              <Field label="Description" value={merchant.businessDescription} />
              {merchant.activatedAt && <Field label="Activated" value={fmtDate(merchant.activatedAt)} />}

              {/* API Keys & Webhooks */}
              {(merchant.activeApiKeyCount != null || merchant.activeWebhookCount != null) && (
                <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2">
                  <div className="bg-muted/20 rounded-xl px-3 py-2.5 text-center">
                    <Key size={13} className="text-foreground/30 mx-auto mb-1" />
                    <p className="text-lg font-semibold text-foreground">{merchant.activeApiKeyCount ?? 0}</p>
                    <p className="text-[10px] text-foreground/30 uppercase tracking-wider">API Keys</p>
                  </div>
                  <div className="bg-muted/20 rounded-xl px-3 py-2.5 text-center">
                    <Webhook size={13} className="text-foreground/30 mx-auto mb-1" />
                    <p className="text-lg font-semibold text-foreground">{merchant.activeWebhookCount ?? 0}</p>
                    <p className="text-[10px] text-foreground/30 uppercase tracking-wider">Webhooks</p>
                  </div>
                </div>
              )}

              {merchant.rejectionReason && (
                <div className="mt-3 bg-red-500/8 border border-red-500/15 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-red-400/70 uppercase tracking-wider font-medium mb-1">Rejection Reason</p>
                  <p className="text-sm text-red-400">{merchant.rejectionReason}</p>
                </div>
              )}
              {merchant.moreInfoRequest && (
                <div className="mt-3 bg-orange-500/8 border border-orange-500/15 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-orange-400/70 uppercase tracking-wider font-medium mb-1">More Info Requested</p>
                  <p className="text-sm text-orange-300">{merchant.moreInfoRequest}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-3">Account Actions</h2>
                <div className="flex flex-wrap gap-2">
                  {canSuspend && (
                    <button
                      onClick={() => { setModal("suspend"); setInputText(""); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-sm font-medium hover:bg-red-500/25 transition-all"
                    >
                      <Ban size={14} /> Suspend
                    </button>
                  )}
                  {canActivate && (
                    <button
                      onClick={() => { setModal("activate"); setInputText(""); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-all"
                    >
                      <CheckCircle2 size={14} /> Reactivate
                    </button>
                  )}
                  {merchant.status !== "REJECTED" && (
                    <button
                      onClick={() => { setModal("reject_merchant"); setInputText(""); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/15 text-red-500 text-sm font-medium hover:bg-red-500/20 transition-all"
                    >
                      <XCircle size={14} /> Reject Account
                    </button>
                  )}
                  <button
                    onClick={handleResetRateLimit}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/30 border border-border text-foreground/50 text-sm font-medium hover:bg-muted hover:text-foreground transition-all"
                  >
                    <RefreshCw size={14} /> Reset Rate Limits
                  </button>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h2 className="text-sm font-semibold text-foreground mb-3">Fee Rate</h2>
                <div className="flex items-center justify-between bg-muted/20 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-xs text-foreground/35 mb-0.5">Current rate</p>
                    <p className="text-lg font-semibold text-[#B7EE7A]">{fmtFee(merchant.feeRateBps)}</p>
                  </div>
                  <button
                    onClick={() => { setModal("fee_rate"); setFeeInput((merchant.feeRateBps / 100).toFixed(2)); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#B7EE7A]/15 border border-[#B7EE7A]/25 text-[#B7EE7A] text-xs font-semibold hover:bg-[#B7EE7A]/25 transition-all"
                  >
                    <Percent size={12} /> Edit
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── KYB TAB ── */}
      {tab === "kyb" && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <ShieldCheck size={16} className="text-foreground/40" />
            <h2 className="text-sm font-semibold text-foreground">KYB Verification</h2>
            {kyb && (
              <Badge cfg={KYB_STATUS_CFG[kyb.status] ?? { cls: "text-foreground/40 bg-muted/30 border-border", label: kyb.status }} />
            )}
          </div>

          {!kyb ? (
            <p className="text-sm text-foreground/30 py-8 text-center">No KYB data submitted yet</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <p className="text-[11px] text-foreground/30 uppercase tracking-wider font-medium mb-2">Business Information</p>
                <Field label="Business Type" value={kyb.businessType?.replace(/_/g, " ")} />
                <Field label="Registration No." value={kyb.registrationNumber} />
                <Field label="Tax ID" value={kyb.taxIdNumber} />
                <Field label="Registered Address" value={kyb.registeredAddress} />
                <Field label="City" value={kyb.city} />
                {kyb.website && (
                  <Field label="Website" value={
                    <a href={kyb.website} target="_blank" rel="noopener noreferrer" className="text-[#B7EE7A] hover:underline flex items-center gap-1">
                      {kyb.website} <ExternalLink size={11} />
                    </a>
                  } />
                )}
                {kyb.submittedAt && <Field label="Submitted" value={fmtDate(kyb.submittedAt)} />}
                {kyb.reviewedAt && <Field label="Reviewed" value={fmtDate(kyb.reviewedAt)} />}
                {kyb.rejectionReason && (
                  <Field label="Rejection Reason" value={<span className="text-red-400">{kyb.rejectionReason}</span>} />
                )}
                {kyb.moreInfoRequest && (
                  <Field label="More Info Request" value={<span className="text-orange-400">{kyb.moreInfoRequest}</span>} />
                )}
              </div>

              <div>
                <p className="text-[11px] text-foreground/30 uppercase tracking-wider font-medium mb-2">Owner / Director</p>
                <Field label="Full Name" value={kyb.ownerFullName} />
                <Field label="ID Type" value={kyb.ownerIdType?.replace(/_/g, " ")} />

                {kyb.documents && kyb.documents.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[11px] text-foreground/30 uppercase tracking-wider font-medium mb-2">Documents</p>
                    <div className="space-y-2">
                      {kyb.documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between bg-muted/20 rounded-xl px-3 py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            {doc.mimeType === "application/pdf"
                              ? <FileText size={14} className="text-foreground/40 flex-shrink-0" />
                              : <ImageIcon size={14} className="text-foreground/40 flex-shrink-0" />
                            }
                            <div className="min-w-0">
                              <p className="text-xs text-foreground/70 font-medium">{doc.type.replace(/_/g, " ")}</p>
                              {doc.fileName && <p className="text-[10px] text-foreground/30 truncate">{doc.fileName}</p>}
                              {doc.fileSizeBytes && <p className="text-[10px] text-foreground/25">{fmtBytes(doc.fileSizeBytes)}</p>}
                            </div>
                          </div>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="ml-3 flex items-center gap-1 text-[#B7EE7A] hover:text-[#B7EE7A]/80 text-xs transition-colors flex-shrink-0"
                          >
                            View <ExternalLink size={11} />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {kybReviewable && (
            <div className="grid grid-cols-3 gap-2 mt-6 pt-5 border-t border-border">
              <button
                onClick={() => { setModal("kyb_approve"); setInputText(""); }}
                className="py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={14} /> Approve
              </button>
              <button
                onClick={() => { setModal("kyb_more_info"); setInputText(""); }}
                className="py-2.5 rounded-xl bg-orange-500/15 border border-orange-500/25 text-orange-400 text-sm font-semibold hover:bg-orange-500/25 transition-all"
              >
                More Info
              </button>
              <button
                onClick={() => { setModal("kyb_reject"); setInputText(""); }}
                className="py-2.5 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-sm font-semibold hover:bg-red-500/25 transition-all flex items-center justify-center gap-1.5"
              >
                <XCircle size={14} /> Reject
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── PAYOUTS TAB ── */}
      {tab === "payouts" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowDownToLine size={15} className="text-foreground/40" />
              <h2 className="text-sm font-semibold text-foreground">Payout History</h2>
              {payouts && <span className="text-xs text-foreground/30">{payouts.totalElements} total</span>}
            </div>
            {payoutsLoading && <Loader2 size={14} className="animate-spin text-foreground/30" />}
          </div>

          {!payouts && payoutsLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="animate-spin text-foreground/30" size={20} />
            </div>
          ) : payouts?.content.length === 0 ? (
            <p className="text-center text-foreground/25 text-sm py-16">No payouts yet</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Amount</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider hidden md:table-cell">Note</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Requested</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider hidden lg:table-cell">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payouts?.content.map((p) => {
                    const sc = PAYOUT_STATUS_CFG[p.status] ?? { cls: "text-foreground/40 bg-muted/30 border-border", label: p.status };
                    return (
                      <tr key={p.id} className="hover:bg-muted/20">
                        <td className="px-5 py-3.5 font-mono font-semibold text-foreground">{fmtAmount(p.amount, p.currency)}</td>
                        <td className="px-5 py-3.5"><SmBadge cfg={sc} /></td>
                        <td className="px-5 py-3.5 text-foreground/45 text-xs hidden md:table-cell">{p.note ?? "—"}</td>
                        <td className="px-5 py-3.5 text-right text-foreground/35 text-xs">{fmtDate(p.requestedAt)}</td>
                        <td className="px-5 py-3.5 text-right text-foreground/35 text-xs hidden lg:table-cell">{fmtDate(p.completedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {payouts && payouts.totalPages > 1 && (
                <div className="flex justify-center items-center gap-3 px-5 py-4 border-t border-border">
                  <button onClick={() => setPayoutsPage(p => p - 1)} disabled={payoutsPage === 0 || payoutsLoading} className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs text-foreground/40">{payoutsPage + 1} / {payouts.totalPages}</span>
                  <button onClick={() => setPayoutsPage(p => p + 1)} disabled={payoutsPage >= payouts.totalPages - 1 || payoutsLoading} className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30">
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── SESSIONS TAB ── */}
      {tab === "sessions" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard size={15} className="text-foreground/40" />
              <h2 className="text-sm font-semibold text-foreground">Checkout Sessions</h2>
              {sessions && <span className="text-xs text-foreground/30">{sessions.totalElements} total</span>}
            </div>
            {sessionsLoading && <Loader2 size={14} className="animate-spin text-foreground/30" />}
          </div>

          {!sessions && sessionsLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="animate-spin text-foreground/30" size={20} />
            </div>
          ) : sessions?.content.length === 0 ? (
            <p className="text-center text-foreground/25 text-sm py-16">No checkout sessions yet</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Amount</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider hidden md:table-cell">Description</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider hidden lg:table-cell">Fee</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sessions?.content.map((s) => {
                    const sc = SESSION_STATUS_CFG[s.status] ?? { cls: "text-foreground/40 bg-muted/30 border-border", label: s.status };
                    return (
                      <tr key={s.id} className="hover:bg-muted/20">
                        <td className="px-5 py-3.5 font-mono font-semibold text-foreground">{fmtAmount(s.amount, s.currency)}</td>
                        <td className="px-5 py-3.5"><SmBadge cfg={sc} /></td>
                        <td className="px-5 py-3.5 text-foreground/45 text-xs hidden md:table-cell max-w-[200px] truncate">{s.description ?? "—"}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-xs text-foreground/40 hidden lg:table-cell">
                          {s.platformFee != null ? fmtAmount(s.platformFee, s.currency) : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right text-foreground/35 text-xs">{fmtDate(s.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {sessions && sessions.totalPages > 1 && (
                <div className="flex justify-center items-center gap-3 px-5 py-4 border-t border-border">
                  <button onClick={() => setSessionsPage(p => p - 1)} disabled={sessionsPage === 0 || sessionsLoading} className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs text-foreground/40">{sessionsPage + 1} / {sessions.totalPages}</span>
                  <button onClick={() => setSessionsPage(p => p + 1)} disabled={sessionsPage >= sessions.totalPages - 1 || sessionsLoading} className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30">
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── INVOICES TAB ── */}
      {tab === "invoices" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-foreground/40" />
              <h2 className="text-sm font-semibold text-foreground">Invoices</h2>
              {invoices && <span className="text-xs text-foreground/30">{invoices.totalElements} total</span>}
            </div>
            {invoicesLoading && <Loader2 size={14} className="animate-spin text-foreground/30" />}
          </div>
          {!invoices && invoicesLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-foreground/30" size={20} /></div>
          ) : invoices?.content.length === 0 ? (
            <p className="text-center text-foreground/25 text-sm py-16">No invoices yet</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Customer</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Amount</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider hidden md:table-cell">Due</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoices?.content.map((inv) => {
                    const sc = INVOICE_STATUS_CFG[inv.status] ?? { cls: "text-foreground/40 bg-muted/30 border-border", label: inv.status };
                    return (
                      <tr key={inv.id} className="hover:bg-muted/20">
                        <td className="px-5 py-3.5">
                          <p className="text-sm text-foreground font-medium">{inv.customerName}</p>
                          <p className="text-xs text-foreground/35">{inv.customerEmail}</p>
                        </td>
                        <td className="px-5 py-3.5 font-mono font-semibold text-foreground">{fmtAmount(inv.amount, inv.currency)}</td>
                        <td className="px-5 py-3.5"><SmBadge cfg={sc} /></td>
                        <td className="px-5 py-3.5 text-foreground/35 text-xs hidden md:table-cell">{fmtDate(inv.dueDate)}</td>
                        <td className="px-5 py-3.5 text-right text-foreground/35 text-xs">{fmtDate(inv.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {invoices && invoices.totalPages > 1 && (
                <div className="flex justify-center items-center gap-3 px-5 py-4 border-t border-border">
                  <button onClick={() => setInvoicesPage(p => p - 1)} disabled={invoicesPage === 0 || invoicesLoading} className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30"><ChevronLeft size={14} /></button>
                  <span className="text-xs text-foreground/40">{invoicesPage + 1} / {invoices.totalPages}</span>
                  <button onClick={() => setInvoicesPage(p => p + 1)} disabled={invoicesPage >= invoices.totalPages - 1 || invoicesLoading} className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30"><ChevronRight size={14} /></button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── SETTLEMENTS TAB ── */}
      {tab === "settlements" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-foreground/40" />
              <h2 className="text-sm font-semibold text-foreground">Settlements</h2>
              {settlements && <span className="text-xs text-foreground/30">{settlements.totalElements} total</span>}
            </div>
            {settlementsLoading && <Loader2 size={14} className="animate-spin text-foreground/30" />}
          </div>
          {!settlements && settlementsLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-foreground/30" size={20} /></div>
          ) : settlements?.content.length === 0 ? (
            <p className="text-center text-foreground/25 text-sm py-16">No settlements yet</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Gross</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider hidden md:table-cell">Fees</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Net</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider hidden lg:table-cell">Txns</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Status</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Period</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {settlements?.content.map((s) => {
                    const sc = SETTLEMENT_STATUS_CFG[s.status] ?? { cls: "text-foreground/40 bg-muted/30 border-border", label: s.status };
                    return (
                      <tr key={s.id} className="hover:bg-muted/20">
                        <td className="px-5 py-3.5 font-mono text-foreground/60 text-xs">{fmtAmount(s.grossAmount)}</td>
                        <td className="px-5 py-3.5 font-mono text-red-400/60 text-xs hidden md:table-cell">-{fmtAmount(s.feeTotal)}</td>
                        <td className="px-5 py-3.5 font-mono font-semibold text-foreground">{fmtAmount(s.netAmount)}</td>
                        <td className="px-5 py-3.5 text-foreground/40 text-xs hidden lg:table-cell">{s.transactionCount}</td>
                        <td className="px-5 py-3.5"><SmBadge cfg={sc} /></td>
                        <td className="px-5 py-3.5 text-right text-foreground/35 text-xs">
                          {s.periodStart ? `${fmtDate(s.periodStart).split(",")[0]} – ${fmtDate(s.periodEnd).split(",")[0]}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {settlements && settlements.totalPages > 1 && (
                <div className="flex justify-center items-center gap-3 px-5 py-4 border-t border-border">
                  <button onClick={() => setSettlementsPage(p => p - 1)} disabled={settlementsPage === 0 || settlementsLoading} className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30"><ChevronLeft size={14} /></button>
                  <span className="text-xs text-foreground/40">{settlementsPage + 1} / {settlements.totalPages}</span>
                  <button onClick={() => setSettlementsPage(p => p + 1)} disabled={settlementsPage >= settlements.totalPages - 1 || settlementsLoading} className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30"><ChevronRight size={14} /></button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── CUSTOMERS TAB ── */}
      {tab === "customers" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-foreground/40" />
              <h2 className="text-sm font-semibold text-foreground">Customers</h2>
              {customers && <span className="text-xs text-foreground/30">{customers.totalElements} total</span>}
            </div>
            {customersLoading && <Loader2 size={14} className="animate-spin text-foreground/30" />}
          </div>
          {!customers && customersLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-foreground/30" size={20} /></div>
          ) : customers?.content.length === 0 ? (
            <p className="text-center text-foreground/25 text-sm py-16">No customers yet</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Customer</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Payments</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Total Spend</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider hidden md:table-cell">First Payment</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider hidden lg:table-cell">Last Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {customers?.content.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/20">
                      <td className="px-5 py-3.5">
                        <p className="text-sm text-foreground font-medium">{c.name}</p>
                        <p className="text-xs text-foreground/35">{c.email ?? c.phone ?? "—"}</p>
                      </td>
                      <td className="px-5 py-3.5 text-foreground/60 text-sm">{c.totalPayments}</td>
                      <td className="px-5 py-3.5 font-mono font-semibold text-foreground">{fmtAmount(c.totalSpend)}</td>
                      <td className="px-5 py-3.5 text-right text-foreground/35 text-xs hidden md:table-cell">{fmtDate(c.firstPaymentAt)}</td>
                      <td className="px-5 py-3.5 text-right text-foreground/35 text-xs hidden lg:table-cell">{fmtDate(c.lastPaymentAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {customers && customers.totalPages > 1 && (
                <div className="flex justify-center items-center gap-3 px-5 py-4 border-t border-border">
                  <button onClick={() => setCustomersPage(p => p - 1)} disabled={customersPage === 0 || customersLoading} className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30"><ChevronLeft size={14} /></button>
                  <span className="text-xs text-foreground/40">{customersPage + 1} / {customers.totalPages}</span>
                  <button onClick={() => setCustomersPage(p => p + 1)} disabled={customersPage >= customers.totalPages - 1 || customersLoading} className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30"><ChevronRight size={14} /></button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── DISPUTES TAB ── */}
      {tab === "disputes" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale size={15} className="text-foreground/40" />
              <h2 className="text-sm font-semibold text-foreground">Disputes</h2>
              {merchantDisputes && <span className="text-xs text-foreground/30">{merchantDisputes.totalElements} total</span>}
            </div>
            {merchantDisputesLoading && <Loader2 size={14} className="animate-spin text-foreground/30" />}
          </div>
          {!merchantDisputes && merchantDisputesLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-foreground/30" size={20} /></div>
          ) : merchantDisputes?.content.length === 0 ? (
            <p className="text-center text-foreground/25 text-sm py-16">No disputes</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Ref</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Amount</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Category</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Status</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Filed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {merchantDisputes?.content.map((d) => {
                    const sc = DISPUTE_STATUS_CFG[d.status] ?? { cls: "text-foreground/40 bg-muted/30 border-border", label: d.status };
                    return (
                      <tr key={d.id} className="hover:bg-muted/20">
                        <td className="px-5 py-3.5 font-mono text-xs text-foreground/50">{d.referenceId}</td>
                        <td className="px-5 py-3.5 font-mono font-semibold text-foreground">{fmtAmount(d.amount, d.currency)}</td>
                        <td className="px-5 py-3.5 text-foreground/50 text-xs">{d.category.replace(/_/g, " ")}</td>
                        <td className="px-5 py-3.5"><SmBadge cfg={sc} /></td>
                        <td className="px-5 py-3.5 text-right text-foreground/35 text-xs">{fmtDate(d.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {merchantDisputes && merchantDisputes.totalPages > 1 && (
                <div className="flex justify-center items-center gap-3 px-5 py-4 border-t border-border">
                  <button onClick={() => setMerchantDisputesPage(p => p - 1)} disabled={merchantDisputesPage === 0 || merchantDisputesLoading} className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30"><ChevronLeft size={14} /></button>
                  <span className="text-xs text-foreground/40">{merchantDisputesPage + 1} / {merchantDisputes.totalPages}</span>
                  <button onClick={() => setMerchantDisputesPage(p => p + 1)} disabled={merchantDisputesPage >= merchantDisputes.totalPages - 1 || merchantDisputesLoading} className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30"><ChevronRight size={14} /></button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── BULK TRANSFERS TAB ── */}
      {tab === "bulk-transfers" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowLeftRight size={15} className="text-foreground/40" />
              <h2 className="text-sm font-semibold text-foreground">Bulk Transfers</h2>
              {bulkTransfers && <span className="text-xs text-foreground/30">{bulkTransfers.totalElements} total</span>}
            </div>
            {bulkTransfersLoading && <Loader2 size={14} className="animate-spin text-foreground/30" />}
          </div>
          {!bulkTransfers && bulkTransfersLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-foreground/30" size={20} /></div>
          ) : bulkTransfers?.content.length === 0 ? (
            <p className="text-center text-foreground/25 text-sm py-16">No bulk transfers yet</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Total Amount</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Recipients</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider hidden md:table-cell">Success / Fail</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Status</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-foreground/30 uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bulkTransfers?.content.map((bt) => {
                    const sc = BULK_STATUS_CFG[bt.status] ?? { cls: "text-foreground/40 bg-muted/30 border-border", label: bt.status };
                    return (
                      <tr key={bt.id} className="hover:bg-muted/20">
                        <td className="px-5 py-3.5 font-mono font-semibold text-foreground">{fmtAmount(bt.totalAmount)}</td>
                        <td className="px-5 py-3.5 text-foreground/60 text-sm">{bt.recipientCount}</td>
                        <td className="px-5 py-3.5 text-xs hidden md:table-cell">
                          <span className="text-emerald-400">{bt.successCount}</span>
                          <span className="text-foreground/25 mx-1">/</span>
                          <span className="text-red-400">{bt.failureCount}</span>
                        </td>
                        <td className="px-5 py-3.5"><SmBadge cfg={sc} /></td>
                        <td className="px-5 py-3.5 text-right text-foreground/35 text-xs">{fmtDate(bt.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {bulkTransfers && bulkTransfers.totalPages > 1 && (
                <div className="flex justify-center items-center gap-3 px-5 py-4 border-t border-border">
                  <button onClick={() => setBulkTransfersPage(p => p - 1)} disabled={bulkTransfersPage === 0 || bulkTransfersLoading} className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30"><ChevronLeft size={14} /></button>
                  <span className="text-xs text-foreground/40">{bulkTransfersPage + 1} / {bulkTransfers.totalPages}</span>
                  <button onClick={() => setBulkTransfersPage(p => p + 1)} disabled={bulkTransfersPage >= bulkTransfers.totalPages - 1 || bulkTransfersLoading} className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30"><ChevronRight size={14} /></button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── WEBHOOKS TAB ── */}
      {tab === "webhooks" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Webhook size={15} className="text-foreground/40" />
            <h2 className="text-sm font-semibold text-foreground">Webhook Delivery Log</h2>
          </div>
          {webhooksLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="animate-spin text-foreground/30" size={20} />
            </div>
          ) : !webhookDeliveries || webhookDeliveries.content.length === 0 ? (
            <p className="text-center text-foreground/30 text-sm py-10">No webhook deliveries recorded.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">Event Type</th>
                    <th className="text-center px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">Status</th>
                    <th className="text-center px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30 hidden md:table-cell">HTTP</th>
                    <th className="text-center px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30 hidden md:table-cell">Attempts</th>
                    <th className="text-right px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">Sent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {webhookDeliveries.content.map((d) => (
                    <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <span className="text-xs font-mono text-foreground/70">{d.eventType}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                          d.status === "SUCCESS"
                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                            : d.status === "FAILED"
                            ? "text-red-400 bg-red-500/10 border-red-500/20"
                            : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                        }`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center hidden md:table-cell">
                        <span className={`text-xs font-mono ${d.responseStatusCode && d.responseStatusCode < 300 ? "text-emerald-400" : "text-red-400"}`}>
                          {d.responseStatusCode ?? "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center hidden md:table-cell">
                        <span className="text-xs text-foreground/50">{d.attemptCount}</span>
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-foreground/35">
                        {d.createdAt ? new Date(d.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {webhookDeliveries.totalPages > 1 && (
                <div className="flex justify-center items-center gap-3 px-5 py-4 border-t border-border">
                  <button onClick={() => setWebhooksPage(p => p - 1)} disabled={webhooksPage === 0} className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs text-foreground/40">{webhooksPage + 1} / {webhookDeliveries.totalPages}</span>
                  <button onClick={() => setWebhooksPage(p => p + 1)} disabled={webhooksPage >= webhookDeliveries.totalPages - 1} className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30">
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── AUDIT LOG TAB ── */}
      {tab === "audit-log" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScrollText size={15} className="text-foreground/40" />
              <h2 className="text-sm font-semibold text-foreground">Audit Log</h2>
              {auditLog && <span className="text-xs text-foreground/30">{auditLog.totalElements} entries</span>}
            </div>
            {auditLogLoading && <Loader2 size={14} className="animate-spin text-foreground/30" />}
          </div>
          {!auditLog && auditLogLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-foreground/30" size={20} /></div>
          ) : auditLog?.content.length === 0 ? (
            <p className="text-center text-foreground/25 text-sm py-16">No audit entries</p>
          ) : (
            <>
              <div className="divide-y divide-border">
                {auditLog?.content.map((entry) => (
                  <div key={entry.id} className="px-5 py-3.5 hover:bg-muted/20 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-foreground/70 font-mono bg-muted/30 px-2 py-0.5 rounded">{entry.action}</span>
                        {entry.actorEmail && <span className="text-xs text-foreground/35">{entry.actorEmail}</span>}
                        {entry.ipAddress && <span className="text-[10px] text-foreground/20 font-mono">{entry.ipAddress}</span>}
                      </div>
                      {entry.details && <p className="text-xs text-foreground/40 mt-1 truncate">{entry.details}</p>}
                    </div>
                    <span className="text-[11px] text-foreground/25 flex-shrink-0">{fmtDate(entry.createdAt)}</span>
                  </div>
                ))}
              </div>
              {auditLog && auditLog.totalPages > 1 && (
                <div className="flex justify-center items-center gap-3 px-5 py-4 border-t border-border">
                  <button onClick={() => setAuditLogPage(p => p - 1)} disabled={auditLogPage === 0 || auditLogLoading} className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30"><ChevronLeft size={14} /></button>
                  <span className="text-xs text-foreground/40">{auditLogPage + 1} / {auditLog.totalPages}</span>
                  <button onClick={() => setAuditLogPage(p => p + 1)} disabled={auditLogPage >= auditLog.totalPages - 1 || auditLogLoading} className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30"><ChevronRight size={14} /></button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modals */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setModal(null)} />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-foreground">
                {modal === "kyb_approve" && "Approve KYB"}
                {modal === "kyb_reject" && "Reject KYB"}
                {modal === "kyb_more_info" && "Request More Information"}
                {modal === "suspend" && "Suspend Merchant"}
                {modal === "activate" && "Reactivate Merchant"}
                {modal === "reject_merchant" && "Reject Merchant Account"}
                {modal === "fee_rate" && "Update Fee Rate"}
              </h3>
              <button onClick={() => setModal(null)} className="text-foreground/40 hover:text-foreground"><X size={18} /></button>
            </div>

            {modal === "kyb_approve" && (
              <>
                <p className="text-sm text-foreground/50 mb-6">
                  This will approve the KYB application and activate the merchant's business account.
                </p>
                <button
                  onClick={() => handleKybReview(true)}
                  disabled={actionLoading}
                  className="w-full py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-semibold hover:bg-emerald-500/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Confirm Approval
                </button>
              </>
            )}

            {modal === "fee_rate" && (
              <>
                <p className="text-sm text-foreground/50 mb-4">
                  Current rate: <span className="text-[#B7EE7A] font-semibold">{fmtFee(merchant.feeRateBps)}</span>
                </p>
                <div className="mb-5">
                  <label className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-2 block">New Rate (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={feeInput}
                      onChange={(e) => setFeeInput(e.target.value)}
                      placeholder="e.g. 1.50"
                      className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/20 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/30 text-sm">%</span>
                  </div>
                  <p className="text-[11px] text-foreground/25 mt-1.5">
                    {feeInput && !isNaN(parseFloat(feeInput)) ? `= ${Math.round(parseFloat(feeInput) * 100)} bps` : "Enter a value between 0 and 100"}
                  </p>
                </div>
                <button
                  onClick={handleFeeRateUpdate}
                  disabled={actionLoading || !feeInput}
                  className="w-full py-3 rounded-xl bg-[#B7EE7A]/20 border border-[#B7EE7A]/30 text-[#B7EE7A] font-semibold hover:bg-[#B7EE7A]/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Percent size={16} />}
                  Update Fee Rate
                </button>
              </>
            )}

            {(modal === "kyb_reject" || modal === "kyb_more_info" || modal === "suspend" || modal === "activate" || modal === "reject_merchant") && (
              <>
                <div className="mb-5">
                  <label className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-2 block">
                    {modal === "kyb_more_info" ? "What information is needed?" : "Reason"}
                    {modal !== "activate" && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      modal === "kyb_more_info"
                        ? "Describe what additional documents or info is required…"
                        : modal === "activate"
                        ? "Optional note…"
                        : "Provide a reason…"
                    }
                    rows={3}
                    className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/20 resize-none"
                  />
                </div>

                {modal === "kyb_reject" && (
                  <button
                    onClick={() => handleKybReview(false, inputText, undefined)}
                    disabled={actionLoading || !inputText.trim()}
                    className="w-full py-3 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 font-semibold hover:bg-red-500/25 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                    Reject KYB
                  </button>
                )}

                {modal === "kyb_more_info" && (
                  <button
                    onClick={() => handleKybReview(false, undefined, inputText)}
                    disabled={actionLoading || !inputText.trim()}
                    className="w-full py-3 rounded-xl bg-orange-500/15 border border-orange-500/25 text-orange-400 font-semibold hover:bg-orange-500/25 disabled:opacity-50 transition-all"
                  >
                    {actionLoading ? <Loader2 size={16} className="animate-spin" /> : "Send Request"}
                  </button>
                )}

                {modal === "suspend" && (
                  <button
                    onClick={() => handleStatusChange("SUSPENDED")}
                    disabled={actionLoading || !inputText.trim()}
                    className="w-full py-3 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 font-semibold hover:bg-red-500/25 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
                    Suspend Merchant
                  </button>
                )}

                {modal === "activate" && (
                  <button
                    onClick={() => handleStatusChange("ACTIVE")}
                    disabled={actionLoading}
                    className="w-full py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 font-semibold hover:bg-emerald-500/25 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    Reactivate Merchant
                  </button>
                )}

                {modal === "reject_merchant" && (
                  <button
                    onClick={() => handleStatusChange("REJECTED")}
                    disabled={actionLoading || !inputText.trim()}
                    className="w-full py-3 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 font-semibold hover:bg-red-500/25 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                    Reject Account
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
