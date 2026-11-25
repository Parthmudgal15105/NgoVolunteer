import { useState } from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { useData } from "../services/useData";
import { State, Empty, downloadCsv, levelClass, date } from "./Common";

const currentMonth = () =>
  new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 7);

// How active each volunteer was in a month, with a department-wise rollup.
export default function MonthlyReport() {
  const [month, setMonth] = useState(currentMonth());
  const [department, setDepartment] = useState("");
  const [level, setLevel] = useState("");
  const [query, setQuery] = useState("");
  const { data, error } = useData(
    `/reports/monthly?month=${month}${department ? `&department=${encodeURIComponent(department)}` : ""}`,
  );
  const rows = data?.members.filter(
    (m) =>
      (!level || m.level === level) &&
      `${m.name} ${m.email}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="monthly-report">
      <div className="section-head">
        <div>
          <span className="eyebrow">MONTHLY VOLUNTEER REPORT</span>
          <h2>How active was everyone this month?</h2>
          <p className="muted">
            Activities count attended events, drives and department tasks.
            Active means 2 or more in the month.
          </p>
        </div>
        {data && (
          <button
            className="secondary"
            onClick={() =>
              downloadCsv(
                `volunteer-report-${data.month}.csv`,
                [
                  "Name",
                  "Email",
                  "Departments",
                  "Activities",
                  "Events",
                  "Drives",
                  "Tasks",
                  "Absences",
                  "Hours",
                  "RP",
                  "Level",
                  "Last activity",
                ],
                data.members.map((m) => [
                  m.name,
                  m.email,
                  m.departments?.join(" / "),
                  m.activities,
                  m.events,
                  m.drives,
                  m.tasks,
                  m.absences,
                  m.hours,
                  m.rp,
                  m.level,
                  m.lastActivity ? date(m.lastActivity) : "",
                ]),
              )
            }
          >
            <Download size={16} /> Download CSV
          </button>
        )}
      </div>
      <div className="filters report-filters">
        <label>
          Month
          <input
            type="month"
            value={month}
            max={currentMonth()}
            onChange={(e) => setMonth(e.target.value || currentMonth())}
          />
        </label>
        <label>
          Department
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">All my departments</option>
            {data?.departments.map((d) => (
              <option key={d.name}>{d.name}</option>
            ))}
          </select>
        </label>
        <label>
          Activity level
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">Any level</option>
            {["Highly active", "Active", "Occasional", "Inactive"].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <label>
          Search
          <input
            value={query}
            placeholder="Name or email"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <State data={data} error={error} />
      {data && (
        <>
          <div className="stats-grid report-stats">
            {[
              ["Volunteers", data.totals.members],
              ["Active (2+)", data.totals.active],
              ["Inactive", data.totals.inactive],
              ["Activities", data.totals.activities],
              ["RP earned", data.totals.rp],
              ["Hours", data.totals.hours],
            ].map(([label, value]) => (
              <div className="stat panel" key={label}>
                <span className="muted tiny">{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="panel table-wrap">
            <div className="section-head padded">
              <h3>Department-wise</h3>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Volunteers</th>
                  <th>Active</th>
                  <th>Inactive</th>
                  <th>Activities</th>
                  <th>RP</th>
                  <th>Hours</th>
                </tr>
              </thead>
              <tbody>
                {data.departments.map((d) => (
                  <tr key={d.name}>
                    <td>
                      <button
                        className="link-button"
                        onClick={() => setDepartment(d.name)}
                      >
                        {d.name}
                      </button>
                    </td>
                    <td>{d.members}</td>
                    <td>{d.activeMembers}</td>
                    <td>{d.inactiveMembers}</td>
                    <td>{d.activities}</td>
                    <td>{d.rp}</td>
                    <td>{d.hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Volunteer</th>
                  <th>Level</th>
                  <th>Activities</th>
                  <th>Events · drives · tasks</th>
                  <th>Absences</th>
                  <th>Hours</th>
                  <th>RP</th>
                  <th>Last activity</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m._id}>
                    <td>
                      <strong>{m.name}</strong>
                      <small>{m.departments?.join(", ")}</small>
                    </td>
                    <td>
                      <span className={`badge ${levelClass(m.level)}`}>
                        {m.level}
                      </span>
                    </td>
                    <td>{m.activities}</td>
                    <td>
                      {m.events} · {m.drives} · {m.tasks}
                    </td>
                    <td>{m.absences}</td>
                    <td>{m.hours}</td>
                    <td>{m.rp}</td>
                    <td>{m.lastActivity ? date(m.lastActivity) : "—"}</td>
                    <td>
                      <Link
                        className="text-link"
                        to={`/app/volunteers/${m._id}`}
                      >
                        Full report
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <Empty>No volunteers match these filters.</Empty>}
          </div>
        </>
      )}
    </section>
  );
}
