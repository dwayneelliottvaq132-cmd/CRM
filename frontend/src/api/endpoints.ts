import { http } from "./client";
import type {
  FinishRate,
  ApiEndpoint,
  Attachment,
  AuditLogEntry,
  AuditProgram,
  CAPA,
  Certificate,
  CertQueueItem,
  CurrentUser,
  DashboardSummary,
  DocumentRow,
  DrawingAiStatus,
  DrawingAnalysis,
  DrawingBatchResult,
  EmailIntakeLogEntry,
  EmailIntakeStatus,
  Equipment,
  InventoryLot,
  Invoice,
  Job,
  JobDetail,
  JobPlanningContext,
  NCR,
  Operator,
  ConfirmedLine,
  GenerateSalesOrderResult,
  Order,
  Part,
  PortalJob,
  PurchaseOrderAiStatus,
  PurchaseOrderAnalysis,
  QuickBooksStatus,
  RoutingRevision,
  RoutingRevisionDetail,
  RoutingTemplate,
  SpecResult,
  Tank,
  TankAddition,
  TankAnalysis,
  Vendor,
} from "../lib/types";

// ---- auth ----------------------------------------------------------------
export async function login(email: string, password: string) {
  const form = new URLSearchParams();
  form.set("username", email);
  form.set("password", password);
  const { data } = await http.post<{ access_token: string }>("/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return data.access_token;
}
export async function me() {
  const { data } = await http.get<CurrentUser>("/auth/me");
  return data;
}

// ---- dashboard -------------------------------------------------------------
export async function dashboardSummary() {
  const { data } = await http.get<DashboardSummary>("/dashboard/summary");
  return data;
}

// ---- customers / vendors ----------------------------------------------------
export async function listVendors(includeInactive = false) {
  const { data } = await http.get<Vendor[]>("/vendors", { params: includeInactive ? { include_inactive: true } : undefined });
  return data;
}
export async function createVendor(body: { name: string; category: string; approval_basis: string; otd_pct?: number; survey_due_at?: string | null; status?: string }) {
  const { data } = await http.post<Vendor>("/vendors", body);
  return data;
}
export async function updateVendor(id: number, body: Partial<{ name: string; category: string; approval_basis: string; otd_pct: number; survey_due_at: string | null; status: string }>) {
  const { data } = await http.patch<Vendor>(`/vendors/${id}`, body);
  return data;
}
export async function archiveVendor(id: number) {
  await http.delete(`/vendors/${id}`);
}

export async function listCustomers(includeInactive = false) {
  const { data } = await http.get<import("../lib/types").Customer[]>("/customers", { params: includeInactive ? { include_inactive: true } : undefined });
  return data;
}
export async function createCustomer(body: { name: string; itar_registered?: boolean; require_approved_routing?: boolean; requires_contract_review?: boolean; quality_standards?: string }) {
  const { data } = await http.post<import("../lib/types").Customer>("/customers", body);
  return data;
}
export async function updateCustomer(id: number, body: Partial<{ name: string; itar_registered: boolean; require_approved_routing: boolean; requires_contract_review: boolean; quality_standards: string }>) {
  const { data } = await http.patch<import("../lib/types").Customer>(`/customers/${id}`, body);
  return data;
}
export async function archiveCustomer(id: number) {
  await http.delete(`/customers/${id}`);
}
export async function portalPreview(customerId: number) {
  const { data } = await http.get<PortalJob[]>(`/customers/${customerId}/portal-preview`);
  return data;
}

// ---- orders -----------------------------------------------------------------
export async function listOrders() {
  const { data } = await http.get<Order[]>("/orders");
  return data;
}
export async function createOrder(body: {
  kind: "order" | "quote";
  customer_id: number;
  customer_po: string;
  part_number: string;
  spec: string;
  qty: number;
  value: number;
  due_date?: string | null;
  status?: string;
}) {
  const { data } = await http.post<Order>("/orders", body);
  return data;
}
export async function updateOrder(orderId: string, body: Partial<{ customer_po: string; part_number: string; spec: string; qty: number; value: number; due_date: string | null }>) {
  const { data } = await http.patch<Order>(`/orders/${orderId}`, body);
  return data;
}
export async function deleteOrder(orderId: string) {
  await http.delete(`/orders/${orderId}`);
}
export async function convertOrder(orderId: string) {
  const { data } = await http.post<Job>(`/orders/${orderId}/convert`);
  return data;
}
export async function getContractReview(orderId: string) {
  const { data } = await http.get<import("../lib/types").ContractReview>(`/orders/${orderId}/contract-review`);
  return data;
}
export async function saveContractReview(orderId: string, body: Partial<Omit<import("../lib/types").ContractReview, "id" | "order_id" | "outcome" | "reviewed_by" | "reviewed_at">>) {
  const { data } = await http.put<import("../lib/types").ContractReview>(`/orders/${orderId}/contract-review`, body);
  return data;
}
export async function acceptContractReview(orderId: string) {
  const { data } = await http.post<Job>(`/orders/${orderId}/contract-review/accept`);
  return data;
}
export async function rejectContractReview(orderId: string) {
  const { data } = await http.post<import("../lib/types").ContractReview>(`/orders/${orderId}/contract-review/reject`);
  return data;
}

// ---- jobs / travelers / shop floor -------------------------------------------
export async function listJobs(status?: string, planningStatus?: string) {
  const params: Record<string, string> = {};
  if (status) params.status = status;
  if (planningStatus) params.planning_status = planningStatus;
  const { data } = await http.get<Job[]>("/jobs", { params: Object.keys(params).length ? params : undefined });
  return data;
}
export async function getJob(jobId: string) {
  const { data } = await http.get<JobDetail>(`/jobs/${jobId}`);
  return data;
}
export async function createJob(body: {
  customer_id: number;
  customer_po: string;
  part_number: string;
  revision?: string;
  qty: number;
  spec: string;
  process_label?: string | null;
  due_date?: string | null;
  itar?: boolean;
}) {
  const { data } = await http.post<JobDetail>("/jobs", body);
  return data;
}
export async function updateJob(jobId: string, body: Partial<{ customer_po: string; part_number: string; revision: string; qty: number; spec: string; due_date: string | null; itar: boolean }>) {
  const { data } = await http.patch<JobDetail>(`/jobs/${jobId}`, body);
  return data;
}
export async function deleteJob(jobId: string) {
  await http.delete(`/jobs/${jobId}`);
}
export async function startOp(jobId: string, seq: number, pin: string) {
  const { data } = await http.post<JobDetail>(`/jobs/${jobId}/ops/${seq}/start`, { pin });
  return data;
}
export async function signoffOp(jobId: string, seq: number, pin: string, readings: { key: string; value: number | string }[] = []) {
  const { data } = await http.post<JobDetail>(`/jobs/${jobId}/ops/${seq}/signoff`, { pin, readings });
  return data;
}
export async function reportProblem(jobId: string, pin: string, description: string) {
  const { data } = await http.post<JobDetail>(`/jobs/${jobId}/report-problem`, { pin, description });
  return data;
}
export async function shipJob(jobId: string) {
  const { data } = await http.post<JobDetail>(`/jobs/${jobId}/ship`);
  return data;
}
export async function resolveSpecResult(jobId: string, resultId: number, note: string) {
  const { data } = await http.post<SpecResult>(`/jobs/${jobId}/spec-results/${resultId}/resolve`, { note });
  return data;
}
export async function getBatchCandidates(jobId: string) {
  const { data } = await http.get<Job[]>(`/jobs/${jobId}/batch-candidates`);
  return data;
}
export async function batchSignoffOp(jobIds: string[], pin: string, readings: { key: string; value: number | string }[] = []) {
  const { data } = await http.post<JobDetail[]>("/jobs/batch/signoff", { job_ids: jobIds, pin, readings });
  return data;
}
export async function getOperatorByPin(pin: string) {
  const { data } = await http.get<Operator>("/jobs/operator-by-pin", { params: { pin } });
  return data;
}
export async function completePlanningApplyPlan(jobId: string) {
  const { data } = await http.post<JobDetail>(`/jobs/${jobId}/complete-planning/apply-plan`);
  return data;
}
export async function completePlanningPlaceholder(jobId: string) {
  const { data } = await http.post<JobDetail>(`/jobs/${jobId}/complete-planning/placeholder`);
  return data;
}

// ---- chemistry ----------------------------------------------------------------
export async function listTanks() {
  const { data } = await http.get<Tank[]>("/tanks");
  return data;
}
export async function tankAnalyses(tankId: string) {
  const { data } = await http.get<TankAnalysis[]>(`/tanks/${tankId}/analyses`);
  return data;
}
export async function logAnalysis(tankId: string, result: number, notes = "") {
  const { data } = await http.post<Tank>(`/tanks/${tankId}/analyses`, { result, notes });
  return data;
}
export async function tankAdditions(tankId: string) {
  const { data } = await http.get<TankAddition[]>(`/tanks/${tankId}/additions`);
  return data;
}
export async function recordAddition(tankId: string, chemical: string, amount: string, notes = "") {
  const { data } = await http.post<TankAddition>(`/tanks/${tankId}/additions`, { chemical, amount, notes });
  return data;
}

// ---- compliance -----------------------------------------------------------------
export async function listNcrs() {
  const { data } = await http.get<NCR[]>("/ncrs");
  return data;
}
export async function createNcr(body: { id: string; reference_label: string; disposition: string; description: string; job_id?: string | null; tank_id?: string | null }) {
  const { data } = await http.post<NCR>("/ncrs", body);
  return data;
}
export async function listCapas() {
  const { data } = await http.get<CAPA[]>("/capas");
  return data;
}
export async function listAuditPrograms() {
  const { data } = await http.get<AuditProgram[]>("/audit-programs");
  return data;
}

// ---- certificates -----------------------------------------------------------------
export async function certQueue() {
  const { data } = await http.get<CertQueueItem[]>("/certs/queue");
  return data;
}
export async function issueCertificate(jobId: string) {
  const { data } = await http.post<Certificate>(`/certs/${jobId}/issue`);
  return data;
}
export function certPdfUrl(certId: string) {
  return `${http.defaults.baseURL}/certs/${certId}.pdf`;
}

// ---- invoicing -----------------------------------------------------------------
export async function listInvoices() {
  const { data } = await http.get<Invoice[]>("/invoices");
  return data;
}
export async function syncInvoice(invoiceId: string) {
  const { data } = await http.post<Invoice>(`/invoices/${invoiceId}/sync`);
  return data;
}
export async function syncAllInvoices() {
  const { data } = await http.post<Invoice[]>("/invoices/sync-all");
  return data;
}
export async function qbStatus() {
  const { data } = await http.get<QuickBooksStatus>("/quickbooks/status");
  return data;
}

// ---- calibration -----------------------------------------------------------------
export async function listEquipment(includeInactive = false) {
  const { data } = await http.get<Equipment[]>("/equipment", { params: includeInactive ? { include_inactive: true } : undefined });
  return data;
}
export async function createEquipment(body: { name: string; location: string; interval_months?: number }) {
  const { data } = await http.post<Equipment>("/equipment", body);
  return data;
}
export async function updateEquipment(id: string, body: Partial<{ name: string; location: string; interval_months: number }>) {
  const { data } = await http.patch<Equipment>(`/equipment/${id}`, body);
  return data;
}
export async function archiveEquipment(id: string) {
  await http.delete(`/equipment/${id}`);
}

// ---- inventory -----------------------------------------------------------------
export async function listInventory() {
  const { data } = await http.get<InventoryLot[]>("/inventory");
  return data;
}
export async function createInventoryLot(body: {
  chemical_name: string;
  lot_number: string;
  vendor_id: number;
  on_hand_qty: number;
  on_hand_unit: string;
  reorder_at_qty: number;
  expires_at?: string | null;
}) {
  const { data } = await http.post<InventoryLot>("/inventory", body);
  return data;
}
export async function updateInventoryLot(
  id: number,
  body: Partial<{ chemical_name: string; lot_number: string; vendor_id: number; on_hand_qty: number; on_hand_unit: string; reorder_at_qty: number; expires_at: string | null }>,
) {
  const { data } = await http.patch<InventoryLot>(`/inventory/${id}`, body);
  return data;
}
export async function deleteInventoryLot(id: number) {
  await http.delete(`/inventory/${id}`);
}

// ---- documents -----------------------------------------------------------------
export async function listDocuments() {
  const { data } = await http.get<DocumentRow[]>("/documents");
  return data;
}
export async function createDocument(body: { doc_no: string; title: string; revision: string; effective_date?: string | null; owner: string; status?: string }) {
  const { data } = await http.post<DocumentRow>("/documents", body);
  return data;
}
export async function updateDocument(docNo: string, body: Partial<{ title: string; revision: string; effective_date: string | null; owner: string; status: string }>) {
  const { data } = await http.patch<DocumentRow>(`/documents/${docNo}`, body);
  return data;
}
export async function obsoleteDocument(docNo: string) {
  await http.delete(`/documents/${docNo}`);
}

// ---- portal -----------------------------------------------------------------
export async function portalLogin(email: string, password: string) {
  const { data } = await http.post<{ access_token: string }>("/portal/login", { email, password });
  return data.access_token;
}
export async function portalJobs() {
  const { data } = await http.get<PortalJob[]>("/portal/jobs", { headers: { "X-Portal": "1" } });
  return data;
}

// ---- audit log / meta -----------------------------------------------------------------
export async function auditLog(limit = 100) {
  const { data } = await http.get<AuditLogEntry[]>("/audit-log", { params: { limit } });
  return data;
}
export async function apiEndpoints() {
  const { data } = await http.get<ApiEndpoint[]>("/meta/endpoints");
  return data;
}
export async function integrationInfo() {
  const { data } = await http.get("/meta/integration-info");
  return data;
}

// ---- AI drawing analysis --------------------------------------------------------------
export async function drawingAiStatus() {
  const { data } = await http.get<DrawingAiStatus>("/drawings/status");
  return data;
}
export async function listDrawingAnalyses() {
  const { data } = await http.get<DrawingAnalysis[]>("/drawings");
  return data;
}
export async function getDrawingAnalysis(analysisId: number) {
  const { data } = await http.get<DrawingAnalysis>(`/drawings/${analysisId}`);
  return data;
}
export async function analyzeDrawing(file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await http.post<DrawingAnalysis>("/drawings/analyze", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 300000, // vision analysis of a large print can take minutes
  });
  return data;
}
export async function analyzeDrawingsBatch(files: File[]) {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  const { data } = await http.post<DrawingBatchResult[]>("/drawings/analyze-batch", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 300000 * Math.max(files.length, 1), // sequential vision passes — scale with batch size
  });
  return data;
}
export async function generateRoutingPlanFromDrawing(
  analysisId: number,
  body: { customer_id: number; part_number?: string; revision?: string; spec?: string; attach_to_template_id?: string | null },
) {
  const { data } = await http.post<RoutingRevisionDetail>(`/drawings/${analysisId}/generate-routing-plan`, body);
  return data;
}
export async function matchingTemplates(analysisId: number) {
  const { data } = await http.get<RoutingTemplate[]>(`/drawings/${analysisId}/matching-templates`);
  return data;
}
export function drawingFileUrl(analysisId: number) {
  return `${http.defaults.baseURL}/drawings/${analysisId}/file`;
}

