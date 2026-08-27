export interface Customer {
  id: number;
  name: string;
  itar_registered: boolean;
  active: boolean;
  require_approved_routing: boolean;
  requires_contract_review: boolean;
  quality_standards: string;
}

export interface ContractReview {
  id: number;
  order_id: string;
  customer_requirements_reviewed: boolean;
  spec_and_revision_confirmed: boolean;
  special_requirements_understood: boolean;
  regulatory_itar_reviewed: boolean;
  approved_process_available: boolean;
  capacity_confirmed: boolean;
  differences_resolved: boolean;
  governing_spec: string;
  spec_revision: string;
  captured_requirements: string[] | null;
  outcome: "Pending" | "Accepted" | "Rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string;
}

export interface Vendor {
  id: number;
  name: string;
  category: string;
  approval_basis: string;
  otd_pct: number;
  survey_due_at: string | null;
  survey_overdue: boolean;
  status: string;
  active: boolean;
}

export interface OrderLine {
  id: number;
  description: string;
  qty: number;
  unit_price: number;
  part_number: string | null;
  revision: string | null;
  spec: string | null;
  job_id: string | null;
}

export interface Order {
  id: string;
  kind: "order" | "quote";
  customer: Customer;
  customer_po: string;
  part_number: string;
  spec: string;
  qty: number;
  value: number;
  due_date: string | null;
  status: string;
  converted_job_id: string | null;
  purchase_order_analysis_id: number | null;
  lines: OrderLine[];
  contract_review: ContractReview | null;
}

export interface JobOperation {
  id: number;
  seq: number;
  name: string;
  parameters: string;
  work_instruction_doc_no: string | null;
  tank_id: string | null;
  equipment_id: string | null;
  source_routing_step_id: number | null;
  done: boolean;
  signed_by: string | null;
  signed_at: string | null;
  started_at: string | null;
  tank_ooc_at_signoff: boolean;
  is_final_inspect: boolean;
  required_parameters: RequiredParameter[];
  recorded_parameters: RecordedParameter[];
  has_out_of_spec_reading: boolean;
}

export interface Job {
  id: string;
  customer: Customer;
  customer_po: string;
  part_number: string;
  revision: string;
  qty: number;
  material_lot: string;
  process_label: string;
  spec: string;
  spec_note: string;
  due_date: string | null;
  due_note: string;
  itar: boolean;
  status: string;
  source_routing_revision_id: number | null;
  routing_warning: string | null;
  routing_planned: boolean;
  source_routing_revision_label: string | null;
  po_requirements: string[];
  planning_status: "Planned" | "Needs Planning";
  source_drawing_analysis_id: number | null;
  current_op_seq: number | null;
  current_op_name: string | null;
  current_op_tank_id: string | null;
  current_op_equipment_id: string | null;
}

export interface SpecResult {
  id: number;
  param_key: string;
  name: string;
  requirement: string;
  value_text: string;
  passed: boolean;
  recorded_by: string;
  recorded_at: string;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
}

export interface JobDetail extends Job {
  ops: JobOperation[];
  spec_results: SpecResult[];
  ship_ready: boolean;
  ship_blockers: string[];
}

export interface Operator {
  name: string;
}

export interface Tank {
  id: string;
  solution: string;
  parameter: string;
  limits_text: string;
  limit_min: number | null;
  limit_max: number | null;
  analysis_interval_days: number;
  last_result: number | null;
  last_analyzed_at: string | null;
  next_due_at: string | null;
  held: boolean;
  hold_reason: string | null;
}

export interface TankAnalysis {
  id: number;
  result: number;
  in_limit: boolean;
  analyzed_by: string;
  analyzed_at: string;
  notes: string;
}

export interface TankAddition {
  id: number;
  chemical: string;
  amount: string;
  added_by: string;
  added_at: string;
  notes: string;
}

export interface NCR {
  id: string;
  job_id: string | null;
  tank_id: string | null;
  reference_label: string;
  opened_at: string;
  disposition: string;
  description: string;
}

export interface CAPA {
  id: string;
  ncr_id: string | null;
  description: string;
  due_date: string | null;
  closed_date: string | null;
  phase: string;
}

export interface AuditProgram {
  id: number;
  name: string;
  pct_complete: number;
  note: string;
  scheduled_for: string | null;
}

