import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { AuthSession, DashboardTab } from '../../types';

type DashboardPageProps = {
  session: AuthSession | null;
  submitting: boolean;
  onSignOut: () => Promise<void>;
  onNavigateHome: () => void;
  setSession: Dispatch<SetStateAction<AuthSession | null>>;
  dashboardTab: DashboardTab;
  setDashboardTab: Dispatch<SetStateAction<DashboardTab>>;
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
              className={props.dashboardTab === 'messages' ? 'dashboard-tab active' : 'dashboard-tab'}
              onClick={() => props.setDashboardTab('messages')}
            >
              Messages
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

      {props.children}
    </main>
  );
}
