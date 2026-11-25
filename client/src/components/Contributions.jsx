import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../services/useData";
import api from "../services/api";
import { State, Badge, Empty, date } from "./Common";

export default function Contributions({ onSaved, rulesVersion = 0 }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const memberId = params.get("member") || "";
  const setMember = (id) => setParams(id ? { member: id } : {});
  const manager = user.role !== "volunteer";
  const { data, error, load } = useData("/contributions");
  const { data: members, load: reloadMembers } = useData(
    manager ? "/volunteers" : null,
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const selectedMember = members?.find((member) => member._id === memberId);
  const { data: rules } = useData(
    manager ? `/rp-rules?v=${rulesVersion}` : null,
  );
  const memberRules =
    rules?.filter((r) =>
      selectedMember?.departments?.some(
        (d) => d.trim().toLowerCase() === r.department.trim().toLowerCase(),
      ),
    ) || [];
  const defaults = { drive: 5, reel_edit: 3, misc: 2, task: 0 };
  const [choice, setChoice] = useState("drive");
  const [points, setPoints] = useState("5");
  const [label, setLabel] = useState("");
  const defaultFor = (value) =>
    value.startsWith("rule:")
      ? (rules?.find((r) => r._id === value.slice(5))?.points ?? "")
      : (defaults[value] ?? "");
  function choose(value) {
    setChoice(value);
    setPoints(String(defaultFor(value)));
  }
  function startEdit(record) {
    setEditing(record);
    const value =
      record.kind === "custom" || (record.points != null && record.ruleLabel)
        ? "custom"
        : record.kind;
    setChoice(value);
    setLabel(record.ruleLabel || "");
    setPoints(String(record.points ?? defaults[record.kind] ?? ""));
  }

  async function save(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    if (choice.startsWith("rule:")) {
      body.rule = choice.slice(5);
      body.kind = "custom";
      body.points = points;
    } else if (choice === "custom") {
      body.kind = "custom";
      body.points = points;
      body.ruleLabel = label;
    } else {
      body.kind = choice;
      // Matching the standard value keeps the original RP rule for this type.
      body.points = String(defaults[choice]) === points ? "" : points;
      body.ruleLabel = "";
    }
    setBusy(true);
    try {
      if (editing) await api.patch(`/contributions/${editing._id}`, body);
      else await api.post("/contributions", body);
      setMessage("Contribution saved.");
      setEditing(null);
      choose("drive");
      setLabel("");
      form.reset();
      load();
      reloadMembers();
      onSaved?.();
    } catch (e) {
      setMessage(e.response?.data?.message || "Unable to save contribution.");
    } finally {
      setBusy(false);
    }
  }
  const memberRows = data?.filter(
    (r) => !manager || r.volunteer?._id === memberId,
  );
  const present = memberRows?.filter((r) => r.status === "present") || [];
  const rows = memberRows?.filter((r) =>
    `${r.volunteer?.name} ${r.title} ${r.kind} ${r.volunteer?.departments?.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <h2>Drive & task contributions</h2>
      <p>
        Choose a member above to log their work. Pick one of your department’s
        RP activities, or set your own points for this entry. Older records keep
        their original RP (drive 5, reel edit 3, miscellaneous 2).
      </p>
      {manager && !memberId && (
        <Empty>
          Choose a member to see their attendance, contribution history, and RP.
        </Empty>
      )}
      {(!manager || memberId) && (
        <>
          {manager && selectedMember && (
            <div className="summary-strip">
              <strong>{selectedMember.name}</strong>
              <span>{selectedMember.departments?.join(", ")}</span>
              <strong>{selectedMember.rp || 0} total RP</strong>
            </div>
          )}
          <div className="summary-strip">
            <strong>
              {present.reduce((n, r) => n + (r.rp || 0), 0)} RP from
              contributions
            </strong>
            <strong>
              {present.filter((r) => r.kind === "drive").length} drives
            </strong>
            <strong>
              {present.filter((r) => r.kind === "reel_edit").length} reel edits
            </strong>
            <strong>
              {present.filter((r) => r.kind === "misc").length} miscellaneous
              actions
            </strong>
          </div>
          {message && (
            <div className="toast" role="status">
              {message}
            </div>
          )}
          {manager && (
            <form onSubmit={save} key={editing?._id || memberId}>
              <h3>
                {editing
                  ? `Edit contribution: ${editing.title}`
                  : `Record activity for ${selectedMember?.name || "this member"}`}
              </h3>
              {!editing && (
                <>
                  <input type="hidden" name="volunteer" value={memberId} />
                  <label>
                    Activity
                    <input name="title" maxLength={180} required />
                  </label>
                  <label>
                    Date
                    <input name="date" type="date" required />
                  </label>
                  <label>
                    Location
                    <input name="location" maxLength={180} />
                  </label>
                </>
              )}
              <label>
                What is the RP for?
                <select value={choice} onChange={(e) => choose(e.target.value)}>
                  {memberRules.length > 0 && (
                    <optgroup label="Department RP activities">
                      {memberRules.map((r) => (
                        <option key={r._id} value={`rule:${r._id}`}>
                          {r.label} · {r.points} RP ({r.department})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Standard">
                    <option value="drive">Drive · 5 RP</option>
                    <option value="reel_edit">
                      Reel edit · 3 RP (Social &amp; Content)
                    </option>
                    <option value="misc">
                      Miscellaneous · 2 RP (Social &amp; Content)
                    </option>
                    <option value="task">Other department task</option>
                  </optgroup>
                  <option value="custom">Something else (type it)…</option>
                </select>
              </label>
              {choice === "custom" && (
                <label>
                  Name of the RP activity
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    maxLength={120}
                    required
                    placeholder="e.g. Hosted a workshop"
                  />
                </label>
              )}
              <label>
                RP to award
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={points}
                  required={choice === "custom"}
                  onChange={(e) => setPoints(e.target.value)}
                />
              </label>
              <label>
                Attendance
                <select
                  name="status"
                  defaultValue={editing?.status || "present"}
                >
                  <option value="present">Present / completed</option>
                  <option value="absent">Absent / not completed</option>
                </select>
              </label>
              <label>
                Hours (optional)
                <input
                  name="hours"
                  type="number"
                  min="0"
                  max="24"
                  step="0.25"
                  defaultValue={editing?.hours ?? ""}
                />
              </label>
              <label>
                Work completed / remarks
                <textarea
                  name="notes"
                  maxLength={1000}
                  defaultValue={editing?.notes || ""}
                />
              </label>
              <div className="inline-actions">
                <button disabled={busy}>
                  {editing ? "Save changes" : "Log activity"}
                </button>
                {editing && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setEditing(null);
                      choose("drive");
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
          <label>
            Search this member’s activity
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Drive or action"
            />
          </label>
          <State data={data} error={error} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {manager && <th>Member</th>}
                  <th>Activity</th>
                  <th>Date</th>
                  <th>Attendance</th>
                  <th>Hours</th>
                  <th>RP</th>
                  <th>Remarks</th>
                  {manager && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rows?.map((r) => (
                  <tr key={r._id}>
                    {manager && (
                      <td>
                        {r.volunteer?.name}
                        <small>{r.volunteer?.departments?.join(", ")}</small>
                      </td>
                    )}
                    <td>
                      {r.title}
                      <small>
                        {r.ruleLabel || r.kind.replaceAll("_", " ")}
                        {r.location ? ` · ${r.location}` : ""}
                      </small>
                    </td>
                    <td>{date(r.date)}</td>
                    <td>
                      <Badge>{r.status}</Badge>
                    </td>
                    <td>
                      {r.hours == null ? "Hours not provided" : `${r.hours}h`}
                    </td>
                    <td>{r.rp || 0} RP</td>
                    <td>{r.notes}</td>
                    {manager && (
                      <td>
                        <button
                          className="small secondary"
                          onClick={() => startEdit(r)}
                        >
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows?.length === 0 && (
              <Empty>No activity has been logged for this member yet.</Empty>
            )}
          </div>
        </>
      )}
    </section>
  );
}
