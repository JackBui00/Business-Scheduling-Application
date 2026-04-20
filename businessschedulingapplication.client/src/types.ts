export type AuthMode = 'signin' | 'signup';

export type AuthSession = {
  userId: string;
  email: string;
  displayName: string;
  roleName: string;
  businessDescription: string | null;
  botName: string | null;
  isActive: boolean;
  lastLoginAtUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type DashboardMetrics = {
  customers: number;
  appointments: number;
  conversations: number;
  messages: number;
};

export type DashboardTab = 'overview' | 'calendar' | 'messages' | 'hours';

export type CalendarView = 'month' | 'week';

export type BusinessHoursDay = {
  dayOfWeek: number;
  dayLabel: string;
  isOpen: boolean;
  opensAtLocal: string | null;
  closesAtLocal: string | null;
};

export type BusinessHoursSchedule = {
  timeZoneId: string;
  days: BusinessHoursDay[];
};

export type AppointmentSummary = {
  appointmentId: string;
  customerId: string;
  customerName: string;
  scheduledAtUtc: string;
  durationMinutes: number;
  serviceName: string;
  status: string;
  notes: string | null;
  createdVia: string;
  createdByUserId: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type BotAppointmentDraft = {
  scheduledAtLocal: string;
  durationMinutes: number;
  serviceName: string;
  notes: string | null;
};

export type CustomerSummary = {
  customerId: string;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  notes: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type CustomerProfileDraft = {
  fullName: string;
  phoneNumber: string;
  email: string;
  notes: string;
};

export type SmsConversationSummary = {
  conversationId: string;
  customerId: string;
  lastMessageAtUtc: string | null;
  unreadCount: number;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type SmsMessageSummary = {
  smsMessageId: string;
  conversationId: string;
  customerId: string;
  direction: string;
  messageBody: string;
  deliveryStatus: string;
  sentAtUtc: string;
  createdAtUtc: string;
};

export type ConversationThread = SmsConversationSummary & {
  customer: CustomerSummary | null;
  customerName: string;
  customerPhoneNumber: string;
  threadMessages: SmsMessageSummary[];
  latestMessage: SmsMessageSummary | null;
};

export type BotReplyResult = {
  message: SmsMessageSummary;
  appointment: AppointmentSummary | null;
};
