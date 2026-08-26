import { Fragment, useState } from "react";
import { colors } from "../lib/theme";
import { useDocuments, useEquipment, useTanks } from "../lib/queries";
import type { RequiredParameter } from "../lib/types";
import { Select, SecondaryButton, TextInput } from "./Modal";
import { AttachmentGallery } from "./AttachmentGallery";

export interface EditableStep {
  id?: number; // present once this step has been saved (RoutingStepOut) — absent for a brand-new unsaved row
  seq: number;
  name: string;
  parameters: string;
  work_instruction_doc_no: string | null;
  tank_id: string | null;
  equipment_id: string | null;
  is_final_inspect: boolean;
  required_parameters: RequiredParameter[];
}

const blankParameter: RequiredParameter = {
  key: "", label: "", kind: "numeric", unit: "",
  target_min: null, target_max: null, target_text: null,
  auto_computed: false, required: true,
};

function renumber(steps: EditableStep[]): EditableStep[] {
  return steps.map((s, i) => ({ ...s, seq: (i + 1) * 10 }));
}

export function RoutingStepEditor({
  steps,
  onChange,
  readOnly = false,
}: {
  steps: EditableStep[];
  onChange: (steps: EditableStep[]) => void;
  readOnly?: boolean;
}) {
  const { data: documents } = useDocuments();
  const { data: tanks } = useTanks();
  const { data: equipment } = useEquipment();

  function update(index: number, patch: Partial<EditableStep>) {
    const next = steps.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onChange(next);
  }

  function remove(index: number) {
    onChange(renumber(steps.filter((_, i) => i !== index)));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(renumber(next));
  }

  function addStep() {
    onChange([
      ...steps,
      { seq: (steps.length + 1) * 10, name: "", parameters: "", work_instruction_doc_no: null, tank_id: null, equipment_id: null, is_final_inspect: false, required_parameters: [] },
    ]);
  }

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  function updateParam(stepIndex: number, paramIndex: number, patch: Partial<RequiredParameter>) {
    const params = steps[stepIndex].required_parameters.map((p, i) => (i === paramIndex ? { ...p, ...patch } : p));
    update(stepIndex, { required_parameters: params });
  }

  function addParam(stepIndex: number) {
    update(stepIndex, { required_parameters: [...steps[stepIndex].required_parameters, { ...blankParameter }] });
    setExpandedIndex(stepIndex);
  }

  function removeParam(stepIndex: number, paramIndex: number) {
    update(stepIndex, { required_parameters: steps[stepIndex].required_parameters.filter((_, i) => i !== paramIndex) });
  }

  return (
    <div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            {["", "Seq", "Operation", "Parameters", "Work Instr.", "Tank", "Equipment", "Final?", ""].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "6px 8px", fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: colors.textFaint, fontWeight: 600 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {steps.map((step, i) => (
            <Fragment key={i}>
              <tr style={{ borderTop: `1px solid ${colors.rowBorder}` }}>
                <td style={{ padding: "6px 4px", textAlign: "center" }}>
                  <button
                    onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                    title="Required process variables"
                    style={{ ...iconBtnStyle, marginRight: 0 }}
                  >
                    {expandedIndex === i ? "▾" : "▸"}
                  </button>
                </td>
                <td style={{ padding: "6px 8px", fontFamily: "'IBM Plex Mono', monospace", color: colors.textFaint }}>{step.seq}</td>
                <td style={{ padding: "6px 8px", minWidth: 140 }}>
                  <TextInput disabled={readOnly} value={step.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Operation name" />
                </td>
                <td style={{ padding: "6px 8px", minWidth: 140 }}>
                  <TextInput disabled={readOnly} value={step.parameters} onChange={(e) => update(i, { parameters: e.target.value })} placeholder="Parameters" />
                  {step.required_parameters.length > 0 ? (
                    <div style={{ marginTop: 3, fontSize: 10, color: colors.accentDefault, fontWeight: 600 }}>
                      {step.required_parameters.length} required param{step.required_parameters.length > 1 ? "s" : ""}
                    </div>
                  ) : null}
                </td>
                <td style={{ padding: "6px 8px", minWidth: 130 }}>
                  <Select disabled={readOnly} value={step.work_instruction_doc_no ?? ""} onChange={(e) => update(i, { work_instruction_doc_no: e.target.value || null })}>
                    <option value="">—</option>
                    {(documents ?? []).map((d) => (
                      <option key={d.doc_no} value={d.doc_no}>
                        {d.doc_no}
                      </option>
                    ))}
                  </Select>
                </td>
                <td style={{ padding: "6px 8px", minWidth: 110 }}>
                  <Select disabled={readOnly} value={step.tank_id ?? ""} onChange={(e) => update(i, { tank_id: e.target.value || null })}>
                    <option value="">—</option>
                    {(tanks ?? []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.id}
                      </option>
                    ))}
                  </Select>
                </td>
                <td style={{ padding: "6px 8px", minWidth: 110 }}>
                  <Select disabled={readOnly} value={step.equipment_id ?? ""} onChange={(e) => update(i, { equipment_id: e.target.value || null })}>
                    <option value="">—</option>
                    {(equipment ?? []).map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.id}
                      </option>
                    ))}
                  </Select>
                </td>
                <td style={{ padding: "6px 8px", textAlign: "center" }}>
                  <input type="checkbox" disabled={readOnly} checked={step.is_final_inspect} onChange={(e) => update(i, { is_final_inspect: e.target.checked })} />
                </td>
                {!readOnly ? (
                  <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                    <button onClick={() => move(i, -1)} disabled={i === 0} title="Move up" style={iconBtnStyle}>
                      ↑
                    </button>
                    <button onClick={() => move(i, 1)} disabled={i === steps.length - 1} title="Move down" style={iconBtnStyle}>
                      ↓
                    </button>
                    <button onClick={() => remove(i)} title="Remove step" style={{ ...iconBtnStyle, color: colors.red }}>
                      ✕
                    </button>
                  </td>
                ) : null}
              </tr>
              {expandedIndex === i ? (
                <tr key={`${i}-params`} style={{ background: "#FAFBFB", borderTop: `1px solid ${colors.rowBorder}` }}>
                  <td colSpan={9} style={{ padding: "10px 14px" }}>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: colors.textFaint, fontWeight: 700, marginBottom: 6 }}>
                      Required Process Variables
                    </div>
                    {step.required_parameters.length === 0 ? (
                      <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8 }}>
                        None defined — this step has no recorded-value requirement at sign-off.
                      </div>
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 8 }}>
                        <thead>
                          <tr>
                            {["Key", "Label", "Kind", "Unit", "Min", "Max", "Target Text", "Auto?", "Req'd?", ""].map((h) => (
                              <th key={h} style={{ textAlign: "left", padding: "4px 6px", fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase", color: colors.textFaint, fontWeight: 600 }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {step.required_parameters.map((p, pi) => (
                            <tr key={pi} style={{ borderTop: `1px solid ${colors.rowBorder}` }}>
                              <td style={{ padding: "4px 6px", minWidth: 100 }}>
                                <TextInput disabled={readOnly} value={p.key} onChange={(e) => updateParam(i, pi, { key: e.target.value })} placeholder="tank_temp" />
                              </td>
                              <td style={{ padding: "4px 6px", minWidth: 130 }}>
                                <TextInput disabled={readOnly} value={p.label} onChange={(e) => updateParam(i, pi, { label: e.target.value })} placeholder="Tank Temperature" />
                              </td>
                              <td style={{ padding: "4px 6px", minWidth: 90 }}>
                                <Select disabled={readOnly} value={p.kind} onChange={(e) => updateParam(i, pi, { kind: e.target.value as RequiredParameter["kind"] })}>
                                  <option value="numeric">numeric</option>
                                  <option value="duration">duration</option>
                                  <option value="text">text</option>
                                </Select>
                              </td>
                              <td style={{ padding: "4px 6px", minWidth: 60 }}>
                                <TextInput disabled={readOnly} value={p.unit} onChange={(e) => updateParam(i, pi, { unit: e.target.value })} placeholder="°F" />
                              </td>
                              {p.kind !== "text" ? (
                                <>
                                  <td style={{ padding: "4px 6px", minWidth: 60 }}>
                                    <TextInput disabled={readOnly} type="number" value={p.target_min ?? ""} onChange={(e) => updateParam(i, pi, { target_min: e.target.value === "" ? null : Number(e.target.value) })} />
                                  </td>
                                  <td style={{ padding: "4px 6px", minWidth: 60 }}>
                                    <TextInput disabled={readOnly} type="number" value={p.target_max ?? ""} onChange={(e) => updateParam(i, pi, { target_max: e.target.value === "" ? null : Number(e.target.value) })} />
                                  </td>
                                  <td style={{ padding: "4px 6px", color: colors.textFaint }}>—</td>
                                </>
                              ) : (
                                <>
                                  <td style={{ padding: "4px 6px", color: colors.textFaint }}>—</td>
                                  <td style={{ padding: "4px 6px", color: colors.textFaint }}>—</td>
                                  <td style={{ padding: "4px 6px", minWidth: 90 }}>
                                    <TextInput disabled={readOnly} value={p.target_text ?? ""} onChange={(e) => updateParam(i, pi, { target_text: e.target.value || null })} placeholder="(optional)" />
                                  </td>
                                </>
                              )}
                              <td style={{ padding: "4px 6px", textAlign: "center" }}>
                                <input
                                  type="checkbox" disabled={readOnly || p.kind !== "duration"} checked={p.auto_computed}
                                  onChange={(e) => updateParam(i, pi, { auto_computed: e.target.checked })}
                                  title="Auto-compute from Start/Signoff clock (duration only)"
                                />
                              </td>
                              <td style={{ padding: "4px 6px", textAlign: "center" }}>
                                <input type="checkbox" disabled={readOnly} checked={p.required} onChange={(e) => updateParam(i, pi, { required: e.target.checked })} />
                              </td>
                              {!readOnly ? (
                                <td style={{ padding: "4px 6px" }}>
                                  <button onClick={() => removeParam(i, pi)} title="Remove parameter" style={{ ...iconBtnStyle, color: colors.red }}>
                                    ✕
                                  </button>
                                </td>
                              ) : null}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {!readOnly ? (
                      <SecondaryButton type="button" onClick={() => addParam(i)}>
                        + Add Parameter
                      </SecondaryButton>
                    ) : null}

                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: colors.textFaint, fontWeight: 700, margin: "14px 0 6px" }}>
                      Process Instructions &amp; Quality Alerts
                    </div>
                    {step.id ? (
                      // Deliberately NOT gated on `readOnly`: reference media isn't part of the
                      // formal process definition change control locks once a revision is
                      // Released, and quality alerts are most useful once a step is already in
                      // production — so photos/videos stay addable/removable either way.
                      <AttachmentGallery
                        entityType="routing_step"
                        entityId={step.id}
                        emptyText="No reference photos or videos for this step yet."
                      />
                    ) : (
                      <div style={{ fontSize: 11, color: colors.textFaint }}>Save this step before attaching photos or videos.</div>
                    )}
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
      {!readOnly ? (
        <div style={{ marginTop: 10 }}>
          <SecondaryButton type="button" onClick={addStep}>
            + Add Step
          </SecondaryButton>
        </div>
      ) : null}
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: 4,
  padding: "3px 7px",
  fontSize: 11,
  cursor: "pointer",
  marginRight: 4,
};
