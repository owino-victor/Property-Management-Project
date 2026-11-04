import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  MessageSquare,
  Send,
} from "lucide-react";

import {
  createFeedback,
  createNotice,
  createRequest,
  getErrorMessage,
  getFeedback,
  getNotices,
  getRequests,
  updateNotice,
  updateRequest,
} from "../lib/api";

import type {
  User,
  ServiceRequest,
  Feedback,
  LeavingNotice,
  RequestType,
  RequestStatus,
  NoticeStatus,
} from "../types";

function formatDate(value: string | null | undefined) {
  if (!value) return "Not scheduled";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: value.includes("T") ? "short" : undefined,
  }).format(date);
}

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function minimumDepartureDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return localDateString(date);
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700",
    in_progress: "bg-blue-50 text-blue-700",
    acknowledged: "bg-blue-50 text-blue-700",
    resolved: "bg-emerald-50 text-emerald-700",
    completed: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-slate-100 text-slate-500",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
        styles[status] || "bg-slate-100 text-slate-600"
      }`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function Message({
  type,
  children,
}: {
  type: "success" | "error";
  children: string;
}) {
  return (
    <div
      role="status"
      className={`rounded-xl px-4 py-3 text-sm ${
        type === "success"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-red-50 text-red-700"
      }`}
    >
      {children}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="panel flex items-center justify-center gap-3 py-10 text-sm text-slate-500">
      <LoaderCircle className="animate-spin" size={18} />
      Loading records...
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 text-center">
      <ClipboardList className="mx-auto mb-3 text-slate-300" size={32} />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <p className="text-sm text-slate-500">{eyebrow}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
        {title}
      </h1>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}

export function RequestsPage({ user }: { user: User }) {
  const isTenant = user.role === "tenant";
  const isCaretaker = user.role === "caretaker";

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [requestType, setRequestType] = useState<RequestType>("complaint");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  async function loadRequests() {
    setLoading(true);
    setError("");

    try {
      setRequests(await getRequests());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await createRequest({ request_type: requestType, title, description });
      setTitle("");
      setDescription("");
      setSuccess("Your request has been submitted.");
      await loadRequests();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(
    request: ServiceRequest,
    status: RequestStatus,
    response: string,
    scheduledValue: string,
  ) {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await updateRequest(request.id, {
        status,
        caretaker_response: response.trim() || null,
        scheduled_for: scheduledValue
          ? new Date(scheduledValue).toISOString()
          : null,
      });

      setSuccess(`Request #${request.id} updated.`);
      await loadRequests();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SectionHeading
        eyebrow={isTenant ? "Your home" : "Property operations"}
        title="Service requests"
        description={
          isTenant
            ? "Report problems, request repairs or ask for assistance."
            : "Review tenant requests and track their progress."
        }
      />

      {error && (
        <div className="mb-4">
          <Message type="error">{error}</Message>
        </div>
      )}
      {success && (
        <div className="mb-4">
          <Message type="success">{success}</Message>
        </div>
      )}

      {isTenant && (
        <form onSubmit={handleCreate} className="panel mb-6 space-y-4">
          <div>
            <h2 className="font-semibold text-slate-900">Submit a request</h2>
            <p className="mt-1 text-sm text-slate-500">
              Your caretaker will receive your request.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Request type
              </label>
              <select
                className="input-field"
                value={requestType}
                onChange={(event) =>
                  setRequestType(event.target.value as RequestType)
                }
              >
                <option value="complaint">Complaint</option>
                <option value="repair">Repair</option>
                <option value="assistance">Assistance</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Title
              </label>
              <input
                className="input-field"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                minLength={3}
                maxLength={150}
                placeholder="e.g. Water supply issue"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              className="input-field min-h-28 resize-y"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              minLength={5}
              placeholder="Describe the issue and any useful details..."
              required
            />
          </div>

          <button className="primary-button" disabled={saving}>
            <Send size={16} />
            {saving ? "Submitting..." : "Submit request"}
          </button>
        </form>
      )}

      <section className="panel">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">
              {isTenant ? "Your request history" : "All service requests"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {requests.length} {requests.length === 1 ? "record" : "records"}
            </p>
          </div>
          <button
            className="secondary-button"
            onClick={() => void loadRequests()}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <LoadingState />
        ) : requests.length === 0 ? (
          <EmptyState message="No service requests have been submitted yet." />
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                showTenant={!isTenant}
                canManage={isCaretaker}
                saving={saving}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RequestCard({
  request,
  showTenant,
  canManage,
  saving,
  onUpdate,
}: {
  request: ServiceRequest;
  showTenant: boolean;
  canManage: boolean;
  saving: boolean;
  onUpdate: (
    request: ServiceRequest,
    status: RequestStatus,
    response: string,
    scheduledValue: string,
  ) => Promise<void>;
}) {
  const [status, setStatus] = useState<RequestStatus>(request.status);
  const [response, setResponse] = useState(request.caretaker_response || "");
  const [scheduled, setScheduled] = useState(
    request.scheduled_for ? localDateTimeValue(request.scheduled_for) : "",
  );

  return (
    <article className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900">{request.title}</h3>
            <StatusPill status={request.status} />
          </div>
          <p className="mt-1 text-xs capitalize text-slate-400">
            {request.request_type.replaceAll("_", " ")} · Request #{request.id}
          </p>
        </div>
        <p className="text-xs text-slate-400">
          {formatDate(request.created_at)}
        </p>
      </div>

      {showTenant && (
        <p className="mt-3 text-xs text-slate-500">
          Tenant record ID: {request.tenant_id}
        </p>
      )}

      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
        {request.description}
      </p>

      {request.caretaker_response && !canManage && (
        <div className="mt-4 rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-500">
            Caretaker response
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
            {request.caretaker_response}
          </p>
        </div>
      )}

      {request.scheduled_for && !canManage && (
        <p className="mt-3 flex items-center gap-2 text-sm text-blue-700">
          <CalendarDays size={15} />
          Scheduled for {formatDate(request.scheduled_for)}
        </p>
      )}

      {canManage && (
        <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Status
              </label>
              <select
                className="input-field"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as RequestStatus)
                }
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Schedule (optional)
              </label>
              <input
                type="datetime-local"
                className="input-field"
                value={scheduled}
                onChange={(event) => setScheduled(event.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Response to tenant
            </label>
            <textarea
              className="input-field min-h-20 resize-y"
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              placeholder="Provide an update or explain the next steps..."
            />
          </div>

          <button
            className="primary-button"
            disabled={saving}
            onClick={() => void onUpdate(request, status, response, scheduled)}
          >
            <CheckCircle2 size={16} />
            Save update
          </button>
        </div>
      )}
    </article>
  );
}

function localDateTimeValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);

  return local.toISOString().slice(0, 16);
}

