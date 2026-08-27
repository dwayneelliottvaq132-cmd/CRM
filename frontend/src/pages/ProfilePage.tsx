import { useState } from "react";
import { fmtDateTime } from "../lib/format";
import { useMyProfile, useUpdateMyProfile } from "../lib/queries";
import { FC, FcBanner, FcButton, FcCard, FcCardHeader, FcChip, FcField, FcInput, MONO } from "../components/FcKit";

/** Styled in the Finishing Control language (see components/FcKit), not the original
 *  ERP theme — these are new screens, so they follow the new design rather than the
 *  one the pre-existing pages use. The page still renders inside the ERP shell. */
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

  if (isLoading || !me) return <div style={{ fontFamily: MONO, fontSize: 11.5, color: FC.muted }}>Loading…</div>;

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
    <section style={{ maxWidth: 560 }}>
      <FcCard>
        <FcCardHeader title="My Profile" sub={`${me.email} · ${me.role}`} />
        <div style={{ padding: "16px 18px" }}>
          {detailsError ? <FcBanner tone="error">{detailsError}</FcBanner> : null}
          {detailsSaved ? <FcBanner tone="ok">Profile updated.</FcBanner> : null}
          <FcField label="Name">
            <FcInput
              value={effectiveName}
              onChange={(e) => {
                setDetailsTouched(true);
                setName(e.target.value);
                setDetailsSaved(false);
              }}
            />
          </FcField>
          <FcField label="Initials" hint="Shown on travelers and sign-off records.">
            <FcInput
              maxLength={4}
              style={{ width: 90 }}
              value={effectiveInitials}
              onChange={(e) => {
                setDetailsTouched(true);
                setInitials(e.target.value.toUpperCase());
                setDetailsSaved(false);
              }}
            />
          </FcField>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <FcButton tone="primary" onClick={saveDetails} disabled={updateMe.isPending || !detailsTouched}>
              {updateMe.isPending ? "SAVING…" : "SAVE"}
            </FcButton>
          </div>

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${FC.line}`, display: "flex", gap: 22, flexWrap: "wrap" }}>
            <Meta label="Account created" value={fmtDateTime(me.created_at)} />
            <Meta label="Last sign-in" value={fmtDateTime(me.last_login_at)} />
            <div>
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", color: FC.faint, marginBottom: 4 }}>SHOP PIN</div>
              <FcChip kind={me.has_pin ? "ready" : "grey"} text={me.has_pin ? "enrolled" : "none"} />
            </div>
          </div>
        </div>
      </FcCard>

      <div style={{ height: 14 }} />

      <FcCard>
        <FcCardHeader title="Change Password" sub="Your current password is required to set a new one." />
        <div style={{ padding: "16px 18px" }}>
          {passwordError ? <FcBanner tone="error">{passwordError}</FcBanner> : null}
          {passwordSaved ? <FcBanner tone="ok">Password changed.</FcBanner> : null}
          <FcField label="Current password">
            <FcInput type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </FcField>
          <FcField label="New password" hint="At least 8 characters.">
            <FcInput type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </FcField>
          <FcField label="Confirm new password">
            <FcInput type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </FcField>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <FcButton tone="primary" onClick={savePassword} disabled={updateMe.isPending}>
              {updateMe.isPending ? "SAVING…" : "CHANGE PASSWORD"}
            </FcButton>
          </div>
        </div>
      </FcCard>
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", color: FC.faint, marginBottom: 4 }}>{label.toUpperCase()}</div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: FC.body }}>{value}</div>
    </div>
  );
}
