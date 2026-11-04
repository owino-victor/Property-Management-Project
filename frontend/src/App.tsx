import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  House,
  Users,
  ClipboardList,
  MessageSquare,
  CalendarDays,
  LogOut,
  Building2,
  Menu,
  X,
  Clock3,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

import {
  login,
  getCurrentUser,
  getDashboard,
  logout,
  getErrorMessage,
} from "./lib/api";

import { HousesPage, TenantsPage } from "./pages/ManagementPages";
import {
  RequestsPage,
  FeedbackPage,
  NoticesPage,
} from "./pages/OperationalPages";

import type {
  User,
  DashboardResponse,
  DashboardData,
  TenantDashboardData,
  TenantRequestSummary,
} from "./types";

type Page =
  | "dashboard"
  | "houses"
  | "tenants"
  | "requests"
  | "feedback"
  | "notices";

const navigation = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "houses", label: "Houses", icon: House },
  { id: "tenants", label: "Tenants", icon: Users },
  { id: "requests", label: "Requests", icon: ClipboardList },
  { id: "feedback", label: "Feedback", icon: MessageSquare },
  { id: "notices", label: "Leaving notices", icon: CalendarDays },
] as const;

function isTenantDashboard(
  data: DashboardResponse | null,
): data is TenantDashboardData {
  return data?.role === "tenant";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not scheduled";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: value.includes("T") ? "short" : undefined,
  }).format(date);
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700",
    in_progress: "bg-blue-50 text-blue-700",
    resolved: "bg-emerald-50 text-emerald-700",
    acknowledged: "bg-blue-50 text-blue-700",
    completed: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-slate-100 text-slate-500",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        styles[status] || "bg-slate-100 text-slate-600"
      }`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function LoginScreen({
  onLogin,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await onLogin(email, password);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Building2 size={27} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Haven
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Property management, made simpler.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="panel space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Welcome back
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Sign in to your Haven account.
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Email address
            </label>
            <input
              className="input-field"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              className="input-field"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          <button className="primary-button w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          Haven Property Management
        </p>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof House;
}) {
  return (
    <div className="panel">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
          <Icon size={18} />
        </div>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}

function PropertyDashboard({
  data,
  user,
}: {
  data: DashboardData | null;
  user: User;
}) {
  const stats = [
    { label: "Total houses", value: data?.total_houses ?? 0, icon: House },
    {
      label: "Occupied houses",
      value: data?.occupied_houses ?? 0,
      icon: Building2,
    },
    { label: "Vacant houses", value: data?.vacant_houses ?? 0, icon: House },
    { label: "Active tenants", value: data?.active_tenants ?? 0, icon: Users },
    {
      label: "Open requests",
      value: data?.open_requests ?? 0,
      icon: ClipboardList,
    },
    {
      label: "Pending notices",
      value: data?.pending_notices ?? 0,
      icon: CalendarDays,
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm text-slate-500">Overview</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Welcome back, {user.full_name.split(" ")[0]}.
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Here's what's happening with your property today.
        </p>
      </div>

      {data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
      ) : (
        <div className="panel text-sm text-slate-500">
          Dashboard information is currently unavailable.
        </div>
      )}

      <div className="panel mt-6">
        <h2 className="font-semibold text-slate-900">Your workspace</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Use the navigation to manage houses and tenants, or review requests,
          feedback and leaving notices.
        </p>
      </div>
    </div>
  );
}

function RequestRow({ request }: { request: TenantRequestSummary }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 py-4 last:border-0">
      <div className="min-w-0">
        <p className="font-medium text-slate-800">{request.title}</p>
        <p className="mt-1 text-xs capitalize text-slate-400">
          {request.request_type.replaceAll("_", " ")} ·{" "}
          {formatDate(request.created_at)}
        </p>
        {request.caretaker_response && (
          <p className="mt-2 text-sm text-slate-500">
            Caretaker: {request.caretaker_response}
          </p>
        )}
      </div>
      <StatusPill status={request.status} />
    </div>
  );
}

function TenantDashboard({
  data,
  user,
  onNavigate,
}: {
  data: TenantDashboardData | null;
  user: User;
  onNavigate: (page: Page) => void;
}) {
  if (!data) {
    return (
      <div>
        <div className="mb-8">
          <p className="text-sm text-slate-500">Your home</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Welcome back, {user.full_name.split(" ")[0]}.
          </h1>
        </div>
        <div className="panel text-sm text-slate-500">
          Your tenant dashboard is currently unavailable.
        </div>
      </div>
    );
  }

  const tenantStats = [
    {
      label: "Total requests",
      value: data.requests.total,
      icon: ClipboardList,
    },
    { label: "Open requests", value: data.requests.open, icon: Clock3 },
    {
      label: "Resolved requests",
      value: data.requests.resolved,
      icon: CheckCircle2,
    },
    {
      label: "Feedback submitted",
      value: data.feedback_count,
      icon: MessageSquare,
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm text-slate-500">Your home</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Welcome back, {user.full_name.split(" ")[0]}.
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Here's your home and service activity at a glance.
        </p>
      </div>

      <section className="panel mb-6 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Your assigned house</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
              {data.house.house_number}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {data.house.description || "Your home at Haven"}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
            <House size={25} />
          </div>
        </div>
        <div className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-500">
          <span className="font-medium text-slate-700">Move-in date:</span>{" "}
          {formatDate(data.house.move_in_date)}
        </div>
      </section>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tenantStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="panel">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Recent requests</h2>
              <p className="text-sm text-slate-500">
                Updates on your submitted requests
              </p>
            </div>
            <button
              onClick={() => onNavigate("requests")}
              className="text-sm font-medium text-slate-600 hover:text-slate-950"
            >
              View all <ArrowRight className="ml-1 inline" size={14} />
            </button>
          </div>

          {data.requests.recent.length ? (
            data.requests.recent.map((request) => (
              <RequestRow key={request.id} request={request} />
            ))
          ) : (
            <div className="py-8 text-center">
              <ClipboardList
                className="mx-auto mb-3 text-slate-300"
                size={30}
              />
              <p className="text-sm text-slate-500">
                You haven't submitted any requests yet.
              </p>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="mb-2">
            <h2 className="font-semibold text-slate-900">
              Upcoming scheduled fixes
            </h2>
            <p className="text-sm text-slate-500">
              Work scheduled for your house
            </p>
          </div>

          {data.requests.upcoming.length ? (
            data.requests.upcoming.map((request) => (
              <div
                key={request.id}
                className="border-b border-slate-100 py-4 last:border-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-medium text-slate-800">{request.title}</p>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700">
                    <CalendarDays size={14} />
                    {formatDate(request.scheduled_for)}
                  </span>
                </div>
                {request.caretaker_response && (
                  <p className="mt-2 text-sm text-slate-500">
                    {request.caretaker_response}
                  </p>
                )}
              </div>
            ))
          ) : (
            <div className="py-8 text-center">
              <CalendarDays className="mx-auto mb-3 text-slate-300" size={30} />
              <p className="text-sm text-slate-500">
                No upcoming fixes have been scheduled.
              </p>
            </div>
          )}
        </section>

        <section className="panel xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-900">Leaving notice</h2>
              <p className="mt-1 text-sm text-slate-500">
                Your latest notice and its status
              </p>
            </div>

            {data.leaving_notice ? (
              <StatusPill status={data.leaving_notice.status} />
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                No notice submitted
              </span>
            )}
          </div>

          {data.leaving_notice ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-400">Intended departure</p>
                <p className="mt-1 font-medium text-slate-800">
                  {formatDate(data.leaving_notice.intended_departure)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Reason</p>
                <p className="mt-1 text-sm text-slate-700">
                  {data.leaving_notice.reason}
                </p>
              </div>
              {data.leaving_notice.caretaker_response && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-400">Caretaker response</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {data.leaving_notice.caretaker_response}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              When you need to move out, you can submit a leaving notice here.
            </p>
          )}

          <button
            onClick={() => onNavigate("notices")}
            className="secondary-button mt-5"
          >
            View leaving notices
          </button>
        </section>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => onNavigate("requests")}
          className="panel flex items-center justify-between text-left transition hover:border-slate-300"
        >
          <span>
            <span className="block font-semibold text-slate-900">
              Submit a request
            </span>
            <span className="mt-1 block text-sm text-slate-500">
              Report an issue or request assistance.
            </span>
          </span>
          <ClipboardList className="text-slate-500" />
        </button>

        <button
          onClick={() => onNavigate("feedback")}
          className="panel flex items-center justify-between text-left transition hover:border-slate-300"
        >
          <span>
            <span className="block font-semibold text-slate-900">
              Share feedback
            </span>
            <span className="mt-1 block text-sm text-slate-500">
              Tell us about your experience at Haven.
            </span>
          </span>
          <MessageSquare className="text-slate-500" />
        </button>
      </section>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [page, setPage] = useState<Page>("dashboard");
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dashboardError, setDashboardError] = useState("");

  async function loadDashboard() {
    try {
      setDashboard(await getDashboard());
      setDashboardError("");
    } catch (err) {
      setDashboard(null);
      setDashboardError(getErrorMessage(err));
    }
  }

  async function restoreSession() {
    const token = sessionStorage.getItem("haven_token");

    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      await loadDashboard();
    } catch {
      logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void restoreSession();
  }, []);

  async function handleLogin(email: string, password: string) {
    const response = await login(email, password);
    setUser(response.user);
    setPage("dashboard");
    await loadDashboard();
  }

  function handleLogout() {
    logout();
    setUser(null);
    setDashboard(null);
    setPage("dashboard");
  }

  function navigate(nextPage: Page) {
    setPage(nextPage);
    setMobileMenuOpen(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
          <p className="text-sm text-slate-500">Loading Haven...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const visibleNavigation = navigation.filter((item) => {
    if (user.role === "tenant") {
      return ["dashboard", "requests", "feedback", "notices"].includes(item.id);
    }

    return true;
  });

  const pageLabel =
    navigation.find((item) => item.id === page)?.label || "Dashboard";

  function renderPage() {
    if (page === "dashboard") {
      if (user.role === "tenant") {
        return (
          <TenantDashboard
            data={isTenantDashboard(dashboard) ? dashboard : null}
            user={user}
            onNavigate={navigate}
          />
        );
      }

      return (
        <PropertyDashboard
          data={dashboard && dashboard.role !== "tenant" ? dashboard : null}
          user={user}
        />
      );
    }

    if (page === "houses" && user.role !== "tenant") {
      return <HousesPage user={user} />;
    }

    if (page === "tenants" && user.role !== "tenant") {
      return <TenantsPage user={user} />;
    }

    if (page === "requests") {
      return <RequestsPage user={user} />;
    }

    if (page === "feedback") {
      return <FeedbackPage user={user} />;
    }

    if (page === "notices") {
      return <NoticesPage user={user} />;
    }

    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {mobileMenuOpen && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center justify-between border-b border-slate-100 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Building2 size={21} />
            </div>
            <div>
              <p className="font-semibold tracking-tight text-slate-900">
                Haven
              </p>
              <p className="text-xs text-slate-400">Property management</p>
            </div>
          </div>
          <button
            className="text-slate-400 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-4 pt-7">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Workspace
          </p>

          <nav className="space-y-1">
            {visibleNavigation.map((item) => {
              const Icon = item.icon;
              const active = page === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto border-t border-slate-100 p-4">
          <div className="mb-4 flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">
                {user.full_name}
              </p>
              <p className="text-xs capitalize text-slate-400">{user.role}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="text-slate-600 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu size={22} />
          </button>

          <div className="hidden text-sm text-slate-500 sm:block">
            {user.role === "tenant" ? "My home" : "Property workspace"}
            <span className="mx-2 text-slate-300">/</span>
            <span className="font-medium text-slate-800">{pageLabel}</span>
          </div>

          <div className="ml-auto text-right">
            <p className="text-sm font-medium text-slate-800">
              {user.full_name}
            </p>
            <p className="text-xs capitalize text-slate-400">{user.role}</p>
          </div>
        </header>

        <div className="mx-auto max-w-7xl p-5 sm:p-8">
          {dashboardError && page === "dashboard" && (
            <div className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Dashboard: {dashboardError}
            </div>
          )}
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

export default App;
