import { useState } from "react";
import { colors, fontMono } from "../lib/theme";
import { fmtDateTime } from "../lib/format";
import { useMyProfile, useUpdateMyProfile } from "../lib/queries";
import { Card } from "../components/Table";
import { Field, FormError, PrimaryButton, TextInput } from "../components/Modal";

export function ProfilePage() {
  const { data: me, isLoading } = useMyProfile();
  const updateMe = useUpdateMyProfile();

  const [name, setName] = useState("");
  const [initials, setInitials] = useState("");
  const [detailsTouched, setDetailsTouched] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsSaved, setDetailsSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  if (isLoading || !me) return <div style={{ padding: 20, fontSize: 12 }}>Loading…</div>;

  const effectiveName = detailsTouched ? name : me.name;
  const effectiveInitials = detailsTouched ? initials : me.initials;

  async function saveDetails() {
    setDetailsError(null);
    setDetailsSaved(false);
    try {
      await updateMe.mutateAsync({ name: effectiveName, initials: effectiveInitials });
      setDetailsSaved(true);
      setDetailsTouched(false);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setDetailsError(detail ?? "Failed to save profile.");
    }
  }

  async function savePassword() {
    setPasswordError(null);
    setPasswordSaved(false);
    if (!currentPassword || !newPassword) {
      setPasswordError("Current and new password are both required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation don't match.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    try {
      await updateMe.mutateAsync({ current_password: currentPassword, new_password: newPassword });
      setPasswordSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setPasswordError(detail ?? "Failed to change password.");
    }
  }

  return (
    <section style={{ maxWidth: 520 }}>
      <Card>
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${colors.rowBorder}` }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>My Profile</div>
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{me.email} · {me.role}</div>
        </div>
        <div style={{ padding: "18px 20px" }}>
          <FormError message={detailsError} />
          {detailsSaved ? <div style={{ fontSize: 12, color: colors.green, marginBottom: 14 }}>Profile updated.</div> : null}
          <Field label="Name">
            <TextInput value={effectiveName} onChange={(e) => { setDetailsTouched(true); setName(e.target.value); setDetailsSaved(false); }} />
          </Field>
          <Field label="Initials">
            <TextInput maxLength={4} value={effectiveInitials} onChange={(e) => { setDetailsTouched(true); setInitials(e.target.value.toUpperCase()); setDetailsSaved(false); }} />
          </Field>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <PrimaryButton onClick={saveDetails} disabled={updateMe.isPending || !detailsTouched}>
              {updateMe.isPending ? "Saving…" : "Save"}
            </PrimaryButton>
          </div>
          <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 16, fontFamily: fontMono }}>
            Account created {fmtDateTime(me.created_at)} · last sign-in {fmtDateTime(me.last_login_at)}
            {me.has_pin ? " · shop-floor PIN enrolled" : ""}
          </div>
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card>
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${colors.rowBorder}` }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Change Password</div>
        </div>
        <div style={{ padding: "18px 20px" }}>
          <FormError message={passwordError} />
          {passwordSaved ? <div style={{ fontSize: 12, color: colors.green, marginBottom: 14 }}>Password changed.</div> : null}
          <Field label="Current Password">
            <TextInput type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </Field>
          <Field label="New Password" hint="At least 8 characters.">
            <TextInput type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
          <Field label="Confirm New Password">
            <TextInput type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </Field>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <PrimaryButton onClick={savePassword} disabled={updateMe.isPending}>
              {updateMe.isPending ? "Saving…" : "Change Password"}
            </PrimaryButton>
          </div>
        </div>
      </Card>
    </section>
  );
}
