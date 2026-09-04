"use client";

import { useState, useEffect } from "react";
import { useAuth, useUser } from "../../../lib/auth";
import { Users, UserPlus, Save, Check, Trash2, KeyRound } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { AppNav } from "../../../components/AppNav";
import { Ticket } from "../../../components/Ticket";

const OWNER_ROLES = ["manager", "supervisor", "operator", "inventory", "sales", "accountant", "auditor", "admin"];
const MANAGER_ROLES = ["supervisor", "operator", "inventory", "sales", "accountant", "auditor", "admin"];

export default function AdminUsersPage() {
  const { getToken, signOut } = useAuth();
  const { user } = useUser();
  const myRole = user?.publicMetadata?.role as string | undefined;
  const canAdminister = myRole === "owner" || myRole === "manager";
  const roleOptions = myRole === "owner" ? OWNER_ROLES : MANAGER_ROLES;

  const [users, setUsers] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("supervisor");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<"idle" | "saving" | "error">("idle");
  const [passwordError, setPasswordError] = useState("");

  const loadUsers = async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const list = await apiFetch("/admin/users", token);
      setUsers(list);
    } catch (e: any) {
      // A non-admin hitting this is expected (403) — the page already
      // hides the UI for them, this just avoids a console-scary failure.
    }
    setLoaded(true);
  };

  useEffect(() => { if (canAdminister) loadUsers(); else setLoaded(true); }, [canAdminister]);

  const provision = async () => {
    if (!name.trim() || !email.trim() || password.length < 12) {
      setErrorMsg("Enter a name, email, and temporary password of at least 12 characters");
      setStatus("error");
      return;
    }
    setStatus("saving"); setErrorMsg("");
    try {
      const token = await getToken();
      if (!token) throw new Error("not authenticated");
      await apiFetch("/admin/users", token, {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, role }),
      });
      setName("");
      setEmail("");
      setPassword("");
      await loadUsers();
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1800);
    } catch (e: any) {
      setErrorMsg(e.message ?? "Failed to create credentials");
      setStatus("error");
    }
  };

  const revoke = async (id: string, emailAddress: string) => {
    if (!window.confirm(`Revoke login access for ${emailAddress}? Their historical records will be retained.`)) return;
    const token = await getToken();
    if (!token) return;
    try {
      await apiFetch(`/admin/users/${id}`, token, { method: "DELETE" });
      await loadUsers();
    } catch (e: any) {
      setErrorMsg(e.message ?? "Failed to revoke credentials");
      setStatus("error");
    }
  };

  const changePassword = async () => {
    if (newPassword.length < 12 || newPassword !== confirmPassword) {
      setPasswordError(newPassword.length < 12 ? "New password must be at least 12 characters" : "New passwords do not match");
      setPasswordStatus("error");
      return;
    }
    setPasswordStatus("saving"); setPasswordError("");
    try {
      const token = await getToken();
      if (!token) throw new Error("not authenticated");
      await apiFetch("/auth/change-password", token, {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      await signOut();
      window.location.assign("/");
    } catch (e: any) {
      setPasswordError(e.message ?? "Failed to change password");
      setPasswordStatus("error");
    }
  };

  if (!loaded) {
    return (
      <div className="app-shell">
        <div className="stamp">
          <div><div className="stamp-title">TEAM ACCESS</div></div>
          <AppNav />
        </div>
        <div className="ticket"><div className="ticket-notch left" /><div className="ticket-notch right" /><p>Loading…</p></div>
      </div>
    );
  }

  if (!canAdminister) {
    return (
      <div className="app-shell">
        <div className="stamp">
          <div><div className="stamp-title">TEAM ACCESS</div></div>
          <AppNav />
        </div>
        <div className="ticket">
          <div className="ticket-notch left" /><div className="ticket-notch right" />
          <p style={{ margin: 0 }}>This page is only visible to owners and managers. Ask one for access if you need it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="stamp">
        <div>
          <div className="stamp-title">TEAM ACCESS</div>
          <div className="stamp-sub">STONEOS · VEDAM GRANITES</div>
        </div>
        <AppNav />
      </div>

      <Ticket icon={UserPlus} title="Create Login" subtitle="Only owners and managers can issue StoneOS credentials" accent="moss">
        <div className="grid">
          <label className="field">
            <span className="field-label">Name</span>
            <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Employee name" />
          </label>
          <label className="field" style={{ gridColumn: "span 2" }}>
            <span className="field-label">Login Email</span>
            <input className="field-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </label>
          <label className="field">
            <span className="field-label">Temporary Password</span>
            <input className="field-input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 12 characters" />
          </label>
          <label className="field">
            <span className="field-label">Role</span>
            <select className="field-input" value={role} onChange={(e) => setRole(e.target.value)}>
              {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        </div>
        {errorMsg && <div style={{ color: "var(--rust)", fontSize: 12.5, marginTop: 10 }}>{errorMsg}</div>}
        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
          <button className={`primary-btn ${status === "saved" ? "saved" : ""}`} onClick={provision} disabled={status === "saving"}>
            {status === "saved" ? <Check size={15} /> : <Save size={15} />}
            {status === "saving" ? "Creating…" : status === "saved" ? "Created" : "Create Login"}
          </button>
        </div>
      </Ticket>

      <Ticket icon={KeyRound} title="Change My Password" subtitle="Changing it signs you out on every device">
        <div className="grid">
          <label className="field"><span className="field-label">Current Password</span><input className="field-input" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></label>
          <label className="field"><span className="field-label">New Password</span><input className="field-input" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 12 characters" /></label>
          <label className="field"><span className="field-label">Confirm New Password</span><input className="field-input" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label>
        </div>
        {passwordError && <div style={{ color: "var(--rust)", fontSize: 12.5, marginTop: 10 }}>{passwordError}</div>}
        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}><button className="primary-btn" onClick={changePassword} disabled={passwordStatus === "saving" || !currentPassword}>{passwordStatus === "saving" ? "Changing…" : "Change Password"}</button></div>
      </Ticket>

      <Ticket icon={Users} title={`Team (${users.length})`}>
        {users.length === 0 ? (
          <p style={{ color: "#857c6c", fontSize: 13 }}>No teammates provisioned yet.</p>
        ) : (
          <table className="list-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Access</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontFamily: "Space Grotesk" }}>{u.name}</td>
                  <td style={{ fontFamily: "Space Grotesk" }}>{u.email}</td>
                  <td><span className="badge invoiced">{u.role}</span></td>
                  <td>{u.active ? "Active" : "Inactive"}</td>
                  <td>
                    {u.active && u.role !== "owner" ? (
                      <button className="secondary-btn" onClick={() => revoke(u.id, u.email)}>
                        <Trash2 size={14} /> Revoke
                      </button>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Ticket>
    </div>
  );
}
