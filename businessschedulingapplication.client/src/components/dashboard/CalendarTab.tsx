import type { Dispatch, SetStateAction } from 'react';
import type { AppointmentSummary, CalendarView } from '../../types';
import { MetricCard } from '../shared/MetricCard';
import {
  addDays,
  appointmentsForDay,
  formatAppointmentTime,
  formatFullDateTime,
  startOfMonth,
  startOfWeek,
} from '../../lib/date';

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

export function CalendarTab(props: CalendarTabProps) {
  const now = new Date();
  const displayedMonthStart = startOfMonth(now);
  const displayedWeekStart = startOfWeek(now);
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