// ---- email intake ----------------------------------------------------------------------
export async function emailIntakeStatus() {
  const { data } = await http.get<EmailIntakeStatus>("/email-intake/status");
  return data;
}
export async function emailIntakeLog() {
  const { data } = await http.get<EmailIntakeLogEntry[]>("/email-intake/log");
  return data;
}
export async function pollEmailIntakeNow() {
  const { data } = await http.post<EmailIntakeStatus>("/email-intake/poll-now");
  return data;
}

// ---- purchase order intake -------------------------------------------------------------
export async function poStatus() {
  const { data } = await http.get<PurchaseOrderAiStatus>("/purchase-orders/status");
  return data;
}
export async function listPoAnalyses() {
  const { data } = await http.get<PurchaseOrderAnalysis[]>("/purchase-orders");
  return data;
}
export async function getPoAnalysis(id: number) {
  const { data } = await http.get<PurchaseOrderAnalysis>(`/purchase-orders/${id}`);
  return data;
}
export async function analyzePo(poFile: File, drawingFiles: File[]) {
  const form = new FormData();
  form.append("po_file", poFile);
  drawingFiles.forEach((f) => form.append("drawing_files", f));
  const { data } = await http.post<PurchaseOrderAnalysis>("/purchase-orders/analyze", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 300000, // vision analysis of the PO + every attached drawing can take minutes
  });
  return data;
}
export async function generateSalesOrder(analysisId: number, body: { customer_id: number; customer_po?: string | null; lines: ConfirmedLine[] }) {
  const { data } = await http.post<GenerateSalesOrderResult>(`/purchase-orders/${analysisId}/generate`, body);
  return data;
}
export function poFileUrl(analysisId: number) {
  return `${http.defaults.baseURL}/purchase-orders/${analysisId}/file`;
}

