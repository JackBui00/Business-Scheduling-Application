import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { BusinessHoursSchedule } from '../../types';
import { browserTimeZoneId, commonTimeZones } from '../../lib/scheduling';

type BusinessHoursTabProps = {
  loading: boolean;
  saving: boolean;
  message: string | null;
  schedule: BusinessHoursSchedule;
  setSchedule: Dispatch<SetStateAction<BusinessHoursSchedule>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function BusinessHoursTab(props: BusinessHoursTabProps) {
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
