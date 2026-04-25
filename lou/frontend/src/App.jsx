import { useEffect, useMemo, useState } from "react";
import logoUrl from "./lou-wordmark.svg";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

const C = {
  sidebar: "#004C54",
  sidebarBorder: "rgba(255,255,255,0.08)",
  teal: "#00646E",
  tealLight: "#004a52",
  tealXLight: "#E6F0F2",
  green: "#00D7A0",
  greenLight: "#E6FAF5",
  amber: "#F5A623",
  amberLight: "#FEF6E9",
  red: "#D0021B",
  redLight: "#FAE6E8",
  purple: "#4A2076",
  bg: "#F4F6F7",
  surface: "#FFFFFF",
  border: "#E1E4E5",
  text: "#191c1d",
  textMuted: "#3f484a",
  textLight: "#6f797a",
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: ${C.bg}; color: ${C.text}; }
  button, input, textarea, select { font-family: inherit; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideRight {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
  }
  .card {
    background: ${C.surface};
    border: 1px solid ${C.border};
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  }
  .btn-primary {
    background: ${C.teal};
    color: #fff;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 20px;
  }
  .btn-primary:hover { background: ${C.tealLight}; }
  .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
  .btn-ghost {
    background: transparent;
    color: ${C.teal};
    border: 1px solid ${C.border};
    border-radius: 8px;
    font-weight: 500;
    font-size: 14px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 20px;
  }
  .btn-ghost:hover { background: #EAECEE; }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .badge-green  { background: ${C.greenLight}; color: #008764; }
  .badge-amber  { background: ${C.amberLight}; color: #9A6400; }
  .badge-red    { background: ${C.redLight}; color: ${C.red}; }
  .badge-teal   { background: ${C.tealXLight}; color: ${C.teal}; }
  .badge-gray   { background: #F3F4F6; color: #374151; }
  .progress-bar { height: 6px; border-radius: 3px; background: ${C.border}; overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 3px; background: ${C.teal}; transform-origin: left; animation: slideRight .6s cubic-bezier(.16,1,.3,1) both; }
  .sidebar-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    margin: 0 8px;
    border-radius: 7px;
    color: rgba(255,255,255,0.75);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    background: transparent;
    width: calc(100% - 16px);
    text-align: left;
  }
  .sidebar-link:hover { background: rgba(255,255,255,0.08); color: #fff; }
  .sidebar-link.active { background: rgba(255,255,255,0.14); color: #fff; font-weight: 600; }
  .drag-zone {
    border: 2px dashed #C8D6D8;
    border-radius: 8px;
    padding: 46px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    cursor: pointer;
  }
  .drag-zone:hover { border-color: ${C.teal}; background: ${C.tealXLight}; }
  .table-row {
    display: grid;
    border-bottom: 1px solid #F3F4F6;
    transition: background .15s;
  }
  .table-row:hover { background: #FAFAFA; }
  .clause-item {
    padding: 12px 16px;
    border-bottom: 1px solid ${C.border};
    cursor: pointer;
    border-radius: 6px;
    margin-bottom: 2px;
  }
  .clause-item:hover { background: ${C.bg}; }
  .clause-item.active { background: ${C.tealXLight}; border-left: 3px solid ${C.teal}; }
  .clause-item.conflict { border-left: 3px solid ${C.amber}; }
  .field-label {
    font-size: 10px;
    font-weight: 700;
    color: ${C.textLight};
    letter-spacing: .06em;
    text-transform: uppercase;
    margin-bottom: 5px;
  }
  .form-field {
    width: 100%;
    border: 1px solid ${C.border};
    border-radius: 8px;
    padding: 11px 12px;
    color: ${C.text};
    background: #fff;
    font-size: 14px;
  }
  .node-label {
    font-size: 11px;
    font-weight: 700;
    fill: ${C.text};
    pointer-events: none;
  }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 3px; }
`;

const NAV_ITEMS = [
  { id: "home", label: "Home", icon: "home" },
  { id: "upload", label: "Upload Playbook", icon: "upload_file" },
  { id: "verification", label: "Clause Verification", icon: "fact_check" },
  { id: "knowledge", label: "Knowledge Overview", icon: "description" },
  { id: "graph", label: "Knowledge Graph", icon: "account_tree" },
];

function Icon({ name, size = 20, style = {} }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: size,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
        ...style,
      }}
    >
      {name}
    </span>
  );
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) {
    let detail = `Request failed with ${response.status}`;
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch {
      // The response did not include JSON.
    }
    throw new Error(detail);
  }
  return response.json();
}

function openIssues(playbook) {
  return (playbook?.clauses || []).flatMap((clause) =>
    (clause.issues || [])
      .filter((issue) => !issue.resolved_at)
      .map((issue) => ({ ...issue, clause }))
  );
}

function statusBadge(status) {
  if (status === "published") return { label: "Published", cls: "badge-green" };
  if (status === "draft") return { label: "Draft", cls: "badge-gray" };
  return { label: status || "Unknown", cls: "badge-amber" };
}

function Sidebar({ page, setPage, activePlaybook }) {
  return (
    <aside style={{
      position: "fixed", left: 0, top: 0,
      width: 220, height: "100vh",
      background: C.sidebar,
      display: "flex", flexDirection: "column",
      zIndex: 50, borderRight: `1px solid ${C.sidebarBorder}`,
    }}>
      <div style={{ padding: "24px 20px 20px", borderBottom: `1px solid ${C.sidebarBorder}` }}>
        <img src={logoUrl} alt="LOU Legal" style={{ height: 42, width: "auto", filter: "brightness(0) invert(1)" }} />
        <div style={{ color: "rgba(255,255,255,.68)", fontSize: 11, marginTop: 10, lineHeight: 1.4 }}>
          {activePlaybook ? activePlaybook.name : "No playbook selected"}
        </div>
      </div>

      <nav style={{ flex: 1, padding: "12px 0", display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`sidebar-link ${page === item.id ? "active" : ""}`}
            onClick={() => setPage(item.id)}
          >
            <Icon name={item.icon} size={18} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div style={{ padding: "16px 12px", borderTop: `1px solid ${C.sidebarBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: C.tealLight, display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0,
          }}>KM</div>
          <div>
            <div style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>Klaus Muller</div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 11 }}>Senior Counsel</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function TopBar({ page, onRefresh, loading }) {
  const label = NAV_ITEMS.find((item) => item.id === page)?.label || "";
  return (
    <header style={{
      position: "fixed", top: 0, left: 220, right: 0, height: 60,
      background: C.surface, borderBottom: `1px solid ${C.border}`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 28px", zIndex: 40,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>Legal Workspace</span>
        <span style={{ color: C.textLight, fontSize: 14 }}>/</span>
        <span style={{ fontWeight: 600, fontSize: 14, color: C.teal }}>{label}</span>
      </div>
      <button className="btn-ghost" onClick={onRefresh} disabled={loading}>
        <Icon name="refresh" size={17} />
        {loading ? "Refreshing..." : "Refresh"}
      </button>
    </header>
  );
}

function PageWrap({ children }) {
  return (
    <main style={{ marginLeft: 220, paddingTop: 60, minHeight: "100vh", background: C.bg }}>
      <div style={{ padding: "32px 32px 48px", maxWidth: 1320, margin: "0 auto" }}>
        {children}
      </div>
    </main>
  );
}

function HomePage({ playbooks, activeId, setActiveId, setPage }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
        <div style={{ animation: "fadeUp .4s ease both" }}>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Main / My Playbooks</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: C.text }}>My Playbooks</h1>
        </div>
        <button className="btn-primary" onClick={() => setPage("upload")}>
          <Icon name="add" size={17} /> New Playbook
        </button>
      </div>

      {playbooks.length === 0 ? (
        <EmptyState title="No playbooks yet" body="Upload the Siemens sample playbook to create the first governed API module." action="Upload playbook" onAction={() => setPage("upload")} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {playbooks.map((pb, index) => {
            const badge = statusBadge(pb.status);
            const issues = openIssues(pb).length;
            return (
              <button
                key={pb.playbook_id}
                className="card"
                onClick={() => { setActiveId(pb.playbook_id); setPage("verification"); }}
                style={{
                  padding: 20,
                  animationDelay: `${index * 70}ms`,
                  animation: "fadeUp .4s ease both",
                  textAlign: "left",
                  cursor: "pointer",
                  borderColor: activeId === pb.playbook_id ? C.teal : C.border,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <span className={`badge ${badge.cls}`}>{badge.label}</span>
                  <span style={{ fontSize: 12, color: C.textLight }}>v{pb.version}</span>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8, lineHeight: 1.4 }}>{pb.name}</h3>
                <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5, marginBottom: 16 }}>{pb.description || "No description."}</p>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: C.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon name="segment" size={14} /> {pb.clauses.length} clauses
                  </span>
                  <span style={{ fontSize: 12, color: issues ? C.amber : C.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon name={issues ? "warning" : "check_circle"} size={14} /> {issues} open issues
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

function UploadPage({ setPage, onUploaded }) {
  const [file, setFile] = useState(null);
  const [owner, setOwner] = useState("Peter");
  const [name, setName] = useState("NDA Playbook");
  const [description, setDescription] = useState("Siemens-style negotiation playbook");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  async function submit() {
    if (!file) {
      setError("Choose an .xlsx playbook first.");
      return;
    }
    setBusy(true);
    setError("");
    setProgress(18);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("owner", owner);
      form.append("name", name);
      form.append("description", description);
      setProgress(48);
      const result = await api("/playbooks/upload", { method: "POST", body: form });
      setProgress(82);
      const analyzed = await api(`/analysis/playbook/${result.playbook.playbook_id}`, { method: "POST" });
      setProgress(100);
      onUploaded(analyzed);
      setTimeout(() => setPage("verification"), 250);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div style={{ animation: "fadeUp .4s ease both", marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: C.teal, marginBottom: 6 }}>Upload Playbook</h1>
        <p style={{ color: C.textMuted, fontSize: 14 }}>Import a Siemens-style spreadsheet and turn it into a draft playbook API.</p>
      </div>

      <div className="card" style={{ padding: 36, animation: "fadeUp .4s ease both" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 22 }}>
          <label>
            <div className="field-label">Playbook name</div>
            <input className="form-field" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            <div className="field-label">Owner</div>
            <input className="form-field" value={owner} onChange={(event) => setOwner(event.target.value)} />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            <div className="field-label">Description</div>
            <textarea className="form-field" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
        </div>

        <label className="drag-zone">
          <input type="file" accept=".xlsx" style={{ display: "none" }} onChange={(event) => setFile(event.target.files?.[0] || null)} />
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.tealXLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="cloud_upload" size={28} style={{ color: C.teal }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>
              {file ? file.name : "Choose the playbook spreadsheet"}
            </div>
            <div style={{ fontSize: 13, color: C.textMuted }}>Expected format: Clause #, Clause Name, Why It Matters, Preferred, Fallback 1, Fallback 2, Red Line, Escalation.</div>
          </div>
        </label>

        {busy && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>Uploading and running first logic check...</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.teal }}>{progress}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%`, transition: "width .25s ease" }} />
            </div>
          </div>
        )}

        {error && <p style={{ color: C.red, fontSize: 13, marginTop: 16 }}>{error}</p>}

        <div style={{ display: "flex", justifyContent: "center", marginTop: 30 }}>
          <button className="btn-primary" style={{ fontSize: 15, padding: "12px 36px" }} onClick={submit} disabled={!file || busy}>
            {busy ? <><Icon name="hourglass_empty" size={17} /> Processing...</> : <><Icon name="analytics" size={17} /> Create API draft</>}
          </button>
        </div>
      </div>
    </>
  );
}

function VerificationPage({ playbook, setPage, onPlaybookUpdate }) {
  const [checkedRows, setCheckedRows] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!playbook) return;
    setCheckedRows((current) => {
      const next = { ...current };
      playbook.clauses.forEach((clause) => {
        if (!(clause.clause_id in next)) next[clause.clause_id] = clause.analysis_status === "clean";
      });
      return next;
    });
  }, [playbook]);

  if (!playbook) {
    return <EmptyState title="Upload a playbook first" body="Clause verification needs a draft playbook." action="Upload playbook" onAction={() => setPage("upload")} />;
  }

  async function runAnalysis() {
    setBusy(true);
    setError("");
    try {
      const updated = await api(`/analysis/playbook/${playbook.playbook_id}`, { method: "POST" });
      onPlaybookUpdate(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const total = playbook.clauses.length;
  const verifiedCount = playbook.clauses.filter((clause) => checkedRows[clause.clause_id]).length;
  const pct = total ? (verifiedCount / total) * 100 : 0;
  const issues = openIssues(playbook);

  return (
    <div className="card" style={{ padding: 24, animation: "fadeUp .35s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Clause Verification</h1>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>{verifiedCount} / {total} clauses manually checked</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-ghost" onClick={runAnalysis} disabled={busy}>
            <Icon name="rule" size={16} />
            {busy ? "Checking..." : "Run logic analysis"}
          </button>
          <button className="btn-primary" onClick={() => setPage(issues.length ? "knowledge" : "graph")}>
            {issues.length ? "Review suggestions" : "Continue to graph"} <Icon name="arrow_forward" size={16} />
          </button>
        </div>
      </div>
      <div className="progress-bar" style={{ marginBottom: 20 }}>
        <div className="progress-fill" style={{ width: `${pct}%`, transition: "width .3s ease" }} />
      </div>
      {error && <p style={{ color: C.red, fontSize: 13, marginBottom: 14 }}>{error}</p>}
      {issues.length > 0 && (
        <div style={{ background: C.amberLight, border: "1px solid #FED7AA", borderRadius: 8, padding: 12, marginBottom: 18, color: "#7A4B00", fontSize: 13 }}>
          Lou found one review suggestion. Handle it in Knowledge Overview before pushing the API.
        </div>
      )}

      <div className="table-row" style={{ gridTemplateColumns: "44px 1.3fr 1.4fr 1.3fr 1.2fr 1.2fr 1.4fr 70px", padding: "8px 12px", background: C.bg, borderRadius: "7px 7px 0 0" }}>
        {["#", "Clause", "Why it matters", "Preferred", "Fallback 1", "Fallback 2", "Red line", "Check"].map((header) => (
          <div key={header} style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: ".06em", textTransform: "uppercase" }}>{header}</div>
        ))}
      </div>
      {playbook.clauses.map((clause, index) => (
        <div key={clause.clause_id} className="table-row" style={{ gridTemplateColumns: "44px 1.3fr 1.4fr 1.3fr 1.2fr 1.2fr 1.4fr 70px", padding: "14px 12px", animationDelay: `${index * 35}ms`, animation: "fadeUp .35s ease both" }}>
          <div style={{ fontSize: 12, color: C.textLight, fontFamily: "DM Mono, monospace" }}>{clause.clause_number}</div>
          <div style={{ fontWeight: 700, fontSize: 13, color: clause.analysis_status === "issue" ? C.red : clause.analysis_status === "warning" ? "#9A6400" : C.text }}>{clause.clause_name}</div>
          <CellText>{clause.why_it_matters}</CellText>
          <CellText strong>{clause.preferred_position}</CellText>
          <CellText>{clause.fallback_1 || "-"}</CellText>
          <CellText>{clause.fallback_2 || "-"}</CellText>
          <CellText>{clause.red_line || "-"}</CellText>
          <button
            onClick={() => setCheckedRows((current) => ({ ...current, [clause.clause_id]: !current[clause.clause_id] }))}
            style={{ background: checkedRows[clause.clause_id] ? C.greenLight : C.bg, border: `1px solid ${checkedRows[clause.clause_id] ? C.green : C.border}`, borderRadius: 6, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            title="Mark checked"
          >
            <Icon name="check" size={15} style={{ color: checkedRows[clause.clause_id] ? "#008764" : C.textLight }} />
          </button>
        </div>
      ))}
    </div>
  );
}

function KnowledgePage({ playbook, setPage, onPlaybookUpdate }) {
  const issues = openIssues(playbook);
  const [selectedId, setSelectedId] = useState(null);
  const [busyIssueId, setBusyIssueId] = useState(null);
  const selected = issues.find((issue) => issue.id === selectedId) || issues[0] || null;

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  if (!playbook) {
    return <EmptyState title="Upload a playbook first" body="Knowledge overview needs a draft or published playbook." action="Upload playbook" onAction={() => setPage("upload")} />;
  }

  async function handleIssue(issue, action) {
    setBusyIssueId(issue.id);
    try {
      const updated = await api(`/analysis/issues/${issue.id}/${action}`, { method: "POST" });
      onPlaybookUpdate(updated);
      setSelectedId(null);
    } finally {
      setBusyIssueId(null);
    }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, animation: "fadeUp .35s ease both" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>Clause Knowledge Overview</h1>
          <p style={{ color: C.textMuted, fontSize: 14, marginTop: 4 }}>Review Lou's issue queue before the playbook becomes an API.</p>
        </div>
        <button className="btn-primary" onClick={() => setPage("graph")}>
          Continue to graph <Icon name="arrow_forward" size={16} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden", animation: "fadeUp .4s ease both" }}>
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: ".06em", textTransform: "uppercase" }}>Review queue</div>
            <span className={`badge ${issues.length ? "badge-amber" : "badge-green"}`}>{issues.length} open</span>
          </div>
          <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 260px)" }}>
            {playbook.clauses.map((clause) => {
              const issue = issues.find((item) => item.clause.clause_id === clause.clause_id);
              return (
                <div key={clause.clause_id} className={`clause-item ${selected?.clause.clause_id === clause.clause_id ? "active" : ""} ${issue ? "conflict" : ""}`} onClick={() => issue && setSelectedId(issue.id)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: issue ? 700 : 500, color: issue ? C.amber : C.text }}>Clause {clause.clause_number}: {clause.clause_name}</div>
                    <Icon name={issue ? "warning" : "check_circle"} size={16} style={{ color: issue ? C.amber : C.green }} />
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, lineHeight: 1.4 }}>{clause.why_it_matters}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ padding: 28, animation: "fadeUp .35s ease both", minHeight: 360 }}>
          {selected ? (
            <>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 18 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: selected.severity === "critical" ? C.redLight : C.amberLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name="warning" size={20} style={{ color: selected.severity === "critical" ? C.red : C.amber }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700 }}>{selected.clause.clause_name}</h2>
                  <span className={`badge ${selected.severity === "critical" ? "badge-red" : "badge-amber"}`}>{selected.severity}</span>
                </div>
              </div>
              <div style={{ background: selected.severity === "critical" ? C.redLight : C.amberLight, border: `1px solid ${selected.severity === "critical" ? "#F3B5BC" : "#FED7AA"}`, borderRadius: 8, padding: 16, marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{selected.issue_type}</div>
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{selected.explanation}</div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <div className="field-label">Proposed fix</div>
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, fontSize: 13, lineHeight: 1.55, color: C.textMuted }}>{selected.proposed_fix || "No automatic fix available."}</div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn-ghost" disabled={busyIssueId === selected.id} onClick={() => handleIssue(selected, "reject")}>
                  <Icon name="close" size={16} /> Reject
                </button>
                <button className="btn-primary" disabled={!selected.proposed_fix || busyIssueId === selected.id} onClick={() => handleIssue(selected, "accept-fix")}>
                  <Icon name="check" size={16} /> Accept fix
                </button>
              </div>
            </>
          ) : (
            <EmptyState title="No open suggestions" body="The playbook is ready for visual inspection in the graph." action="Continue to graph" onAction={() => setPage("graph")} compact />
          )}
        </div>
      </div>
    </>
  );
}

function GraphPage({ playbook, setPage, onPlaybookUpdate }) {
  const [brain, setBrain] = useState(null);
  const [selected, setSelected] = useState(null);
  const [committedBy, setCommittedBy] = useState("Peter");
  const [comment, setComment] = useState("");
  const [committed, setCommitted] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!playbook) return;
    let cancelled = false;
    api(`/playbooks/${playbook.playbook_id}/brain`)
      .then((data) => { if (!cancelled) { setBrain(data); setSelected(data.nodes[0] || null); } })
      .catch((err) => { if (!cancelled) setMessage(err.message); });
    return () => { cancelled = true; };
  }, [playbook]);

  if (!playbook) {
    return <EmptyState title="Upload a playbook first" body="The graph shows the current playbook as a mini brain." action="Upload playbook" onAction={() => setPage("upload")} />;
  }

  function commitDraft() {
    if (!committedBy.trim() || !comment.trim()) {
      setMessage("Add a committer name and comment before committing.");
      return;
    }
    setCommitted(true);
    setMessage("Committed locally. Push when this playbook should become an API.");
  }

  async function pushApi() {
    if (!committed) {
      setMessage("Commit before pushing to the company brain.");
      return;
    }
    setBusy(true);
    try {
      const result = await api(`/playbooks/${playbook.playbook_id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ committed_by: committedBy, comment }),
      });
      onPlaybookUpdate(result.playbook);
      setMessage(`Pushed ${result.mega_brain_entries} clauses to the company brain. Commit ${result.commit_hash}.`);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  const layout = useMemo(() => computeGraphLayout(brain), [brain]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 330px", gap: 24 }}>
      <div className="card" style={{ padding: 24, minHeight: 650, animation: "fadeUp .4s ease both" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800 }}>Knowledge Graph</h2>
            <p style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>Each clause is a mini hierarchy: preferred, fallbacks, red line, escalation.</p>
          </div>
          <span className={`badge ${playbook.status === "published" ? "badge-green" : "badge-gray"}`}>{playbook.status}</span>
        </div>
        {brain ? (
          <svg viewBox="0 0 980 590" width="100%" height="590" role="img" aria-label="Playbook mini brain">
            <rect x="0" y="0" width="980" height="590" rx="12" fill="#F9FBFB" />
            {layout.edges.map((edge, index) => {
              const source = layout.points.get(edge.source);
              const target = layout.points.get(edge.target);
              if (!source || !target) return null;
              return (
                <line
                  key={`${edge.source}-${edge.target}-${index}`}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={edge.relationship === "playbook_hierarchy" ? "rgba(0,100,110,.22)" : "rgba(63,72,74,.12)"}
                  strokeWidth={edge.relationship === "playbook_hierarchy" ? 1.5 : 1}
                />
              );
            })}
            {layout.nodes.map((node) => {
              const point = layout.points.get(node.id);
              if (!point) return null;
              const isSelected = selected?.id === node.id;
              const radius = node.node_type === "clause" ? 13 : 8;
              return (
                <g key={node.id} onClick={() => setSelected(node)} style={{ cursor: "pointer" }}>
                  <circle cx={point.x} cy={point.y} r={isSelected ? radius + 5 : radius + 2} fill={isSelected ? "rgba(0,100,110,.14)" : "transparent"} />
                  <circle cx={point.x} cy={point.y} r={radius} fill={node.color} stroke="#fff" strokeWidth="2" />
                  <text x={point.x} y={point.y + radius + 14} textAnchor="middle" className="node-label">{node.node_type === "clause" ? node.label : node.label}</text>
                </g>
              );
            })}
          </svg>
        ) : (
          <EmptyState title="Loading graph" body="Lou is computing the playbook brain." compact />
        )}
      </div>

      <aside className="card" style={{ padding: 22, animation: "fadeUp .4s ease both" }}>
        <div style={{ marginBottom: 20 }}>
          <div className="field-label">Selected node</div>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>{selected?.label || "Select a node"}</h2>
          <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.55 }}>{selected?.text || selected?.clause?.preferred_position || "Click a graph node to inspect it."}</p>
          {selected && <span className="badge badge-teal" style={{ marginTop: 12 }}>{selected.node_type}</span>}
        </div>

        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 18 }}>
          <div className="field-label">Publish control</div>
          <label style={{ display: "block", marginBottom: 12 }}>
            <div className="field-label">Committer</div>
            <input className="form-field" value={committedBy} onChange={(event) => setCommittedBy(event.target.value)} />
          </label>
          <label style={{ display: "block", marginBottom: 12 }}>
            <div className="field-label">Commit comment</div>
            <textarea className="form-field" rows={4} value={comment} onChange={(event) => { setComment(event.target.value); setCommitted(false); }} placeholder="Explain why this playbook is ready." />
          </label>
          <div style={{ display: "grid", gap: 10 }}>
            <button className="btn-ghost" disabled={busy || committed} onClick={commitDraft}>
              <Icon name="commit" size={16} /> {committed ? "Committed" : "Commit"}
            </button>
            <button className="btn-primary" disabled={busy || !committed} onClick={pushApi}>
              <Icon name="send" size={16} /> {busy ? "Pushing..." : "Push to API"}
            </button>
          </div>
          {message && <p style={{ color: message.includes("Pushed") || message.includes("Committed") ? C.teal : C.red, fontSize: 12, lineHeight: 1.5, marginTop: 12 }}>{message}</p>}
        </div>
      </aside>
    </div>
  );
}

function CellText({ children, strong = false }) {
  return <div style={{ fontSize: 12, fontWeight: strong ? 700 : 500, color: strong ? C.text : C.textMuted, lineHeight: 1.45 }}>{children}</div>;
}

function EmptyState({ title, body, action, onAction, compact = false }) {
  return (
    <div className="card" style={{ padding: compact ? 24 : 40, textAlign: "center", animation: "fadeUp .4s ease both" }}>
      <Icon name="info" size={compact ? 30 : 46} style={{ color: C.teal, marginBottom: 14 }} />
      <h2 style={{ fontSize: compact ? 18 : 22, fontWeight: 800 }}>{title}</h2>
      <p style={{ color: C.textMuted, margin: "8px auto 18px", maxWidth: 520, lineHeight: 1.5 }}>{body}</p>
      {action && <button className="btn-primary" onClick={onAction}>{action}</button>}
    </div>
  );
}

function computeGraphLayout(brain) {
  const nodes = brain?.nodes || [];
  const edges = brain?.edges || [];
  const points = new Map();
  const clauseNodes = nodes.filter((node) => node.node_type === "clause");
  const centerX = 490;
  const centerY = 295;
  const rx = 330;
  const ry = 205;

  clauseNodes.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(1, clauseNodes.length) - Math.PI / 2;
    const x = centerX + Math.cos(angle) * rx;
    const y = centerY + Math.sin(angle) * ry;
    points.set(node.id, { x, y });

    const children = nodes.filter((candidate) => candidate.id.startsWith(`${node.id}:`));
    children.forEach((child, childIndex) => {
      const childAngle = angle + (childIndex - 2) * 0.15;
      const distance = 48 + childIndex * 13;
      points.set(child.id, {
        x: x + Math.cos(childAngle) * distance,
        y: y + Math.sin(childAngle) * distance,
      });
    });
  });

  return { nodes, edges, points };
}

export default function App() {
  const [page, setPage] = useState("home");
  const [playbooks, setPlaybooks] = useState([]);
  const [activeId, setActiveId] = useState(() => window.localStorage.getItem("lou.frontend.activePlaybookId") || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activePlaybook = playbooks.find((playbook) => playbook.playbook_id === activeId) || playbooks[0] || null;

  useEffect(() => {
    document.title = "LOU Legal Workspace";
    refreshPlaybooks();
  }, []);

  useEffect(() => {
    if (activePlaybook?.playbook_id) {
      window.localStorage.setItem("lou.frontend.activePlaybookId", activePlaybook.playbook_id);
      if (activeId !== activePlaybook.playbook_id) setActiveId(activePlaybook.playbook_id);
    }
  }, [activePlaybook, activeId]);

  async function refreshPlaybooks() {
    setLoading(true);
    setError("");
    try {
      const data = await api("/playbooks");
      setPlaybooks(data);
      if (!activeId && data[0]) setActiveId(data[0].playbook_id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function upsertPlaybook(playbook) {
    setPlaybooks((current) => {
      const without = current.filter((item) => item.playbook_id !== playbook.playbook_id);
      return [playbook, ...without];
    });
    setActiveId(playbook.playbook_id);
  }

  const pages = {
    home: <HomePage playbooks={playbooks} activeId={activeId} setActiveId={setActiveId} setPage={setPage} />,
    upload: <UploadPage setPage={setPage} onUploaded={upsertPlaybook} />,
    verification: <VerificationPage playbook={activePlaybook} setPage={setPage} onPlaybookUpdate={upsertPlaybook} />,
    knowledge: <KnowledgePage playbook={activePlaybook} setPage={setPage} onPlaybookUpdate={upsertPlaybook} />,
    graph: <GraphPage playbook={activePlaybook} setPage={setPage} onPlaybookUpdate={upsertPlaybook} />,
  };

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      <Sidebar page={page} setPage={setPage} activePlaybook={activePlaybook} />
      <TopBar page={page} onRefresh={refreshPlaybooks} loading={loading} />
      <PageWrap>
        {error && <div style={{ background: C.redLight, border: "1px solid #F3B5BC", color: C.red, borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13 }}>{error}</div>}
        {pages[page]}
      </PageWrap>
    </>
  );
}
