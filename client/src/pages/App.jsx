import NgoBrand from "../components/NgoBrand";
import VolunteerOverview from "../components/VolunteerOverview";
import { useData } from "../services/useData";
import { State, Badge, Empty, EventCard, date } from "../components/Common";
import { useEffect, useState, lazy, Suspense } from "react";
import {
  Routes,
  Route,
  Link,
  NavLink,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  Heart,
  LayoutDashboard,
  CalendarDays,
  Users,
  ClipboardCheck,
  Award,
  Bell,
  Settings,
  LogOut,
  ArrowUpRight,
  ArrowRight,
  Clock,
  MapPin,
  Search,
  Plus,
  Menu,
  X,
  Leaf,
  CheckCircle2,
  BarChart3,
  Megaphone,
  Download,
  Check,
  Trash2,
  Pencil,
  HandHeart,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import api, { downloadCertificate } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

const PdfPreview = lazy(() => import("../components/PdfPreview"));

const categories = [
  "Environment",
  "Community",
  "Education",
  "Health",
  "Food security",
];

function PublicHeader() {
  return (
    <header className="public-header">
      <NgoBrand />
      <nav>
        <Link to="/events">Explore opportunities</Link>
        <Link to="/login">Log in</Link>
        <Link className="button" to="/register">
          Become a volunteer <ArrowUpRight size={16} />
        </Link>
      </nav>
    </header>
  );
}
function Landing() {
  const { data, error } = useData("/events");
  return (
    <>
      <PublicHeader />
      <main className="landing">
        <div className="hero">
          <div>
            <span className="eyebrow">
              <span className="live-dot" /> SMALL ACTIONS. LASTING CHANGE.
            </span>
            <h1>
              A little of your time.
              <br />
              <em>A world of difference.</em>
            </h1>
            <p>
              Find your people. Support a cause you believe in. Turn your time
              and talents into meaningful change in your community.
            </p>
            <div className="hero-actions">
              <Link className="button" to="/register">
                Find your purpose <ArrowUpRight size={18} />
              </Link>
              <Link className="button secondary" to="/events">
                Explore opportunities <ArrowRight size={18} />
              </Link>
            </div>
            <div className="hero-note">
              <HandHeart size={23} />A community built on kindness.
            </div>
          </div>
          <div className="hero-visual">
            <img src="/brand/ngo-logo.jpeg" alt="Warriors Without Cause NGO" />
          </div>
        </div>
        <div className="section-head">
          <div>
            <span className="eyebrow">YOUR NEXT GOOD THING</span>
            <h2>Opportunities with purpose</h2>
          </div>
          <Link to="/events" className="text-link">
            View all opportunities <ArrowRight size={17} />
          </Link>
        </div>
        <State data={data} error={error} />
        <div className="event-grid">
          {data
            ?.filter(
              (e) => e.status === "upcoming" && new Date(e.date) > new Date(),
            )
            .slice(0, 3)
            .map((e) => (
              <EventCard
                key={e._id}
                event={e}
                action={
                  <Link to="/register" className="text-link">
                    Get involved <ArrowUpRight size={16} />
                  </Link>
                }
              />
            ))}
        </div>
        <section className="how">
          <span className="eyebrow">GOOD THINGS START HERE</span>
          <h2>Making a difference is simple.</h2>
          <div className="three-grid">
            {[
              [
                "01",
                "Find your cause",
                "Explore local opportunities that match your interests and availability.",
              ],
              [
                "02",
                "Raise your hand",
                "Create your profile and apply. Your NGO will confirm your place.",
              ],
              [
                "03",
                "See your impact",
                "Show up, give back, and keep a record of your hours and certificates.",
              ],
            ].map(([n, t, d]) => (
              <div key={n}>
                <span className="step">{n}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </section>
        <footer>
          Warriors Without Cause{" "}
          <span>Connecting people. Creating change.</span>
        </footer>
      </main>
    </>
  );
}
function AuthPage({ register = false }) {
  const { login, user } = useAuth(),
    navigate = useNavigate();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/app" />;
  async function submit(e) {
    e.preventDefault();
    setError("");
    const body = Object.fromEntries(new FormData(e.target));
    if (register && body.password !== body.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post(
        `/auth/${register ? "register" : "login"}`,
        body,
      );
      login(data);
      navigate("/app");
    } catch (e) {
      setError(e.response?.data?.message || "Cannot connect to the server.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-screen">
      <form
        className={`auth-form panel ${register ? "registration-form" : ""}`}
        onSubmit={submit}
      >
        <h1>{register ? "Join as a Volunteer" : "Welcome Back"}</h1>
        <p>
          {register
            ? "Create your volunteer account with Warriorswithoutcause."
            : "Login to your Warriorswithoutcause volunteer account."}
        </p>
        {register && (
          <label>
            Full Name
            <input
              name="name"
              placeholder="Enter your full name"
              required
              autoComplete="name"
            />
          </label>
        )}
        <label>
          {register ? "Email Address" : "Email or Login ID"}
          <input
            type={register ? "email" : "text"}
            name="email"
            placeholder={
              register ? "Enter your email" : "Enter your email or login ID"
            }
            required
            autoComplete="email"
          />
        </label>
        {register && (
          <label>
            Phone Number
            <input
              type="tel"
              name="phone"
              placeholder="Enter your phone number"
              required
              autoComplete="tel"
              maxLength={30}
            />
          </label>
        )}
        <label>
          Password
          <input
            type="password"
            name="password"
            placeholder={register ? "Create a password" : "Enter your password"}
            minLength={8}
            maxLength={72}
            required
            autoComplete={register ? "new-password" : "current-password"}
          />
        </label>
        {register && (
          <>
            <label>
              Confirm Password
              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm your password"
                minLength={8}
                maxLength={72}
                required
                autoComplete="new-password"
              />
            </label>
            <label>
              Area of Interest
              <select name="interest" required>
                <option value="">Select an area</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button disabled={busy}>
          {busy ? "Please wait…" : register ? "Create Account" : "Login"}
        </button>
        <p className="auth-switch">
          {register ? "Already have an account?" : "Don't have an account?"}{" "}
          <Link to={register ? "/login" : "/register"}>
            {register ? "Login here" : "Register here"}
          </Link>
        </p>
      </form>
    </main>
  );
}
const adminLinks = [
  ["", "Overview", LayoutDashboard],
  ["volunteers", "Volunteers", Users],
  ["events", "Events", CalendarDays],
  ["applications", "Applications", ClipboardCheck],
  ["attendance", "Attendance", CheckCircle2],
  ["certificates", "Certificates", Award],
  ["announcements", "Announcements", Megaphone],
  ["reports", "Reports & analytics", BarChart3],
];
const volunteerLinks = [
  ["", "Dashboard", LayoutDashboard],
  ["profile", "My Profile", Settings],
  ["my-events", "My Activities", Heart],
  ["certificates", "Certificates", Award],
  ["events", "Explore Drives", CalendarDays],
  ["applications", "My Applications", ClipboardCheck],
  ["attendance", "Attendance & Hours", Clock],
  ["notifications", "Notifications", Bell],
];
function Shell() {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  if (loading) return <Empty>Loading your session…</Empty>;
  if (!user) return <Navigate to="/login" />;
  const admin = user.role !== "volunteer",
    links =
      user.role === "head"
        ? adminLinks
            .filter(([p]) => p !== "announcements")
            .concat([["profile", "My Profile", Settings]])
        : admin
          ? adminLinks.concat([
              ["source-data", "Imported records", ClipboardCheck],
              ["profile", "My Profile", Settings],
            ])
          : volunteerLinks;
  const title =
    links.find(
      ([p]) =>
        location.pathname.replace(/\/$/, "") === `/app${p ? "/" + p : ""}`,
    )?.[1] || "Workspace";
  return (
    <div className={`app-shell ${admin ? "admin-shell" : "volunteer-shell"}`}>
      <aside className={open ? "sidebar open" : "sidebar"}>
        <NgoBrand compact />
        <nav>
          {links.map(([path, label, Icon], index) => (
            <div className="nav-item" key={path}>
              <NavLink to={`/app/${path}`} end onClick={() => setOpen(false)}>
                <Icon size={17} />
                {label}
              </NavLink>
              {!admin && index === 1 && (
                <button className="logout" onClick={logout}>
                  Logout
                </button>
              )}
            </div>
          ))}
        </nav>
        {admin && (
          <button className="logout" onClick={logout}>
            Logout
          </button>
        )}
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="app-main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setOpen(!open)}
          >
            <Menu />
          </button>
          <strong>{title}</strong>
          <Link
            className="icon-button"
            aria-label="Notifications"
            to="/app/notifications"
          >
            <Bell size={19} />
          </Link>
        </header>
        <main className="content">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="events" element={<Events />} />
            <Route path="my-events" element={<Applications assigned />} />
            <Route path="applications" element={<Applications />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="certificates" element={<Certificates />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="profile" element={<Profile />} />
            <Route
              path="source-data"
              element={
                user.role === "admin" ? (
                  <ImportedRecords />
                ) : (
                  <Navigate to="/app" />
                )
              }
            />
            <Route
              path="volunteers"
              element={
                <AdminOnly>
                  <Volunteers />
                </AdminOnly>
              }
            />
            <Route
              path="announcements"
              element={
                <AdminOnly>
                  <Announcements />
                </AdminOnly>
              }
            />
            <Route
              path="reports"
              element={
                <AdminOnly>
                  <Overview reports />
                </AdminOnly>
              }
            />
            <Route path="*" element={<Navigate to="/app" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
function AdminOnly({ children }) {
  return useAuth().user.role !== "volunteer" ? (
    children
  ) : (
    <Navigate to="/app" />
  );
}
function PageHead({
  eyebrow = "YOUR COMMUNITY, CONNECTED",
  title,
  description,
  children,
}) {
  return (
    <div className="page-head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
function Overview({ reports = false }) {
  const { user } = useAuth(),
    { data: d, error } = useData("/dashboard"),
    { data: announcements } = useData("/announcements");
  const admin = user.role !== "volunteer";
  if (!d) return <State data={d} error={error} />;
  if (!admin && !reports) return <VolunteerOverview dashboard={d} />;
  const stats = admin
    ? [
        [
          "Total volunteers",
          d.totalVolunteers,
          Users,
          `${d.activeVolunteers} active in your community`,
        ],
        [
          "Upcoming events",
          d.upcoming,
          CalendarDays,
          `${d.completed} events completed`,
        ],
        ["Volunteering hours", d.hours, Clock, "Time that made a difference"],
        [
          "Certificates issued",
          d.certificates,
          Award,
          `${d.attendancePercentage}% attendance rate`,
        ],
      ]
    : [
        ["Volunteering hours", d.hours, Clock, "Every hour makes a difference"],
        [
          "Events participated",
          d.participated,
          Heart,
          "Moments of meaningful change",
        ],
        [
          "Upcoming events",
          d.upcoming,
          CalendarDays,
          "Your next opportunities to give",
        ],
        [
          "Certificates earned",
          d.certificates,
          Award,
          "Your impact, recognised",
        ],
      ];
  return (
    <>
      <PageHead
        title={
          reports
            ? "Your impact, in perspective."
            : `Welcome, ${user.name.split(" ")[0]}!`
        }
        description={
          admin
            ? "Here’s how your community is making a difference."
            : "A little time. A lasting impact. Here’s your journey so far."
        }
      >
        <Link className="button" to="/app/events">
          {admin ? <Plus size={17} /> : <Search size={17} />}{" "}
          {admin ? "Manage events" : "Explore events"}
        </Link>
      </PageHead>
      <div className="impact-banner">
        <div>
          <span className="eyebrow">BETTER, TOGETHER</span>
          <h2>
            {admin
              ? "A community with purpose."
              : "Your kindness creates ripples."}
          </h2>
          <p>
            {admin
              ? "Connect willing hands with meaningful work. Your next moment of impact starts here."
              : "Find a cause that speaks to you and be part of something bigger."}
          </p>
          <Link to="/app/events">
            Let’s make good happen <ArrowRight size={16} />
          </Link>
        </div>
        <div className="banner-art">
          <Leaf size={90} />
          <Heart size={65} fill="currentColor" />
        </div>
      </div>
      <div className="stats-grid">
        {stats.map(([label, value, Icon, caption]) => (
          <div className="stat panel" key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <span className="stat-icon">
                <Icon size={19} />
              </span>
            </div>
            <strong>{value.toLocaleString()}</strong>
            <small>{caption}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="section-head">
            <div>
              <h3>Hours of impact</h3>
              <p>Your volunteering contribution over time</p>
            </div>
            <span className="pill">Last 6 months</span>
          </div>
          <ResponsiveContainer width="100%" height={235}>
            <AreaChart data={d.months}>
              <defs>
                <linearGradient id="green" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ad0b61" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="#ad0b61" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f2e7dc"
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#82908a", fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#82908a", fontSize: 12 }}
              />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="hours"
                stroke="#ad0b61"
                strokeWidth={3}
                fill="url(#green)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </section>
        <section className="panel quick-panel">
          <h3>A little action goes a long way</h3>
          <p className="muted">Keep your community moving forward.</p>
          {(admin
            ? [
                [
                  "Review applications",
                  `${d.pending} awaiting your review`,
                  "applications",
                  ClipboardCheck,
                ],
                [
                  "Manage attendance",
                  "Recognise every contribution",
                  "attendance",
                  CheckCircle2,
                ],
                [
                  "Share an update",
                  "Keep your community in the loop",
                  "announcements",
                  Megaphone,
                ],
              ]
            : [
                [
                  "My applications",
                  `${d.pending} pending applications`,
                  "applications",
                  ClipboardCheck,
                ],
                [
                  "My certificates",
                  "Celebrate your contribution",
                  "certificates",
                  Award,
                ],
                [
                  "Update your profile",
                  "Help us find your perfect fit",
                  "profile",
                  Settings,
                ],
              ]
          ).map(([t, s, p, I]) => (
            <Link className="quick-link" key={p} to={`/app/${p}`}>
              <span className="stat-icon">
                <I size={19} />
              </span>
              <div>
                <strong>{t}</strong>
                <small>{s}</small>
              </div>
              <ArrowUpRight size={18} />
            </Link>
          ))}
        </section>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-head">
            <h3>Coming up next</h3>
            <Link className="text-link" to="/app/events">
              View events <ArrowRight size={15} />
            </Link>
          </div>
          {d.upcomingEvents.length ? (
            d.upcomingEvents.map((e) => (
              <div className="upcoming-row" key={e._id}>
                <span className="date-tile">
                  <strong>{new Date(e.date).getDate()}</strong>
                  {new Date(e.date).toLocaleString("en", { month: "short" })}
                </span>
                <div>
                  <h4>{e.title}</h4>
                  <span className="muted tiny">
                    <MapPin size={13} />
                    {e.location}
                  </span>
                </div>
                <Badge>{e.category}</Badge>
              </div>
            ))
          ) : (
            <Empty>
              No upcoming assignments yet. Explore events to get started.
            </Empty>
          )}
        </section>
        <section className="panel">
          <div className="section-head">
            <h3>Community board</h3>
            <Megaphone size={18} />
          </div>
          {announcements?.slice(0, 3).map((a) => (
            <div className="announcement-preview" key={a._id}>
              <span className="tiny muted">{date(a.createdAt)}</span>
              <h4>{a.title}</h4>
              <p>{a.message}</p>
            </div>
          ))}
          {!announcements?.length && <Empty>No announcements yet.</Empty>}
        </section>
      </div>
      {reports && (
        <section className="panel">
          <h3>Events by cause</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d.categories}>
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#ad0b61" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}
    </>
  );
}
function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop">
      <section
        className="modal panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="section-head">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Events({ publicView = false }) {
  const { user } = useAuth(),
    admin = user?.role === "admin" && !publicView,
    { data, error, load } = useData("/events");
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All causes"),
    [editing, setEditing] = useState(null),
    [detail, setDetail] = useState(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const { data: regs, load: reloadRegs } = useData(
    user ? "/registrations" : "/events",
  );
  async function action(fn, success) {
    setBusy(true);
    try {
      await fn();
      setMessage(success);
      await load();
      if (user) reloadRegs();
    } catch (e) {
      setMessage(e.response?.data?.message || "Unable to complete action.");
    } finally {
      setBusy(false);
    }
  }
  async function save(e) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    await action(async () => {
      await api[editing._id ? "put" : "post"](
        `/events${editing._id ? "/" + editing._id : ""}`,
        body,
      );
      setEditing(null);
    }, "Event saved.");
  }
  const location = useLocation();
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("event");
    if (id && data) {
      const event = data.find((e) => e._id === id);
      if (event) setDetail(event);
    }
  }, [location.search, data]);
  const filtered = data?.filter(
    (e) =>
      (e.title + " " + e.location)
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (category === "All causes" || e.category === category),
  );
  return (
    <>
      {publicView && <PublicHeader />}
      <div className={publicView ? "public-events" : ""}>
        <PageHead
          title={
            admin ? "Make good happen." : "Find your next meaningful moment."
          }
          description={
            admin
              ? "Create opportunities that bring your community together."
              : "Discover local causes. Meet good people. Make a real difference."
          }
        >
          {admin && (
            <button onClick={() => setEditing({})}>
              <Plus size={17} />
              Create event
            </button>
          )}
        </PageHead>
        {message && (
          <div role="status" className="toast" onClick={() => setMessage("")}>
            {message}
            <X size={15} />
          </div>
        )}
        <div className="filters">
          <div className="search-input">
            <Search size={18} />
            <input
              aria-label="Search events"
              placeholder="Search events or locations…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter cause"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {["All causes", ...categories].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <span className="muted tiny">
            {filtered?.length || 0} opportunities
          </span>
        </div>
        <State data={data} error={error} />
        <div className="event-grid">
          {filtered?.map((e) => {
            const reg = regs?.find((r) => r.event?._id === e._id);
            return (
              <EventCard
                key={e._id}
                event={e}
                action={
                  <button className="link-button" onClick={() => setDetail(e)}>
                    View details <ArrowUpRight size={15} />
                  </button>
                }
              />
            );
          })}
        </div>
        {filtered?.length === 0 && <Empty>No events match your search.</Empty>}
        {detail && (
          <Modal title={detail.title} onClose={() => setDetail(null)}>
            <Badge>{detail.category}</Badge>
            <p>{detail.description}</p>
            <p>
              <MapPin size={16} /> {detail.location}
            </p>
            <p>
              {date(detail.date)} · {detail.hours} hours · Capacity{" "}
              {detail.capacity}
            </p>
            <Badge>{detail.status}</Badge>
            <div className="modal-actions">
              {admin ? (
                <>
                  <button
                    className="secondary"
                    onClick={() => {
                      setEditing(detail);
                      setDetail(null);
                    }}
                  >
                    <Pencil size={16} />
                    Edit
                  </button>
                  <button
                    disabled={busy || detail.status === "completed"}
                    onClick={() =>
                      action(async () => {
                        await api.post(`/events/${detail._id}/complete`);
                        setDetail(null);
                      }, "Event completed and eligible certificates issued.")
                    }
                  >
                    Complete event
                  </button>
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() =>
                      action(async () => {
                        await api.delete(`/events/${detail._id}`);
                        setDetail(null);
                      }, "Event deleted.")
                    }
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </>
              ) : user ? (
                <button
                  disabled={
                    busy ||
                    !!regs?.find((r) => r.event?._id === detail._id) ||
                    detail.status === "completed" ||
                    new Date(detail.date) < new Date() ||
                    detail.approvedCount >= detail.capacity
                  }
                  onClick={() =>
                    action(
                      () => api.post(`/events/${detail._id}/apply`),
                      "Application submitted. You’ll be notified after review.",
                    )
                  }
                >
                  {regs?.find((r) => r.event?._id === detail._id)?.status ||
                    "Apply to volunteer"}
                </button>
              ) : (
                <Link className="button" to="/register">
                  Join to apply
                </Link>
              )}
            </div>
          </Modal>
        )}
        {editing && (
          <Modal
            title={editing._id ? "Edit event" : "Create an opportunity"}
            onClose={() => setEditing(null)}
          >
            <form onSubmit={save}>
              <label>
                Event title
                <input name="title" defaultValue={editing.title} required />
              </label>
              <label>
                Description
                <textarea
                  name="description"
                  defaultValue={editing.description}
                  required
                />
              </label>
              <div className="form-grid">
                <label>
                  Cause
                  <select
                    name="category"
                    defaultValue={editing.category || categories[0]}
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Location
                  <input
                    name="location"
                    defaultValue={editing.location}
                    required
                  />
                </label>
                <label>
                  Date and time
                  <input
                    name="date"
                    type="datetime-local"
                    defaultValue={
                      editing.date
                        ? new Date(
                            new Date(editing.date).getTime() -
                              new Date(editing.date).getTimezoneOffset() *
                                60000,
                          )
                            .toISOString()
                            .slice(0, 16)
                        : ""
                    }
                    required
                  />
                </label>
                <label>
                  Hours
                  <input
                    name="hours"
                    type="number"
                    min="0.5"
                    max="24"
                    step="0.5"
                    defaultValue={editing.hours || 3}
                    required
                  />
                </label>
                <label>
                  Volunteer capacity
                  <input
                    name="capacity"
                    type="number"
                    min="1"
                    defaultValue={editing.capacity || 20}
                    required
                  />
                </label>
              </div>
              <button disabled={busy}>Save event</button>
            </form>
          </Modal>
        )}
      </div>
    </>
  );
}
function Applications({ assigned = false }) {
  const { user } = useAuth(),
    admin = user.role !== "volunteer",
    { data, error, load } = useData("/registrations"),
    [filter, setFilter] = useState("all"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function review(id, status) {
    setBusy(true);
    try {
      await api.patch(`/registrations/${id}`, { status });
      setMessage(`Application ${status}.`);
      load();
    } catch (e) {
      setMessage(e.response?.data?.message || "Update failed.");
    } finally {
      setBusy(false);
    }
  }
  const rows = data?.filter(
    (r) =>
      (!assigned || r.status === "approved") &&
      (filter === "all" || r.status === filter),
  );
  if (assigned && !admin)
    return (
      <>
        <PageHead
          title="My Activities"
          description="Here are the drives you have joined."
        />
        <State data={data} error={error} />
        <div className="drive-grid">
          {rows?.map((r) => (
            <article className="panel drive-card" key={r._id}>
              <h3>{r.event?.title}</h3>
              <div>
                <CalendarDays size={13} />
                {date(r.event?.date)}
              </div>
              <div>
                <MapPin size={13} />
                {r.event?.location}
              </div>
              <div>
                <Clock size={13} />
                {r.event?.hours} volunteer hours
              </div>
              <div className="joined-status">
                <Check size={13} />
                Joined
              </div>
              <Link
                className="text-link"
                to={`/app/events?event=${r.event?._id}`}
              >
                View Details
              </Link>
            </article>
          ))}
        </div>
        {rows?.length === 0 && (
          <Empty>
            No assigned drives yet. Apply for an upcoming drive to get started.
          </Empty>
        )}
      </>
    );
  return (
    <>
      <PageHead
        title={
          assigned
            ? "Your next moments of impact."
            : admin
              ? "A helping hand starts here."
              : "Your volunteer journey."
        }
        description={
          admin
            ? "Review applications and welcome volunteers to your events."
            : "Keep track of your applications and confirmed opportunities."
        }
      />
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
      <div className="tabs">
        {["all", "pending", "approved", "rejected"].map((s) => (
          <button
            key={s}
            className={filter === s ? "active" : ""}
            onClick={() => setFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <State data={data} error={error} />
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              {admin && <th>Volunteer</th>}
              <th>Event</th>
              <th>Date</th>
              <th>Status</th>
              {admin && <th>Review</th>}
            </tr>
          </thead>
          <tbody>
            {rows?.map((r) => (
              <tr key={r._id}>
                {admin && (
                  <td>
                    <strong>{r.volunteer?.name}</strong>
                    <small>{r.volunteer?.email}</small>
                  </td>
                )}
                <td>
                  <strong>{r.event?.title}</strong>
                  <small>{r.event?.location}</small>
                </td>
                <td>{date(r.event?.date)}</td>
                <td>
                  <Badge>{r.status}</Badge>
                </td>
                {admin && (
                  <td>
                    <div className="inline-actions">
                      <button
                        disabled={busy || r.status === "approved"}
                        className="small"
                        onClick={() => review(r._id, "approved")}
                      >
                        <Check size={14} />
                        Approve
                      </button>
                      <button
                        disabled={busy || r.status === "rejected"}
                        className="small secondary"
                        onClick={() => review(r._id, "rejected")}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {rows?.length === 0 && <Empty>No applications here yet.</Empty>}
      </div>
    </>
  );
}
function AttendancePage() {
  const { user } = useAuth(),
    admin = user.role !== "volunteer",
    { data, error, load } = useData("/attendance"),
    { data: regs } = useData("/registrations"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function mark(r, status) {
    setBusy(true);
    try {
      await api.put("/attendance", {
        event: r.event._id,
        volunteer: r.volunteer._id,
        status,
      });
      setMessage("Attendance saved. Hours recalculated.");
      load();
    } catch (e) {
      setMessage(e.response?.data?.message || "Attendance update failed.");
    } finally {
      setBusy(false);
    }
  }
  const rows = admin ? regs?.filter((r) => r.status === "approved") : data;
  return (
    <>
      <PageHead
        title="Every hour counts."
        description={
          admin
            ? "Record attendance after an event. Complete the event to issue certificates."
            : "Your time and participation, all in one place."
        }
      />
      {message && (
        <div role="status" className="toast">
          {message}
        </div>
      )}
      <div className="summary-strip">
        <Clock />
        <strong>{data?.reduce((n, a) => n + a.hours, 0) || 0} hours</strong>
        <span>of recorded contribution</span>
      </div>
      <State data={data} error={error} />
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              {admin && <th>Volunteer</th>}
              <th>Event</th>
              <th>Date</th>
              <th>Attendance</th>
              <th>Hours</th>
              {admin && <th>Mark attendance</th>}
            </tr>
          </thead>
          <tbody>
            {rows?.map((r) => {
              const record = admin
                ? data?.find(
                    (a) =>
                      a.event?._id === r.event?._id &&
                      a.volunteer?._id === r.volunteer?._id,
                  )
                : r;
              return (
                <tr key={r._id}>
                  {admin && <td>{r.volunteer?.name}</td>}
                  <td>{r.event?.title}</td>
                  <td>{date(r.event?.date)}</td>
                  <td>
                    <Badge>{record?.status || "unmarked"}</Badge>
                  </td>
                  <td>{record?.hours || 0}h</td>
                  {admin && (
                    <td>
                      <div className="inline-actions">
                        <button
                          className="small"
                          disabled={
                            busy || new Date(r.event?.date) > new Date()
                          }
                          onClick={() => mark(r, "present")}
                        >
                          Present
                        </button>
                        <button
                          className="small secondary"
                          disabled={
                            busy || new Date(r.event?.date) > new Date()
                          }
                          onClick={() => mark(r, "absent")}
                        >
                          Absent
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows?.length === 0 && <Empty>No attendance records yet.</Empty>}
      </div>
    </>
  );
}
function Certificates() {
  const { user } = useAuth();
  const { data, error } = useData("/certificates");
  const [message, setMessage] = useState(""),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(false);
  useEffect(
    () => () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  async function openPreview(c) {
    setBusy(true);
    setMessage("");
    try {
      const { data: blob } = await api.get(`/certificates/${c._id}/download`, {
        responseType: "blob",
      });
      setPreview({ certificate: c, url: URL.createObjectURL(blob) });
    } catch {
      setMessage("Certificate preview failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        title="My Certificates"
        description="Your contribution, recognised by Warriors Without Cause."
      />
      {message && (
        <div className="toast error" role="alert">
          {message}
        </div>
      )}
      <State data={data} error={error} />
      <div className="three-grid">
        {data?.map((c) => (
          <article className="panel certificate-card" key={c._id}>
            <img
              className="certificate-logo"
              src="/brand/ngo-logo.jpeg"
              alt="Warriors Without Cause"
            />
            <span className="eyebrow">CERTIFICATE OF APPRECIATION</span>
            <h3>{c.event?.title}</h3>
            {user.role !== "volunteer" && <p>{c.volunteer?.name}</p>}
            <p>
              {c.hours} volunteer hours · {date(c.event?.date)}
            </p>
            <code>{c.certificateId}</code>
            <div className="certificate-actions">
              <button disabled={busy} onClick={() => openPreview(c)}>
                View Certificate
              </button>
              <button
                className="secondary"
                onClick={() =>
                  downloadCertificate(c._id).catch(() =>
                    setMessage(
                      "Certificate download failed. Please try again.",
                    ),
                  )
                }
              >
                <Download size={15} />
                Download
              </button>
            </div>
          </article>
        ))}
      </div>
      {data?.length === 0 && (
        <Empty>
          Certificates appear once attendance is confirmed and the event is
          completed.
        </Empty>
      )}
      {preview && (
        <div className="modal-backdrop">
          <section
            className="certificate-preview panel"
            role="dialog"
            aria-modal="true"
            aria-label="Certificate preview"
          >
            <div className="section-head">
              <h2>Certificate of Appreciation</h2>
              <button
                className="icon-button"
                aria-label="Close certificate preview"
                onClick={() => setPreview(null)}
              >
                <X />
              </button>
            </div>
            <Suspense
              fallback={
                <div className="empty">Loading certificate viewer…</div>
              }
            >
              <PdfPreview url={preview.url} />
            </Suspense>
            <div className="preview-footer">
              <button
                onClick={() =>
                  downloadCertificate(preview.certificate._id).catch(() =>
                    setMessage("Download failed. Please try again."),
                  )
                }
              >
                <Download size={16} />
                Download Certificate
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
function Notifications() {
  const { data, error, load } = useData("/notifications"),
    [message, setMessage] = useState("");
  return (
    <>
      <PageHead
        title="You’re in the loop."
        description="Application updates and community notifications."
      />
      {message && <p className="error">{message}</p>}
      <State data={data} error={error} />
      <div className="panel">
        {data?.map((n) => (
          <div className="notification" key={n._id}>
            <span className="stat-icon">
              <Bell size={20} />
            </span>
            <div>
              <p>{n.message}</p>
              <small>{date(n.createdAt)}</small>
            </div>
            {!n.read ? (
              <button
                className="small secondary"
                onClick={() =>
                  api
                    .patch(`/notifications/${n._id}/read`)
                    .then(load)
                    .catch(() =>
                      setMessage("Could not mark notification as read."),
                    )
                }
              >
                Mark read
              </button>
            ) : (
              <Badge>read</Badge>
            )}
          </div>
        ))}
        {data?.length === 0 && <Empty>You’re all caught up.</Empty>}
      </div>
    </>
  );
}
function Profile() {
  const { user, setUser } = useAuth(),
    { data, error } = useData("/profile"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const body = Object.fromEntries(new FormData(e.target));
    body.skills = body.skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    body.interests = body.interests
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await api.put("/profile", body);
      setUser({ ...user, name: body.name });
      setMessage("Your profile has been updated.");
    } catch (e) {
      setMessage(e.response?.data?.message || "Save failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        title="Bring your whole self."
        description="Your skills, interests, and availability help us find the right opportunities for you."
      />
      <State data={data} error={error} />
      <PasswordForm />
      {data && (
        <form className="panel profile-form" onSubmit={save}>
          <div className="form-grid">
            <label>
              Full name
              <input name="name" defaultValue={user.name} required />
            </label>
            <label>
              Email
              <input value={user.email} disabled />
            </label>
            <label>
              Phone
              <input name="phone" defaultValue={data.phone} />
            </label>
            <label>
              Availability
              <input
                name="availability"
                placeholder="Weekends, 9 am – 2 pm"
                defaultValue={data.availability}
              />
            </label>
          </div>
          <label>
            About you
            <textarea name="bio" defaultValue={data.bio} />
          </label>
          <label>
            Skills, separated by commas
            <input
              name="skills"
              placeholder="Teaching, first aid, photography"
              defaultValue={data.skills?.join(", ")}
            />
          </label>
          <label>
            Interests, separated by commas
            <input
              name="interests"
              placeholder="Environment, education"
              defaultValue={data.interests?.join(", ")}
            />
          </label>
          {message && <p role="status">{message}</p>}
          <button disabled={busy}>
            Save profile <Check size={16} />
          </button>
        </form>
      )}
    </>
  );
}
function Volunteers() {
  const { data, error, load } = useData("/volunteers"),
    { data: events } = useData("/events"),
    [selected, setSelected] = useState(null),
    [message, setMessage] = useState(""),
    [query, setQuery] = useState("");
  async function toggle(v) {
    try {
      await api.patch(`/volunteers/${v._id}`, { active: !v.active });
      load();
    } catch (e) {
      setMessage(e.response?.data?.message || "Update failed.");
    }
  }
  async function assign(e) {
    e.preventDefault();
    try {
      await api.post("/assignments", {
        volunteer: selected._id,
        event: new FormData(e.target).get("event"),
      });
      setSelected(null);
      setMessage("Volunteer assigned and notified.");
    } catch (e) {
      setMessage(e.response?.data?.message || "Assignment failed.");
    }
  }
  return (
    <>
      <PageHead
        title="The people behind the impact."
        description="Get to know your volunteers and connect them with meaningful work."
      />
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
      <div className="filters">
        <div className="search-input">
          <Search size={18} />
          <input
            placeholder="Search volunteers…"
            aria-label="Search volunteers"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <State data={data} error={error} />
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Volunteer</th>
              <th>Department & role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data
              ?.filter((v) =>
                (v.name + " " + v.email)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((v) => (
                <tr key={v._id}>
                  <td>
                    <strong>{v.name}</strong>
                    <small>{v.email}</small>
                  </td>
                  <td>
                    {v.departments?.join(", ") || "Department not provided"}
                    <small>
                      {v.founder
                        ? "Founder · Full access"
                        : v.role === "admin"
                          ? "Full access"
                          : v.role === "head"
                            ? "Department head"
                            : v.organizationRole || "Volunteer"}
                    </small>
                    <small>
                      {v.profile?.phone} · {v.profile?.state}
                    </small>
                  </td>
                  <td>
                    <Badge>{v.active ? "active" : "inactive"}</Badge>
                  </td>
                  <td>
                    <div className="inline-actions">
                      <button
                        className="small secondary"
                        onClick={() => toggle(v)}
                      >
                        {v.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        className="small"
                        disabled={!v.active || v.role !== "volunteer"}
                        onClick={() => setSelected(v)}
                      >
                        Assign event
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <Modal
          title={`Assign ${selected.name}`}
          onClose={() => setSelected(null)}
        >
          <form onSubmit={assign}>
            <label>
              Event
              <select name="event" required>
                <option value="">Select an event</option>
                {events
                  ?.filter(
                    (e) =>
                      e.status === "upcoming" && new Date(e.date) > new Date(),
                  )
                  .map((e) => (
                    <option key={e._id} value={e._id}>
                      {e.title}
                    </option>
                  ))}
              </select>
            </label>
            <button>Assign volunteer</button>
          </form>
        </Modal>
      )}
    </>
  );
}
function Announcements() {
  const { data, error, load } = useData("/announcements"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function publish(e) {
    e.preventDefault();
    const form = e.target;
    setBusy(true);
    try {
      await api.post("/announcements", Object.fromEntries(new FormData(form)));
      form.reset();
      load();
      setMessage("Announcement published.");
    } catch (e) {
      setMessage(e.response?.data?.message || "Publish failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        title="Keep your community connected."
        description="Share news, celebrate milestones, and inspire your volunteers."
      />
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
      <div className="dashboard-grid">
        <form className="panel" onSubmit={publish}>
          <h3>Share an update</h3>
          <label>
            Title
            <input name="title" required maxLength={150} />
          </label>
          <label>
            Message
            <textarea name="message" required rows={6} />
          </label>
          <button disabled={busy}>
            <Megaphone size={16} />
            Publish announcement
          </button>
        </form>
        <section className="panel">
          <h3>Community updates</h3>
          <State data={data} error={error} />
          {data?.map((a) => (
            <div className="announcement-preview" key={a._id}>
              <small>{date(a.createdAt)}</small>
              <h4>{a.title}</h4>
              <p>{a.message}</p>
              <button
                className="link-button danger-text"
                onClick={() =>
                  api
                    .delete(`/announcements/${a._id}`)
                    .then(load)
                    .catch(() => setMessage("Delete failed."))
                }
              >
                Remove
              </button>
            </div>
          ))}
          {data?.length === 0 && <Empty>No announcements yet.</Empty>}
        </section>
      </div>
    </>
  );
}
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage register />} />
      <Route path="/events" element={<Events publicView />} />
      <Route path="/app/*" element={<Shell />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function ImportedRecords() {
  const [sheet, setSheet] = useState("");
  const { data, error } = useData(
    `/source-data${sheet ? `?sheet=${encodeURIComponent(sheet)}` : ""}`,
  );
  return (
    <>
      <PageHead
        title="Imported source records"
        description="Original workbook rows, including historical rosters and RP/default records. These values do not count as volunteering hours."
      />
      <label>
        Source worksheet
        <select value={sheet} onChange={(e) => setSheet(e.target.value)}>
          <option value="">Choose a worksheet</option>
          {data?.sheets?.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <State data={data} error={error} />
      {data?.rows && (
        <div className="panel table-wrap">
          <table>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r._id}>
                  <th>Row {r.row}</th>
                  {r.cells.map((c, i) => (
                    <td key={i}>{c == null ? "" : String(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function PasswordForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function change(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    if (body.newPassword !== body.confirmPassword) {
      setMessage("New passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const r = await api.put("/auth/password", body);
      setMessage(r.data.message);
      form.reset();
    } catch (error) {
      setMessage(error.response?.data?.message || "Password change failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel profile-form" onSubmit={change}>
      <h2>Change your password</h2>
      <div className="form-grid">
        <label>
          Current password
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <label>
          New password
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={72}
            required
          />
        </label>
        <label>
          Confirm new password
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={72}
            required
          />
        </label>
      </div>
      {message && <p role="status">{message}</p>}
      <button disabled={busy}>Update password</button>
    </form>
  );
}
