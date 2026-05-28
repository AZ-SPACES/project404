import { useMutation } from '@tanstack/react-query';
import { markAllNotificationsAsRead, markNotificationAsRead, deleteAllNotifications } from '../../../services/api';
import { queryClient } from '../../../lib/queryClient';
import { queryKeys } from '../../../lib/queryKeys';

export function useMarkAllReadMutation() {
  return useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationCount() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
    },
  });
}

export function useMarkReadMutation() {
  return useMutation({
    mutationFn: (id: string) => markNotificationAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationCount() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
    },
  });
}

export function useDeleteAllNotificationsMutation() {
  return useMutation({
    mutationFn: deleteAllNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationCount() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
    },
  });
}
