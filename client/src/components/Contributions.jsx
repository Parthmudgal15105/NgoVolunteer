import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../services/useData";
import api from "../services/api";
import { State, Badge, Empty, date } from "./Common";

export default function Contributions() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const memberId = params.get("member") || "";
  const setMember = (id) => setParams(id ? { member: id } : {});
  const manager = user.role !== "volunteer";
  const { data, error, load } = useData("/contributions");
  const { data: members } = useData(manager ? "/volunteers" : null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const selectedMember = members?.find((member) => member._id === memberId);

  async function save(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    setBusy(true);
    try {
      if (editing) await api.patch(`/contributions/${editing._id}`, body);
      else await api.post("/contributions", body);
      setMessage("Contribution saved.");
      setEditing(null);
      form.reset();
      load();
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
        Review one member’s activity at a time. Attended drives earn 5 RP.
        Social &amp; Content earns 3 RP for a reel edit and 2 RP for a
        miscellaneous action.
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
                Type
                <select name="kind" defaultValue={editing?.kind || "drive"}>
                  <option value="drive">Drive · 5 RP</option>
                  <option value="reel_edit">
                    Reel edit · 3 RP (Social &amp; Content)
                  </option>
                  <option value="misc">
                    Miscellaneous · 2 RP (Social &amp; Content)
                  </option>
                  <option value="task">
                    Other department task · no RP rule
                  </option>
                </select>
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
                    onClick={() => setEditing(null)}
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
                        {r.kind.replaceAll("_", " ")} · {r.location}
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
                          onClick={() => setEditing(r)}
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