export function FeedbackPage({ user }: { user: User }) {
  const isTenant = user.role === "tenant";
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(!isTenant);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadFeedback() {
    if (isTenant) return;

    setLoading(true);
    setError("");

    try {
      setFeedback(await getFeedback());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isTenant) void loadFeedback();
  }, [isTenant]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await createFeedback({ message });
      setMessage("");
      setSuccess("Thank you. Your feedback has been submitted.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SectionHeading
        eyebrow={isTenant ? "Your voice matters" : "Property operations"}
        title="Feedback"
        description={
          isTenant
            ? "Share suggestions or tell us about your experience at Haven."
            : "Read feedback submitted by tenants."
        }
      />

      {error && (
        <div className="mb-4">
          <Message type="error">{error}</Message>
        </div>
      )}
      {success && (
        <div className="mb-4">
          <Message type="success">{success}</Message>
        </div>
      )}

      {isTenant ? (
        <form onSubmit={handleSubmit} className="panel space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-3 text-slate-600">
              <MessageSquare size={21} />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">
                Share your feedback
              </h2>
              <p className="text-sm text-slate-500">
                Suggestions, concerns or things we're doing well.
              </p>
            </div>
          </div>

          <textarea
            className="input-field min-h-40 resize-y"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            minLength={3}
            placeholder="Write your feedback here..."
            required
          />

          <button className="primary-button" disabled={saving}>
            <Send size={16} />
            {saving ? "Submitting..." : "Submit feedback"}
          </button>
        </form>
      ) : (
        <section className="panel">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">
                Tenant feedback inbox
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {feedback.length}{" "}
                {feedback.length === 1 ? "submission" : "submissions"}
              </p>
            </div>
            <button
              className="secondary-button"
              onClick={() => void loadFeedback()}
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <LoadingState />
          ) : feedback.length === 0 ? (
            <EmptyState message="No feedback has been submitted yet." />
          ) : (
            <div className="space-y-3">
              {feedback.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {item.tenant}
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
                        House {item.house_number} · Feedback #{item.id}
                      </p>
                    </div>
                    <p className="text-xs text-slate-400">
                      {formatDate(item.created_at)}
                    </p>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {item.message}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export function NoticesPage({ user }: { user: User }) {
  const isTenant = user.role === "tenant";
  const isCaretaker = user.role === "caretaker";

  const [notices, setNotices] = useState<LeavingNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [departure, setDeparture] = useState(minimumDepartureDate());
  const [reason, setReason] = useState("");

  async function loadNotices() {
    setLoading(true);
    setError("");

    try {
      setNotices(await getNotices());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNotices();
  }, []);

  const activeNotice = notices.some(
    (notice) => notice.status === "pending" || notice.status === "acknowledged",
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await createNotice({
        intended_departure: departure,
        reason,
      });
      setReason("");
      setSuccess("Your leaving notice has been submitted.");
      await loadNotices();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(
    notice: LeavingNotice,
    status: NoticeStatus,
    response: string,
  ) {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await updateNotice(notice.id, {
        status,
        caretaker_response: response.trim() || null,
      });
      setSuccess(`Notice #${notice.id} updated.`);
      await loadNotices();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SectionHeading
        eyebrow={isTenant ? "Your tenancy" : "Property operations"}
        title="Leaving notices"
        description={
          isTenant
            ? "Submit and track your intended departure from the property."
            : "Review tenant departure notices and record your response."
        }
      />

      {error && (
        <div className="mb-4">
          <Message type="error">{error}</Message>
        </div>
      )}
      {success && (
        <div className="mb-4">
          <Message type="success">{success}</Message>
        </div>
      )}

      {isTenant && (
        <form onSubmit={handleCreate} className="panel mb-6 space-y-4">
          <div>
            <h2 className="font-semibold text-slate-900">
              Submit a leaving notice
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              At least 30 days' notice is required. You can only have one active
              notice at a time.
            </p>
          </div>

          {activeNotice ? (
            <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              You already have an active leaving notice. You can track its
              progress below.
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Intended departure date
                </label>
                <input
                  type="date"
                  className="input-field"
                  min={minimumDepartureDate()}
                  value={departure}
                  onChange={(event) => setDeparture(event.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Reason for leaving
                </label>
                <textarea
                  className="input-field min-h-28 resize-y"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  minLength={5}
                  placeholder="Please explain your reason..."
                  required
                />
              </div>

              <button className="primary-button" disabled={saving}>
                <Send size={16} />
                {saving ? "Submitting..." : "Submit notice"}
              </button>
            </>
          )}
        </form>
      )}

      <section className="panel">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">
              {isTenant ? "Your notice history" : "All leaving notices"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {notices.length} {notices.length === 1 ? "record" : "records"}
            </p>
          </div>
          <button
            className="secondary-button"
            onClick={() => void loadNotices()}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <LoadingState />
        ) : notices.length === 0 ? (
          <EmptyState message="No leaving notices have been submitted." />
        ) : (
          <div className="space-y-4">
            {notices.map((notice) => (
              <NoticeCard
                key={notice.id}
                notice={notice}
                showTenant={!isTenant}
                canManage={isCaretaker}
                saving={saving}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function NoticeCard({
  notice,
  showTenant,
  canManage,
  saving,
  onUpdate,
}: {
  notice: LeavingNotice;
  showTenant: boolean;
  canManage: boolean;
  saving: boolean;
  onUpdate: (
    notice: LeavingNotice,
    status: NoticeStatus,
    response: string,
  ) => Promise<void>;
}) {
  const [status, setStatus] = useState<NoticeStatus>(notice.status);
  const [response, setResponse] = useState(notice.caretaker_response || "");

  return (
    <article className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900">
              {showTenant ? notice.tenant : "Your leaving notice"}
            </h3>
            <StatusPill status={notice.status} />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {showTenant ? `House ${notice.house_number} · ` : ""}
            Notice #{notice.id} · Submitted {formatDate(notice.created_at)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-slate-400">Intended departure</p>
          <p className="mt-1 text-sm font-medium text-slate-800">
            {formatDate(notice.intended_departure)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Reason</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
            {notice.reason}
          </p>
        </div>
      </div>

      {notice.caretaker_response && !canManage && (
        <div className="mt-4 rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-500">
            Caretaker response
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
            {notice.caretaker_response}
          </p>
        </div>
      )}

      {canManage && (
        <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Notice status
            </label>
            <select
              className="input-field"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as NoticeStatus)
              }
            >
              <option value="pending">Pending</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Response to tenant
            </label>
            <textarea
              className="input-field min-h-20 resize-y"
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              placeholder="Add a response or instructions..."
            />
          </div>

          <button
            className="primary-button"
            disabled={saving}
            onClick={() => void onUpdate(notice, status, response)}
          >
            <CheckCircle2 size={16} />
            Save notice update
          </button>
        </div>
      )}
    </article>
  );
}
