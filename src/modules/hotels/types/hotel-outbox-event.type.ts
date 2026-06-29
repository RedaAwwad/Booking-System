import { AuditPayload } from '../../audit/types/audit-payload.type';
import { NotificationPayload } from '../../notifications/types/notification-payload.type';

export type HotelOutboxEvent = AuditPayload | NotificationPayload;
