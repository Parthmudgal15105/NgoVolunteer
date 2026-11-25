import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../services/useData";
import api from "../services/api";
import { State, Badge, Empty, PageHead, date, downloadCsv } from "./Common";
import Contributions from "./Contributions";
import RpRules from "./RpRules";

const monthOf = (value) =>
  new Date(new Date(value).getTime() + 5.5 * 3600000).toISOString().slice(0, 7);

// Attendance with data up front: every event and drive/task record in scope, filterable.
export default function AttendanceTab() {
  const { user } = useAuth();
  const manager = user.role !== "volunteer";
  const [params, setParams] = useSearchParams();
  const memberId = params.get("member") || "";
  const setMember = (id) => setParams(id ? { member: id } : {});
  const { data: attendance, error, load } = useData("/attendance");
  const {
    data: contributions,
    error: cError,
    load: reloadContributions,
  } = useData("/contributions");
  const { data: regs, load: reloadRegs } = useData(
    manager ? "/registrations" : null,
  );
  const { data: members, load: reloadMembers } = useData(
    manager ? "/volunteers" : null,
  );
  const [department, setDepartment] = useState("");
  const [month, setMonth] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [rulesVersion, setRulesVersion] = useState(0);

  const departmentsOf = (id) =>
    members?.find((m) => m._id === id)?.departments || [];
  const rows =
    attendance && contributions
      ? [
          ...attendance.map((a) => ({
            _id: a._id,
            source: "event",
            volunteer: a.volunteer,
            title: a.event?.title,
            label: "Event",
            date: a.event?.date,
            status: a.status,
            hours: a.hours,
            rp: a.rp,
          })),
          ...contributions.map((c) => ({
            _id: c._id,
            source: "contribution",
            volunteer: c.volunteer,
            title: c.title,
            label:
              c.ruleLabel ||
              {
                drive: "Drive",
                task: "Task",
                reel_edit: "Reel edit",
                misc: "Miscellaneous",
                custom: "Custom",
              }[c.kind],
            date: c.date,
            status: c.status,
            hours: c.hours,
            rp: c.rp,
            notes: c.notes,
          })),
        ]
          .filter(
            (r) =>
              (!memberId || r.volunteer?._id === memberId) &&
              (!department ||
                (
                  r.volunteer?.departments || departmentsOf(r.volunteer?._id)
                ).includes(department)) &&
              (!month || monthOf(r.date) === month) &&
              (type === "all" || r.source === type) &&
              (!status || r.status === status),
          )
          .sort((a, b) => new Date(b.date) - new Date(a.date))
      : null;
  const present = rows?.filter((r) => r.status === "present") || [];
  const toMark = regs?.filter(
    (r) =>
      r.status === "approved" &&
      new Date(r.event?.date) <= new Date() &&
      (!memberId || r.volunteer?._id === memberId) &&
      (!department || departmentsOf(r.volunteer?._id).includes(department)),
  );
  const departments = [
    ...new Set(members?.flatMap((m) => m.departments || []) || []),
  ].sort();

  async function mark(r, value) {
    setBusy(true);
    try {
      await api.put("/attendance", {
        event: r.event._id,
        volunteer: r.volunteer._id,
        status: value,
      });
      setMessage("Attendance saved. Hours and RP recalculated.");
      load();
      reloadRegs();
    } catch (e) {
      setMessage(e.response?.data?.message || "Attendance update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Every hour counts."
        description={
          manager
            ? "All attendance for your members — events, drives and department tasks. Filter to narrow it down."
            : "Your time and participation, all in one place."
        }
      />
      {message && (
        <div role="status" className="toast" onClick={() => setMessage("")}>
          {message}
        </div>
      )}
      {manager && (
        <div className="filters report-filters">
          <label>
            Member
            <select
              value={memberId}
              onChange={(e) => setMember(e.target.value)}
            >
              <option value="">All members</option>
              {members?.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name} · {m.departments?.join(", ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Department
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            Month
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
          <label>
            Attendance
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Present & absent</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
            </select>
          </label>
        </div>
      )}
      <div className="stats-grid report-stats">
        {[
          ["Records", rows?.length ?? "…"],
          ["Present", present.length],
          ["Absent", (rows?.length || 0) - present.length],
          [
            "Attendance rate",
            rows?.length
              ? `${Math.round((present.length / rows.length) * 100)}%`
              : "—",
          ],
          ["Hours", present.reduce((n, r) => n + (r.hours || 0), 0)],
          ["RP", rows?.reduce((n, r) => n + (r.rp || 0), 0) ?? 0],
        ].map(([label, value]) => (
          <div className="stat panel" key={label}>
            <span className="muted tiny">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      {manager && !!toMark?.length && (
        <section className="panel table-wrap">
          <div className="section-head padded">
            <div>
              <h3>Mark event attendance</h3>
              <p className="muted tiny">
                Approved volunteers for events that have started. Complete the
                event to issue certificates.
              </p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Volunteer</th>
                <th>Event</th>
                <th>Date</th>
                <th>Current</th>
                <th>Mark</th>
              </tr>
            </thead>
            <tbody>
              {toMark.map((r) => {
                const record = attendance?.find(
                  (a) =>
                    a.event?._id === r.event?._id &&
                    a.volunteer?._id === r.volunteer?._id,
                );
                return (
                  <tr key={r._id}>
                    <td>{r.volunteer?.name}</td>
                    <td>{r.event?.title}</td>
                    <td>{date(r.event?.date)}</td>
                    <td>
                      <Badge>{record?.status || "unmarked"}</Badge>
                    </td>
                    <td>
                      <div className="inline-actions">
                        <button
                          className="small"
                          disabled={busy}
                          onClick={() => mark(r, "present")}
                        >
                          Present
                        </button>
                        <button
                          className="small secondary"
                          disabled={busy}
                          onClick={() => mark(r, "absent")}
                        >
                          Absent
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
      <section className="panel table-wrap">
        <div className="section-head padded">
          <div className="tabs">
            {[
              ["all", "All records"],
              ["event", "Events"],
              ["contribution", "Drives & tasks"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={type === key ? "active" : ""}
                onClick={() => setType(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {rows && (
            <button
              className="small secondary"
              onClick={() =>
                downloadCsv(
                  "attendance.csv",
                  [
                    "Date",
                    "Member",
                    "Activity",
                    "Type",
                    "Attendance",
                    "Hours",
                    "RP",
                  ],
                  rows.map((r) => [
                    date(r.date),
                    r.volunteer?.name,
                    r.title,
                    r.label,
                    r.status,
                    r.hours ?? "",
                    r.rp,
                  ]),
                )
              }
            >
              <Download size={14} /> CSV
            </button>
          )}
        </div>
        <State data={rows} error={error || cError} />
        {rows && (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                {manager && <th>Member</th>}
                <th>Activity</th>
                <th>Type</th>
                <th>Attendance</th>
                <th>Hours</th>
                <th>RP</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 500).map((r) => (
                <tr key={`${r.source}-${r._id}`}>
                  <td>{date(r.date)}</td>
                  {manager && (
                    <td>
                      <Link
                        className="text-link"
                        to={`/app/volunteers/${r.volunteer?._id}`}
                      >
                        {r.volunteer?.name}
                      </Link>
                    </td>
                  )}
                  <td>{r.title}</td>
                  <td>{r.label}</td>
                  <td>
                    <Badge>{r.status}</Badge>
                  </td>
                  <td>{r.hours == null ? "—" : `${r.hours}h`}</td>
                  <td>{r.rp || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {rows?.length > 500 && (
          <p className="muted tiny padded">
            Showing the latest 500 of {rows.length}. Use the filters or CSV for
            the rest.
          </p>
        )}
        {rows?.length === 0 && (
          <Empty>No attendance matches these filters.</Empty>
        )}
      </section>
      {manager && <RpRules onChange={() => setRulesVersion((v) => v + 1)} />}
      <Contributions
        rulesVersion={rulesVersion}
        onSaved={() => {
          reloadContributions();
          reloadMembers();
        }}
      />
    </>
  );
}
