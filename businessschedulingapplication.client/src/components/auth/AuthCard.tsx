import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { AuthMode, AuthSession } from '../../types';

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

export function AuthCard(props: AuthCardProps) {
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
            <span>Business profile</span>
            <strong>{props.session.businessDescription ? 'Saved' : 'Not set'}</strong>
          </div>
          <div>
            <span>Bot name</span>
            <strong>{props.session.botName ?? 'Not set'}</strong>
          </div>
          <div>
            <span>Last login</span>
            <strong>{props.session.lastLoginAtUtc ? new Date(props.session.lastLoginAtUtc).toLocaleString() : 'Just now'}</strong>
          </div>
        </div>

        <div className="session-actions">
          <button className="primary-btn auth-button" type="button" onClick={props.onSignOut} disabled={props.submitting}>
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
