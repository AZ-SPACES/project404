import { useState, useEffect, useCallback } from 'react';
import { getMiniAppConsent, grantMiniAppConsent } from '../services/api';

type ConsentStatus = 'loading' | 'needs_consent' | 'granted' | 'not_applicable';

export function useMiniAppConsent(appId: string, requestedPermissions: string[]) {
  const [status, setStatus] = useState<ConsentStatus>('loading');
  const [grantedPermissions, setGrantedPermissions] = useState<string[]>([]);

  const check = useCallback(async () => {
    if (!requestedPermissions || requestedPermissions.length === 0) {
      setStatus('not_applicable');
      return;
    }
    try {
      const res = await getMiniAppConsent(appId);
      const consent = res.data?.data;
      if (consent?.granted) {
        setGrantedPermissions(consent.grantedPermissions ?? []);
        setStatus('granted');
      } else {
        setStatus('needs_consent');
      }
    } catch {
      setStatus('needs_consent');
    }
  }, [appId, requestedPermissions]);

  useEffect(() => { check(); }, [check]);

  const grant = useCallback(async (permissions: string[]) => {
    await grantMiniAppConsent(appId, permissions);
    setGrantedPermissions(permissions);
    setStatus('granted');
  }, [appId]);

  const deny = useCallback(() => {
    setStatus('needs_consent');
  }, []);

  return { consentStatus: status, grantedPermissions, grant, deny };
}
