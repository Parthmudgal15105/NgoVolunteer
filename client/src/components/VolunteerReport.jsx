import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer, Download } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../services/useData";
import {
  State,
  Badge,
  Empty,
  PageHead,
  date,
  downloadCsv,
  levelClass,
} from "./Common";

// Proper detailed report of one volunteer: totals, monthly trend, every activity.
export default function VolunteerReport({ self = false }) {
  const { user } = useAuth();
  const { id } = useParams();
  const memberId = self ? user._id : id;
  const { data, error } = useData(`/volunteers/${memberId}/report`);
  const [filter, setFilter] = useState("all");
  if (!data) return <State data={data} error={error} />;
  const { member, profile, totals, months, byActivity, tenure } = data;
  const activity = data.activity.filter(
    (r) => filter === "all" || r.source === filter,
  );
  const stats = [
    ["Reward Points", totals.rp],
    ["Activities attended", totals.activities],
    ["Recorded hours", totals.hours],
    ["Drives", totals.drives],
    ["Department tasks", totals.tasks],
    ["Absences", totals.absences],
    [
      "Attendance rate",
      totals.attendanceRate == null ? "—" : `${totals.attendanceRate}%`,
    ],
    ["Certificates", totals.certificates],
  ];
  return (
    <div className="volunteer-report">
      <PageHead
        eyebrow="VOLUNTEER REPORT"
        title={member.name}
        description={`${member.departments?.join(", ") || "No department"} · ${member.organizationRole || "Volunteer"}`}
      >
        <div className="inline-actions no-print">
          {!self && (
            <Link className="button secondary" to="/app/volunteers">
              <ArrowLeft size={16} /> Volunteers
            </Link>
          )}
          <button
            className="secondary"
            onClick={() =>
              downloadCsv(
                `${member.name}-activity.csv`,
                [
                  "Date",
                  "Activity",
                  "Type",
                  "Attendance",
                  "Hours",
                  "RP",
                  "Notes",
                ],
                data.activity.map((r) => [
                  date(r.date),
                  r.title,
                  r.label,
                  r.status,
                  r.hours ?? "",
                  r.rp,
                  r.notes || "",
                ]),
              )
            }
          >
            <Download size={16} /> CSV
          </button>
          <button onClick={() => window.print()}>
            <Printer size={16} /> Print
          </button>
        </div>
      </PageHead>
      <div className="report-grid">
        <section className="panel">
          <h3>Profile</h3>
          <dl className="details">
            <dt>Email</dt>
            <dd>{member.email}</dd>
            <dt>Login ID</dt>
            <dd>{member.loginId || "—"}</dd>
            <dt>Phone</dt>
            <dd>{profile.phone || "—"}</dd>
            <dt>State</dt>
            <dd>{profile.state || "—"}</dd>
            <dt>Joined</dt>
            <dd>{profile.joiningDate || date(member.createdAt)}</dd>
            <dt>Status</dt>
            <dd>
              <Badge>{member.active ? "active" : "inactive"}</Badge>
            </dd>
            <dt>Skills</dt>
            <dd>{profile.skills?.join(", ") || "—"}</dd>
          </dl>
        </section>
        <section className="panel">
          <h3>Certificate tenure</h3>
          {tenure ? (
            <dl className="details">
              <dt>Department</dt>
              <dd>{tenure.department || "—"}</dd>
              <dt>Tenure</dt>
              <dd>
                {tenure.start ? date(tenure.start) : "Start not set"}
                {tenure.end ? ` → ${date(tenure.end)}` : ""}
                {tenure.months != null ? ` (${tenure.months} months)` : ""}
              </dd>
              <dt>RP in tenure</dt>
              <dd>
                {tenure.rp}
                {tenure.minRP != null ? ` of ${tenure.minRP} required` : ""}
              </dd>
              <dt>Status</dt>
              <dd>
                <Badge>{tenure.eligible ? "approved" : "pending"}</Badge>{" "}
                {tenure.reason || "Eligible"}
              </dd>
            </dl>
          ) : (
            <p className="muted">Tenure certificates apply to volunteers.</p>
          )}
        </section>
      </div>
      <div className="stats-grid report-stats">
        {stats.map(([label, value]) => (
          <div className="stat panel" key={label}>
            <span className="muted tiny">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="report-grid">
        <section className="panel">
          <h3>Monthly activity</h3>
          <p className="muted tiny">RP earned in each of the last 12 months</p>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={months}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f2e7dc"
              />
              <XAxis dataKey="label" axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar
                dataKey="rp"
                name="RP"
                fill="#ad0b61"
                radius={[5, 5, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Activities</th>
                <th>RP</th>
                <th>Hours</th>
                <th>Level</th>
              </tr>
            </thead>
            <tbody>
              {[...months].reverse().map((m) => (
                <tr key={m.month}>
                  <td>{m.month}</td>
                  <td>{m.activities}</td>
                  <td>{m.rp}</td>
                  <td>{m.hours}</td>
                  <td>
                    <span className={`badge ${levelClass(m.level)}`}>
                      {m.level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      <section className="panel table-wrap">
        <div className="section-head padded">
          <h3>RP by activity</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>Activity</th>
              <th>Times</th>
              <th>Hours</th>
              <th>RP</th>
            </tr>
          </thead>
          <tbody>
            {byActivity.map((a) => (
              <tr key={a.label}>
                <td>{a.label}</td>
                <td>{a.count}</td>
                <td>{a.hours}</td>
                <td>{a.rp}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!byActivity.length && <Empty>No attended activity yet.</Empty>}
      </section>
      <section className="panel table-wrap">
        <div className="section-head padded">
          <h3>Full activity history</h3>
          <div className="tabs no-print">
            {[
              ["all", "All"],
              ["event", "Events"],
              ["contribution", "Drives & tasks"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={filter === key ? "active" : ""}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Activity</th>
              <th>Type</th>
              <th>Attendance</th>
              <th>Hours</th>
              <th>RP</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {activity.map((r) => (
              <tr key={r._id}>
                <td>{date(r.date)}</td>
                <td>
                  {r.title}
                  {r.location && <small>{r.location}</small>}
                </td>
                <td>{r.label}</td>
                <td>
                  <Badge>{r.status}</Badge>
                </td>
                <td>{r.hours == null ? "—" : `${r.hours}h`}</td>
                <td>{r.rp}</td>
                <td className="wrap">{r.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!activity.length && <Empty>No activity recorded.</Empty>}
      </section>
      <div className="report-grid">
        <section className="panel table-wrap">
          <div className="section-head padded">
            <h3>Certificates</h3>
          </div>
          <table>
            <tbody>
              {data.certificates.map((c) => (
                <tr key={c._id}>
                  <td>
                    <strong>{c.title}</strong>
                    <small>{c.certificateId}</small>
                  </td>
                  <td>
                    <Badge>{c.type}</Badge>
                  </td>
                  <td>{c.date ? date(c.date) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.certificates.length && <Empty>No certificates yet.</Empty>}
        </section>
        <section className="panel table-wrap">
          <div className="section-head padded">
            <h3>Event applications</h3>
          </div>
          <table>
            <tbody>
              {data.applications.map((a) => (
                <tr key={a._id}>
                  <td>{a.event}</td>
                  <td>{a.date ? date(a.date) : ""}</td>
                  <td>
                    <Badge>{a.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.applications.length && <Empty>No applications.</Empty>}
        </section>
      </div>
    </div>
  );
}
