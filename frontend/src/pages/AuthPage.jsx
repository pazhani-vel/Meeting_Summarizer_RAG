import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

export default function AuthPage() {
  const { login, register } = useAuth();

  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const errs = {};
    if (!email.trim()) errs.email = "Email is required.";
    else if (!EMAIL_RE.test(email.trim())) errs.email = "Enter a valid email address.";
    if (!password) errs.password = "Password is required.";
    else if (password.length < MIN_PASSWORD) errs.password = `Password must be at least ${MIN_PASSWORD} characters.`;
    if (tab === "register" && password !== confirm) errs.confirm = "Passwords do not match.";
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const fn = tab === "register" ? register : login;
      await fn(email.trim(), password);
    } catch (err) {
      setServerError(err.response?.data?.message || err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (next) => {
    setTab(next);
    setErrors({});
    setServerError("");
  };

  const isRegister = tab === "register";

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="navbar-logo" data-status="ready" />
          <h1 className="login-title">Meeting RAG</h1>
          <p className="login-subtitle">
            {isRegister ? "Create your account" : "Sign in to continue"}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === "login" ? "active" : ""}`}
            onClick={() => switchTab("login")}
            type="button"
          >Sign In</button>
          <button
            className={`auth-tab ${tab === "register" ? "active" : ""}`}
            onClick={() => switchTab("register")}
            type="button"
          >Register</button>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((p) => ({ ...p, email: undefined })); }}
              className={errors.email ? "field-error" : ""}
              autoComplete="email"
            />
            {errors.email && <span className="field-error-msg">{errors.email}</span>}
          </div>

          <div className="login-field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              placeholder={`At least ${MIN_PASSWORD} characters`}
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((p) => ({ ...p, password: undefined })); }}
              className={errors.password ? "field-error" : ""}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
            {errors.password && <span className="field-error-msg">{errors.password}</span>}
          </div>

          {isRegister && (
            <div className="login-field">
              <label htmlFor="auth-confirm">Confirm password</label>
              <input
                id="auth-confirm"
                type="password"
                placeholder="Re-enter password"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); if (errors.confirm) setErrors((p) => ({ ...p, confirm: undefined })); }}
                className={errors.confirm ? "field-error" : ""}
                autoComplete="new-password"
              />
              {errors.confirm && <span className="field-error-msg">{errors.confirm}</span>}
            </div>
          )}

          {serverError && <p className="login-error">{serverError}</p>}

          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : isRegister ? "Create Account" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
