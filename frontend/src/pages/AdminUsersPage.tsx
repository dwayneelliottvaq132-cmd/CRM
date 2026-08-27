import { useState } from "react";
import { fmtDateTime } from "../lib/format";
import { useCreateUser, useEnrollPin, useUpdateUser, useUsers } from "../lib/queries";
import { Modal } from "../components/Modal";
import { FC, FcBanner, FcButton, FcCard, FcChip, FcField, FcInput, FcSelect, MONO, SANS } from "../components/FcKit";
import type { AppUser } from "../lib/types";

/** Styled in the Finishing Control language (see components/FcKit), not the original
 *  ERP theme. The generic Modal shell is reused as-is — it is chrome, not styling —
 *  with its contents built from the FC primitives. */

// Mirrors app.schemas.user.ROLES on the backend — the model stores role as free text
// (see app/models/user.py), so this list exists only to drive the dropdown; the
// authoritative check is server-side and rejects anything outside this set.
const ROLES = ["Quality Manager", "Operator", "Accountant", "Admin"];

function errorDetail(err: unknown): string | undefined {
  return (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
}

function ModalFooter({ onCancel, onSubmit, pending, label, pendingLabel }: {
  onCancel: () => void;
  onSubmit: () => void;
  pending: boolean;
  label: string;
  pendingLabel: string;
}) {
  return (
    <>
      <FcButton onClick={onCancel}>CANCEL</FcButton>
      <FcButton tone="primary" onClick={onSubmit} disabled={pending}>
        {pending ? pendingLabel : label}
      </FcButton>
    </>
  );
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const createUser = useCreateUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Operator");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!name || !email || !password) {
      setError("Name, email, and password are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    try {
      await createUser.mutateAsync({ name, email, role, password });
      onClose();
    } catch (err: unknown) {
      setError(errorDetail(err) ?? "Failed to create user.");
    }
  }

  return (
    <Modal
      title="New User"
      onClose={onClose}
      footer={<ModalFooter onCancel={onClose} onSubmit={handleSubmit} pending={createUser.isPending} label="CREATE" pendingLabel="CREATING…" />}
    >
      {error ? <FcBanner tone="error">{error}</FcBanner> : null}
      <FcField label="Name">
        <FcInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="J. Smith" />
      </FcField>
      <FcField label="Email">
        <FcInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="j.smith@surftec.com" />
      </FcField>
      <FcField label="Role">
        <FcSelect value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </FcSelect>
      </FcField>
      <FcField label="Initial password" hint="At least 8 characters. The user can change it from their profile.">
        <FcInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </FcField>
    </Modal>
  );
}

function EditUserModal({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const updateUser = useUpdateUser();
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const [isActive, setIsActive] = useState(user.is_active);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (newPassword && newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    try {
      await updateUser.mutateAsync({
        id: user.id,
        body: { name, role, is_active: isActive, ...(newPassword ? { new_password: newPassword } : {}) },
      });
      onClose();
    } catch (err: unknown) {
      setError(errorDetail(err) ?? "Failed to save user.");
    }
  }

  return (
    <Modal
      title={`Edit ${user.name}`}
      onClose={onClose}
      footer={<ModalFooter onCancel={onClose} onSubmit={handleSubmit} pending={updateUser.isPending} label="SAVE CHANGES" pendingLabel="SAVING…" />}
    >
      {error ? <FcBanner tone="error">{error}</FcBanner> : null}
      <FcField label="Name">
        <FcInput value={name} onChange={(e) => setName(e.target.value)} />
      </FcField>
      <FcField label="Email" hint="Email isn't editable here.">
        <FcInput value={user.email} disabled style={{ background: FC.wash, color: FC.muted }} />
      </FcField>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FcField label="Role">
          <FcSelect value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </FcSelect>
        </FcField>
        <FcField label="Status">
          <FcSelect value={isActive ? "active" : "inactive"} onChange={(e) => setIsActive(e.target.value === "active")}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </FcSelect>
        </FcField>
      </div>
      <FcField label="Reset password" hint="Leave blank to keep the current password.">
        <FcInput type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </FcField>
    </Modal>
  );
}

function PinModal({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const enrollPin = useEnrollPin();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!/^\d{4,8}$/.test(pin)) {
      setError("PIN must be 4-8 digits.");
      return;
    }
    try {
      await enrollPin.mutateAsync({ id: user.id, pin });
      onClose();
    } catch (err: unknown) {
      setError(errorDetail(err) ?? "Failed to enroll PIN.");
    }
  }

  return (
    <Modal
      title={`Shop-Floor PIN — ${user.name}`}
      onClose={onClose}
      footer={
        <ModalFooter
          onCancel={onClose}
          onSubmit={handleSubmit}
          pending={enrollPin.isPending}
          label={user.has_pin ? "ROTATE PIN" : "ENROL PIN"}
          pendingLabel="SAVING…"
        />
      }
    >
      {error ? <FcBanner tone="error">{error}</FcBanner> : null}
      <FcField label="PIN" hint="4-8 digits. Rejected if another operator already uses it.">
        <FcInput
          inputMode="numeric"
          style={{ width: 120, letterSpacing: "0.25em" }}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          maxLength={8}
        />
      </FcField>
    </Modal>
  );
}

