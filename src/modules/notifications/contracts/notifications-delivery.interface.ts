export interface INotificationsDeliveryService {
  sendEmail(to: string, subject: string, content: string): Promise<void>;
  sendSms(to: string, content: string): Promise<void>;
}
