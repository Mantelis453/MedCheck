import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

if (Platform.OS !== 'web') {
  Notifications.setNotificationCategoryAsync('medication_reminder', [
    {
      identifier: 'confirm_taken',
      buttonTitle: 'I Took It',
      options: {
        opensAppToForeground: false,
      },
    },
    {
      identifier: 'skip',
      buttonTitle: 'Skip',
      options: {
        opensAppToForeground: false,
      },
    },
  ]);
}

export async function handleNotificationResponse(
  response: Notifications.NotificationResponse
): Promise<void> {
  const { notification, actionIdentifier } = response;
  const data = notification.request.content.data as { medicationId?: string; medicationName?: string };

  if (!data?.medicationId) return;
  
  const medicationId = data.medicationId;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (actionIdentifier === 'confirm_taken') {
      const { error } = await supabase.from('medication_logs').insert({
        user_id: user.id,
        medication_id: medicationId,
        scheduled_time: today.toISOString(),
        taken_at: now.toISOString(),
        status: 'taken',
        confirmed_via: 'notification',
      });
      if (error) {
        if (error.code === 'PGRST205') {
          console.warn('medication_logs table not found. Medication tracking features require migration.');
        } else {
          console.error('Failed to log medication taken:', error);
        }
      }
    } else if (actionIdentifier === 'skip') {
      const { error } = await supabase.from('medication_logs').insert({
        user_id: user.id,
        medication_id: medicationId,
        scheduled_time: today.toISOString(),
        status: 'skipped',
        confirmed_via: 'notification',
      });
      if (error) {
        if (error.code === 'PGRST205') {
          console.warn('medication_logs table not found. Medication tracking features require migration.');
        } else {
          console.error('Failed to log medication skipped:', error);
        }
      }
    }
  } catch (error) {
    console.error('Failed to handle notification response:', error);
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

export async function scheduleMedicationReminder(
  medicationName: string,
  time: string,
  medicationId: string,
  frequency: 'daily' | 'weekly' | 'monthly' = 'daily',
  reminderDays: number[] = []
): Promise<string[]> {
  if (Platform.OS === 'web') {
    return [];
  }

  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return [];
    }

    await cancelMedicationReminder(medicationId);

    const [hours, minutes] = time.split(':').map(Number);
    const notificationIds: string[] = [];

    if (frequency === 'daily') {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Medication Reminder',
          body: `Time to take ${medicationName}`,
          data: {
            medicationId,
            medicationName,
            type: 'medication_reminder',
          },
          sound: true,
          categoryIdentifier: 'medication_reminder',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: hours,
          minute: minutes,
          repeats: true,
        } as any,
      });
      notificationIds.push(notificationId);
    } else if (frequency === 'weekly') {
      for (const weekday of reminderDays) {
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Medication Reminder',
            body: `Time to take ${medicationName}`,
            data: {
              medicationId,
              medicationName,
              type: 'medication_reminder',
            },
            sound: true,
            categoryIdentifier: 'medication_reminder',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: weekday + 1,
            hour: hours,
            minute: minutes,
            repeats: true,
          } as any,
        });
        notificationIds.push(notificationId);
      }
    } else if (frequency === 'monthly') {
      for (const day of reminderDays) {
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Medication Reminder',
            body: `Time to take ${medicationName}`,
            data: {
              medicationId,
              medicationName,
              type: 'medication_reminder',
            },
            sound: true,
            categoryIdentifier: 'medication_reminder',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            day: day,
            hour: hours,
            minute: minutes,
            repeats: true,
          } as any,
        });
        notificationIds.push(notificationId);
      }
    }

    return notificationIds;
  } catch (error) {
    console.error('Failed to schedule notification:', error);
    return [];
  }
}

export async function cancelMedicationReminder(medicationId: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    const toCancel = notifications.filter(
      (notif) => notif.content.data?.medicationId === medicationId
    );

    for (const notif of toCancel) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  } catch (error) {
    console.error('Failed to cancel notification:', error);
  }
}

export async function cancelAllMedicationReminders(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Failed to cancel all notifications:', error);
  }
}
