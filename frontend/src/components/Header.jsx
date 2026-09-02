import { useState } from "react";

export default function Header({ status }) {
  const [showToast, setShowToast] = useState(false);

  const handleSignOut = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <>
      <header className="header">
        <div className="header-left">
          <div className="header-logo" data-status={status} />
          <span className="header-title">Meeting RAG</span>
        </div>
        <button className="signout-btn" onClick={handleSignOut}>
          Sign Out
        </button>
      </header>
      {showToast && (
        <div className="toast">Sign out functionality coming soon</div>
      )}
    </>
  );
}
