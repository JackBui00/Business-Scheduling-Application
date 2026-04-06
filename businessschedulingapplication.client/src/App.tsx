import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import './App.css';
import { LandingPage } from './components/landing/LandingPage';
import { DashboardPage } from './components/dashboard/DashboardPage';
import { DashboardWorkspace } from './components/dashboard/DashboardWorkspace';
import type { AuthMode, AuthSession } from './types';
import { browserTimeZoneId } from './lib/scheduling';

function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
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
      <DashboardPage session={session} submitting={submitting} onSignOut={handleSignOut} onNavigateHome={() => navigate('/')}>
        <DashboardWorkspace session={session} setSession={setSession} />
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

export default App;
