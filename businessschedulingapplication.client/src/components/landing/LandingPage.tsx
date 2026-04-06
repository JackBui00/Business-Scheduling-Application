import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { AuthMode, AuthSession } from '../../types';
import { AuthCard } from '../auth/AuthCard';
import { features, highlights, testimonials, workflow } from '../../data/landing';

type LandingPageProps = {
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
  onNavigateDashboard: () => void;
};

export function LandingPage(props: LandingPageProps) {
  const heroActionLabel = props.session ? 'Continue to dashboard' : 'Start automating';

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
              ZephyrBook helps small business owners book appointments, send reminders, and handle follow-ups through
              SMS so every client feels remembered.
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
