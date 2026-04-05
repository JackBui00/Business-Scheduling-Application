import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import './App.css';

type AuthMode = 'signin' | 'signup';

type AuthSession = {
  userId: string;
  email: string;
  displayName: string;
  roleName: string;
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

type DashboardTab = 'overview' | 'calendar' | 'hours';

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

const highlights = [
  { value: '63%', label: 'fewer no-shows with automated reminders' },
  { value: '24/7', label: 'booking and follow-up coverage without extra staff' },
  { value: '1 inbox', label: 'to manage scheduling, replies, and confirmations' },
];

const features = [
  {
    title: 'Smart appointment reminders',
    description:
      'Automatically send text reminders before visits so clients confirm, reschedule, or cancel without back-and-forth calls.',
  },
  {
    title: 'Two-way SMS conversations',
    description:
      'Keep every reply in one place and turn simple text messages into scheduled conversations that move work forward.',
  },
  {
    title: 'Client-friendly follow-ups',
    description:
      'Send thank-yous, review requests, and rebooking nudges after each appointment to keep your calendar full.',
  },
];

const workflow = [
  'Connect your services, hours, and team availability.',
  'Let ZephyrBook confirm bookings and send reminders automatically.',
  'Reply to clients by text from a single streamlined inbox.',
  'Fill cancellations faster with instant follow-up messages.',
];

const testimonials = [
  {
    quote:
      'We stopped spending our day chasing confirmations. ZephyrBook keeps clients informed and our schedule tighter.',
    name: 'Maya R.',
    role: 'Salon owner',
  },
  {
    quote:
      'The text follow-ups feel personal, but they run on autopilot. It freed up hours every week for our team.',
    name: 'Jordan L.',
    role: 'Home services founder',
  },
];

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
        loadingSession={loadingSession}
        submitting={submitting}
        error={error}
        authMode={authMode}
        dashboardTab={dashboardTab}
        form={form}
        setForm={setForm}
        setAuthMode={setAuthMode}
        setDashboardTab={setDashboardTab}
        onSubmit={handleSubmit}
        onSignOut={handleSignOut}
        onNavigateHome={() => navigate('/')}
      />
    );
  }

  return (
    <LandingPage
      session={session}
      loadingSession={loadingSession}
      submitting={submitting}
      error={error}
      authMode={authMode}
      dashboardTab={dashboardTab}
      form={form}
      setForm={setForm}
      setAuthMode={setAuthMode}
      setDashboardTab={setDashboardTab}
      onSubmit={handleSubmit}
      onSignOut={handleSignOut}
      onNavigateDashboard={() => navigate('/dashboard')}
    />
  );
}

type SharedAuthProps = {
  session: AuthSession | null;
  loadingSession: boolean;
  submitting: boolean;
  error: string | null;
  authMode: AuthMode;
  dashboardTab: DashboardTab;
  form: {
    displayName: string;
    email: string;
    password: string;
  };
  setForm: Dispatch<
    SetStateAction<{
      displayName: string;
      email: string;
      password: string;
    }>
  >;
  setAuthMode: Dispatch<SetStateAction<AuthMode>>;
  setDashboardTab: Dispatch<SetStateAction<DashboardTab>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSignOut: () => Promise<void>;
};

type LandingPageProps = SharedAuthProps & {
  onNavigateDashboard: () => void;
};

type DashboardPageProps = SharedAuthProps & {
  onNavigateHome: () => void;
  dashboardTab: DashboardTab;
  setDashboardTab: Dispatch<SetStateAction<DashboardTab>>;
};

