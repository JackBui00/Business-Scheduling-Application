import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type {
  AppointmentSummary,
  AuthSession,
  BotReplyResult,
  BusinessHoursSchedule,
  CalendarView,
  ConversationThread,
  CustomerProfileDraft,
  CustomerSummary,
  DashboardMetrics,
  DashboardTab,
  SmsConversationSummary,
  SmsMessageSummary,
} from '../../types';
import { browserTimeZoneId, createDefaultBusinessHoursSchedule } from '../../lib/scheduling';
import { CalendarTab } from './CalendarTab';
import { BusinessHoursTab } from './BusinessHoursTab';
import { MessagesTab } from './MessagesTab';
import { MetricCard } from '../shared/MetricCard';

type DashboardWorkspaceProps = {
  session: AuthSession | null;
  setSession: Dispatch<SetStateAction<AuthSession | null>>;
};

export function DashboardWorkspace(props: DashboardWorkspaceProps) {
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('overview');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [conversations, setConversations] = useState<SmsConversationSummary[]>([]);
  const [messages, setMessages] = useState<SmsMessageSummary[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHoursSchedule>(() => createDefaultBusinessHoursSchedule());
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [savingBusinessHours, setSavingBusinessHours] = useState(false);
  const [businessHoursMessage, setBusinessHoursMessage] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState<CalendarView>('month');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [takenOverConversationIds, setTakenOverConversationIds] = useState<string[]>([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [newCustomerForm, setNewCustomerForm] = useState({
    fullName: '',
    phoneNumber: '',
    email: '',
    notes: '',
  });
  const [newConversationDraft, setNewConversationDraft] = useState('');
  const [sendingNewConversation, setSendingNewConversation] = useState(false);
  const [isNewConversationComposerOpen, setIsNewConversationComposerOpen] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [sendingBotReply, setSendingBotReply] = useState(false);
  const [simulatedInboundDraft, setSimulatedInboundDraft] = useState('');
  const [simulatingInboundMessage, setSimulatingInboundMessage] = useState(false);
  const [isEditingCustomerProfile, setIsEditingCustomerProfile] = useState(false);
  const [customerProfileDraft, setCustomerProfileDraft] = useState<CustomerProfileDraft>({
    fullName: '',
    phoneNumber: '',
    email: '',
    notes: '',
  });
  const [savingCustomerProfile, setSavingCustomerProfile] = useState(false);
  const [customerProfileMessage, setCustomerProfileMessage] = useState<string | null>(null);
  const [takeoverNotice, setTakeoverNotice] = useState<string | null>(null);
  const [businessDescriptionDraft, setBusinessDescriptionDraft] = useState(props.session?.businessDescription ?? '');
  const [botNameDraft, setBotNameDraft] = useState(props.session?.botName ?? '');
  const [savingBusinessDescription, setSavingBusinessDescription] = useState(false);
  const [businessDescriptionMessage, setBusinessDescriptionMessage] = useState<string | null>(null);
  const [businessDescriptionError, setBusinessDescriptionError] = useState<string | null>(null);

  useEffect(() => {
    setBusinessDescriptionDraft(props.session?.businessDescription ?? '');
    setBotNameDraft(props.session?.botName ?? '');
    setBusinessDescriptionMessage(null);
    setBusinessDescriptionError(null);
  }, [props.session?.businessDescription, props.session?.botName]);

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.customerId, customer] as const)),
    [customers],
  );

  const conversationThreads = useMemo<ConversationThread[]>(() => {
    const groupedMessages = new Map<string, SmsMessageSummary[]>();

    [...messages]
      .sort((left, right) => new Date(left.sentAtUtc).getTime() - new Date(right.sentAtUtc).getTime())
      .forEach((message) => {
        const threadMessages = groupedMessages.get(message.conversationId) ?? [];
        threadMessages.push(message);
        groupedMessages.set(message.conversationId, threadMessages);
      });

    return [...conversations]
      .map((conversation) => {
        const customer = customerById.get(conversation.customerId) ?? null;
        const threadMessages = groupedMessages.get(conversation.conversationId) ?? [];
        const latestMessage = threadMessages[threadMessages.length - 1] ?? null;

        return {
          ...conversation,
          customer,
          customerName: customer?.fullName ?? 'Unknown customer',
          customerPhoneNumber: customer?.phoneNumber ?? '',
          threadMessages,
          latestMessage,
        };
      })
      .sort((left, right) => {
        const leftTime = new Date(left.lastMessageAtUtc ?? left.updatedAtUtc).getTime();
        const rightTime = new Date(right.lastMessageAtUtc ?? right.updatedAtUtc).getTime();
        return rightTime - leftTime;
      });
  }, [conversations, customerById, messages]);

  const selectedConversation =
    conversationThreads.find((conversation) => conversation.conversationId === selectedConversationId) ?? null;
  const isConversationTakenOver =
    selectedConversation !== null && takenOverConversationIds.includes(selectedConversation.conversationId);
  const takeoverStorageKey = props.session ? `zephyrbook.takeovers.${props.session.userId}` : null;

  useEffect(() => {
    if (!takeoverStorageKey) {
      return;
    }

    try {
      const storedValue = window.localStorage.getItem(takeoverStorageKey);
      if (!storedValue) {
        setTakenOverConversationIds([]);
        return;
      }

      const parsedValue = JSON.parse(storedValue) as unknown;
      if (Array.isArray(parsedValue) && parsedValue.every((value) => typeof value === 'string')) {
        setTakenOverConversationIds(parsedValue);
      } else {
        setTakenOverConversationIds([]);
      }
    } catch {
      setTakenOverConversationIds([]);
    }
  }, [takeoverStorageKey]);

  useEffect(() => {
    if (!takeoverStorageKey) {
      return;
    }

    window.localStorage.setItem(takeoverStorageKey, JSON.stringify(takenOverConversationIds));
  }, [takeoverStorageKey, takenOverConversationIds]);

  useEffect(() => {
    if (!props.session) {
      setMetrics(null);
      setCustomers([]);
      setAppointments([]);
      setConversations([]);
      setMessages([]);
      setBusinessHours(createDefaultBusinessHoursSchedule());
      setLoadingMetrics(false);
      setSelectedAppointmentId(null);
      setSelectedConversationId(null);
      setTakenOverConversationIds([]);
      setMessageDraft('');
      setNewCustomerForm({
        fullName: '',
        phoneNumber: '',
        email: '',
        notes: '',
      });
      setNewConversationDraft('');
      setSendingNewConversation(false);
      setSendingBotReply(false);
      setSimulatedInboundDraft('');
      setSimulatingInboundMessage(false);
      setIsNewConversationComposerOpen(false);
      setIsEditingCustomerProfile(false);
      setSavingCustomerProfile(false);
      setCustomerProfileDraft({
        fullName: '',
        phoneNumber: '',
        email: '',
        notes: '',
      });
      setCustomerProfileMessage(null);
      setTakeoverNotice(null);
      setMessagesError(null);
      return;
    }

    let cancelled = false;

    async function loadDashboardData() {
      setLoadingMetrics(true);
      setMetricsError(null);
      setMessagesError(null);

      try {
        const [customersResponse, appointmentsResponse, conversationsResponse, messagesResponse, businessHoursResponse] =
          await Promise.all([
            fetch('/api/customers', { credentials: 'include' }),
            fetch('/api/appointments', { credentials: 'include' }),
            fetch('/api/smsconversations', { credentials: 'include' }),
            fetch('/api/smsmessages', { credentials: 'include' }),
            fetch('/api/businesshours', { credentials: 'include' }),
          ]);

        if (
          !customersResponse.ok ||
          !appointmentsResponse.ok ||
          !conversationsResponse.ok ||
          !messagesResponse.ok ||
          !businessHoursResponse.ok
        ) {
          throw new Error('Unable to load dashboard data right now.');
        }

        const [customerRows, appointmentRows, conversationRows, messageRows, businessHoursRows] = (await Promise.all([
          customersResponse.json(),
          appointmentsResponse.json(),
          conversationsResponse.json(),
          messagesResponse.json(),
          businessHoursResponse.json(),
        ])) as [CustomerSummary[], AppointmentSummary[], SmsConversationSummary[], SmsMessageSummary[], BusinessHoursSchedule];

        if (cancelled) {
          return;
        }

        setCustomers(customerRows);
        setAppointments(appointmentRows);
        setConversations(conversationRows);
        setMessages(messageRows);
        setMetrics({
          customers: customerRows.length,
          appointments: appointmentRows.length,
          conversations: conversationRows.length,
          messages: messageRows.length,
        });
        setBusinessHours({
          timeZoneId: businessHoursRows.timeZoneId || browserTimeZoneId,
          days: businessHoursRows.days ?? createDefaultBusinessHoursSchedule().days,
        });
        setBusinessHoursMessage(null);
        setSelectedAppointmentId((currentSelectedId) => {
          if (currentSelectedId && appointmentRows.some((appointment) => appointment.appointmentId === currentSelectedId)) {
            return currentSelectedId;
          }

          return appointmentRows[0]?.appointmentId ?? null;
        });
        setSelectedConversationId((currentSelectedId) => {
          if (currentSelectedId && conversationRows.some((conversation) => conversation.conversationId === currentSelectedId)) {
            return currentSelectedId;
          }

          return conversationRows[0]?.conversationId ?? null;
        });
        setTakenOverConversationIds((currentTakenOverIds) =>
          currentTakenOverIds.filter((conversationId) =>
            conversationRows.some((conversation) => conversation.conversationId === conversationId),
          ),
        );
        setMessageDraft('');
        setNewCustomerForm({
          fullName: '',
          phoneNumber: '',
          email: '',
          notes: '',
        });
        setNewConversationDraft('');
        setSendingBotReply(false);
        setSimulatedInboundDraft('');
        setSimulatingInboundMessage(false);
        setIsNewConversationComposerOpen(false);
        setIsEditingCustomerProfile(false);
        setSavingCustomerProfile(false);
        setCustomerProfileMessage(null);
        setTakeoverNotice(null);
      } catch (loadError) {
        if (!cancelled) {
          setMetricsError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard data.');
        }
      } finally {
        if (!cancelled) {
          setLoadingMetrics(false);
        }
      }
    }

    void loadDashboardData();

    return () => {
      cancelled = true;
    };
  }, [props.session]);

  function handleConversationSelection(conversationId: string) {
    setSelectedConversationId(conversationId);
    setMessageDraft('');
    setTakeoverNotice(null);
    setMessagesError(null);
  }

  function handleOpenNewConversationComposer() {
    setIsNewConversationComposerOpen(true);
    setMessagesError(null);
    setTakeoverNotice(null);
  }

  function handleCloseNewConversationComposer() {
    setIsNewConversationComposerOpen(false);
    setMessagesError(null);
  }

  function handleOpenCustomerProfileEditor() {
    if (!selectedConversation?.customer) {
      setMessagesError('Select a conversation with a known customer first.');
      return;
    }

    setCustomerProfileDraft({
      fullName: selectedConversation.customer.fullName,
      phoneNumber: selectedConversation.customer.phoneNumber,
      email: selectedConversation.customer.email ?? '',
      notes: selectedConversation.customer.notes ?? '',
    });
    setIsEditingCustomerProfile(true);
    setCustomerProfileMessage(null);
    setMessagesError(null);
  }

  function handleCloseCustomerProfileEditor() {
    setIsEditingCustomerProfile(false);
    setCustomerProfileMessage(null);
    setMessagesError(null);
  }

  function handleTakeoverConversation() {
    if (!selectedConversation) {
      setMessagesError('Select a conversation first.');
      return;
    }

    setTakenOverConversationIds((current) => {
      if (current.includes(selectedConversation.conversationId)) {
        return current.filter((conversationId) => conversationId !== selectedConversation.conversationId);
      }

      return [...current, selectedConversation.conversationId];
    });
    setTakeoverNotice(
      isConversationTakenOver
        ? `Bot replies are back on for ${selectedConversation.customerName}.`
        : `You are now replying directly to ${selectedConversation.customerName}.`,
    );
    setMessagesError(null);
  }

  async function handleStartConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedFullName = newCustomerForm.fullName.trim();
    const trimmedPhoneNumber = newCustomerForm.phoneNumber.trim();
    const trimmedEmail = newCustomerForm.email.trim();
    const trimmedNotes = newCustomerForm.notes.trim();
    const trimmedDraft = newConversationDraft.trim();
    const customerAlreadyExists = customers.some((customer) => customer.phoneNumber === trimmedPhoneNumber);

    if (!trimmedFullName || !trimmedPhoneNumber) {
      setMessagesError('Add the customer name and phone number first.');
      return;
    }

    if (!trimmedDraft) {
      setMessagesError('Write a message before sending it.');
      return;
    }

    setSendingNewConversation(true);
    setMessagesError(null);

    try {
      const customerResponse = await fetch('/api/customers', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: trimmedFullName,
          phoneNumber: trimmedPhoneNumber,
          email: trimmedEmail || null,
          notes: trimmedNotes || null,
        }),
      });

      const customerData = (await customerResponse.json().catch(() => null)) as CustomerSummary | { message?: string } | null;
      if (!customerResponse.ok) {
        throw new Error(
          customerData && 'message' in customerData
            ? customerData.message ?? 'Unable to create the customer right now.'
            : 'Unable to create the customer right now.',
        );
      }

      const targetCustomer = customerData as CustomerSummary;
      setCustomers((current) => {
        const existingCustomerIndex = current.findIndex((customer) => customer.customerId === targetCustomer.customerId);

        if (existingCustomerIndex >= 0) {
          return current.map((customer) => (customer.customerId === targetCustomer.customerId ? targetCustomer : customer));
        }

        return [targetCustomer, ...current];
      });

      const response = await fetch('/api/smsmessages/send', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: targetCustomer.customerId,
          messageBody: trimmedDraft,
        }),
      });

      const data = (await response.json().catch(() => null)) as SmsMessageSummary | { message?: string } | null;
      if (!response.ok) {
        throw new Error(
          data && 'message' in data ? data.message ?? 'Unable to start conversation right now.' : 'Unable to start conversation right now.',
        );
      }

      const sentMessage = data as SmsMessageSummary;
      const sentConversationTime = sentMessage.sentAtUtc;
      setMessages((current) => [...current, sentMessage]);
      setConversations((current) => {
        const existingConversation = current.find(
          (conversation) => conversation.conversationId === sentMessage.conversationId || conversation.customerId === targetCustomer.customerId,
        );

        if (existingConversation) {
          return current.map((conversation) =>
            conversation.conversationId === existingConversation.conversationId
              ? {
                  ...conversation,
                  lastMessageAtUtc: sentConversationTime,
                  unreadCount: 0,
                  updatedAtUtc: sentConversationTime,
                }
              : conversation,
          );
        }

        return [
          {
            conversationId: sentMessage.conversationId,
            customerId: targetCustomer.customerId,
            lastMessageAtUtc: sentConversationTime,
            unreadCount: 0,
            createdAtUtc: sentConversationTime,
            updatedAtUtc: sentConversationTime,
          },
          ...current,
        ];
      });
      setMetrics((current) =>
        current
          ? {
              ...current,
              customers: customerAlreadyExists ? current.customers : current.customers + 1,
              conversations: current.conversations + 1,
              messages: current.messages + 1,
            }
          : current,
      );
      setSelectedConversationId(sentMessage.conversationId);
      setTakenOverConversationIds((current) =>
        current.includes(sentMessage.conversationId) ? current : [...current, sentMessage.conversationId],
      );
      setMessageDraft('');
      setNewCustomerForm({
        fullName: '',
        phoneNumber: '',
        email: '',
        notes: '',
      });
      setNewConversationDraft('');
      setIsNewConversationComposerOpen(false);
      setTakeoverNotice(`Conversation started with ${targetCustomer.fullName}.`);
    } catch (sendError) {
      setMessagesError(sendError instanceof Error ? sendError.message : 'Unable to start conversation right now.');
    } finally {
      setSendingNewConversation(false);
    }
  }

  async function handleSaveCustomerProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedConversation?.customer) {
      setMessagesError('Select a customer profile to edit.');
      return;
    }

    const trimmedFullName = customerProfileDraft.fullName.trim();
    const trimmedPhoneNumber = customerProfileDraft.phoneNumber.trim();
    const trimmedEmail = customerProfileDraft.email.trim();
    const trimmedNotes = customerProfileDraft.notes.trim();

    if (!trimmedFullName || !trimmedPhoneNumber) {
      setMessagesError('Customer name and phone number are required.');
      return;
    }

    setSavingCustomerProfile(true);
    setCustomerProfileMessage(null);
    setMessagesError(null);

    try {
      const response = await fetch(`/api/customers/${selectedConversation.customer.customerId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: trimmedFullName,
          phoneNumber: trimmedPhoneNumber,
          email: trimmedEmail || null,
          notes: trimmedNotes || null,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message ?? 'Unable to save customer profile right now.');
      }

      const updatedCustomer: CustomerSummary = {
        ...selectedConversation.customer,
        fullName: trimmedFullName,
        phoneNumber: trimmedPhoneNumber,
        email: trimmedEmail || null,
        notes: trimmedNotes || null,
        updatedAtUtc: new Date().toISOString(),
      };

      setCustomers((current) =>
        current.map((customer) => (customer.customerId === updatedCustomer.customerId ? updatedCustomer : customer)),
      );
      setCustomerProfileMessage('Customer profile saved.');
      setIsEditingCustomerProfile(false);
    } catch (saveError) {
      setMessagesError(saveError instanceof Error ? saveError.message : 'Unable to save customer profile right now.');
    } finally {
      setSavingCustomerProfile(false);
    }
  }

  async function handleSaveBusinessDescription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSavingBusinessDescription(true);
    setBusinessDescriptionMessage(null);
    setBusinessDescriptionError(null);

    try {
      const response = await fetch('/api/auth/me', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessDescription: businessDescriptionDraft.trim() || null,
          botName: botNameDraft.trim() || null,
        }),
      });

      const data = (await response.json().catch(() => null)) as AuthSession | { message?: string } | null;
      if (!response.ok) {
        throw new Error(
          data && 'message' in data ? data.message ?? 'Unable to save business profile right now.' : 'Unable to save business profile right now.',
        );
      }

      const updatedSession = data as AuthSession;
      props.setSession(updatedSession);
      setBusinessDescriptionDraft(updatedSession.businessDescription ?? '');
      setBotNameDraft(updatedSession.botName ?? '');
      setBusinessDescriptionMessage('Business profile saved.');
    } catch (saveError) {
      setBusinessDescriptionError(saveError instanceof Error ? saveError.message : 'Unable to save business profile right now.');
    } finally {
      setSavingBusinessDescription(false);
    }
  }

  async function handleSendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedConversation) {
      setMessagesError('Select a conversation first.');
      return;
    }

    if (!isConversationTakenOver) {
      setMessagesError('Take over this conversation before replying.');
      return;
    }

    const trimmedDraft = messageDraft.trim();
    if (!trimmedDraft) {
      setMessagesError('Write a reply before sending it.');
      return;
    }

    setSendingReply(true);
    setMessagesError(null);

    try {
      const response = await fetch('/api/smsmessages/send', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: selectedConversation.conversationId,
          customerId: selectedConversation.customerId,
          messageBody: trimmedDraft,
        }),
      });

      const data = (await response.json().catch(() => null)) as SmsMessageSummary | { message?: string } | null;
      if (!response.ok) {
        throw new Error(
          data && 'message' in data ? data.message ?? 'Unable to send reply right now.' : 'Unable to send reply right now.',
        );
      }

      const sentMessage = data as SmsMessageSummary;
      setMessages((current) => [...current, sentMessage]);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.conversationId === selectedConversation.conversationId
            ? {
                ...conversation,
                lastMessageAtUtc: sentMessage.sentAtUtc,
                unreadCount: 0,
                updatedAtUtc: sentMessage.sentAtUtc,
              }
            : conversation,
        ),
      );
      setMetrics((current) =>
        current
          ? {
              ...current,
              messages: current.messages + 1,
            }
          : current,
      );
      setMessageDraft('');
      setTakeoverNotice(`Reply sent to ${selectedConversation.customerName}.`);
    } catch (sendError) {
      setMessagesError(sendError instanceof Error ? sendError.message : 'Unable to send reply right now.');
    } finally {
      setSendingReply(false);
    }
  }

  async function handleGenerateBotReply() {
    if (!selectedConversation) {
      setMessagesError('Select a conversation first.');
      return;
    }

    if (isConversationTakenOver) {
      setMessagesError('Release the takeover before letting the bot answer.');
      return;
    }

    setSendingBotReply(true);
    setMessagesError(null);

    try {
      const response = await fetch('/api/smsmessages/bot-reply', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: selectedConversation.conversationId,
        }),
      });

      const data = (await response.json().catch(() => null)) as BotReplyResult | { message?: string } | null;
      if (!response.ok) {
        const errorMessage =
          data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
            ? data.message
            : 'Unable to generate a bot reply right now.';
        throw new Error(errorMessage);
      }

      const result = data as BotReplyResult;
      setMessages((current) => [...current, result.message]);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.conversationId === selectedConversation.conversationId
            ? {
                ...conversation,
                lastMessageAtUtc: result.message.sentAtUtc,
                unreadCount: 0,
                updatedAtUtc: result.message.sentAtUtc,
              }
            : conversation,
        ),
      );
      setMetrics((current) =>
        current
          ? {
              ...current,
              messages: current.messages + 1,
              appointments: result.appointment ? current.appointments + 1 : current.appointments,
            }
          : current,
      );

      if (result.appointment) {
        setAppointments((current) => {
          const existingIndex = current.findIndex((appointment) => appointment.appointmentId === result.appointment?.appointmentId);

          if (existingIndex >= 0) {
            return current.map((appointment) =>
              appointment.appointmentId === result.appointment?.appointmentId ? result.appointment! : appointment,
            );
          }

          return [result.appointment!, ...current];
        });
      }

      setTakeoverNotice(`Bot replied to ${selectedConversation.customerName}.`);
    } catch (sendError) {
      setMessagesError(sendError instanceof Error ? sendError.message : 'Unable to generate a bot reply right now.');
    } finally {
      setSendingBotReply(false);
    }
  }

  async function handleSimulateInboundMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedConversation) {
      setMessagesError('Select a conversation first.');
      return;
    }

    const customerPhone = selectedConversation.customerPhoneNumber.trim();
    if (!customerPhone) {
      setMessagesError('This conversation does not have a customer phone number yet.');
      return;
    }

    const trimmedDraft = simulatedInboundDraft.trim();
    if (!trimmedDraft) {
      setMessagesError('Write a simulated customer message first.');
      return;
    }

    setSimulatingInboundMessage(true);
    setMessagesError(null);

    const optimisticMessageId = `simulated-${Date.now()}`;
    const optimisticSentAtUtc = new Date().toISOString();
    const optimisticInboundMessage: SmsMessageSummary = {
      smsMessageId: optimisticMessageId,
      conversationId: selectedConversation.conversationId,
      customerId: selectedConversation.customerId,
      direction: 'inbound',
      messageBody: trimmedDraft,
      deliveryStatus: 'received',
      sentAtUtc: optimisticSentAtUtc,
      createdAtUtc: optimisticSentAtUtc,
    };

    setMessages((current) => [...current, optimisticInboundMessage]);
    setConversations((current) =>
      current.map((conversation) =>
        conversation.conversationId === selectedConversation.conversationId
          ? {
              ...conversation,
              lastMessageAtUtc: optimisticSentAtUtc,
              unreadCount: 1,
              updatedAtUtc: optimisticSentAtUtc,
            }
          : conversation,
      ),
    );
    setMetrics((current) =>
      current
        ? {
            ...current,
            messages: current.messages + 1,
          }
        : current,
    );
    setSimulatedInboundDraft('');
    setTakeoverNotice(`Simulated inbound SMS received from ${selectedConversation.customerName}.`);

    try {
      const formBody = new URLSearchParams();
      formBody.set('From', customerPhone);
      formBody.set('Body', trimmedDraft);
      formBody.set('To', 'SIMULATED');

      const webhookResponse = await fetch('/api/twilio/sms', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formBody.toString(),
      });

      if (!webhookResponse.ok) {
        throw new Error('Unable to simulate inbound SMS right now.');
      }

      const [messagesResponse, conversationsResponse, appointmentsResponse] = await Promise.all([
        fetch('/api/smsmessages', { credentials: 'include' }),
        fetch('/api/smsconversations', { credentials: 'include' }),
        fetch('/api/appointments', { credentials: 'include' }),
      ]);

      if (!messagesResponse.ok || !conversationsResponse.ok || !appointmentsResponse.ok) {
        throw new Error('Inbound message was simulated, but reloading message data failed.');
      }

      const [messageRows, conversationRows, appointmentRows] = (await Promise.all([
        messagesResponse.json(),
        conversationsResponse.json(),
        appointmentsResponse.json(),
      ])) as [SmsMessageSummary[], SmsConversationSummary[], AppointmentSummary[]];

      setMessages(messageRows);
      setConversations(conversationRows);
      setAppointments(appointmentRows);
      setMetrics((current) =>
        current
          ? {
              ...current,
              conversations: conversationRows.length,
              messages: messageRows.length,
              appointments: appointmentRows.length,
            }
          : current,
      );
    } catch (simulateError) {
      setMessages((current) => current.filter((message) => message.smsMessageId !== optimisticMessageId));
      setConversations((current) =>
        current.map((conversation) =>
          conversation.conversationId === selectedConversation.conversationId
            ? {
                ...conversation,
                unreadCount: Math.max(0, conversation.unreadCount - 1),
              }
            : conversation,
        ),
      );
      setMetrics((current) =>
        current
          ? {
              ...current,
              messages: Math.max(0, current.messages - 1),
            }
          : current,
      );
      setMessagesError(simulateError instanceof Error ? simulateError.message : 'Unable to simulate inbound SMS right now.');
    } finally {
      setSimulatingInboundMessage(false);
    }
  }

  async function handleBusinessHoursSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingBusinessHours(true);
    setMetricsError(null);
    setBusinessHoursMessage(null);

    try {
      const response = await fetch('/api/businesshours', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeZoneId: businessHours.timeZoneId,
          days: businessHours.days,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message ?? 'Unable to save business hours right now.');
      }

      setBusinessHoursMessage('Business hours saved.');
    } catch (saveError) {
      setMetricsError(saveError instanceof Error ? saveError.message : 'Unable to save business hours.');
    } finally {
      setSavingBusinessHours(false);
    }
  }

  if (!props.session) {
    return (
      <section className="dashboard-section">
        <div className="dashboard-empty">
          <span className="eyebrow">Dashboard locked</span>
          <h2>Sign in to view your business dashboard.</h2>
          <p>Once you authenticate, your customer and scheduling data will appear here.</p>
        </div>
      </section>
    );
  }

  const upcomingAppointments = appointments
    .filter((appointment) => new Date(appointment.scheduledAtUtc).getTime() >= Date.now())
    .sort((a, b) => new Date(a.scheduledAtUtc).getTime() - new Date(b.scheduledAtUtc).getTime());
  const pastAppointments = appointments
    .filter((appointment) => new Date(appointment.scheduledAtUtc).getTime() < Date.now())
    .sort((a, b) => new Date(b.scheduledAtUtc).getTime() - new Date(a.scheduledAtUtc).getTime());
  const selectedAppointment = appointments.find((appointment) => appointment.appointmentId === selectedAppointmentId) ?? null;

  return (
    <section className="dashboard-section">
      <div className="dashboard-tabs dashboard-tabs-top">
        <button
          type="button"
          className={dashboardTab === 'overview' ? 'dashboard-tab active' : 'dashboard-tab'}
          onClick={() => setDashboardTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          className={dashboardTab === 'calendar' ? 'dashboard-tab active' : 'dashboard-tab'}
          onClick={() => setDashboardTab('calendar')}
        >
          Calendar
        </button>
        <button
          type="button"
          className={dashboardTab === 'messages' ? 'dashboard-tab active' : 'dashboard-tab'}
          onClick={() => setDashboardTab('messages')}
        >
          Messages
        </button>
        <button
          type="button"
          className={dashboardTab === 'hours' ? 'dashboard-tab active' : 'dashboard-tab'}
          onClick={() => setDashboardTab('hours')}
        >
          Hours
        </button>
      </div>

      {metricsError ? <p className="auth-error">{metricsError}</p> : null}
      {messagesError ? <p className="auth-error">{messagesError}</p> : null}

      {dashboardTab === 'overview' ? (
        <div className="dashboard-tab-panel">
          <div className="dashboard-section-heading">
            <span className="eyebrow">Business overview</span>
            <h2>Quick stats for today.</h2>
          </div>

          <div className="dashboard-metrics">
            <MetricCard label="Your customers" value={loadingMetrics ? '...' : String(metrics?.customers ?? 0)} />
            <MetricCard label="Appointments" value={loadingMetrics ? '...' : String(metrics?.appointments ?? 0)} />
            <MetricCard label="SMS conversations" value={loadingMetrics ? '...' : String(metrics?.conversations ?? 0)} />
            <MetricCard label="SMS messages" value={loadingMetrics ? '...' : String(metrics?.messages ?? 0)} />
          </div>

          <div className="dashboard-grid">
            <article className="dashboard-card">
              <span className="eyebrow">Today</span>
              <h3>Keep confirmations moving.</h3>
              <p>Use reminders, follow-ups, and quick replies to protect your schedule from no-shows.</p>
            </article>

            <article className="dashboard-card">
              <span className="eyebrow">Next step</span>
              <h3>Open the messages tab.</h3>
              <p>Take over a customer thread, reply by SMS, and keep every conversation in one place.</p>
            </article>

            <article className="dashboard-card dashboard-profile-card">
              <div className="dashboard-profile-header">
                <div>
                  <span className="eyebrow">Business profile</span>
                  <h3>Tell the bot about your business.</h3>
                </div>
                <p className="dashboard-profile-note">
                  Share your services, tone, policies, and any details the AI should use when it replies to customers.
                </p>
              </div>

              <form className="dashboard-profile-form" onSubmit={handleSaveBusinessDescription}>
                <label className="field">
                  <span>Business description</span>
                  <textarea
                    value={businessDescriptionDraft}
                    onChange={(event) => setBusinessDescriptionDraft(event.target.value)}
                    placeholder="Example: We are a family-owned salon that offers haircuts, color, and beard trims. Keep replies warm and concise. Appointments are usually 30 to 60 minutes and we do not book after 4 PM on Fridays."
                    rows={6}
                  />
                </label>

                <label className="field compact">
                  <span>Bot name</span>
                  <input
                    type="text"
                    value={botNameDraft}
                    onChange={(event) => setBotNameDraft(event.target.value)}
                    placeholder="Example: Zephyr"
                    maxLength={100}
                  />
                </label>

                {businessDescriptionMessage ? <p className="business-profile-success">{businessDescriptionMessage}</p> : null}
                {businessDescriptionError ? <p className="auth-error">{businessDescriptionError}</p> : null}

                <div className="dashboard-profile-actions">
                  <p className="dashboard-profile-note">
                    This will become context for future bot replies and scheduling conversations.
                  </p>
                  <button className="primary-btn" type="submit" disabled={savingBusinessDescription}>
                    {savingBusinessDescription ? 'Saving...' : 'Save profile'}
                  </button>
                </div>
              </form>
            </article>
          </div>
        </div>
      ) : dashboardTab === 'calendar' ? (
        <CalendarTab
          loading={loadingMetrics}
          calendarView={calendarView}
          setCalendarView={setCalendarView}
          upcomingAppointments={upcomingAppointments}
          pastAppointments={pastAppointments}
          appointments={appointments}
          selectedAppointment={selectedAppointment}
          onSelectAppointment={setSelectedAppointmentId}
        />
      ) : dashboardTab === 'messages' ? (
        <MessagesTab
          loading={loadingMetrics}
          conversations={conversationThreads}
          isNewConversationComposerOpen={isNewConversationComposerOpen}
          selectedConversation={selectedConversation}
          selectedConversationId={selectedConversationId}
          isConversationTakenOver={isConversationTakenOver}
          isEditingCustomerProfile={isEditingCustomerProfile}
          takeoverNotice={takeoverNotice}
          customerProfileMessage={customerProfileMessage}
          replyDraft={messageDraft}
          setReplyDraft={setMessageDraft}
          simulatedInboundDraft={simulatedInboundDraft}
          setSimulatedInboundDraft={setSimulatedInboundDraft}
          newCustomerForm={newCustomerForm}
          setNewCustomerForm={setNewCustomerForm}
          newConversationDraft={newConversationDraft}
          setNewConversationDraft={setNewConversationDraft}
          sendingNewConversation={sendingNewConversation}
          sendingReply={sendingReply}
          savingCustomerProfile={savingCustomerProfile}
          customerProfileDraft={customerProfileDraft}
          setCustomerProfileDraft={setCustomerProfileDraft}
          onSelectConversation={handleConversationSelection}
          onOpenNewConversationComposer={handleOpenNewConversationComposer}
          onCloseNewConversationComposer={handleCloseNewConversationComposer}
          onOpenCustomerProfileEditor={handleOpenCustomerProfileEditor}
          onCloseCustomerProfileEditor={handleCloseCustomerProfileEditor}
          onStartConversation={handleStartConversation}
          onSaveCustomerProfile={handleSaveCustomerProfile}
          onTakeoverConversation={handleTakeoverConversation}
          onGenerateBotReply={handleGenerateBotReply}
          onSendReply={handleSendReply}
          onSimulateInboundMessage={handleSimulateInboundMessage}
          sendingBotReply={sendingBotReply}
          simulatingInboundMessage={simulatingInboundMessage}
        />
      ) : (
        <BusinessHoursTab
          loading={loadingMetrics}
          saving={savingBusinessHours}
          message={businessHoursMessage}
          schedule={businessHours}
          setSchedule={setBusinessHours}
          onSubmit={handleBusinessHoursSubmit}
        />
      )}
    </section>
  );
}
