export interface NotificationPayload {
  kind: 'notification';
  transactionId: string;
  type: 'EMAIL' | 'SMS';
  recipient: string;
  subject?: string;
  content: string;
}