// ---- process planning: routing templates & parts -----------------------------------------
export interface RoutingStepBody {
  seq: number;
  name: string;
  parameters?: string;
  work_instruction_doc_no?: string | null;
  tank_id?: string | null;
  equipment_id?: string | null;
  is_final_inspect?: boolean;
}

export async function listRoutingTemplates(includeInactive = false) {
  const { data } = await http.get<RoutingTemplate[]>("/routing/templates", { params: includeInactive ? { include_inactive: true } : undefined });
  return data;
}
export async function createRoutingTemplate(body: { name: string; spec: string }) {
  const { data } = await http.post<RoutingTemplate>("/routing/templates", body);
  return data;
}
export async function updateRoutingTemplate(id: string, body: Partial<{ name: string; spec: string }>) {
  const { data } = await http.patch<RoutingTemplate>(`/routing/templates/${id}`, body);
  return data;
}
export async function archiveRoutingTemplate(id: string) {
  await http.delete(`/routing/templates/${id}`);
}
export async function listTemplateRevisions(templateId: string) {
  const { data } = await http.get<RoutingRevision[]>(`/routing/templates/${templateId}/revisions`);
  return data;
}
export async function createTemplateRevision(templateId: string, body: { steps?: RoutingStepBody[]; clone_from_revision_id?: number | null }) {
  const { data } = await http.post<RoutingRevisionDetail>(`/routing/templates/${templateId}/revisions`, body);
  return data;
}

