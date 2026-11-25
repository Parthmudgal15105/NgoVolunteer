import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../services/useData";
import api from "../services/api";
import { Empty } from "./Common";

// Heads decide what they award RP for, and how much, for their own department.
export default function RpRules({ onChange }) {
  const { user } = useAuth();
  const { data, load } = useData("/rp-rules");
  const [message, setMessage] = useState("");
  const admin = user.role === "admin";
  const own = user.departments || [];
  const editable = (rule) =>
    admin ||
    own.some(
      (d) => d.trim().toLowerCase() === rule.department.trim().toLowerCase(),
    );
  const visible = data?.filter((r) => admin || editable(r));

  async function add(e) {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      await api.post("/rp-rules", Object.fromEntries(new FormData(form)));
      form.reset();
      setMessage("RP activity saved.");
      load();
      onChange?.();
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not save.");
    }
  }
  async function remove(rule) {
    try {
      const r = await api.delete(`/rp-rules/${rule._id}`);
      setMessage(r.data.message);
      load();
      onChange?.();
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not remove.");
    }
  }
  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <h2>RP activities</h2>
      <p className="muted">
        Decide what your department awards RP for and how many points each is
        worth. They appear when you log an activity. You can still type custom
        points for one-off work.
      </p>
      {message && (
        <div className="toast" role="status" onClick={() => setMessage("")}>
          {message}
        </div>
      )}
      <form className="rule-form" onSubmit={add}>
        <label>
          Department
          {admin ? (
            <input name="department" required placeholder="e.g. Research" />
          ) : (
            <select name="department" required>
              {own.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          )}
        </label>
        <label>
          What is the RP for?
          <input
            name="label"
            required
            maxLength={120}
            placeholder="e.g. Research paper submitted"
          />
        </label>
        <label>
          RP
          <input name="points" type="number" min="0" max="100" required />
        </label>
        <button>Add activity</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Department</th>
              <th>Activity</th>
              <th>RP</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible?.map((r) => (
              <tr key={r._id}>
                <td>{r.department}</td>
                <td>{r.label}</td>
                <td>{r.points}</td>
                <td>
                  {editable(r) && (
                    <button
                      className="small secondary"
                      aria-label={`Remove ${r.label}`}
                      onClick={() => remove(r)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible?.length === 0 && (
          <Empty>
            No RP activities yet. Drives earn 5 RP by default until you add your
            own.
          </Empty>
        )}
      </div>
    </section>
  );
}