export interface Certificate {
  id: string;
  job_id: string;
  qty_accepted: number;
  process_text: string;
  issued: boolean;
  issued_at: string | null;
  issued_by: string | null;
  blocked_reason: string | null;
  material_lot: string | null;
  part_number: string | null;
  revision: string | null;
  spec: string | null;
  routing_revision_label: string | null;
  recorded_readings: {
    op_seq: number;
    op_name: string;
    label: string;
    value: number | string;
    unit: string;
    in_spec: boolean | null;
    recorded_by: string;
    recorded_at: string;
  }[] | null;
}

export interface CertQueueItem {
  job_id: string;
  customer_name: string;
  process_label: string;
  ready: boolean;
  state: string;
  certificate_id: string | null;
}

export interface InvoiceLine {
  job_id: string | null;
  description: string;
  amount: number;
}

export interface Invoice {
  id: string;
  customer: Customer;
  amount: number;
  terms: string;
  status: string;
  qb_sync_status: string;
  quickbooks_invoice_id: string | null;
  last_synced_at: string | null;
  lines: InvoiceLine[];
}

export interface QuickBooksStatus {
  connected: boolean;
  mode: string;
  last_sync: string | null;
  detail: string;
}

export interface Equipment {
  id: string;
  name: string;
  location: string;
  interval_text: string;
  interval_months: number;
  last_calibrated_at: string | null;
  due_at: string | null;
  active: boolean;
}

export interface InventoryLot {
  id: number;
  chemical_name: string;
  lot_number: string;
  vendor: Vendor | null;
  on_hand_qty: number;
  on_hand_unit: string;
  reorder_at_qty: number;
  expires_at: string | null;
}

export interface DocumentRow {
  doc_no: string;
  title: string;
  revision: string;
  effective_date: string | null;
  owner: string;
  status: string;
}

export interface Kpi {
  key: string;
  value: string;
  label: string;
  kind: string;
}

export interface HotJob {
  id: string;
  customer: string;
  process: string;
  current_op: string;
  due: string;
  due_urgent: boolean;
}

export interface TankAlert {
  tank_id: string;
  title: string;
  detail: string;
  kind: string;
}

export interface PulseItem {
  label: string;
  value: string;
  kind: string;
}

export interface DashboardSummary {
  kpis: Kpi[];
  hot_jobs: HotJob[];
  tank_alerts: TankAlert[];
  pulse: PulseItem[];
}

export interface PortalJob {
  po: string;
  part_number: string;
  stage: string;
  eta: string;
  pct: number;
  has_cert: boolean;
  cert_id: string | null;
}