export async function listParts(includeInactive = false) {
  const { data } = await http.get<Part[]>("/routing/parts", { params: includeInactive ? { include_inactive: true } : undefined });
  return data;
}
export async function createPart(body: { customer_id: number; part_number: string; revision: string; spec: string; itar?: boolean }) {
  const { data } = await http.post<Part>("/routing/parts", body);
  return data;
}
export async function updatePart(id: number, body: Partial<{ spec: string; itar: boolean }>) {
  const { data } = await http.patch<Part>(`/routing/parts/${id}`, body);
  return data;
}
export async function archivePart(id: number) {
  await http.delete(`/routing/parts/${id}`);
}
export async function listPartRevisions(partId: number) {
  const { data } = await http.get<RoutingRevision[]>(`/routing/parts/${partId}/revisions`);
  return data;
}
export async function createPartRevision(partId: number, body: { steps?: RoutingStepBody[]; clone_from_revision_id?: number | null }) {
  const { data } = await http.post<RoutingRevisionDetail>(`/routing/parts/${partId}/revisions`, body);
  return data;
}

export async function getRoutingRevision(revisionId: number) {
  const { data } = await http.get<RoutingRevisionDetail>(`/routing/revisions/${revisionId}`);
  return data;
}
export async function replaceRevisionSteps(revisionId: number, steps: RoutingStepBody[]) {
  const { data } = await http.put<RoutingRevisionDetail>(`/routing/revisions/${revisionId}/steps`, { steps });
  return data;
}
export async function releaseRevision(revisionId: number) {
  const { data } = await http.post<RoutingRevisionDetail>(`/routing/revisions/${revisionId}/release`);
  return data;
}
export async function obsoleteRevision(revisionId: number) {
  const { data } = await http.post<RoutingRevisionDetail>(`/routing/revisions/${revisionId}/obsolete`);
  return data;
}

