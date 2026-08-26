import { useState } from "react";
import { colors, fontMono, statusKind } from "../lib/theme";
import { fmtDate } from "../lib/format";
import { useCreateDocument, useDocuments, useObsoleteDocument, useUpdateDocument } from "../lib/queries";
import { Card, Table, type Column } from "../components/Table";
import { Chip } from "../components/Chip";
import { Field, FormError, Modal, PrimaryButton, SecondaryButton, TextInput } from "../components/Modal";
import type { DocumentRow } from "../lib/types";

function DocumentModal({ initial, onClose }: { initial?: DocumentRow; onClose: () => void }) {
  const createDocument = useCreateDocument();
  const updateDocument = useUpdateDocument();
  const [docNo, setDocNo] = useState(initial?.doc_no ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [revision, setRevision] = useState(initial?.revision ?? "A");
  const [owner, setOwner] = useState(initial?.owner ?? "");
  const [effectiveDate, setEffectiveDate] = useState(initial?.effective_date ?? "");
  const [error, setError] = useState<string | null>(null);

  const busy = createDocument.isPending || updateDocument.isPending;

  async function handleSubmit() {
    setError(null);
    if (!docNo || !title || !owner) {
      setError("Doc No., title, and owner are required.");
      return;
    }
    try {
      if (initial) {
        await updateDocument.mutateAsync({ docNo: initial.doc_no, body: { title, revision, owner, effective_date: effectiveDate || null } });
      } else {
        await createDocument.mutateAsync({ doc_no: docNo, title, revision, owner, effective_date: effectiveDate || null });
      }
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Failed to save document.");
    }
  }

  return (
    <Modal
      title={initial ? `Edit ${initial.doc_no}` : "New Document"}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={handleSubmit} disabled={busy}>
            {busy ? "Saving…" : initial ? "Save Changes" : "Create"}
          </PrimaryButton>
        </>
      }
    >
      <FormError message={error} />
      <Field label="Doc No." hint={initial ? "Doc No. can't be changed after creation" : undefined}>
        <TextInput autoFocus={!initial} value={docNo} onChange={(e) => setDocNo(e.target.value)} placeholder="WI-AN-014" disabled={!!initial} />
      </Field>
      <Field label="Title">
        <TextInput autoFocus={!!initial} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Anodize Line Work Instruction" />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Revision">
          <TextInput value={revision} onChange={(e) => setRevision(e.target.value)} />
        </Field>
        <Field label="Effective Date" hint="Optional">
          <TextInput type="date" value={effectiveDate ?? ""} onChange={(e) => setEffectiveDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Owner">
        <TextInput value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Quality Manager" />
      </Field>
    </Modal>
  );
}

export function DocumentsPage() {
  const { data: docs, isLoading } = useDocuments();
  const obsoleteDocument = useObsoleteDocument();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<DocumentRow | null>(null);
  const [confirmObsoleteNo, setConfirmObsoleteNo] = useState<string | null>(null);

  const columns: Column<DocumentRow>[] = [
    { header: "Doc No.", first: true, render: (d) => <span style={{ fontFamily: fontMono, fontWeight: 600, color: colors.accentDefault }}>{d.doc_no}</span> },
    { header: "Title", render: (d) => <span style={{ fontWeight: 600 }}>{d.title}</span> },
    { header: "Rev", render: (d) => <span style={{ fontFamily: fontMono }}>{d.revision}</span> },
    { header: "Effective", render: (d) => <span style={{ fontFamily: fontMono, fontSize: 11 }}>{fmtDate(d.effective_date)}</span> },
    { header: "Owner", render: (d) => <span style={{ color: colors.textMuted }}>{d.owner}</span> },
    { header: "Status", render: (d) => <Chip kind={statusKind(d.status)} text={d.status} /> },
    {
      header: "",
      last: true,
      align: "right",
      render: (d) => (
        <span style={{ display: "inline-flex", gap: 8 }}>
          <button
            onClick={() => setEditing(d)}
            style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", background: "#FFF", color: colors.accentDefault, border: `1px solid ${colors.cardBorder}`, borderRadius: 4, cursor: "pointer" }}
          >
            Edit
          </button>
          {d.status !== "Obsolete" ? (
            confirmObsoleteNo === d.doc_no ? (
              <>
                <button
                  onClick={() => obsoleteDocument.mutate(d.doc_no, { onSuccess: () => setConfirmObsoleteNo(null) })}
                  style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", background: colors.red, color: "#FFF", border: "none", borderRadius: 4, cursor: "pointer" }}
                >
                  Confirm
                </button>
                <button onClick={() => setConfirmObsoleteNo(null)} style={{ fontSize: 11, padding: "4px 8px", background: "transparent", border: `1px solid ${colors.cardBorder}`, borderRadius: 4, cursor: "pointer" }}>
                  ✕
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmObsoleteNo(d.doc_no)}
                style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", background: "#FFF", color: colors.red, border: `1px solid ${colors.red}`, borderRadius: 4, cursor: "pointer" }}
              >
                Obsolete
              </button>
            )
          ) : null}
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
          + New Document
        </button>
      </div>
      <Card>{isLoading || !docs ? <div style={{ padding: 20, fontSize: 12 }}>Loading…</div> : <Table columns={columns} rows={docs} keyFn={(d) => d.doc_no} />}</Card>
      <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 10 }}>
        Travelers always link the revision that was current at job release — superseded revs stay retrievable for audit but can't be issued to new jobs.
        Marking a document Obsolete keeps the row (and its history) for audit; it just can't be issued to new jobs.
      </div>
      {showNew ? <DocumentModal onClose={() => setShowNew(false)} /> : null}
      {editing ? <DocumentModal initial={editing} onClose={() => setEditing(null)} /> : null}
    </section>
  );
}
