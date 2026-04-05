import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import './App.css';
import { LandingPage } from './components/landing/LandingPage';
import { DashboardPage } from './components/dashboard/DashboardPage';

type AuthMode = 'signin' | 'signup';

type AuthSession = {
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

type DashboardMetrics = {
  customers: number;
  appointments: number;
  conversations: number;
  messages: number;
};

type DashboardTab = 'overview' | 'calendar' | 'messages' | 'hours';

type CalendarView = 'month' | 'week';

type BusinessHoursDay = {
  dayOfWeek: number;
  dayLabel: string;
  isOpen: boolean;
  opensAtLocal: string | null;
  closesAtLocal: string | null;
};

type BusinessHoursSchedule = {
  timeZoneId: string;
  days: BusinessHoursDay[];
};

type AppointmentSummary = {
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

type CustomerSummary = {
  customerId: string;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  notes: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
};

type CustomerProfileDraft = {
  fullName: string;
  phoneNumber: string;
  email: string;
  notes: string;
};

type SmsConversationSummary = {
  conversationId: string;
  customerId: string;
  lastMessageAtUtc: string | null;
  unreadCount: number;
  createdAtUtc: string;
  updatedAtUtc: string;
};

type SmsMessageSummary = {
  smsMessageId: string;
  conversationId: string;
  customerId: string;
  direction: string;
  messageBody: string;
  deliveryStatus: string;
  sentAtUtc: string;
  createdAtUtc: string;
};

type ConversationThread = SmsConversationSummary & {
  customer: CustomerSummary | null;
  customerName: string;
  customerPhoneNumber: string;
  threadMessages: SmsMessageSummary[];
  latestMessage: SmsMessageSummary | null;
};

const businessDayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const commonTimeZones = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'UTC',
];
const browserTimeZoneId = getBrowserTimeZoneId();

function createDefaultBusinessHoursSchedule(): BusinessHoursSchedule {
  return {
    timeZoneId: browserTimeZoneId,
    days: businessDayLabels.map((dayLabel, dayOfWeek) => ({
      dayOfWeek,
      dayLabel,
      isOpen: dayOfWeek >= 1 && dayOfWeek <= 5,
      opensAtLocal: dayOfWeek >= 1 && dayOfWeek <= 5 ? '09:00' : null,
      closesAtLocal: dayOfWeek >= 1 && dayOfWeek <= 5 ? '17:00' : null,
    })),
  };
}

function getBrowserTimeZoneId() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('overview');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    void fetchSession();
  }, []);

  const navigate = (nextPath: string) => {
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }

    setPathname(nextPath);
  };

  async function fetchSession() {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = (await response.json()) as AuthSession;
        setSession(data);
      }
    } finally {
      setLoadingSession(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const endpoint = authMode === 'signin' ? '/api/auth/signin' : '/api/auth/signup';
      const payload =
        authMode === 'signin'
          ? { email: form.email, password: form.password }
          : { email: form.email, password: form.password, displayName: form.displayName, timeZoneId: browserTimeZoneId };

      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message ?? 'Unable to complete authentication.');
      }

      const data = (await response.json()) as AuthSession;
      setSession(data);
      setForm({ displayName: '', email: '', password: '' });
      navigate('/dashboard');
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Unable to sign out right now.');
      }

      setSession(null);
      setAuthMode('signin');
      navigate('/');
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  const routeIsDashboard = pathname.startsWith('/dashboard');

  if (routeIsDashboard) {
    return (
      <DashboardPage
        session={session}
        submitting={submitting}
        onSignOut={handleSignOut}
        onNavigateHome={() => navigate('/')}
        setSession={setSession}
        dashboardTab={dashboardTab}
        setDashboardTab={setDashboardTab}
      >
        <DashboardWorkspace session={session} setSession={setSession} dashboardTab={dashboardTab} />
      </DashboardPage>
    );
  }

  return (
    <LandingPage
      session={session}
      loadingSession={loadingSession}
      submitting={submitting}
      error={error}
      authMode={authMode}
      form={form}
      setForm={setForm}
      setAuthMode={setAuthMode}
      onSubmit={handleSubmit}
      onSignOut={handleSignOut}
      onNavigateDashboard={() => navigate('/dashboard')}
    />
  );
}

