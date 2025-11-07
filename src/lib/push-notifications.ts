import { PushNotifications, Token, ActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// 初始化推送通知
export const initializePushNotifications = async () => {
  if (!Capacitor.isNativePlatform()) {
    console.log('Push notifications only work on native platforms');
    return;
  }

  try {
    // 請求推送權限
    const permStatus = await PushNotifications.requestPermissions();
    
    if (permStatus.receive === 'granted') {
      // 註冊推送
      await PushNotifications.register();
      console.log('Push notifications registered');
    } else {
      console.log('Push notification permission denied');
    }

    // 監聽註冊成功
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('Push registration success, token:', token.value);
      
      // 將 token 儲存到 Supabase（用於後續發送通知）
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('profiles')
            .update({ 
              push_token: token.value,
              push_platform: Capacitor.getPlatform()
            })
            .eq('id', user.id);
        }
      } catch (error) {
        console.error('Error saving push token:', error);
      }
    });

    // 監聽註冊錯誤
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Push registration error:', error);
    });

    // 監聽推送通知接收（App 在前景時）
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push notification received:', notification);
      
      // 顯示通知（使用 toast）
      toast.info(notification.title || '新通知', {
        description: notification.body
      });
    });

    // 監聽推送通知點擊
    PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
      console.log('Push notification action performed:', notification);
      
      // 根據通知數據導航到相應頁面
      const data = notification.notification.data;
      if (data.topicId) {
        window.location.href = `/vote/${data.topicId}`;
      }
    });

  } catch (error) {
    console.error('Error initializing push notifications:', error);
  }
};

// 獲取推送通知列表（獲取已接收但未讀的通知）
export const getDeliveredNotifications = async () => {
  if (!Capacitor.isNativePlatform()) return [];
  
  try {
    const result = await PushNotifications.getDeliveredNotifications();
    return result.notifications;
  } catch (error) {
    console.error('Error getting delivered notifications:', error);
    return [];
  }
};

// 清除所有通知
export const removeAllNotifications = async () => {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    await PushNotifications.removeAllDeliveredNotifications();
  } catch (error) {
    console.error('Error removing notifications:', error);
  }
};

