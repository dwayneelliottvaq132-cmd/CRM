import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/endpoints";

export const qk = {
  dashboard: ["dashboard"],
  orders: ["orders"],
  jobs: ["jobs"],
  job: (id: string) => ["job", id],
  tanks: ["tanks"],
  tankAnalyses: (id: string) => ["tankAnalyses", id],
  tankAdditions: (id: string) => ["tankAdditions", id],
  ncrs: ["ncrs"],
  capas: ["capas"],
  auditPrograms: ["auditPrograms"],
  certQueue: ["certQueue"],
  invoices: ["invoices"],
  qbStatus: ["qbStatus"],
  equipment: ["equipment"],
  inventory: ["inventory"],
  vendors: ["vendors"],
  documents: ["documents"],
  customers: ["customers"],
  portalPreview: (id: number) => ["portalPreview", id],
  auditLog: ["auditLog"],
  apiEndpoints: ["apiEndpoints"],
  integrationInfo: ["integrationInfo"],
  routingTemplates: ["routingTemplates"],
  templateRevisions: (id: string) => ["templateRevisions", id],
  parts: ["parts"],
  partRevisions: (id: number) => ["partRevisions", id],
  routingRevision: (id: number) => ["routingRevision", id],
  matchingTemplates: (id: number) => ["matchingTemplates", id],
  planningQueue: ["jobs", "Needs Planning"],
  planningContext: (jobId: string) => ["planningContext", jobId],
  batchCandidates: (jobId: string) => ["batchCandidates", jobId],
  attachments: (entityType: string, entityId: number | string) => ["attachments", entityType, entityId],
} as const;

export const useDashboard = () => useQuery({ queryKey: qk.dashboard, queryFn: api.dashboardSummary, refetchInterval: 30_000 });
export const useOrders = () => useQuery({ queryKey: qk.orders, queryFn: api.listOrders });
export const useJobs = () => useQuery({ queryKey: qk.jobs, queryFn: () => api.listJobs() });
export const usePlanningQueue = () => useQuery({ queryKey: qk.planningQueue, queryFn: () => api.listJobs(undefined, "Needs Planning") });
export const usePlanningContext = (jobId: string | undefined) =>
  useQuery({ queryKey: qk.planningContext(jobId ?? ""), queryFn: () => api.getPlanningContext(jobId as string), enabled: !!jobId });
export const useBatchCandidates = (jobId: string | undefined) =>
  useQuery({ queryKey: qk.batchCandidates(jobId ?? ""), queryFn: () => api.getBatchCandidates(jobId as string), enabled: !!jobId });
export const useJob = (id: string | undefined) =>
  useQuery({ queryKey: qk.job(id ?? ""), queryFn: () => api.getJob(id as string), enabled: !!id });
export const useTanks = () => useQuery({ queryKey: qk.tanks, queryFn: api.listTanks });
export const useTankAnalyses = (id: string) => useQuery({ queryKey: qk.tankAnalyses(id), queryFn: () => api.tankAnalyses(id) });
export const useTankAdditions = (id: string) => useQuery({ queryKey: qk.tankAdditions(id), queryFn: () => api.tankAdditions(id) });
export const useNcrs = () => useQuery({ queryKey: qk.ncrs, queryFn: api.listNcrs });
export const useCapas = () => useQuery({ queryKey: qk.capas, queryFn: api.listCapas });
export const useAuditPrograms = () => useQuery({ queryKey: qk.auditPrograms, queryFn: api.listAuditPrograms });
export const useCertQueue = () => useQuery({ queryKey: qk.certQueue, queryFn: api.certQueue });
export const useInvoices = () => useQuery({ queryKey: qk.invoices, queryFn: api.listInvoices });
export const useQbStatusQuery = () => useQuery({ queryKey: qk.qbStatus, queryFn: api.qbStatus });
export const useEquipment = () => useQuery({ queryKey: qk.equipment, queryFn: () => api.listEquipment() });
export const useInventory = () => useQuery({ queryKey: qk.inventory, queryFn: api.listInventory });
export const useVendors = () => useQuery({ queryKey: qk.vendors, queryFn: () => api.listVendors() });
export const useDocuments = () => useQuery({ queryKey: qk.documents, queryFn: api.listDocuments });
export const useCustomers = () => useQuery({ queryKey: qk.customers, queryFn: () => api.listCustomers() });
export const usePortalPreview = (id: number | undefined) =>
  useQuery({ queryKey: qk.portalPreview(id ?? -1), queryFn: () => api.portalPreview(id as number), enabled: !!id });
