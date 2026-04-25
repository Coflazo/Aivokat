import { useState, useEffect, useRef } from "react";
import logoUrl from "./lou-wordmark.svg";

// ─── Design tokens (Siemens Palette) ──────────────────────────────────────────
const C = {
  sidebar: "#004C54", // Sidebar Dark Teal
  sidebarActive: "rgba(255,255,255,0.12)",
  sidebarBorder: "rgba(255,255,255,0.08)",
  teal: "#00646E", // Primary Siemens Teal
  tealLight: "#004a52", // Darker hover state
  tealXLight: "#E6F0F2",
  green: "#00D7A0", // Accent Siemens Green
  greenLight: "#E6FAF5",
  amber: "#F5A623", // Warning Amber
  amberLight: "#FEF6E9",
  red: "#D0021B", // Red line Red
  redLight: "#FAE6E8",
  bg: "#F4F6F7", // Background
  surface: "#FFFFFF",
  border: "#E1E4E5",
  text: "#191c1d", // On-surface
  textMuted: "#3f484a", // On-surface variant
  textLight: "#6f797a", // Outline
};

// ─── Keyframe styles injected once ───────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: ${C.bg}; color: ${C.text}; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes slideRight {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
  }

  .anim-fadeUp { animation: fadeUp 0.4s ease both; }
  .anim-fadeIn { animation: fadeIn 0.3s ease both; }

  .card {
    background: ${C.surface};
    border: 1px solid ${C.border};
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    transition: box-shadow 0.2s, transform 0.2s;
  }
  .card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }

  .btn-primary {
    background: ${C.teal};
    color: #fff;
    border: none;
    border-radius: 8px;
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    transition: background 0.15s, transform 0.1s;
  }
  .btn-primary:hover { background: ${C.tealLight}; }
  .btn-primary:active { transform: scale(0.97); }

  .btn-ghost {
    background: transparent;
    color: ${C.teal};
    border: 1px solid ${C.border};
    border-radius: 8px;
    font-family: 'Inter', sans-serif;
    font-weight: 500;
    font-size: 14px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    transition: background 0.15s;
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
  .badge-amber  { background: ${C.amberLight}; color: ${C.amber}; }
  .badge-red    { background: ${C.redLight};   color: ${C.red}; }
  .badge-teal   { background: ${C.tealXLight}; color: ${C.teal}; }
  .badge-gray   { background: #F3F4F6; color: #374151; }

  .progress-bar {
    height: 6px;
    border-radius: 3px;
    background: ${C.border};
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    border-radius: 3px;
    background: ${C.teal};
    transform-origin: left;
    animation: slideRight 0.8s cubic-bezier(0.16,1,0.3,1) both;
  }

  .table-row {
    display: grid;
    border-bottom: 1px solid #F3F4F6;
    transition: background 0.15s;
  }
  .table-row:hover { background: #FAFAFA; }

  .clause-item {
    padding: 12px 16px;
    border-bottom: 1px solid ${C.border};
    cursor: pointer;
    transition: background 0.15s;
    border-radius: 6px;
    margin-bottom: 2px;
  }
  .clause-item:hover { background: ${C.bg}; }
  .clause-item.active { background: ${C.tealXLight}; border-left: 3px solid ${C.teal}; }
  .clause-item.conflict { border-left: 3px solid ${C.amber}; }

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
    transition: background 0.15s, color 0.15s;
    border: none;
    background: transparent;
    width: calc(100% - 16px);
    text-align: left;
  }
  .sidebar-link:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,1); }
  .sidebar-link.active { background: rgba(255,255,255,0.14); color: #fff; font-weight: 600; }

  .drag-zone {
    border: 2px dashed #C8D6D8;
    border-radius: 8px;
    padding: 48px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    transition: border-color 0.2s, background 0.2s;
    cursor: pointer;
  }
  .drag-zone:hover, .drag-zone.over { border-color: ${C.teal}; background: ${C.tealXLight}; }

  .step-circle {
    width: 36px; height: 36px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 700;
    flex-shrink: 0;
  }
  .step-active   { background: ${C.teal}; color: #fff; }
  .step-complete { background: ${C.green}; color: #fff; }
  .step-pending  { background: #E5E7EB; color: #6B7280; }

  .radio-opt {
    border: 1px solid ${C.border};
    border-radius: 8px;
    padding: 14px 16px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }
  .radio-opt.selected { border-color: ${C.teal}; background: ${C.tealXLight}; }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 3px; }
`;

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

function Sidebar({ page, setPage }) {
  return (
    <aside style={{
      position: "fixed", left: 0, top: 0,
      width: 220, height: "100vh",
      background: C.sidebar,
      display: "flex", flexDirection: "column",
      zIndex: 50, borderRight: `1px solid ${C.sidebarBorder}`,
    }}>
      <div style={{ padding: "24px 20px 20px", borderBottom: `1px solid ${C.sidebarBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={logoUrl} alt="LOU Legal" style={{ height: 42, width: "auto", filter: "brightness(0) invert(1)" }} />
        </div>
      </div>

      <nav style={{ flex: 1, padding: "12px 0", display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV_ITEMS.map(item => (
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
          <div style={{ overflow: "hidden" }}>
            <div style={{ color: "#fff", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Klaus Müller</div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 11 }}>Senior Counsel</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function TopBar({ page }) {
  const label = NAV_ITEMS.find(n => n.id === page)?.label || "";
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
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button style={{
          width: 34, height: 34, borderRadius: "50%",
          background: C.bg, border: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
        }}>
          <Icon name="notifications" size={18} style={{ color: C.textMuted }} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.textMuted }}>Dr. A. Schmidt</span>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: C.teal, display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 12, fontWeight: 700,
          }}>AS</div>
        </div>
      </div>
    </header>
  );
}

function PageWrap({ children }) {
  return (
    <main style={{
      marginLeft: 220, paddingTop: 60,
      minHeight: "100vh", background: C.bg,
    }}>
      <div style={{ padding: "32px 32px 48px", maxWidth: 1300, margin: "0 auto" }}>
        {children}
      </div>
    </main>
  );
}

const PLAYBOOKS = [
  { id: 1, status: "approved", title: "NDA Playbook — ACME Corp", desc: "Standard NDA framework for ACME Corp partnership 2024.", clauses: 14, date: "Oct 12, 2023" },
  { id: 2, status: "in_review", title: "Master Services — Global Logistics", desc: "Complex logistics agreement covering multi-region shipping and handling protocols.", clauses: 42, date: "Yesterday" },
  { id: 3, status: "draft", title: "NDA Playbook — Supplier X", desc: "Preliminary draft for new supplier onboarding process in the DACH region.", clauses: 12, date: "Oct 05, 2023" },
];

const STATUS_CONFIG = {
  approved: { label: "Approved", cls: "badge-green" },
  in_review: { label: "In Review", cls: "badge-amber" },
  draft: { label: "Draft", cls: "badge-gray" },
};

function HomePage({ setPage }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
        <div style={{ animation: "fadeUp 0.4s ease both" }}>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Main / My Playbooks</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: C.text }}>My Playbooks</h1>
        </div>
        <button className="btn-primary" onClick={() => setPage("upload")}>
          <Icon name="add" size={17} /> New Playbook
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {PLAYBOOKS.map((pb, i) => {
          const sc = STATUS_CONFIG[pb.status];
          return (
            <div key={pb.id} className="card" style={{ padding: 20, animationDelay: `${i * 70}ms`, animation: "fadeUp 0.4s ease both" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <span className={`badge ${sc.cls}`}>{sc.label}</span>
                <button style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, padding: 2 }}>
                  <Icon name="more_horiz" size={18} />
                </button>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 8, lineHeight: 1.4 }}>{pb.title}</h3>
              <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5, marginBottom: 16 }}>{pb.desc}</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 14 }}>
                  <span style={{ fontSize: 12, color: C.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon name="segment" size={14} /> {pb.clauses} Clauses
                  </span>
                  <span style={{ fontSize: 12, color: C.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon name="calendar_today" size={14} /> {pb.date}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function UploadPage({ setPage }) {
  const [step, setStep] = useState(1);
  const [over, setOver] = useState(false);
  const [file, setFile] = useState({ name: "Siemens_GTC_Playbook_v2.4.docx", size: "2.4 MB" });
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  function analyze() {
    setAnalyzing(true);
    setStep(2);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 18;
      if (p >= 100) { p = 100; clearInterval(iv); setTimeout(() => { setStep(3); setPage("verification"); }, 600); }
      setProgress(Math.min(100, p));
    }, 250);
  }

  const steps = ["Upload File", "Analyze", "Verify Clauses"];

  return (
    <>
      <div style={{ animation: "fadeUp 0.4s ease both", marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: C.teal, marginBottom: 6 }}>Upload Playbook</h1>
        <p style={{ color: C.textMuted, fontSize: 14 }}>Import your legal standards and guidelines to initialize automated clause verification.</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 40, animation: "fadeUp 0.4s ease both", animationDelay: "80ms" }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div className={`step-circle ${i + 1 < step ? "step-complete" : i + 1 === step ? "step-active" : "step-pending"}`}>
                {i + 1 < step ? <Icon name="check" size={16} /> : i + 1}
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: i + 1 === step ? C.teal : C.textMuted, whiteSpace: "nowrap" }}>{i + 1}. {s}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 120, height: 2, background: i + 1 < step ? C.green : C.border, margin: "0 8px", marginBottom: 24 }} />
            )}
          </div>
        ))}
      </div>
      <div className="card" style={{ padding: 40, animation: "fadeUp 0.4s ease both", animationDelay: "160ms" }}>
        <div
          className={`drag-zone ${over ? "over" : ""}`}
          onDragOver={e => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={e => { e.preventDefault(); setOver(false); }}
        >
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.tealXLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="cloud_upload" size={28} style={{ color: C.teal }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 4 }}>Drag & drop your file here</div>
            <div style={{ fontSize: 13, color: C.textMuted }}>Supported formats: .xlsx, .docx, .pdf (Max 25MB)</div>
          </div>
          <button style={{ fontSize: 13, color: C.teal, fontWeight: 600, border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            or browse files <Icon name="open_in_new" size={14} />
          </button>
        </div>
        {file && (
          <div style={{ marginTop: 24, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="description" size={18} style={{ color: C.teal }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{file.name}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{file.size} · Ready to analyze</div>
              </div>
            </div>
            <button style={{ background: "none", border: "none", cursor: "pointer", color: C.red }} onClick={() => setFile(null)}>
              <Icon name="delete" size={18} />
            </button>
          </div>
        )}
        {analyzing && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>Analyzing clauses…</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.teal }}>{Math.round(progress)}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%`, transition: "width 0.25s ease" }} />
            </div>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}>
          <button className="btn-primary" style={{ fontSize: 15, padding: "12px 36px" }} onClick={analyze} disabled={!file || analyzing}>
            {analyzing ? <><Icon name="hourglass_empty" size={17} /> Processing…</> : <><Icon name="analytics" size={17} /> Analyze Playbook</>}
          </button>
        </div>
      </div>
    </>
  );
}

const CLAUSES_VER = [
  { id: "01", name: "Type of NDA", why: "Defines scope of confidentiality obligations between parties.", pref: "MUTUAL", fallback: "UNILATERAL (SIEMENS)", redline: "UNILATERAL (THIRD PARTY)" },
  { id: "02", name: "Marking of Confidential Information", why: "Requirement to label data as 'Confidential' to be protected.", pref: "NO MARKING REQUIRED", fallback: "WRITTEN CONFIRMATION", redline: "STRICT MARKING" },
  { id: "03", name: "Intellectual Property Rights", why: "Protects ownership of underlying technologies and trade secrets.", pref: "OWNERSHIP RETAINED", fallback: "LIMITED USAGE LICENSE", redline: "JOINT OWNERSHIP" },
  { id: "04", name: "Choice of Law", why: "Jurisdiction and governing law for dispute resolution.", pref: "GERMAN LAW", fallback: "SWISS/UK LAW", redline: "US STATE LAW" },
  { id: "05", name: "Period of Confidentiality", why: "Duration after termination that info remains protected.", pref: "5+ YEARS", fallback: "3 YEARS", redline: "1 YEAR" },
  { id: "06", name: "Permitted Purpose", why: "Specific use cases for shared confidential information.", pref: "SPECIFIC PROJECT", fallback: "EVAL BUSINESS OPT", redline: "GENERAL PURPOSE" },
  { id: "07", name: "Return or Destroy", why: "Obligation to handle data upon termination.", pref: "SIEMENS OPTION", fallback: "DESTROY ONLY", redline: "NO OBLIGATION" },
];

function VerificationPage({ setPage }) {
  const [checkedRows, setCheckedRows] = useState(
    CLAUSES_VER.reduce((acc, c, i) => ({ ...acc, [c.id]: i < 5 }), {})
  );

  const toggleCheck = (id) => setCheckedRows(prev => ({ ...prev, [id]: !prev[id] }));
  const handleEdit = (id) => alert(`Editing clause ${id}`);

  const total = CLAUSES_VER.length;
  const verifiedCount = Object.values(checkedRows).filter(Boolean).length;
  const pct = (verifiedCount / total) * 100;

  return (
    <>
      <div className="card" style={{ padding: 24, animation: "fadeUp 0.35s ease both" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>Clause Verification</h1>
            <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>{verifiedCount} / {total} clauses verified</div>
          </div>
          <button className="btn-primary" onClick={() => setPage("knowledge")} style={{ opacity: verifiedCount < total ? 0.5 : 1 }}>
            Proceed to Overview <Icon name="arrow_forward" size={16} />
          </button>
        </div>
        <div className="progress-bar" style={{ marginBottom: 24 }}>
          <div className="progress-fill" style={{ width: `${pct}%`, transition: "width 0.3s ease" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.textMuted, marginBottom: 20 }}>
          <span style={{ color: C.green, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            <Icon name="check" size={14} /> 2. Analyze
          </span>
          <Icon name="arrow_forward" size={14} />
          <span style={{ color: C.teal, fontWeight: 600 }}>3. Verify Clauses</span>
        </div>
        <div className="table-row" style={{ gridTemplateColumns: "40px 2fr 3fr 1.4fr 1.4fr 1.4fr 80px", padding: "8px 12px", background: C.bg, borderRadius: "7px 7px 0 0" }}>
          {["#", "CLAUSE NAME", "WHY IT MATTERS", "PREFERRED POSITION", "FALLBACK", "RED LINE", "ACTIONS"].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: "0.06em" }}>{h}</div>
          ))}
        </div>
        {CLAUSES_VER.map((c, i) => (
          <div key={c.id} className="table-row" style={{ gridTemplateColumns: "40px 2fr 3fr 1.4fr 1.4fr 1.4fr 80px", padding: "14px 12px", animationDelay: `${i * 40}ms`, animation: "fadeUp 0.35s ease both" }}>
            <div style={{ fontSize: 12, color: C.textLight, fontFamily: "DM Mono, monospace", marginTop: 2 }}>{c.id}</div>
            <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{c.name}</div>
            <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.4 }}>{c.why}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{c.pref}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>{c.fallback}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>{c.redline}</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => toggleCheck(c.id)} style={{ background: checkedRows[c.id] ? C.greenLight : C.bg, border: `1px solid ${checkedRows[c.id] ? C.green : C.border}`, borderRadius: 6, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s ease" }} title="Verify Clause">
                <Icon name="check" size={15} style={{ color: checkedRows[c.id] ? C.green : C.textLight }} />
              </button>
              <button onClick={() => handleEdit(c.id)} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} title="Edit Clause">
                <Icon name="edit" size={15} style={{ color: C.textMuted }} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const KO_CLAUSES = [
  { id: "01", name: "Confidentiality Scope", desc: "Standard non-disclosure obligations for both parties regarding proprietary information.", ok: true },
  { id: "11", name: "Liability Limitation", desc: "Aggregated liability cap set at 2.5x annual contract value, excluding gross negligence.", ok: false, conflict: true },
  { id: "04", name: "Dispute Resolution", desc: "Multi-step dispute resolution including mediation before arbitration.", ok: true },
  { id: "12", name: "Warranty Term", desc: "18-month warranty period from delivery date.", ok: false, conflict: true },
];

function KnowledgePage() {
  const [selected, setSelected] = useState(KO_CLAUSES.find(c => c.conflict));
  const [radioVal, setRadioVal] = useState("override");
  const conflicts = KO_CLAUSES.filter(c => c.conflict).length;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, animation: "fadeUp 0.35s ease both" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>Clause Knowledge Overview</h1>
          <p style={{ color: C.textMuted, fontSize: 14, marginTop: 4 }}>Review and reconcile playbook clauses with the existing knowledge graph.</p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden", animation: "fadeUp 0.4s ease both", animationDelay: "80ms" }}>
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Playbook Clauses ({KO_CLAUSES.length})
            </div>
            <span className="badge badge-amber">{conflicts} conflicts</span>
          </div>
          <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 260px)" }}>
            {KO_CLAUSES.map((c, i) => (
              <div key={c.id} className={`clause-item ${selected?.id === c.id ? "active" : ""} ${c.conflict ? "conflict" : ""}`} style={{ animationDelay: `${i * 30}ms`, animation: "fadeUp 0.35s ease both" }} onClick={() => setSelected(c)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: c.conflict ? 600 : 500, color: c.conflict ? C.amber : C.text }}>Clause {c.id}: {c.name}</div>
                  {c.ok && !c.conflict && <Icon name="check_circle" size={16} style={{ color: C.green }} />}
                  {c.conflict && <Icon name="warning" size={16} style={{ color: C.amber }} />}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, lineHeight: 1.4 }}>{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
        {selected && (
          <div className="card" style={{ padding: 28, animation: "fadeIn 0.3s ease both", display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              {selected.conflict && (
                <div style={{ width: 36, height: 36, borderRadius: 8, background: C.amberLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name="warning" size={20} style={{ color: C.amber }} />
                </div>
              )}
              <div><h2 style={{ fontSize: 20, fontWeight: 700 }}>Clause {selected.id}: {selected.name}</h2></div>
            </div>
            {selected.conflict && (
              <div style={{ background: "#FFF8F0", border: `1px solid #FED7AA`, borderRadius: 8, padding: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="info" size={16} style={{ color: C.amber }} /> Knowledge Graph Inconsistency
                </div>
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>
                  The proposed liability cap of <strong style={{ color: C.red }}>2.5x ACV</strong> conflicts with the established organizational standard for Tier 2 vendors, which is currently set at <strong style={{ color: C.teal }}>1.5x ACV</strong>.
                </div>
              </div>
            )}
            {selected.conflict && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Reconciliation Suggestions</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { val: "align", title: "Align with Knowledge Graph", desc: "Update playbook clause to match the 1.5x ACV standard. High compliance, low risk." },
                    { val: "override", title: "Override and Add to Knowledge Graph", desc: "Validate this as a new accepted variance for special project tiers. Updates the graph for future use." },
                  ].map(opt => (
                    <div key={opt.val} className={`radio-opt ${radioVal === opt.val ? "selected" : ""}`} onClick={() => setRadioVal(opt.val)}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${radioVal === opt.val ? C.teal : C.border}`, background: radioVal === opt.val ? C.teal : "transparent", flexShrink: 0, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {radioVal === opt.val && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{opt.title}</div>
                        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{opt.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function GraphPage() {
  return (
    <div className="card" style={{ padding: 40, textAlign: "center", animation: "fadeUp 0.4s ease both" }}>
      <Icon name="account_tree" size={48} style={{ color: C.teal, marginBottom: 16 }} />
      <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text }}>Knowledge Graph</h2>
      <p style={{ color: C.textMuted, marginTop: 8 }}>Interactive graph view placeholder.</p>
    </div>
  );
}

const NAV_ITEMS = [
  { id: "home", label: "Home", icon: "home" },
  { id: "upload", label: "Upload Playbook", icon: "upload_file" },
  { id: "verification", label: "Clause Verification", icon: "fact_check" },
  { id: "knowledge", label: "Knowledge Overview", icon: "description" },
  { id: "graph", label: "Knowledge Graph", icon: "account_tree" },
];

export default function App() {
  const [page, setPage] = useState("home");
  useEffect(() => { document.title = "LOU Legal Workspace"; }, []);
  const pages = {
    home: <HomePage setPage={setPage} />,
    upload: <UploadPage setPage={setPage} />,
    verification: <VerificationPage setPage={setPage} />,
    knowledge: <KnowledgePage />,
    graph: <GraphPage />,
  };
  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      <Sidebar page={page} setPage={setPage} />
      <TopBar page={page} />
      <PageWrap key={page}>{pages[page]}</PageWrap>
    </>
  );
}
