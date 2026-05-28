export const queryKeys = {
  profile:             () => ['profile'] as const,
  wallet:              () => ['wallet'] as const,
  transactions:        (status?: string) => ['transactions', status ?? 'all'] as const,
  contacts:            () => ['contacts'] as const,
  contactRequests:     () => ['contact-requests'] as const,
  sentContactRequests: () => ['sent-contact-requests'] as const,
  blockedUsers:        () => ['blocked-users'] as const,
  notifications:       (page?: number) => ['notifications', page ?? 0] as const,
  notificationCount:   () => ['notification-count'] as const,
  kycStatus:           () => ['kyc-status'] as const,
  merchant:            () => ['merchant'] as const,
  spendingSummary:     () => ['spending-summary'] as const,
} as const;