export const useAuditLog = () => useQuery({ queryKey: qk.auditLog, queryFn: () => api.auditLog(100) });
export const useApiEndpoints = () => useQuery({ queryKey: qk.apiEndpoints, queryFn: api.apiEndpoints });
export const useIntegrationInfo = () => useQuery({ queryKey: qk.integrationInfo, queryFn: api.integrationInfo });
export const useRoutingTemplates = () => useQuery({ queryKey: qk.routingTemplates, queryFn: () => api.listRoutingTemplates() });
export const useTemplateRevisions = (id: string | undefined) =>
  useQuery({ queryKey: qk.templateRevisions(id ?? ""), queryFn: () => api.listTemplateRevisions(id as string), enabled: !!id });
export const useParts = () => useQuery({ queryKey: qk.parts, queryFn: () => api.listParts() });
export const usePartRevisions = (id: number | undefined) =>
  useQuery({ queryKey: qk.partRevisions(id ?? -1), queryFn: () => api.listPartRevisions(id as number), enabled: !!id });
export const useRoutingRevision = (id: number | undefined) =>
  useQuery({ queryKey: qk.routingRevision(id ?? -1), queryFn: () => api.getRoutingRevision(id as number), enabled: !!id });

// ---- mutations --------------------------------------------------------------

export function useConvertOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api.convertOrder(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.orders });
      qc.invalidateQueries({ queryKey: qk.jobs });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.orders });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useSaveContractReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, body }: { orderId: string; body: Parameters<typeof api.saveContractReview>[1] }) =>
      api.saveContractReview(orderId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.orders }),
  });
}

export function useAcceptContractReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api.acceptContractReview(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.orders });
      qc.invalidateQueries({ queryKey: qk.jobs });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useRejectContractReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api.rejectContractReview(orderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.orders }),
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof api.updateOrder>[1] }) => api.updateOrder(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.orders }),
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.orders }),
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createCustomer,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.customers }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Parameters<typeof api.updateCustomer>[1] }) => api.updateCustomer(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.customers }),
  });
}

export function useArchiveCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.archiveCustomer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.customers }),
  });
}

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createVendor,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.vendors }),
  });
}

export function useUpdateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Parameters<typeof api.updateVendor>[1] }) => api.updateVendor(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.vendors }),
  });
}

export function useArchiveVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.archiveVendor(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.vendors }),
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createDocument,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.documents }),
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ docNo, body }: { docNo: string; body: Parameters<typeof api.updateDocument>[1] }) => api.updateDocument(docNo, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.documents }),
  });
}

export function useObsoleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docNo: string) => api.obsoleteDocument(docNo),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.documents }),
  });
}

export function useCreateInventoryLot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createInventoryLot,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.inventory }),
  });
}

export function useUpdateInventoryLot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Parameters<typeof api.updateInventoryLot>[1] }) => api.updateInventoryLot(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.inventory }),
  });
}

export function useDeleteInventoryLot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteInventoryLot(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.inventory }),
  });
}

export function useCreateEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createEquipment,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.equipment }),
  });
}

export function useUpdateEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof api.updateEquipment>[1] }) => api.updateEquipment(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.equipment }),
  });
}

export function useArchiveEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.archiveEquipment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.equipment }),
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createJob,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.jobs });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof api.updateJob>[1] }) => api.updateJob(id, body),
    onSuccess: (job) => {
      qc.setQueryData(qk.job(job.id), job);
      qc.invalidateQueries({ queryKey: qk.jobs });
    },
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteJob(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.jobs });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useStartOp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, seq, pin }: { jobId: string; seq: number; pin: string }) => api.startOp(jobId, seq, pin),
    onSuccess: (job) => {
      qc.setQueryData(qk.job(job.id), job);
      qc.invalidateQueries({ queryKey: qk.jobs });
    },
  });
}

export function useSignoffOp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, seq, pin, readings }: { jobId: string; seq: number; pin: string; readings?: { key: string; value: number | string }[] }) =>
      api.signoffOp(jobId, seq, pin, readings),
    onSuccess: (job) => {
      qc.setQueryData(qk.job(job.id), job);
      qc.invalidateQueries({ queryKey: qk.jobs });
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: qk.certQueue });
    },
  });
}

export function useBatchSignoffOp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobIds, pin, readings }: { jobIds: string[]; pin: string; readings?: { key: string; value: number | string }[] }) =>
      api.batchSignoffOp(jobIds, pin, readings),
    onSuccess: (jobs) => {
      for (const job of jobs) {
        qc.setQueryData(qk.job(job.id), job);
        qc.invalidateQueries({ queryKey: qk.batchCandidates(job.id) });
      }
      qc.invalidateQueries({ queryKey: qk.jobs });
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: qk.certQueue });
    },
  });
}

