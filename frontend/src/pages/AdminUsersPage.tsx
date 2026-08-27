import { useState } from "react";
import { colors, fontMono } from "../lib/theme";
import { fmtDateTime } from "../lib/format";
import { useCreateUser, useEnrollPin, useUpdateUser, useUsers } from "../lib/queries";
import { Card, Table, type Column } from "../components/Table";
import { Chip } from "../components/Chip";
import { Field, FormError, Modal, PrimaryButton, SecondaryButton, Select, TextInput } from "../components/Modal";
import type { AppUser } from "../lib/types";

// Mirrors app.schemas.user.ROLES on the backend — the model stores role as free text
// (see app/models/user.py), so this list exists only to drive the dropdown; the
// authoritative check is server-side and rejects anything outside this set.
const ROLES = ["Quality Manager", "Operator", "Accountant", "Admin"];

function errorDetail(err: unknown): string | undefined {
  return (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
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
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={handleSubmit} disabled={createUser.isPending}>
            {createUser.isPending ? "Creating…" : "Create"}
          </PrimaryButton>
        </>
      }
    >
      <FormError message={error} />
      <Field label="Name">
        <TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="J. Smith" />
      </Field>
      <Field label="Email">
        <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="j.smith@surftec.com" />
      </Field>
      <Field label="Role">
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
      </Field>
      <Field label="Initial Password" hint="At least 8 characters. The user can change it from their profile.">
        <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
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
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={handleSubmit} disabled={updateUser.isPending}>
            {updateUser.isPending ? "Saving…" : "Save Changes"}
          </PrimaryButton>
        </>
      }
    >
      <FormError message={error} />
      <Field label="Name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Email" hint="Email isn't editable here.">
        <TextInput value={user.email} disabled style={{ background: "#F2F3F1", color: colors.textMuted }} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Role">
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={isActive ? "active" : "inactive"} onChange={(e) => setIsActive(e.target.value === "active")}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
      </div>
      <Field label="Reset Password" hint="Leave blank to keep the current password.">
        <TextInput type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </Field>
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
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={handleSubmit} disabled={enrollPin.isPending}>
            {enrollPin.isPending ? "Saving…" : user.has_pin ? "Rotate PIN" : "Enroll PIN"}
          </PrimaryButton>
        </>
      }
    >
      <FormError message={error} />
      <Field label="PIN" hint="4-8 digits. Rejected if another operator already uses it.">
        <TextInput inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} maxLength={8} />
      </Field>
    </Modal>
  );
}

export function AdminUsersPage() {
  const { data: users, isLoading } = useUsers();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [pinTarget, setPinTarget] = useState<AppUser | null>(null);

  const columns: Column<AppUser>[] = [
    { header: "Name", first: true, render: (u) => <span style={{ fontWeight: 600 }}>{u.name}</span> },
    { header: "Email", render: (u) => <span style={{ fontSize: 12, color: colors.textMuted }}>{u.email}</span> },
    { header: "Role", render: (u) => <span>{u.role}</span> },
    { header: "Status", render: (u) => <Chip kind={u.is_active ? "good" : "neutral"} text={u.is_active ? "Active" : "Inactive"} /> },
    { header: "Shop PIN", render: (u) => <Chip kind={u.has_pin ? "good" : "neutral"} text={u.has_pin ? "Enrolled" : "None"} /> },
    { header: "Last Sign-In", render: (u) => <span style={{ fontFamily: fontMono, fontSize: 11, color: colors.textMuted }}>{fmtDateTime(u.last_login_at)}</span> },
    {
      header: "",
      last: true,
      align: "right",
      render: (u) => (
        <span style={{ display: "inline-flex", gap: 8 }}>
          <button
            onClick={() => setPinTarget(u)}
            style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", background: "#FFF", color: colors.accentDefault, border: `1px solid ${colors.cardBorder}`, borderRadius: 4, cursor: "pointer" }}
          >
            PIN
          </button>
          <button
            onClick={() => setEditing(u)}
            style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", background: "#FFF", color: colors.accentDefault, border: `1px solid ${colors.cardBorder}`, borderRadius: 4, cursor: "pointer" }}
          >
            Edit
          </button>
        </span>
      ),
    },
  ];

  return (
    <section>
      <div style={{ display: "flex", marginBottom: 14 }}>
        <button
          onClick={() => setShowNew(true)}
          style={{ background: colors.accentDefault, color: "#FFFFFF", border: "none", borderRadius: 5, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          + New User
        </button>
      </div>
      <Card>{isLoading || !users ? <div style={{ padding: 20, fontSize: 12 }}>Loading…</div> : <Table columns={columns} rows={users} keyFn={(u) => String(u.id)} />}</Card>
      {showNew ? <CreateUserModal onClose={() => setShowNew(false)} /> : null}
      {editing ? <EditUserModal user={editing} onClose={() => setEditing(null)} /> : null}
      {pinTarget ? <PinModal user={pinTarget} onClose={() => setPinTarget(null)} /> : null}
    </section>
  );
}