type DashboardWorkspaceProps = {
  session: AuthSession | null;
  setSession: Dispatch<SetStateAction<AuthSession | null>>;
  dashboardTab: DashboardTab;
};

function DashboardWorkspace(props: DashboardWorkspaceProps) {
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
        ])) as [
          CustomerSummary[],
          AppointmentSummary[],
          SmsConversationSummary[],
          SmsMessageSummary[],
          BusinessHoursSchedule,
        ];

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
        current.map((customer) =>
          customer.customerId === updatedCustomer.customerId ? updatedCustomer : customer,
        ),
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
  const selectedAppointment =
    appointments.find((appointment) => appointment.appointmentId === selectedAppointmentId) ?? null;

  return (
    <section className="dashboard-section">
      {metricsError ? <p className="auth-error">{metricsError}</p> : null}
      {messagesError ? <p className="auth-error">{messagesError}</p> : null}

      {props.dashboardTab === 'overview' ? (
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
      ) : props.dashboardTab === 'calendar' ? (
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
      ) : props.dashboardTab === 'messages' ? (
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
          onSendReply={handleSendReply}
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

type CalendarTabProps = {
  loading: boolean;
  calendarView: CalendarView;
  setCalendarView: Dispatch<SetStateAction<CalendarView>>;
  appointments: AppointmentSummary[];
  upcomingAppointments: AppointmentSummary[];
  pastAppointments: AppointmentSummary[];
  selectedAppointment: AppointmentSummary | null;
  onSelectAppointment: (appointmentId: string) => void;
};

function CalendarTab(props: CalendarTabProps) {
  const now = useMemo(() => new Date(), []);
  const displayedMonthStart = useMemo(() => startOfMonth(now), [now]);
  const displayedWeekStart = useMemo(() => startOfWeek(now), [now]);
  const selectedAppointment = props.selectedAppointment;

  return (
    <div className="calendar-panel dashboard-tab-panel">
      <div className="dashboard-section-heading">
        <span className="eyebrow">Calendar</span>
        <h2>Future and past appointments for your business.</h2>
      </div>

      <div className="dashboard-tabs calendar-view-tabs">
        <button
          type="button"
          className={props.calendarView === 'month' ? 'dashboard-tab active' : 'dashboard-tab'}
          onClick={() => props.setCalendarView('month')}
        >
          Month
        </button>
        <button
          type="button"
          className={props.calendarView === 'week' ? 'dashboard-tab active' : 'dashboard-tab'}
          onClick={() => props.setCalendarView('week')}
        >
          Week
        </button>
      </div>

      <div className="calendar-summary">
        <MetricCard label="Upcoming" value={props.loading ? '...' : String(props.upcomingAppointments.length)} />
        <MetricCard label="Past" value={props.loading ? '...' : String(props.pastAppointments.length)} />
      </div>

      <div className="calendar-workspace">
        <div className="calendar-grid-shell">
          {props.calendarView === 'month' ? (
            <MonthGrid
              appointments={props.appointments}
              selectedAppointmentId={selectedAppointment?.appointmentId ?? null}
              onSelectAppointment={props.onSelectAppointment}
              monthStart={displayedMonthStart}
            />
          ) : (
            <WeekGrid
              appointments={props.appointments}
              selectedAppointmentId={selectedAppointment?.appointmentId ?? null}
              onSelectAppointment={props.onSelectAppointment}
              weekStart={displayedWeekStart}
            />
          )}
        </div>

        <aside className="appointment-details">
          {selectedAppointment ? (
            <AppointmentDetails appointment={selectedAppointment} />
          ) : (
            <div className="dashboard-empty">
              <span className="eyebrow">Appointment details</span>
              <h2>Select an appointment.</h2>
              <p>Click any item in the calendar grid to see the full appointment details here.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

type BusinessHoursTabProps = {
  loading: boolean;
  saving: boolean;
  message: string | null;
  schedule: BusinessHoursSchedule;
  setSchedule: Dispatch<SetStateAction<BusinessHoursSchedule>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function BusinessHoursTab(props: BusinessHoursTabProps) {
  return (
    <div className="dashboard-tab-panel">
      <div className="dashboard-section-heading">
        <span className="eyebrow">Business hours</span>
        <h2>Set daily hours in your business time zone.</h2>
      </div>

      <div className="dashboard-grid hours-grid">
        <article className="dashboard-card hours-card">
          <div className="hours-card-header">
            <div>
              <span className="eyebrow">Weekly schedule</span>
              <h3>Open and close the booking window by day.</h3>
            </div>
            <p className="hours-note">
              Times are stored in your selected business time zone and converted before appointments are validated.
            </p>
          </div>

          <form className="hours-form" onSubmit={props.onSubmit}>
            <div className="hours-toolbar">
              <label className="field compact hours-timezone-field">
                <span>Business time zone</span>
                <select
                  value={props.schedule.timeZoneId}
                  onChange={(event) =>
                    props.setSchedule((current) => ({
                      ...current,
                      timeZoneId: event.target.value,
                    }))
                  }
                  disabled={props.loading || props.saving}
                  required
                >
                  {[props.schedule.timeZoneId, ...commonTimeZones.filter((timeZone) => timeZone !== props.schedule.timeZoneId)].map(
                    (timeZone) => (
                      <option key={timeZone} value={timeZone}>
                        {timeZone}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <button
                type="button"
                className="secondary-btn hours-use-local"
                onClick={() =>
                  props.setSchedule((current) => ({
                    ...current,
                    timeZoneId: browserTimeZoneId,
                  }))
                }
                disabled={props.loading || props.saving}
              >
                Use my current zone
              </button>
            </div>

            <p className="hours-note hours-note-inline">
              You can change this anytime if your business runs in a different zone.
            </p>

            <div className="hours-list">
              {props.schedule.days.map((day) => (
                <div className="hours-row" key={day.dayOfWeek}>
                  <label className="hours-day">
                    <input
                      type="checkbox"
                      checked={day.isOpen}
                      onChange={() =>
                        props.setSchedule((current) => ({
                          ...current,
                          days: current.days.map((item) =>
                            item.dayOfWeek === day.dayOfWeek
                              ? {
                                  ...item,
                                  isOpen: !item.isOpen,
                                  opensAtLocal: !item.isOpen ? item.opensAtLocal ?? '09:00' : item.opensAtLocal,
                                  closesAtLocal: !item.isOpen ? item.closesAtLocal ?? '17:00' : item.closesAtLocal,
                                }
                              : item,
                          ),
                        }))
                      }
                      disabled={props.loading || props.saving}
                    />
                    <span>{day.dayLabel}</span>
                  </label>

                  <div className="hours-times">
                    <label className="field compact">
                      <span>Open</span>
                      <input
                        type="time"
                        value={day.opensAtLocal ?? ''}
                        onChange={(event) =>
                          props.setSchedule((current) => ({
                            ...current,
                            days: current.days.map((item) =>
                              item.dayOfWeek === day.dayOfWeek ? { ...item, opensAtLocal: event.target.value } : item,
                            ),
                          }))
                        }
                        disabled={!day.isOpen || props.loading || props.saving}
                        required={day.isOpen}
                      />
                    </label>

                    <label className="field compact">
                      <span>Close</span>
                      <input
                        type="time"
                        value={day.closesAtLocal ?? ''}
                        onChange={(event) =>
                          props.setSchedule((current) => ({
                            ...current,
                            days: current.days.map((item) =>
                              item.dayOfWeek === day.dayOfWeek ? { ...item, closesAtLocal: event.target.value } : item,
                            ),
                          }))
                        }
                        disabled={!day.isOpen || props.loading || props.saving}
                        required={day.isOpen}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {props.message ? <p className="hours-success">{props.message}</p> : null}

            <button className="primary-btn hours-save" type="submit" disabled={props.loading || props.saving}>
              {props.saving ? 'Saving...' : 'Save daily hours'}
            </button>
          </form>
        </article>

        <article className="dashboard-card hours-guide">
          <span className="eyebrow">How it works</span>
          <h3>Appointments outside these windows are blocked.</h3>
          <p>
            Owners can keep each day open or closed with different start and end times, and the appointment API checks
            the saved schedule before a booking is created or updated.
          </p>
          <p>
            If you leave a day closed, no appointments can be scheduled for that day. If no saved schedule exists yet,
            ZephyrBook keeps appointments flexible until you save one.
          </p>
        </article>
      </div>
    </div>
  );
}

type MessagesTabProps = {
  loading: boolean;
  conversations: ConversationThread[];
  isNewConversationComposerOpen: boolean;
  selectedConversation: ConversationThread | null;
  selectedConversationId: string | null;
  isConversationTakenOver: boolean;
  isEditingCustomerProfile: boolean;
  takeoverNotice: string | null;
  customerProfileMessage: string | null;
  replyDraft: string;
  setReplyDraft: Dispatch<SetStateAction<string>>;
  newCustomerForm: {
    fullName: string;
    phoneNumber: string;
    email: string;
    notes: string;
  };
  setNewCustomerForm: Dispatch<
    SetStateAction<{
      fullName: string;
      phoneNumber: string;
      email: string;
      notes: string;
    }>
  >;
  newConversationDraft: string;
  setNewConversationDraft: Dispatch<SetStateAction<string>>;
  sendingNewConversation: boolean;
  sendingReply: boolean;
  savingCustomerProfile: boolean;
  customerProfileDraft: CustomerProfileDraft;
  setCustomerProfileDraft: Dispatch<SetStateAction<CustomerProfileDraft>>;
  onSelectConversation: (conversationId: string) => void;
  onOpenNewConversationComposer: () => void;
  onCloseNewConversationComposer: () => void;
  onOpenCustomerProfileEditor: () => void;
  onCloseCustomerProfileEditor: () => void;
  onStartConversation: (event: FormEvent<HTMLFormElement>) => void;
  onSaveCustomerProfile: (event: FormEvent<HTMLFormElement>) => void;
  onTakeoverConversation: () => void;
  onSendReply: (event: FormEvent<HTMLFormElement>) => void;
};

function MessagesTab(props: MessagesTabProps) {
  const selectedThread = props.selectedConversation;

  return (
    <div className="messages-panel dashboard-tab-panel">
      <div className="dashboard-section-heading">
        <span className="eyebrow">Messages</span>
        <h2>Take over customer threads and reply through SMS.</h2>
      </div>

      <div className="dashboard-metrics messages-summary">
        <MetricCard label="Conversations" value={props.loading ? '...' : String(props.conversations.length)} />
        <MetricCard
          label="Needs reply"
          value={
            props.loading
              ? '...'
              : String(props.conversations.filter((conversation) => conversation.unreadCount > 0).length)
          }
        />
      </div>

      <div className="messages-workspace">
        <aside className="messages-sidebar dashboard-card">
          <div className="messages-sidebar-header">
            <div>
              <span className="eyebrow">Inbox</span>
              <h3>Customer conversations</h3>
            </div>
            <button
              type="button"
              className="secondary-btn messages-new-button"
              onClick={props.onOpenNewConversationComposer}
            >
              New conversation
            </button>
          </div>

          {props.isNewConversationComposerOpen ? (
            <form className="messages-new-thread" onSubmit={props.onStartConversation}>
              <div className="messages-new-thread-header">
                <div>
                  <span className="eyebrow">Start new</span>
                  <h4>Add a customer and send the first message.</h4>
                </div>
                <button type="button" className="messages-new-thread-close" onClick={props.onCloseNewConversationComposer}>
                  Close
                </button>
              </div>

              <label className="field compact">
                <span>Customer name</span>
                <input
                  type="text"
                  value={props.newCustomerForm.fullName}
                  onChange={(event) =>
                    props.setNewCustomerForm((current) => ({
                      ...current,
                      fullName: event.target.value,
                    }))
                  }
                  placeholder="Full name"
                  autoComplete="name"
                  required
                />
              </label>

              <label className="field compact">
                <span>Phone number</span>
                <input
                  type="tel"
                  value={props.newCustomerForm.phoneNumber}
                  onChange={(event) =>
                    props.setNewCustomerForm((current) => ({
                      ...current,
                      phoneNumber: event.target.value,
                    }))
                  }
                  placeholder="+1 555 123 4567"
                  autoComplete="tel"
                  required
                />
              </label>

              <label className="field compact">
                <span>Email</span>
                <input
                  type="email"
                  value={props.newCustomerForm.email}
                  onChange={(event) =>
                    props.setNewCustomerForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="customer@example.com"
                  autoComplete="email"
                />
              </label>

              <label className="field compact">
                <span>Notes</span>
                <textarea
                  value={props.newCustomerForm.notes}
                  onChange={(event) =>
                    props.setNewCustomerForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Optional details for the customer record"
                  rows={3}
                />
              </label>

              <label className="field compact">
                <span>First message</span>
                <textarea
                  value={props.newConversationDraft}
                  onChange={(event) => props.setNewConversationDraft(event.target.value)}
                  placeholder="Write the first SMS to start the thread..."
                  rows={4}
                  required
                />
              </label>

              <button className="primary-btn" type="submit" disabled={props.sendingNewConversation}>
                {props.sendingNewConversation ? 'Starting...' : 'Create customer and message'}
              </button>
            </form>
          ) : null}

          {props.conversations.length > 0 ? (
            <div className="messages-list">
              {props.conversations.map((conversation) => {
                const isSelected = conversation.conversationId === props.selectedConversationId;
                const previewMessage = conversation.latestMessage?.messageBody ?? 'No messages yet.';

                return (
                  <button
                    type="button"
                    key={conversation.conversationId}
                    className={isSelected ? 'message-thread-item active' : 'message-thread-item'}
                    onClick={() => props.onSelectConversation(conversation.conversationId)}
                  >
                    <div className="message-thread-item-top">
                      <strong>{conversation.customerName}</strong>
                      <span>{formatConversationTimestamp(conversation.lastMessageAtUtc ?? conversation.updatedAtUtc)}</span>
                    </div>
                    <p>{previewMessage}</p>
                    <div className="message-thread-item-meta">
                      <span>{conversation.customerPhoneNumber || 'No phone number'}</span>
                      {conversation.unreadCount > 0 ? <strong>{conversation.unreadCount} new</strong> : <span>Ready</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="dashboard-empty messages-empty">
              <span className="eyebrow">No threads yet</span>
              <h2>When customers text in, their conversations will appear here.</h2>
              <p>Use this inbox to step in, answer directly, and keep the bot from replying when you want control.</p>
            </div>
          )}
        </aside>

        <article className="messages-thread dashboard-card">
          {selectedThread ? (
            <>
              <div className="messages-thread-header">
                <div>
                  <span className="eyebrow">Active thread</span>
                  <h3>{selectedThread.customerName}</h3>
                  <p>{selectedThread.customerPhoneNumber || 'No phone number on file'}</p>
                </div>

                <div className="messages-thread-actions">
                  <span className={props.isConversationTakenOver ? 'status-pill active' : 'status-pill'}>
                    {props.isConversationTakenOver ? 'Owner takeover active' : 'Bot handling replies'}
                  </span>
                  <div className="messages-thread-actions-row">
                    <button type="button" className="secondary-btn" onClick={props.onOpenCustomerProfileEditor}>
                      Edit customer
                    </button>
                    <button type="button" className="secondary-btn" onClick={props.onTakeoverConversation}>
                      Take over
                    </button>
                  </div>
                </div>
              </div>

              {props.takeoverNotice ? <p className="messages-banner">{props.takeoverNotice}</p> : null}
              {props.customerProfileMessage ? <p className="messages-banner soft">{props.customerProfileMessage}</p> : null}
              {props.isEditingCustomerProfile ? (
                <form className="messages-profile-form" onSubmit={props.onSaveCustomerProfile}>
                  <div className="messages-new-thread-header">
                    <div>
                      <span className="eyebrow">Customer profile</span>
                      <h4>Edit contact details and notes.</h4>
                    </div>
                    <button type="button" className="messages-new-thread-close" onClick={props.onCloseCustomerProfileEditor}>
                      Close
                    </button>
                  </div>

                  <label className="field compact">
                    <span>Customer name</span>
                    <input
                      type="text"
                      value={props.customerProfileDraft.fullName}
                      onChange={(event) =>
                        props.setCustomerProfileDraft((current) => ({
                          ...current,
                          fullName: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>

                  <label className="field compact">
                    <span>Phone number</span>
                    <input
                      type="tel"
                      value={props.customerProfileDraft.phoneNumber}
                      onChange={(event) =>
                        props.setCustomerProfileDraft((current) => ({
                          ...current,
                          phoneNumber: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>

                  <label className="field compact">
                    <span>Email</span>
                    <input
                      type="email"
                      value={props.customerProfileDraft.email}
                      onChange={(event) =>
                        props.setCustomerProfileDraft((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="field compact">
                    <span>Notes</span>
                    <textarea
                      value={props.customerProfileDraft.notes}
                      onChange={(event) =>
                        props.setCustomerProfileDraft((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      rows={3}
                    />
                  </label>

                  <div className="messages-composer-actions">
                    <p className="messages-composer-note">Changes update the shared customer record for this thread.</p>
                    <button className="primary-btn" type="submit" disabled={props.savingCustomerProfile}>
                      {props.savingCustomerProfile ? 'Saving...' : 'Save profile'}
                    </button>
                  </div>
                </form>
              ) : null}
              {!props.isConversationTakenOver ? (
                <p className="messages-banner soft">
                  Take over this thread before sending a reply so the owner, not the bot, answers the customer.
                </p>
              ) : null}

              <div className="messages-thread-body">
                {selectedThread.threadMessages.length > 0 ? (
                  selectedThread.threadMessages.map((message) => (
                    <article
                      key={message.smsMessageId}
                      className={message.direction === 'outbound' ? 'message message-out' : 'message message-in'}
                    >
                      <p>{message.messageBody}</p>
                      <span>
                        {formatConversationTimestamp(message.sentAtUtc)} · {message.deliveryStatus}
                      </span>
                    </article>
                  ))
                ) : (
                  <div className="dashboard-empty message-thread-empty">
                    <span className="eyebrow">Empty thread</span>
                    <h2>No SMS history yet.</h2>
                    <p>Take over this conversation and send the first message when you are ready.</p>
                  </div>
                )}
              </div>

              <form className="messages-composer" onSubmit={props.onSendReply}>
                <label className="field">
                  <span>Reply from the owner inbox</span>
                  <textarea
                    value={props.replyDraft}
                    onChange={(event) => props.setReplyDraft(event.target.value)}
                    placeholder={
                      props.isConversationTakenOver
                        ? 'Write the reply you want Twilio to send...'
                        : 'Take over this thread to unlock the reply box.'
                    }
                    rows={4}
                    disabled={!props.isConversationTakenOver || props.sendingReply}
                  />
                </label>

                <div className="messages-composer-actions">
                  <p className="messages-composer-note">
                    {props.isConversationTakenOver
                      ? 'Replies will be sent through Twilio and stored in this thread.'
                      : 'The compose box stays locked until you take the thread over.'}
                  </p>
                  <button className="primary-btn" type="submit" disabled={!props.isConversationTakenOver || props.sendingReply}>
                    {props.sendingReply ? 'Sending...' : 'Send reply'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="dashboard-empty messages-empty">
              <span className="eyebrow">No thread selected</span>
              <h2>Pick a conversation from the inbox.</h2>
              <p>Select a customer on the left to review the thread and take over replies when needed.</p>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}

type GridProps = {
  appointments: AppointmentSummary[];
  selectedAppointmentId: string | null;
  onSelectAppointment: (appointmentId: string) => void;
  monthStart?: Date;
  weekStart?: Date;
};

function MonthGrid(props: GridProps) {
  const monthStart = props.monthStart ?? startOfMonth(new Date());
  const firstCell = startOfWeek(monthStart);
  const days = Array.from({ length: 42 }, (_, index) => addDays(firstCell, index));
  const monthLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(monthStart);

  return (
    <section className="calendar-grid">
      <div className="calendar-grid-header">
        <h3>{monthLabel}</h3>
        <div className="calendar-weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
      </div>

      <div className="month-grid">
        {days.map((day) => {
          const dayAppointments = appointmentsForDay(props.appointments, day);
          const isCurrentMonth = day.getMonth() === monthStart.getMonth();

          return (
            <div key={day.toDateString()} className={isCurrentMonth ? 'calendar-day' : 'calendar-day muted'}>
              <div className="calendar-day-header">
                <span>{day.getDate()}</span>
                <strong>{dayAppointments.length}</strong>
              </div>
              <div className="calendar-day-items">
                {dayAppointments.slice(0, 3).map((appointment) => (
                  <button
                    key={appointment.appointmentId}
                    type="button"
                    className={
                      appointment.appointmentId === props.selectedAppointmentId
                        ? 'appointment-chip active'
                        : 'appointment-chip'
                    }
                    onClick={() => props.onSelectAppointment(appointment.appointmentId)}
                  >
                    <span className="chip-time">{formatAppointmentTime(appointment.scheduledAtUtc)}</span>
                    <span className="chip-name">{appointment.customerName}</span>
                  </button>
                ))}
                {dayAppointments.length > 3 ? <span className="calendar-more">+{dayAppointments.length - 3} more</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function WeekGrid(props: GridProps) {
  const weekStart = props.weekStart ?? startOfWeek(new Date());
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const weekLabel = `Week of ${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(weekStart)}`;

  return (
    <section className="calendar-grid">
      <div className="calendar-grid-header">
        <h3>{weekLabel}</h3>
        <div className="calendar-weekdays">
          {days.map((day) => (
            <span key={day.toDateString()}>
              {new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(day)}
            </span>
          ))}
        </div>
      </div>

      <div className="week-grid">
        {days.map((day) => {
          const dayAppointments = appointmentsForDay(props.appointments, day);

          return (
            <div key={day.toDateString()} className="calendar-day week">
              <div className="calendar-day-header">
                <span>{new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' }).format(day)}</span>
                <strong>{dayAppointments.length}</strong>
              </div>
              <div className="calendar-day-items">
                {dayAppointments.length === 0 ? (
                  <span className="calendar-empty-inline">No appointments</span>
                ) : (
                  dayAppointments.map((appointment) => (
                    <button
                      key={appointment.appointmentId}
                      type="button"
                      className={
                        appointment.appointmentId === props.selectedAppointmentId
                          ? 'appointment-chip active'
                          : 'appointment-chip'
                      }
                      onClick={() => props.onSelectAppointment(appointment.appointmentId)}
                    >
                      <span className="chip-time">{formatAppointmentTime(appointment.scheduledAtUtc)}</span>
                      <span className="chip-name">{appointment.customerName}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AppointmentDetails(props: { appointment: AppointmentSummary }) {
  const { appointment } = props;
  const scheduledDate = new Date(appointment.scheduledAtUtc);
  const createdDate = new Date(appointment.createdAtUtc);
  const updatedDate = new Date(appointment.updatedAtUtc);

  return (
    <section className="appointment-detail-card">
      <span className="eyebrow">Appointment details</span>
      <h3>{appointment.customerName}</h3>
      <p className="appointment-detail-service">{appointment.serviceName}</p>

      <div className="appointment-detail-grid">
        <div>
          <span>Status</span>
          <strong>{appointment.status}</strong>
        </div>
        <div>
          <span>Scheduled</span>
          <strong>{formatFullDateTime(scheduledDate)}</strong>
        </div>
        <div>
          <span>Duration</span>
          <strong>{appointment.durationMinutes} minutes</strong>
        </div>
        <div>
          <span>Created via</span>
          <strong>{appointment.createdVia}</strong>
        </div>
        <div>
          <span>Created</span>
          <strong>{formatFullDateTime(createdDate)}</strong>
        </div>
        <div>
          <span>Updated</span>
          <strong>{formatFullDateTime(updatedDate)}</strong>
        </div>
      </div>

      <div className="appointment-detail-id">
        <span>Appointment ID</span>
        <strong>{appointment.appointmentId}</strong>
      </div>

      {appointment.notes ? (
        <div className="appointment-detail-notes">
          <span>Notes</span>
          <p>{appointment.notes}</p>
        </div>
      ) : (
        <p className="calendar-empty-inline">No notes were added for this appointment.</p>
      )}
    </section>
  );
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day);
  return copy;
}

function addDays(date: Date, amount: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function appointmentsForDay(appointments: AppointmentSummary[], day: Date) {
  return appointments
    .filter((appointment) => isSameDay(new Date(appointment.scheduledAtUtc), day))
    .sort((a, b) => new Date(a.scheduledAtUtc).getTime() - new Date(b.scheduledAtUtc).getTime());
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatAppointmentTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatConversationTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatFullDateTime(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
}

type MetricCardProps = {
  label: string;
  value: string;
};

function MetricCard(props: MetricCardProps) {
  return (
    <article className="metric-card">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </article>
  );
}

export default App;