export interface AuditLogEntry {
  id: number;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

export interface CurrentUser {
  id: number;
  name: string;
  initials: string;
  email: string;
  role: string;
}

/** Fuller account record from /users — CurrentUser above stays as /auth/me returns it. */
export interface AppUser {
  id: number;
  name: string;
  initials: string;
  email: string;
  role: string;
  is_active: boolean;
  has_pin: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface ApiEndpoint {
  method: string;
  path: string;
  desc: string;
}

export interface DrawingProcessingRequirement {
  process: string;
  spec: string;
  class_type: string;
  notes: string;
}

export interface DrawingDimension {
  feature: string;
  dimensions_text: string;
  shape: "circular_hole_wall" | "rect_face" | null;
  params: {
    diameter_in: number | null;
    depth_in: number | null;
    length_in: number | null;
    width_in: number | null;
    count: number | null;
  } | null;
  area_sq_in: number | null;
  computed: boolean;
}

export interface DrawingPostTreatmentRequirement {
  treatment: string;
  spec: string;
  notes: string;
}

export interface DrawingAnalysis {
  id: number;
  filename: string;
  file_size: number;
  status: string;
  part_number: string | null;
  revision: string | null;
  material: string | null;
  processing_requirements: DrawingProcessingRequirement[] | null;
  governing_specs: { spec: string; description: string }[] | null;
  masking_requirements: string[] | null;
  post_treatment_requirements: DrawingPostTreatmentRequirement[] | null;
  dimensions: DrawingDimension[] | null;
  surface_area_sq_in: number | null;
  surface_area_method: string | null;
  surface_area_confidence: "high" | "medium" | "low" | null;
  overall_thickness_in: number | null;
  overall_thickness_source: string | null;
  overall_thickness_confidence: "high" | "medium" | "low" | "n/a" | null;
  warnings: string[] | null;
  error_detail: string | null;
  model_used: string | null;
  created_by: string;
  created_at: string;
  stored_file_path: string | null;
}

export interface DrawingBatchResult {
  filename: string;
  success: boolean;
  analysis: DrawingAnalysis | null;
  error: string | null;
}

export interface DrawingAiStatus {
  configured: boolean;
  model: string;
  detail: string;
}

export interface PurchaseOrderLineItem {
  line_no: number;
  part_number: string | null;
  revision: string | null;
  description: string;
  qty: number | null;
  unit_price: number | null;
  due_date: string | null;
  spec_text: string | null;
  drawing_ref_text: string | null;
  line_requirements: string[];
  processing_requirements: DrawingProcessingRequirement[];
  matched_drawing_analysis_id: number | null;
}

export interface PurchaseOrderAnalysis {
  id: number;
  filename: string;
  file_size: number;
  status: string;
  po_number: string | null;
  po_date: string | null;
  customer_name_guess: string | null;
  general_requirements: string[] | null;
  line_items: PurchaseOrderLineItem[] | null;
  warnings: string[] | null;
  error_detail: string | null;
  model_used: string | null;
  created_by: string;
  created_at: string;
  matched_drawings?: DrawingAnalysis[];
  stored_file_path: string | null;
}

export interface PurchaseOrderAiStatus {
  configured: boolean;
  model: string;
  detail: string;
}

export interface ConfirmedLine {
  line_no: number;
  part_number: string;
  revision: string;
  spec: string;
  description: string;
  qty: number;
  unit_price: number;
  due_date: string | null;
  drawing_analysis_id: number | null;
  line_requirements: string[];
}

export interface LineResult {
  line_no: number;
  job_id: string | null;
  error: string | null;
}

export interface GenerateSalesOrderResult {
  order: Order;
  line_results: LineResult[];
}

export interface EmailIntakeStatus {
  configured: boolean;
  imap_host: string;
  imap_folder: string;
  allowed_senders: string[];
  poll_interval_minutes: number;
  last_poll_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
  detail: string;
}

export interface EmailIntakeLogEntry {
  id: number;
  message_id: string;
  sender: string;
  subject: string;
  attachment_filename: string | null;
  status: "Scanned" | "Skipped-Sender" | "Skipped-NoPdf" | "Error";
  drawing_analysis_id: number | null;
  error_detail: string | null;
  processed_at: string;
}

export interface RequiredParameter {
  key: string;
  label: string;
  kind: "numeric" | "duration" | "text";
  unit: string;
  target_min: number | null;
  target_max: number | null;
  target_text: string | null;
  auto_computed: boolean;
  required: boolean;
}

export interface RecordedParameter extends RequiredParameter {
  value: number | string;
  in_spec: boolean | null;
  recorded_by: string;
  recorded_at: string;
}

export interface Attachment {
  id: number;
  entity_type: "part" | "routing_step";
  entity_id: string;
  kind: "image" | "video";
  label: string;
  is_quality_alert: boolean;
  filename: string;
  content_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
}

export interface RoutingStep {
  id: number;
  seq: number;
  name: string;
  parameters: string;
  work_instruction_doc_no: string | null;
  tank_id: string | null;
  equipment_id: string | null;
  is_final_inspect: boolean;
  required_parameters: RequiredParameter[];
}

export interface RoutingRevision {
  id: number;
  routing_template_id: string | null;
  part_id: number | null;
  revision_number: number;
  status: "Draft" | "Released" | "Superseded" | "Obsolete";
  cloned_from_revision_id: number | null;
  source_drawing_analysis_id: number | null;
  created_by: string;
  created_at: string;
  released_by: string | null;
  released_at: string | null;
  superseded_at: string | null;
}

export interface RoutingRevisionDetail extends RoutingRevision {
  steps: RoutingStep[];
}

export interface RoutingTemplate {
  id: string;
  name: string;
  spec: string;
  active: boolean;
}

export interface Part {
  id: number;
  customer_id: number;
  part_number: string;
  revision: string;
  spec: string;
  itar: boolean;
  active: boolean;
}

export interface JobPlanningContext {
  job: Job;
  part: Part;
  matching_templates: RoutingTemplate[];
  drawing: DrawingAnalysis | null;
  po_line: PurchaseOrderLineItem | null;
  spec_mismatch: string | null;
}
