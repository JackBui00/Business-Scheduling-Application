import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { ConversationThread, CustomerProfileDraft } from '../../types';
import { formatConversationTimestamp } from '../../lib/date';

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

export function MessagesTab(props: MessagesTabProps) {
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

function MetricCard(props: { label: string; value: string }) {
  return (
    <article className="metric-card">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </article>
  );
}