const TH: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: 9,
  letterSpacing: "0.12em",
  color: FC.faint,
  textAlign: "left",
  padding: "9px 14px",
  borderBottom: `1px solid ${FC.line}`,
  whiteSpace: "nowrap",
};
const TD: React.CSSProperties = { padding: "9px 14px", borderBottom: `1px solid #F0F0F2`, verticalAlign: "middle" };

export function AdminUsersPage() {
  const { data: users, isLoading } = useUsers();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [pinTarget, setPinTarget] = useState<AppUser | null>(null);

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <FcButton tone="primary" onClick={() => setShowNew(true)}>+ NEW USER</FcButton>
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: FC.muted }}>
          {users ? `${users.length} account${users.length === 1 ? "" : "s"}` : ""}
        </div>
      </div>

      <FcCard>
        {isLoading || !users ? (
          <div style={{ padding: 20, fontFamily: MONO, fontSize: 11.5, color: FC.muted }}>Loading…</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={TH}>NAME</th>
                  <th style={TH}>EMAIL</th>
                  <th style={TH}>ROLE</th>
                  <th style={TH}>STATUS</th>
                  <th style={TH}>SHOP PIN</th>
                  <th style={TH}>LAST SIGN-IN</th>
                  <th style={{ ...TH, textAlign: "right" }} />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="fc-row">
                    <td style={{ ...TD, fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: FC.ink }}>{u.name}</td>
                    <td style={{ ...TD, fontFamily: MONO, fontSize: 10.5, color: FC.muted }}>{u.email}</td>
                    <td style={{ ...TD, fontFamily: MONO, fontSize: 10.5, color: FC.body }}>{u.role}</td>
                    <td style={TD}><FcChip kind={u.is_active ? "ready" : "grey"} text={u.is_active ? "active" : "inactive"} /></td>
                    <td style={TD}><FcChip kind={u.has_pin ? "ready" : "grey"} text={u.has_pin ? "enrolled" : "none"} /></td>
                    <td style={{ ...TD, fontFamily: MONO, fontSize: 10.5, color: FC.muted }}>{fmtDateTime(u.last_login_at)}</td>
                    <td style={{ ...TD, textAlign: "right", whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", gap: 6 }}>
                        <FcButton onClick={() => setPinTarget(u)}>PIN</FcButton>
                        <FcButton onClick={() => setEditing(u)}>EDIT</FcButton>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FcCard>

      <div style={{ fontFamily: MONO, fontSize: 10, color: FC.faint, marginTop: 12 }}>
        Deactivating an account blocks sign-in but keeps its sign-off history intact.
      </div>

      {showNew ? <CreateUserModal onClose={() => setShowNew(false)} /> : null}
      {editing ? <EditUserModal user={editing} onClose={() => setEditing(null)} /> : null}
      {pinTarget ? <PinModal user={pinTarget} onClose={() => setPinTarget(null)} /> : null}
    </section>
  );
}