export function useOperatorByPin() {
  return useMutation({ mutationFn: (pin: string) => api.getOperatorByPin(pin) });
}

export const useAttachments = (entityType: "part" | "routing_step", entityId: number | string | undefined) =>
  useQuery({
    queryKey: qk.attachments(entityType, entityId ?? ""),
    queryFn: () => api.listAttachments(entityType, entityId as number | string),
    enabled: entityId !== undefined && entityId !== "",
  });

export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      entityType, entityId, file, label, isQualityAlert,
    }: { entityType: "part" | "routing_step"; entityId: number | string; file: File; label?: string; isQualityAlert?: boolean }) =>
      api.uploadAttachment(entityType, entityId, file, { label, isQualityAlert }),
    onSuccess: (attachment) => {
      qc.invalidateQueries({ queryKey: qk.attachments(attachment.entity_type, attachment.entity_id) });
    },
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; entityType: "part" | "routing_step"; entityId: number | string }) => api.deleteAttachment(id),
    onSuccess: (_void, { entityType, entityId }) => {
      qc.invalidateQueries({ queryKey: qk.attachments(entityType, entityId) });
    },
  });
}

export function useReportProblem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, pin, description }: { jobId: string; pin: string; description: string }) =>
      api.reportProblem(jobId, pin, description),
    onSuccess: (job) => {
      qc.setQueryData(qk.job(job.id), job);
      qc.invalidateQueries({ queryKey: qk.jobs });
      qc.invalidateQueries({ queryKey: qk.ncrs });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useShipJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => api.shipJob(jobId),
    onSuccess: (job) => {
      qc.setQueryData(qk.job(job.id), job);
      qc.invalidateQueries({ queryKey: qk.jobs });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useApplyReleasedPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => api.completePlanningApplyPlan(jobId),
    onSuccess: (job) => {
      qc.setQueryData(qk.job(job.id), job);
      qc.invalidateQueries({ queryKey: qk.jobs });
      qc.invalidateQueries({ queryKey: qk.planningQueue });
      qc.invalidateQueries({ queryKey: qk.planningContext(job.id) });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useApplyPlaceholderPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => api.completePlanningPlaceholder(jobId),
    onSuccess: (job) => {
      qc.setQueryData(qk.job(job.id), job);
      qc.invalidateQueries({ queryKey: qk.jobs });
      qc.invalidateQueries({ queryKey: qk.planningQueue });
      qc.invalidateQueries({ queryKey: qk.planningContext(job.id) });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useGenerateFromPo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, attachToTemplateId }: { jobId: string; attachToTemplateId?: string | null }) =>
      api.generateFromPo(jobId, { attach_to_template_id: attachToTemplateId ?? null }),
    onSuccess: (_revision, { jobId }) => {
      qc.invalidateQueries({ queryKey: qk.parts });
      qc.invalidateQueries({ queryKey: qk.planningContext(jobId) });
    },
  });
}

export function useResolveSpecResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, resultId, note }: { jobId: string; resultId: number; note: string }) =>
      api.resolveSpecResult(jobId, resultId, note),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: qk.job(vars.jobId) });
      qc.invalidateQueries({ queryKey: qk.jobs });
      qc.invalidateQueries({ queryKey: qk.certQueue });
    },
  });
}

export function useLogAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tankId, result, notes }: { tankId: string; result: number; notes?: string }) =>
      api.logAnalysis(tankId, result, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.tanks });
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: qk.certQueue });
    },
  });
}

export function useRecordAddition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tankId, chemical, amount, notes }: { tankId: string; chemical: string; amount: string; notes?: string }) =>
      api.recordAddition(tankId, chemical, amount, notes),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.tankAdditions(vars.tankId) });
    },
  });
}

export function useCreateNcr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createNcr,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.ncrs });
      qc.invalidateQueries({ queryKey: qk.jobs });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useIssueCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => api.issueCertificate(jobId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.certQueue });
    },
  });
}

export function useSyncInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) => api.syncInvoice(invoiceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.invoices }),
  });
}

export function useSyncAllInvoices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.syncAllInvoices,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.invoices }),
  });
}

export const useDrawingAiStatus = () => useQuery({ queryKey: ["drawingAiStatus"], queryFn: api.drawingAiStatus });
export const useDrawingAnalyses = () => useQuery({ queryKey: ["drawings"], queryFn: api.listDrawingAnalyses });
export const useDrawingAnalysis = (id: number | undefined) =>
  useQuery({ queryKey: ["drawing", id ?? -1], queryFn: () => api.getDrawingAnalysis(id as number), enabled: !!id });