function LandingPage(props: LandingPageProps) {
  const heroActionLabel = useMemo(
    () => (props.session ? 'Continue to dashboard' : 'Start automating'),
    [props.session],
  );

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="topbar">
          <div className="brand">
            <span className="brand-mark">Z</span>
            <span className="brand-name">ZephyrBook</span>
          </div>
          <nav className="nav">
            <a href="#features">Features</a>
            <a href="#workflow">How it works</a>
            <a href="#auth">Sign in</a>
          </nav>
        </div>

        <div className="hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">Scheduling that keeps the conversation moving</span>
            <h1>Automate client communication with text-first scheduling.</h1>
            <p className="lede">
              ZephyrBook helps small business owners book appointments, send reminders,
              and handle follow-ups through SMS so every client feels remembered.
            </p>

            <div className="hero-actions">
              <a
                className="primary-btn"
                href={props.session ? '/dashboard' : '#auth'}
                onClick={(event) => {
                  if (props.session) {
                    event.preventDefault();
                    props.onNavigateDashboard();
                  }
                }}
              >
                {heroActionLabel}
              </a>
              <a className="secondary-btn" href="#features">
                See how it works
              </a>
            </div>

            <div className="highlight-row" aria-label="Key product benefits">
              {highlights.map((item) => (
                <article className="highlight" key={item.label}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </article>
              ))}
            </div>
          </div>

          <div className="auth-panel" id="auth">
            <AuthCard
              session={props.session}
              loadingSession={props.loadingSession}
              submitting={props.submitting}
              error={props.error}
              authMode={props.authMode}
              form={props.form}
              setForm={props.setForm}
              setAuthMode={props.setAuthMode}
              onSubmit={props.onSubmit}
              onSignOut={props.onSignOut}
              authTitle="Owner access"
              authDescription="Use the same account to manage bookings, reminders, and SMS follow-ups."
              signedInDescription="Your account is connected to the backend and stored in the database."
            />
          </div>
        </div>
      </section>

      <section className="section" id="features">
        <div className="section-heading">
          <span className="eyebrow">Built for busy owners</span>
          <h2>Everything you need to turn appointments into reliable conversations.</h2>
        </div>

        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature-card" key={feature.title}>
              <div className="feature-icon" />
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section split" id="workflow">
        <div className="section-heading tight">
          <span className="eyebrow">Simple setup</span>
          <h2>From first booking to final follow-up in four clean steps.</h2>
        </div>

        <div className="workflow-list">
          {workflow.map((step, index) => (
            <article className="workflow-step" key={step}>
              <span className="step-number">0{index + 1}</span>
              <p>{step}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section testimonials">
        <div className="section-heading">
          <span className="eyebrow">Loved by service businesses</span>
          <h2>Small teams use ZephyrBook to sound bigger without hiring more staff.</h2>
        </div>

        <div className="testimonial-grid">
          {testimonials.map((item) => (
            <article className="testimonial-card" key={item.name}>
              <p className="quote">"{item.quote}"</p>
              <div className="testimonial-meta">
                <strong>{item.name}</strong>
                <span>{item.role}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="cta" id="cta">
        <div>
          <span className="eyebrow">Ready to convert more leads?</span>
          <h2>Make every appointment easier to book, confirm, and follow up.</h2>
        </div>
        <a
          className="primary-btn dark"
          href={props.session ? '/dashboard' : '#auth'}
          onClick={(event) => {
            if (props.session) {
              event.preventDefault();
              props.onNavigateDashboard();
            }
          }}
        >
          Open your account
        </a>
      </section>
    </main>
  );
}

function DashboardPage(props: DashboardPageProps) {
  return (
    <main className="page-shell dashboard-shell">
      <header className="dashboard-topbar">
        <div className="brand">
          <span className="brand-mark">Z</span>
          <span className="brand-name">ZephyrBook</span>
        </div>
        <div className="dashboard-topbar-center">
          <div className="dashboard-tabs dashboard-tabs-top">
            <button
              type="button"
              className={props.dashboardTab === 'overview' ? 'dashboard-tab active' : 'dashboard-tab'}
              onClick={() => props.setDashboardTab('overview')}
            >
              Overview
            </button>
            <button
              type="button"
              className={props.dashboardTab === 'calendar' ? 'dashboard-tab active' : 'dashboard-tab'}
              onClick={() => props.setDashboardTab('calendar')}
            >
              Calendar
            </button>
            <button
              type="button"
              className={props.dashboardTab === 'hours' ? 'dashboard-tab active' : 'dashboard-tab'}
              onClick={() => props.setDashboardTab('hours')}
            >
              Hours
            </button>
          </div>
        </div>
        <div className="dashboard-topbar-actions">
          <a
            className="secondary-btn"
            href="/"
            onClick={(event) => {
              event.preventDefault();
              props.onNavigateHome();
            }}
          >
            Home
          </a>
          <button className="primary-btn" type="button" onClick={props.onSignOut} disabled={props.submitting}>
            {props.submitting ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </header>

      <DashboardWorkspace
        session={props.session}
        dashboardTab={props.dashboardTab}
        setDashboardTab={props.setDashboardTab}
      />
    </main>
  );
}

type AuthCardProps = {
  session: AuthSession | null;
  loadingSession: boolean;
  submitting: boolean;
  error: string | null;
  authMode: AuthMode;
  form: {
    displayName: string;
    email: string;
    password: string;
  };
  setForm: Dispatch<
    SetStateAction<{
      displayName: string;
      email: string;
      password: string;
    }>
  >;
  setAuthMode: Dispatch<SetStateAction<AuthMode>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSignOut: () => Promise<void>;
  authTitle: string;
  authDescription: string;
  signedInDescription: string;
};

function AuthCard(props: AuthCardProps) {
  if (props.loadingSession) {
    return (
      <section className="auth-card">
        <div className="auth-card-header">
          <span className="eyebrow">{props.authTitle}</span>
          <h2>Checking your session...</h2>
        </div>
        <p className="auth-muted">Please wait while we verify your secure sign in.</p>
      </section>
    );
  }

  if (props.session) {
    return (
      <section className="auth-card session-card">
        <div className="auth-card-header">
          <span className="eyebrow">You are signed in</span>
          <h2>Welcome back, {props.session.displayName}.</h2>
          <p className="auth-muted">{props.signedInDescription}</p>
        </div>

        <div className="session-summary">
          <div>
            <span>Account</span>
            <strong>{props.session.email}</strong>
          </div>
          <div>
            <span>Role</span>
            <strong>{props.session.roleName}</strong>
          </div>
          <div>
            <span>Last login</span>
            <strong>
              {props.session.lastLoginAtUtc
                ? new Date(props.session.lastLoginAtUtc).toLocaleString()
                : 'Just now'}
            </strong>
          </div>
        </div>

        <div className="session-actions">
          <button
            className="primary-btn auth-button"
            type="button"
            onClick={props.onSignOut}
            disabled={props.submitting}
          >
            {props.submitting ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-card">
      <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
        <button
          type="button"
          className={props.authMode === 'signin' ? 'tab active' : 'tab'}
          onClick={() => props.setAuthMode('signin')}
        >
          Sign in
        </button>
        <button
          type="button"
          className={props.authMode === 'signup' ? 'tab active' : 'tab'}
          onClick={() => props.setAuthMode('signup')}
        >
          Sign up
        </button>
      </div>

      <div className="auth-card-header">
        <span className="eyebrow">{props.authTitle}</span>
        <h2>{props.authMode === 'signin' ? 'Welcome back.' : 'Create your owner account.'}</h2>
        <p className="auth-muted">{props.authDescription}</p>
      </div>

      <form className="auth-form" onSubmit={props.onSubmit}>
        {props.authMode === 'signup' ? (
          <label className="field">
            <span>Your name</span>
            <input
              type="text"
              name="displayName"
              value={props.form.displayName}
              onChange={(event) => props.setForm({ ...props.form, displayName: event.target.value })}
              placeholder="Avery Johnson"
              autoComplete="name"
              required
            />
          </label>
        ) : null}

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            value={props.form.email}
            onChange={(event) => props.setForm({ ...props.form, email: event.target.value })}
            placeholder="owner@yourbusiness.com"
            autoComplete="email"
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            value={props.form.password}
            onChange={(event) => props.setForm({ ...props.form, password: event.target.value })}
            placeholder="At least 8 characters"
            autoComplete={props.authMode === 'signin' ? 'current-password' : 'new-password'}
            minLength={8}
            required
          />
        </label>

        {props.error ? <p className="auth-error">{props.error}</p> : null}

        <button className="primary-btn auth-button" type="submit" disabled={props.submitting}>
          {props.submitting
            ? props.authMode === 'signin'
              ? 'Signing in...'
              : 'Creating account...'
            : props.authMode === 'signin'
              ? 'Sign in'
              : 'Create account'}
        </button>
      </form>

      <p className="auth-footer">
        {props.authMode === 'signin'
          ? 'New here? Switch to sign up and start your free setup.'
          : 'Already have an account? Switch to sign in.'}
      </p>
    </section>
  );
}

type DashboardWorkspaceProps = {
  session: AuthSession | null;
  dashboardTab: DashboardTab;
  setDashboardTab: Dispatch<SetStateAction<DashboardTab>>;
};

function DashboardWorkspace(props: DashboardWorkspaceProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHoursSchedule>(() => createDefaultBusinessHoursSchedule());
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [savingBusinessHours, setSavingBusinessHours] = useState(false);
  const [businessHoursMessage, setBusinessHoursMessage] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState<CalendarView>('month');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!props.session) {
      setMetrics(null);
      setAppointments([]);
      setBusinessHours(createDefaultBusinessHoursSchedule());
      setLoadingMetrics(false);
      return;
    }

    let cancelled = false;

    async function loadDashboardData() {
      setLoadingMetrics(true);
      setMetricsError(null);

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

        const [customers, appointmentRows, conversations, messages, businessHoursRows] = await Promise.all([
          customersResponse.json(),
          appointmentsResponse.json(),
          conversationsResponse.json(),
          messagesResponse.json(),
          businessHoursResponse.json(),
        ]) as [unknown[], AppointmentSummary[], unknown[], unknown[], BusinessHoursSchedule];

        if (cancelled) {
          return;
        }

        setMetrics({
          customers: customers.length,
          appointments: appointmentRows.length,
          conversations: conversations.length,
          messages: messages.length,
        });
        setAppointments(appointmentRows);
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
              <p>
                Use reminders, follow-ups, and quick replies to protect your schedule from no-shows.
              </p>
            </article>

            <article className="dashboard-card">
              <span className="eyebrow">Next step</span>
              <h3>Open the calendar tab.</h3>
              <p>
                Review future and past appointments in one place, all filtered to your account.
              </p>
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
