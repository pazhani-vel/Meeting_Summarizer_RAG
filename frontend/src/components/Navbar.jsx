export default function Navbar({
  status,
  user,
  onLogout,
  currentView,
  onNavigate,
  historyOpen,
  setHistoryOpen,
}) {
  return (
    <nav className="navbar">
      <div className="navbar-left">
        <a className="navbar-brand" href="#" onClick={(e) => { e.preventDefault(); onNavigate("landing"); }}>
          <div className="navbar-logo" data-status={status} />
          <span className="navbar-title">Meeting <span>RAG</span></span>
        </a>
        <div className="navbar-links">
          <button
            className={`navbar-link ${currentView === "landing" ? "active" : ""}`}
            onClick={() => onNavigate("landing")}
          >
            {Icons.dashboard} Dashboard
          </button>
          <button
            className={`navbar-link ${currentView === "workspace" ? "active" : ""}`}
            onClick={() => onNavigate("workspace")}
          >
            {Icons.upload} Workspace
          </button>
        </div>
      </div>
      <div className="navbar-right">
        <span className="navbar-email">{user?.email}</span>
        <button
          className={`btn-ghost ${historyOpen ? "active" : ""}`}
          onClick={() => setHistoryOpen((prev) => !prev)}
          title="Meeting history"
        >
          {Icons.clock} History
        </button>
        <button className="btn-ghost" onClick={onLogout}>
          Sign Out
        </button>
      </div>
    </nav>
  );
}

const Icons = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
    </svg>
  ),
  upload: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
};
