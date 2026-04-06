import type { ReactNode } from 'react';
import type { AuthSession } from '../../types';

type DashboardPageProps = {
  session: AuthSession | null;
  submitting: boolean;
  onSignOut: () => Promise<void>;
  onNavigateHome: () => void;
  children: ReactNode;
};

export function DashboardPage(props: DashboardPageProps) {
  return (
    <main className="page-shell dashboard-shell">
      <header className="dashboard-topbar">
        <div className="brand">
          <span className="brand-mark">Z</span>
          <span className="brand-name">ZephyrBook</span>
        </div>
        <div className="dashboard-topbar-center" />
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

      {props.children}
    </main>
  );
}
