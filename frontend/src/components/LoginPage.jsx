import { useState } from "react";

import { loginUser, registerUser } from "../services/api";

export default function LoginPage({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const fn = isRegister ? registerUser : loginUser;
      const data = await fn(email, password);

      if (data.status === "success" && data.token) {
        onLogin(data.token, data.user);
      } else {
        setError(data.message || "Something went wrong");
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        "Unable to connect. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegister((prev) => !prev);
    setError("");
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="header-logo" data-status="ready" />
          <h1 className="login-title">Meeting RAG</h1>
          <p className="login-subtitle">
            {isRegister ? "Create your account" : "Sign in to continue"}
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder={isRegister ? "At least 6 characters" : "Your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button
            className="login-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <span className="spinner" />
            ) : isRegister ? (
              "Create Account"
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <p className="login-toggle">
          {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
          <button type="button" onClick={toggleMode}>
            {isRegister ? "Sign in" : "Register"}
          </button>
        </p>
      </div>
    </div>
  );
}
