import { useEffect, useState, lazy, Suspense } from "react";
import { Download, Pencil, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../services/useData";
import api, { downloadPdf } from "../services/api";
import { State, Badge, Empty, PageHead, Modal, date } from "./Common";

const PdfPreview = lazy(() => import("./PdfPreview"));
const pdfPath = (c) =>
  c.type === "event"
    ? `/certificates/${c._id}/download`
    : `/program-certificates/${c._id}/download`;
const PLACEHOLDERS =
  "{name} {department} {title} {period} {hours} {hoursLabel} {event} {date} {rp} {months} {monthsLabel} {start} {end}. Wrap words in **double stars** for bold.";

function Preview({ preview, onClose, onDownload }) {
  return (
    <div className="modal-backdrop">
      <section
        className="certificate-preview panel"
        role="dialog"
        aria-modal="true"
        aria-label="Certificate preview"
      >
        <div className="section-head">
          <h2>Certificate preview</h2>
          <button
            className="icon-button"
            aria-label="Close certificate preview"
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        <Suspense
          fallback={<div className="empty">Loading certificate viewer…</div>}
        >
          <PdfPreview url={preview.url} />
        </Suspense>
        {onDownload && (
          <div className="preview-footer">
            <button onClick={onDownload}>
              <Download size={16} />
              Download Certificate
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
function usePreview() {
  const [preview, setPreview] = useState(null);
  useEffect(
    () => () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  return [preview, setPreview];
}

export default function CertificatesPage() {
  const { user } = useAuth();
  const perms = user.permissions || {};
  const manager = user.role !== "volunteer";
  const [tab, setTab] = useState("issued");
  const tabs = [
    ["issued", manager ? "Issued certificates" : "My certificates"],
    ...(manager
      ? [
          ["tenure", "Tenure & conditions"],
          ["issue", "Issue a certificate"],
          ["format", "Certificate format"],
        ]
      : []),
  ];
  return (
    <>
      <PageHead
        title={manager ? "Certificates" : "My Certificates"}
        description={
          manager
            ? "Certificates issue automatically once a volunteer completes their tenure with the minimum RP. You can also issue and correct them here."
            : "Your contribution, recognised by Warriors Without Cause."
        }
      />
      {tabs.length > 1 && (
        <div className="tabs">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {tab === "issued" && (
        <Issued canEdit={manager && perms.editCertificates} />
      )}
      {tab === "tenure" && <Tenure />}
      {tab === "issue" && <IssueForm onIssued={() => setTab("issued")} />}
      {tab === "format" && <Format canSave={perms.certificateFormat} />}
    </>
  );
}

function Issued({ canEdit }) {
  const { user } = useAuth();
  const manager = user.role !== "volunteer";
  const events = useData("/certificates");
  const programs = useData("/program-certificates");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = usePreview();
  const [busy, setBusy] = useState(false);
  const all =
    events.data && programs.data
      ? [
          ...events.data.map((c) => ({
            ...c,
            type: "event",
            heading: c.overrideTitle || c.event?.title,
            subline: `${c.overrideHours ?? c.hours} volunteer hours · ${date(c.event?.date)}`,
          })),
          ...programs.data.map((c) => ({
            ...c,
            type: c.kind,
            heading: c.title,
            subline:
              c.kind === "tenure"
                ? `${c.rp} RP · ${date(c.periodStart)} – ${date(c.periodEnd)}`
                : [c.department, c.period].filter(Boolean).join(" · "),
          })),
        ].filter((c) =>
          `${c.heading} ${c.volunteer?.name} ${c.displayName || ""} ${c.certificateId}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
      : null;
  async function open(c) {
    setBusy(true);
    try {
      const { data: blob } = await api.get(pdfPath(c), {
        responseType: "blob",
      });
      setPreview({ certificate: c, url: URL.createObjectURL(blob) });
    } catch {
      setMessage("Certificate preview failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function save(e) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api.patch(
        editing.type === "event"
          ? `/certificates/${editing._id}`
          : `/program-certificates/${editing._id}`,
        body,
      );
      setEditing(null);
      setMessage("Certificate updated.");
      events.load();
      programs.load();
    } catch (error) {
      setMessage(error.response?.data?.message || "Update failed.");
    }
  }
  async function withdraw(c) {
    if (!window.confirm(`Withdraw "${c.heading}" for ${c.volunteer?.name}?`))
      return;
    try {
      await api.delete(`/program-certificates/${c._id}`);
      setEditing(null);
      setMessage("Certificate withdrawn.");
      programs.load();
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not withdraw.");
    }
  }
  return (
    <>
      {message && (
        <div className="toast" role="status" onClick={() => setMessage("")}>
          {message}
        </div>
      )}
      {manager && (
        <div className="filters">
          <input
            aria-label="Search certificates"
            placeholder="Search by volunteer, title or ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}
      <State data={all} error={events.error || programs.error} />
      <div className="three-grid">
        {all?.map((c) => (
          <article className="panel certificate-card" key={c._id}>
            <img
              className="certificate-logo"
              src="/brand/ngo-logo.jpeg"
              alt="Warriors Without Cause"
            />
            <span className="eyebrow">CERTIFICATE OF APPRECIATION</span>
            <h3>{c.heading}</h3>
            {manager && <p>{c.displayName || c.volunteer?.name}</p>}
            <p>{c.subline}</p>
            <Badge>{c.type}</Badge>
            <code>{c.certificateId}</code>
            <div className="certificate-actions">
              <button disabled={busy} onClick={() => open(c)}>
                View
              </button>
              <button
                className="secondary"
                onClick={() =>
                  downloadPdf(pdfPath(c)).catch(() =>
                    setMessage("Certificate download failed."),
                  )
                }
              >
                <Download size={15} />
                Download
              </button>
              {canEdit && (
                <button className="secondary" onClick={() => setEditing(c)}>
                  <Pencil size={15} />
                  Edit
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {all?.length === 0 && (
        <Empty>
          Certificates appear after a completed event, or once a tenure is
          finished with the minimum RP.
        </Empty>
      )}
      {editing && (
        <Modal
          title={`Edit certificate · ${editing.volunteer?.name}`}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={save}>
            <label>
              Name printed on certificate
              <input
                name="displayName"
                defaultValue={editing.displayName || ""}
                placeholder={editing.volunteer?.name}
                maxLength={100}
              />
            </label>
            {editing.type === "event" ? (
              <div className="form-grid">
                <label>
                  Event title on certificate
                  <input
                    name="overrideTitle"
                    defaultValue={editing.overrideTitle || ""}
                    placeholder={editing.event?.title}
                  />
                </label>
                <label>
                  Hours on certificate
                  <input
                    name="overrideHours"
                    type="number"
                    min="0"
                    step="0.5"
                    defaultValue={editing.overrideHours ?? ""}
                    placeholder={String(editing.hours)}
                  />
                </label>
              </div>
            ) : (
              <>
                <label>
                  Certificate for
                  <input
                    name="title"
                    defaultValue={editing.title}
                    required
                    maxLength={150}
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Department
                    <input
                      name="department"
                      defaultValue={editing.department || ""}
                    />
                  </label>
                  <label>
                    Period
                    <input
                      name="period"
                      defaultValue={editing.period || ""}
                      placeholder="February 2026"
                    />
                  </label>
                </div>
              </>
            )}
            <label>
              Custom wording (optional — replaces the standard line)
              <textarea
                name="description"
                defaultValue={editing.description || ""}
                maxLength={600}
                placeholder="from **Social Media Department** for being the **Volunteer of the Month** of **February 2026.** We appreciate her commitment…"
              />
              <small className="muted">{PLACEHOLDERS}</small>
            </label>
            <label>
              Internal note
              <input name="note" defaultValue={editing.note || ""} />
            </label>
            <div className="modal-actions">
              <button>Save certificate</button>
              {editing.type === "manual" &&
                user.permissions?.issueCertificates && (
                  <button
                    type="button"
                    className="danger"
                    onClick={() => withdraw(editing)}
                  >
                    Withdraw
                  </button>
                )}
            </div>
          </form>
        </Modal>
      )}
      {preview && (
        <Preview
          preview={preview}
          onClose={() => setPreview(null)}
          onDownload={() =>
            downloadPdf(pdfPath(preview.certificate)).catch(() =>
              setMessage("Download failed. Please try again."),
            )
          }
        />
      )}
    </>
  );
}

function Tenure() {
  const { user } = useAuth();
  const rules = useData("/certificate-rules");
  const status = useData("/certificate-status");
  const [message, setMessage] = useState("");
  const [marking, setMarking] = useState(null);
  const [filter, setFilter] = useState("all");
  const admin = user.role === "admin";
  const own = user.departments || [];
  const rows = status.data?.filter(
    (s) =>
      filter === "all" ||
      (filter === "eligible" && s.eligible && !s.certificate) ||
      (filter === "issued" && s.certificate) ||
      (filter === "waiting" && !s.eligible),
  );
  async function saveRule(e) {
    e.preventDefault();
    try {
      await api.put(
        "/certificate-rules",
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      setMessage(
        "Certificate condition saved. Eligible volunteers receive their certificate now.",
      );
      rules.load();
      status.load();
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not save.");
    }
  }
  async function saveTenure(e) {
    e.preventDefault();
    try {
      await api.put(
        `/volunteers/${marking.volunteer._id}/tenure`,
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      setMarking(null);
      setMessage("Tenure saved.");
      status.load();
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not save tenure.");
    }
  }
  const toInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
  return (
    <>
      {message && (
        <div className="toast" role="status" onClick={() => setMessage("")}>
          {message}
        </div>
      )}
      <section className="panel">
        <h3>Certificate conditions for your department</h3>
        <p className="muted">
          A volunteer receives their certificate automatically when both are
          met: they have worked for the tenure, and earned the minimum RP during
          it. Tenure starts on the joining date unless you mark a different
          start for a volunteer below.
        </p>
        <form className="rule-form" onSubmit={saveRule}>
          <label>
            Department
            {admin ? (
              <input name="department" required placeholder="e.g. Operations" />
            ) : (
              <select name="department" required>
                {own.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            )}
          </label>
          <label>
            Minimum RP
            <input name="minRP" type="number" min="0" required />
          </label>
          <label>
            Tenure (months)
            <input
              name="tenureMonths"
              type="number"
              min="0"
              max="120"
              required
            />
          </label>
          <button>Save condition</button>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Department</th>
                <th>Minimum RP</th>
                <th>Tenure</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rules.data?.map((r) => (
                <tr key={r._id}>
                  <td>{r.department}</td>
                  <td>{r.minRP} RP</td>
                  <td>{r.tenureMonths} months</td>
                  <td>{date(r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rules.data?.length === 0 && (
            <Empty>No conditions yet. Add one for your department above.</Empty>
          )}
        </div>
      </section>
      <section className="panel table-wrap" style={{ marginTop: 24 }}>
        <div className="section-head padded">
          <h3>Volunteer tenure</h3>
          <div className="tabs">
            {[
              ["all", "All"],
              ["waiting", "In progress"],
              ["issued", "Issued"],
            ].map(([k, l]) => (
              <button
                key={k}
                className={filter === k ? "active" : ""}
                onClick={() => setFilter(k)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <State data={status.data} error={status.error} />
        <table>
          <thead>
            <tr>
              <th>Volunteer</th>
              <th>Tenure</th>
              <th>RP in tenure</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((s) => (
              <tr key={s.volunteer._id}>
                <td>
                  <strong>{s.volunteer.name}</strong>
                  <small>{s.department}</small>
                </td>
                <td>
                  {s.start ? date(s.start) : "No start date"}
                  {s.end && <small>until {date(s.end)}</small>}
                  {s.marked && <small>Marked by head</small>}
                </td>
                <td>
                  {s.rp}
                  {s.minRP != null && <small>of {s.minRP} needed</small>}
                </td>
                <td>
                  <Badge>{s.certificate ? "approved" : "pending"}</Badge>
                  <small>{s.reason || "Eligible"}</small>
                </td>
                <td>
                  <button
                    className="small secondary"
                    onClick={() => setMarking(s)}
                  >
                    Mark tenure
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows?.length === 0 && <Empty>No volunteers here.</Empty>}
      </section>
      {marking && (
        <Modal
          title={`Tenure · ${marking.volunteer.name}`}
          onClose={() => setMarking(null)}
        >
          <p className="muted">
            Leave a field blank to use the joining date or the department
            condition.
          </p>
          <form onSubmit={saveTenure}>
            <div className="form-grid">
              <label>
                Tenure start
                <input
                  name="start"
                  type="date"
                  defaultValue={marking.marked ? toInput(marking.start) : ""}
                />
              </label>
              <label>
                Months they will work
                <input
                  name="months"
                  type="number"
                  min="0"
                  max="120"
                  defaultValue={marking.marked ? (marking.months ?? "") : ""}
                />
              </label>
              <label>
                Minimum RP
                <input
                  name="minRP"
                  type="number"
                  min="0"
                  defaultValue={marking.marked ? (marking.minRP ?? "") : ""}
                />
              </label>
              <label>
                Certificate department
                <select name="department" defaultValue="">
                  <option value="">Default</option>
                  {marking.volunteer.departments?.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
            </div>
            <button>Save tenure</button>
          </form>
        </Modal>
      )}
    </>
  );
}

function IssueForm({ onIssued }) {
  const { data: members } = useData("/volunteers");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [memberId, setMemberId] = useState("");
  const selected = members?.find((m) => m._id === memberId);
  async function issue(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(
        "/program-certificates",
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      onIssued();
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not issue.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel profile-form" onSubmit={issue}>
      <h3>Issue a certificate</h3>
      <p className="muted">
        For recognition outside the automatic tenure certificate — for example
        Volunteer of the Month.
      </p>
      <label>
        Volunteer
        <select
          name="volunteer"
          required
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
        >
          <option value="">Select a volunteer</option>
          {members
            ?.filter((m) => m.role === "volunteer" && m.active)
            .map((m) => (
              <option key={m._id} value={m._id}>
                {m.name} · {m.departments?.join(", ")}
              </option>
            ))}
        </select>
      </label>
      <div className="form-grid">
        <label>
          Certificate for
          <input
            name="title"
            required
            maxLength={150}
            placeholder="Volunteer of the Month"
          />
        </label>
        <label>
          Period
          <input name="period" maxLength={60} placeholder="February 2026" />
        </label>
        <label>
          Department
          <select name="department" key={memberId}>
            {selected?.departments?.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label>
          Hours (optional)
          <input name="hours" type="number" min="0" step="0.5" />
        </label>
      </div>
      <label>
        Custom wording (optional)
        <textarea name="description" maxLength={600} />
        <small className="muted">{PLACEHOLDERS}</small>
      </label>
      {message && <p className="error">{message}</p>}
      <button disabled={busy}>Issue certificate</button>
    </form>
  );
}

function Format({ canSave }) {
  const { data, error, load } = useData("/certificate-template");
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState("manual");
  const [preview, setPreview] = usePreview();
  const [values, setValues] = useState(null);
  useEffect(() => {
    if (data) setValues(data.template);
  }, [data]);
  if (!values) return <State data={data} error={error} />;
  const field = (key, label, long) => (
    <label key={key}>
      {label}
      {long ? (
        <textarea
          value={values[key]}
          disabled={!canSave}
          maxLength={600}
          onChange={(e) => setValues({ ...values, [key]: e.target.value })}
        />
      ) : (
        <input
          value={values[key]}
          disabled={!canSave}
          maxLength={120}
          onChange={(e) => setValues({ ...values, [key]: e.target.value })}
        />
      )}
    </label>
  );
  async function save() {
    try {
      await api.put("/certificate-template", values);
      setMessage("Certificate format saved. New downloads use it.");
      load();
    } catch (e) {
      setMessage(e.response?.data?.message || "Could not save.");
    }
  }
  async function show() {
    try {
      const { data: blob } = await api.post(
        "/certificate-template/preview",
        { ...values, kind },
        { responseType: "blob" },
      );
      setPreview({ url: URL.createObjectURL(blob) });
    } catch {
      setMessage("Preview failed.");
    }
  }
  return (
    <section className="panel profile-form">
      <h3>Certificate format</h3>
      <p className="muted">
        The layout, seal, trustee signatures and registration footer follow the
        official certificate. Edit the wording here.{" "}
        {!canSave &&
          "Only founders, BOD, HR and department heads can save changes."}
      </p>
      {message && (
        <div className="toast" role="status" onClick={() => setMessage("")}>
          {message}
        </div>
      )}
      <div className="form-grid">
        {field("heading", "Heading")}
        {field("subheading", "Sub-heading")}
      </div>
      {field("presentedText", "Line above the name")}
      {field(
        "manualBody",
        "Issued certificates (e.g. Volunteer of the Month)",
        true,
      )}
      {field("tenureBody", "Tenure certificates", true)}
      {field("eventBody", "Event certificates", true)}
      <p className="muted tiny">{PLACEHOLDERS}</p>
      <div className="inline-actions">
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="manual">Preview issued</option>
          <option value="tenure">Preview tenure</option>
          <option value="event">Preview event</option>
        </select>
        <button className="secondary" type="button" onClick={show}>
          Preview
        </button>
        {canSave && (
          <>
            <button type="button" onClick={save}>
              Save format
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setValues(data.defaults)}
            >
              Reset to standard
            </button>
          </>
        )}
      </div>
      {preview && (
        <Preview preview={preview} onClose={() => setPreview(null)} />
      )}
    </section>
  );
}
