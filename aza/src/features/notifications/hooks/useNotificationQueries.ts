import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../providers/AuthProvider';
import { getNotifications, getUnreadNotificationCount } from '../../../services/api';
import { queryKeys } from '../../../lib/queryKeys';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data: string;
  imageUrl?: string;
  isRead: boolean;
  createdAt: string;
}

export function useNotificationCountQuery() {
  const { userToken } = useAuth();
  return useQuery({
    queryKey: queryKeys.notificationCount(),
    queryFn: async () => {
      const response = await getUnreadNotificationCount();
      return response.data?.data?.unreadCount ?? 0;
    },
    enabled: !!userToken,
    staleTime: 60_000,
  });
}

export function useNotificationsQuery() {
  const { userToken } = useAuth();
  return useQuery({
    queryKey: queryKeys.notifications(),
    queryFn: async () => {
      const response = await getNotifications();
      const content = response.data?.data?.content || [];
      return content.map((n: any) => ({
        ...n,
        isRead: n.isRead !== undefined ? n.isRead : n.read,
      })) as NotificationItem[];
    },
    enabled: !!userToken,
    staleTime: 30_000,
  });
}