export function useAnalyzeDrawing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.analyzeDrawing(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drawings"] });
    },
  });
}

export function useAnalyzeDrawingsBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => api.analyzeDrawingsBatch(files),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drawings"] });
    },
  });
}

export const useMatchingTemplates = (analysisId: number | undefined) =>
  useQuery({
    queryKey: qk.matchingTemplates(analysisId ?? -1),
    queryFn: () => api.matchingTemplates(analysisId as number),
    enabled: !!analysisId,
  });

export function useGenerateRoutingPlanFromDrawing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ analysisId, body }: { analysisId: number; body: Parameters<typeof api.generateRoutingPlanFromDrawing>[1] }) =>
      api.generateRoutingPlanFromDrawing(analysisId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.parts }),
  });
}

export const useEmailIntakeStatus = () => useQuery({ queryKey: ["emailIntakeStatus"], queryFn: api.emailIntakeStatus });
export const useEmailIntakeLog = () => useQuery({ queryKey: ["emailIntakeLog"], queryFn: api.emailIntakeLog });

export function usePollEmailIntakeNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.pollEmailIntakeNow,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emailIntakeStatus"] });
      qc.invalidateQueries({ queryKey: ["emailIntakeLog"] });
      qc.invalidateQueries({ queryKey: ["drawings"] });
    },
  });
}

export const usePoStatus = () => useQuery({ queryKey: ["poStatus"], queryFn: api.poStatus });
export const usePoAnalyses = () => useQuery({ queryKey: ["poAnalyses"], queryFn: api.listPoAnalyses });
export const usePoAnalysis = (id: number | undefined) =>
  useQuery({ queryKey: ["poAnalysis", id ?? -1], queryFn: () => api.getPoAnalysis(id as number), enabled: !!id });

export function useAnalyzePo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ poFile, drawingFiles }: { poFile: File; drawingFiles: File[] }) => api.analyzePo(poFile, drawingFiles),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["poAnalyses"] }),
  });
}

export function useGenerateSalesOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ analysisId, body }: { analysisId: number; body: Parameters<typeof api.generateSalesOrder>[1] }) =>
      api.generateSalesOrder(analysisId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.orders });
      qc.invalidateQueries({ queryKey: qk.jobs });
      qc.invalidateQueries({ queryKey: qk.parts });
    },
  });
}

// ---- process planning: routing templates & parts -----------------------------------------

export function useCreateRoutingTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createRoutingTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.routingTemplates }),
  });
}

export function useUpdateRoutingTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof api.updateRoutingTemplate>[1] }) => api.updateRoutingTemplate(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.routingTemplates }),
  });
}

export function useArchiveRoutingTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.archiveRoutingTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.routingTemplates }),
  });
}

export function useCreateTemplateRevision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, body }: { templateId: string; body: Parameters<typeof api.createTemplateRevision>[1] }) =>
      api.createTemplateRevision(templateId, body),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: qk.templateRevisions(vars.templateId) }),
  });
}

export function useCreatePart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createPart,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.parts }),
  });
}

export function useUpdatePart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Parameters<typeof api.updatePart>[1] }) => api.updatePart(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.parts }),
  });
}

export function useArchivePart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.archivePart(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.parts }),
  });
}

export function useCreatePartRevision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ partId, body }: { partId: number; body: Parameters<typeof api.createPartRevision>[1] }) =>
      api.createPartRevision(partId, body),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: qk.partRevisions(vars.partId) }),
  });
}

export function useReplaceRevisionSteps() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ revisionId, steps }: { revisionId: number; steps: Parameters<typeof api.replaceRevisionSteps>[1] }) =>
      api.replaceRevisionSteps(revisionId, steps),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: qk.routingRevision(vars.revisionId) }),
  });
}

export function useReleaseRevision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ revisionId }: { revisionId: number; templateId?: string; partId?: number }) => api.releaseRevision(revisionId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.routingRevision(vars.revisionId) });
      if (vars.templateId) qc.invalidateQueries({ queryKey: qk.templateRevisions(vars.templateId) });
      if (vars.partId) qc.invalidateQueries({ queryKey: qk.partRevisions(vars.partId) });
    },
  });
}

export function useObsoleteRevision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ revisionId }: { revisionId: number; templateId?: string; partId?: number }) => api.obsoleteRevision(revisionId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.routingRevision(vars.revisionId) });
      if (vars.templateId) qc.invalidateQueries({ queryKey: qk.templateRevisions(vars.templateId) });
      if (vars.partId) qc.invalidateQueries({ queryKey: qk.partRevisions(vars.partId) });
    },
  });
}