// ---- planning module: per-job context + drawing/PO-driven draft generation ---------------
export async function getPlanningContext(jobId: string) {
  const { data } = await http.get<JobPlanningContext>(`/routing/jobs/${jobId}/planning-context`);
  return data;
}
export async function generateFromPo(jobId: string, body: { attach_to_template_id?: string | null } = {}) {
  const { data } = await http.post<RoutingRevisionDetail>(`/routing/jobs/${jobId}/generate-from-po`, body);
  return data;
}

// ---- attachments: part photos + routing-step process instructions / quality alerts -------
export async function listAttachments(entityType: "part" | "routing_step", entityId: number | string) {
  const { data } = await http.get<Attachment[]>("/attachments", { params: { entity_type: entityType, entity_id: entityId } });
  return data;
}
export async function uploadAttachment(
  entityType: "part" | "routing_step",
  entityId: number | string,
  file: File,
  opts: { label?: string; isQualityAlert?: boolean } = {},
) {
  const form = new FormData();
  form.append("entity_type", entityType);
  form.append("entity_id", String(entityId));
  form.append("label", opts.label ?? "");
  form.append("is_quality_alert", String(opts.isQualityAlert ?? false));
  form.append("file", file);
  const { data } = await http.post<Attachment>("/attachments", form, { headers: { "Content-Type": "multipart/form-data" } });
  return data;
}
export async function deleteAttachment(id: number) {
  await http.delete(`/attachments/${id}`);
}
export async function getAttachmentFileBlob(id: number) {
  const { data } = await http.get(`/attachments/${id}/file`, { responseType: "blob" });
  return data as Blob;
}

// ---- finish rates (admin-editable pricing table) -----------------------------------------
export async function listRates() {
  const { data } = await http.get<FinishRate[]>("/rates");
  return data;
}
export async function createRate(body: Partial<FinishRate>) {
  const { data } = await http.post<FinishRate>("/rates", body);
  return data;
}
export async function updateRate(id: number, body: Partial<FinishRate>) {
  const { data } = await http.patch<FinishRate>(`/rates/${id}`, body);
  return data;
}
export async function deleteRate(id: number) {
  await http.delete(`/rates/${id}`);
}
