-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('DEALER_PRINCIPAL', 'GENERAL_MANAGER', 'SALES_MANAGER', 'SALES_EXECUTIVE', 'WORKSHOP_CONTROLLER', 'SERVICE_ADVISOR', 'TECHNICIAN', 'PARTS_MANAGER', 'ACCOUNTS');

-- CreateEnum
CREATE TYPE "ModuleKey" AS ENUM ('NEW_CAR_PDI', 'WORKSHOP', 'PARTS', 'USED_CARS', 'WARRANTY', 'DASHBOARD', 'ADMIN', 'CRM', 'VHC', 'LISTINGS', 'ACCOUNTING', 'COURTESY_FLEET', 'FI', 'AI_INSIGHTS', 'AI_CHATBOT', 'GENERAL_LEDGER');

-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT', 'APPROVE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "VehiclePipelineStatus" AS ENUM ('ORDERED', 'IN_PRODUCTION', 'IN_TRANSIT', 'ARRIVED', 'PDI_SCHEDULED', 'PDI_COMPLETE', 'READY_FOR_HANDOVER', 'DELIVERED');

-- CreateEnum
CREATE TYPE "PdiStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETE');

-- CreateEnum
CREATE TYPE "PdiItemRating" AS ENUM ('PASS', 'ADVISORY', 'FAIL');

-- CreateEnum
CREATE TYPE "HandoverType" AS ENUM ('NEW_CAR', 'USED_CAR');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('PDI', 'SERVICE', 'REPAIR', 'WARRANTY', 'MOT');

-- CreateEnum
CREATE TYPE "JobCardStatus" AS ENUM ('CREATED', 'SCHEDULED', 'IN_PROGRESS', 'AWAITING_PARTS', 'COMPLETE', 'INVOICED');

-- CreateEnum
CREATE TYPE "ServiceBookingStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('GOODS_RECEIVED', 'ALLOCATED', 'RETURNED', 'WRITE_OFF');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED');

-- CreateEnum
CREATE TYPE "UsedVehicleStatus" AS ENUM ('IN_STOCK', 'LISTED', 'RESERVED', 'SOLD', 'DELIVERED');

-- CreateEnum
CREATE TYPE "VehicleSource" AS ENUM ('PART_EX', 'TRADE_BUY', 'AUCTION', 'OTHER');

-- CreateEnum
CREATE TYPE "WarrantyClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'AUTHORISED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('PROSPECT', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('ENQUIRY', 'CONTACTED', 'TEST_DRIVE', 'OFFER', 'RESERVED', 'SOLD', 'LOST');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WEBSITE_FORM', 'BMW_CRM', 'EMAIL', 'MANUAL', 'CHATBOT', 'PHONE');

-- CreateEnum
CREATE TYPE "CrmActivityType" AS ENUM ('CALL', 'MEETING', 'NOTE', 'EMAIL', 'SMS', 'STAGE_CHANGE');

-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('INITIAL_ENQUIRY', 'FOLLOW_UP', 'TEST_DRIVE_CONFIRMATION', 'OFFER_LETTER', 'LOST_SALE_RECOVERY', 'SERVICE_REMINDER', 'OTHER');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENT', 'OPENED', 'CLICKED', 'REPLIED', 'FAILED');

-- CreateEnum
CREATE TYPE "SmsStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'REPLIED');

-- CreateEnum
CREATE TYPE "DocumentTemplateType" AS ENUM ('SALES_INVOICE', 'PART_EXCHANGE_RECEIPT', 'SERVICE_ESTIMATE', 'HANDOVER_DOCUMENT');

-- CreateEnum
CREATE TYPE "WorkflowTrigger" AS ENUM ('MANUAL', 'LEAD_STAGE_ENTERED', 'CONTACT_CREATED', 'NO_ACTIVITY_DAYS');

-- CreateEnum
CREATE TYPE "WorkflowActionType" AS ENUM ('SEND_EMAIL', 'SEND_SMS', 'CREATE_TASK', 'CHANGE_LEAD_STAGE', 'ADD_TAG');

-- CreateEnum
CREATE TYPE "WorkflowEnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'UNENROLLED');

-- CreateEnum
CREATE TYPE "VhcRating" AS ENUM ('GREEN', 'AMBER', 'RED');

-- CreateEnum
CREATE TYPE "ListingPlatformType" AS ENUM ('AUTOTRADER', 'MOTORS', 'DEALER_WEBSITE');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED', 'REMOVED');

-- CreateEnum
CREATE TYPE "AccountingProvider" AS ENUM ('XERO', 'SAGE', 'QUICKBOOKS', 'CSV');

-- CreateEnum
CREATE TYPE "AccountingTxnType" AS ENUM ('SALES_INVOICE', 'CREDIT_NOTE', 'PURCHASE_ORDER', 'PAYMENT', 'FI_COMMISSION');

-- CreateEnum
CREATE TYPE "AccountingSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "CourtesyVehicleStatus" AS ENUM ('AVAILABLE', 'ON_LOAN', 'OFF_ROAD', 'IN_FOR_SERVICE');

-- CreateEnum
CREATE TYPE "FiProductType" AS ENUM ('FINANCE', 'INSURANCE');

-- CreateEnum
CREATE TYPE "AiConversationChannel" AS ENUM ('INTERNAL_ASSISTANT', 'CUSTOMER_CHATBOT');

-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateTable
CREATE TABLE "dealers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "franchiseCode" TEXT,
    "address" TEXT,
    "timeZone" TEXT NOT NULL DEFAULT 'Europe/London',
    "locale" TEXT NOT NULL DEFAULT 'en-GB',
    "subdomain" TEXT NOT NULL,
    "risDealerId" TEXT,
    "awpWebhookUrl" TEXT,
    "logoUrl" TEXT,
    "primaryColour" TEXT DEFAULT '#0066B1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dealers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "systemRole" "SystemRole",
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "module" "ModuleKey" NOT NULL,
    "action" "PermissionAction" NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "user_module_overrides" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" "ModuleKey" NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "allowed" BOOLEAN NOT NULL,

    CONSTRAINT "user_module_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_audits" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "roleIds" TEXT[],
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_licenses" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "module" "ModuleKey" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "stripeSubscriptionItemId" TEXT,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "userId" TEXT,
    "module" "ModuleKey" NOT NULL,
    "action" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "vin" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "colour" TEXT,
    "customerName" TEXT,
    "eta" TIMESTAMP(3),
    "status" "VehiclePipelineStatus" NOT NULL DEFAULT 'ORDERED',
    "allocatedAdvisorId" TEXT,
    "risOrderRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdi_jobs" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "bayId" TEXT,
    "technicianId" TEXT,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 60,
    "status" "PdiStatus" NOT NULL DEFAULT 'SCHEDULED',
    "awpJobRef" TEXT,
    "jobCardId" TEXT,
    "signedOffAt" TIMESTAMP(3),
    "signedOffBy" TEXT,
    "checklistPdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pdi_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdi_checklist_items" (
    "id" TEXT NOT NULL,
    "pdiJobId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rating" "PdiItemRating",
    "notes" TEXT,
    "photoUrls" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pdi_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handover_appointments" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "type" "HandoverType" NOT NULL,
    "vehicleId" TEXT,
    "usedVehicleId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "advisorId" TEXT,
    "checklistJson" JSONB,
    "signatureUrl" TEXT,
    "completedAt" TIMESTAMP(3),
    "confirmationEmailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handover_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bays" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "bays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_cards" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "contactId" TEXT,
    "vehicleId" TEXT,
    "vehicleReg" TEXT,
    "jobType" "JobType" NOT NULL,
    "description" TEXT,
    "estimatedHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "status" "JobCardStatus" NOT NULL DEFAULT 'CREATED',
    "bayId" TEXT,
    "assignedTechnicianId" TEXT,
    "serviceAdvisorId" TEXT,
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "awpJobRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_card_time_entries" (
    "id" TEXT NOT NULL,
    "jobCardId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "clockOn" TIMESTAMP(3) NOT NULL,
    "clockOff" TIMESTAMP(3),

    CONSTRAINT "job_card_time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capacity_blocks" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "bayId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "availableMinutes" INTEGER NOT NULL DEFAULT 480,
    "reason" TEXT,

    CONSTRAINT "capacity_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_bookings" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "vehicleReg" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "requestedSlot" TIMESTAMP(3) NOT NULL,
    "status" "ServiceBookingStatus" NOT NULL DEFAULT 'REQUESTED',
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "binLocation" TEXT,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    "costPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reasonCode" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_allocations" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "jobCardId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "part_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "quantityOrdered" INTEGER NOT NULL,
    "quantityReceived" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "used_vehicles" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "reg" TEXT NOT NULL,
    "vin" TEXT,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "colour" TEXT,
    "mileage" INTEGER,
    "fuel" TEXT,
    "transmission" TEXT,
    "purchasePrice" DECIMAL(10,2),
    "askingPrice" DECIMAL(10,2),
    "source" "VehicleSource" NOT NULL DEFAULT 'OTHER',
    "status" "UsedVehicleStatus" NOT NULL DEFAULT 'IN_STOCK',
    "listedAt" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "v5cDocumentUrl" TEXT,
    "serviceHistoryUrl" TEXT,
    "hpiReportUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "used_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_photos" (
    "id" TEXT NOT NULL,
    "usedVehicleId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "vehicle_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history_entries" (
    "id" TEXT NOT NULL,
    "usedVehicleId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_exchange_appraisals" (
    "id" TEXT NOT NULL,
    "usedVehicleId" TEXT NOT NULL,
    "dealId" TEXT,
    "condition" TEXT,
    "mileage" INTEGER,
    "damageNotes" TEXT,
    "photoUrls" TEXT[],
    "agreedValue" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "part_exchange_appraisals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_sheets" (
    "id" TEXT NOT NULL,
    "usedVehicleId" TEXT NOT NULL,
    "sellingPrice" DECIMAL(10,2) NOT NULL,
    "partExchangeValue" DECIMAL(10,2),
    "financeContribution" DECIMAL(10,2),
    "accessoriesTotal" DECIMAL(10,2),
    "grossProfit" DECIMAL(10,2),
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranty_claims" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "jobCardId" TEXT,
    "customerName" TEXT NOT NULL,
    "faultDescription" TEXT NOT NULL,
    "symptomCode" TEXT,
    "status" "WarrantyClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "awpAuthorisationRef" TEXT,
    "rejectionReason" TEXT,
    "expectedPayment" DECIMAL(10,2),
    "actualPayment" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warranty_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranty_operation_lines" (
    "id" TEXT NOT NULL,
    "warrantyClaimId" TEXT NOT NULL,
    "operationCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "standardMinutes" INTEGER NOT NULL,
    "cause" TEXT,
    "correction" TEXT,
    "complaint" TEXT,
    "labourWriteUp" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warranty_operation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranty_clock_entries" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "clockOn" TIMESTAMP(3) NOT NULL,
    "clockOff" TIMESTAMP(3),

    CONSTRAINT "warranty_clock_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" "ContactStatus" NOT NULL DEFAULT 'PROSPECT',
    "gdprConsent" BOOLEAN NOT NULL DEFAULT false,
    "emailOptIn" BOOLEAN NOT NULL DEFAULT true,
    "smsOptIn" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "usedVehicleId" TEXT,
    "stage" "LeadStage" NOT NULL DEFAULT 'ENQUIRY',
    "source" "LeadSource" NOT NULL DEFAULT 'MANUAL',
    "assignedSalespersonId" TEXT,
    "lostReason" TEXT,
    "score" INTEGER DEFAULT 0,
    "scoreReasons" TEXT[],
    "lastActivityAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_activities" (
    "id" TEXT NOT NULL,
    "contactId" TEXT,
    "leadId" TEXT,
    "type" "CrmActivityType" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_tasks" (
    "id" TEXT NOT NULL,
    "contactId" TEXT,
    "leadId" TEXT,
    "assigneeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "overdueAlertSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "TemplateCategory" NOT NULL DEFAULT 'OTHER',
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "templateId" TEXT,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_templates" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_messages" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "SmsStatus" NOT NULL DEFAULT 'QUEUED',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "type" "DocumentTemplateType" NOT NULL,
    "name" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" "WorkflowTrigger" NOT NULL DEFAULT 'MANUAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_steps" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "delayHours" INTEGER NOT NULL DEFAULT 0,
    "actionType" "WorkflowActionType" NOT NULL,
    "actionConfig" JSONB NOT NULL,

    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_enrollments" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "contactId" TEXT,
    "leadId" TEXT,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "status" "WorkflowEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextRunAt" TIMESTAMP(3),

    CONSTRAINT "workflow_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vhc_inspections" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "jobCardId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "vehicleReg" TEXT NOT NULL,
    "mileage" INTEGER,
    "reportUrl" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vhc_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vhc_items" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rating" "VhcRating" NOT NULL,
    "description" TEXT,
    "photoUrls" TEXT[],
    "estimatedLabourMinutes" INTEGER,
    "estimatedPartsCost" DECIMAL(10,2),
    "approved" BOOLEAN,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "vhc_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_platforms" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "type" "ListingPlatformType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "credentialsSecretRef" TEXT,

    CONSTRAINT "listing_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_listings" (
    "id" TEXT NOT NULL,
    "usedVehicleId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'PENDING',
    "errorDetail" TEXT,
    "viewCount" INTEGER,
    "enquiryCount" INTEGER,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "vehicle_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_integrations" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "provider" "AccountingProvider" NOT NULL,
    "credentialsSecretRef" TEXT,
    "accountMappings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_transactions" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "type" "AccountingTxnType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "nominalCode" TEXT,
    "sourceRecordId" TEXT,
    "status" "AccountingSyncStatus" NOT NULL DEFAULT 'PENDING',
    "errorDetail" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courtesy_vehicles" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "reg" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "colour" TEXT,
    "mileage" INTEGER,
    "insuranceExpiry" TIMESTAMP(3),
    "motExpiry" TIMESTAMP(3),
    "taxExpiry" TIMESTAMP(3),
    "status" "CourtesyVehicleStatus" NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT "courtesy_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courtesy_bookings" (
    "id" TEXT NOT NULL,
    "courtesyVehicleId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "linkedJobCardId" TEXT,
    "outDate" TIMESTAMP(3) NOT NULL,
    "expectedReturnDate" TIMESTAMP(3) NOT NULL,
    "outMileage" INTEGER,
    "returnMileage" INTEGER,
    "actualReturnDate" TIMESTAMP(3),
    "handoverConditionUrl" TEXT,
    "returnConditionUrl" TEXT,
    "handoverSignatureUrl" TEXT,
    "returnSignatureUrl" TEXT,
    "newDamageNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courtesy_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_products" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "type" "FiProductType" NOT NULL,
    "name" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "productCode" TEXT,
    "commissionRate" DECIMAL(6,3),
    "commissionFixed" DECIMAL(10,2),
    "fcaProductRef" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "finance_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_finance_products" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT,
    "usedVehicleId" TEXT,
    "productId" TEXT NOT NULL,
    "term" INTEGER,
    "monthlyPayment" DECIMAL(10,2),
    "totalPremium" DECIMAL(10,2),
    "commissionAmount" DECIMAL(10,2),
    "lenderName" TEXT,
    "agreementNumber" TEXT,
    "amountFinanced" DECIMAL(10,2),
    "apr" DECIMAL(6,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_finance_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fca_disclosures" (
    "id" TEXT NOT NULL,
    "dealFinanceProductId" TEXT NOT NULL,
    "commissionDisclosed" BOOLEAN NOT NULL DEFAULT false,
    "customerConsentAt" TIMESTAMP(3),
    "customerSignatureUrl" TEXT,
    "vulnerableCustomerFlag" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fca_disclosures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "channel" "AiConversationChannel" NOT NULL,
    "userId" TEXT,
    "contactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dealers_subdomain_key" ON "dealers"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "roles_dealerId_name_key" ON "roles"("dealerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_module_action_key" ON "role_permissions"("roleId", "module", "action");

-- CreateIndex
CREATE UNIQUE INDEX "users_dealerId_email_key" ON "users"("dealerId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "user_module_overrides_userId_module_action_key" ON "user_module_overrides"("userId", "module", "action");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refreshToken_key" ON "user_sessions"("refreshToken");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "module_licenses_dealerId_module_key" ON "module_licenses"("dealerId", "module");

-- CreateIndex
CREATE INDEX "audit_logs_dealerId_module_createdAt_idx" ON "audit_logs"("dealerId", "module", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_dealerId_docType_year_key" ON "document_sequences"("dealerId", "docType", "year");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_dealerId_vin_key" ON "vehicles"("dealerId", "vin");

-- CreateIndex
CREATE UNIQUE INDEX "pdi_jobs_jobCardId_key" ON "pdi_jobs"("jobCardId");

-- CreateIndex
CREATE UNIQUE INDEX "bays_dealerId_name_key" ON "bays"("dealerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "capacity_blocks_bayId_date_key" ON "capacity_blocks"("bayId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "parts_dealerId_partNumber_key" ON "parts"("dealerId", "partNumber");

-- CreateIndex
CREATE UNIQUE INDEX "used_vehicles_dealerId_reg_key" ON "used_vehicles"("dealerId", "reg");

-- CreateIndex
CREATE UNIQUE INDEX "part_exchange_appraisals_usedVehicleId_key" ON "part_exchange_appraisals"("usedVehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "deal_sheets_usedVehicleId_key" ON "deal_sheets"("usedVehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "warranty_claims_jobCardId_key" ON "warranty_claims"("jobCardId");

-- CreateIndex
CREATE UNIQUE INDEX "listing_platforms_dealerId_type_key" ON "listing_platforms"("dealerId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_listings_usedVehicleId_platformId_key" ON "vehicle_listings"("usedVehicleId", "platformId");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_integrations_dealerId_provider_key" ON "accounting_integrations"("dealerId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "courtesy_vehicles_dealerId_reg_key" ON "courtesy_vehicles"("dealerId", "reg");

-- CreateIndex
CREATE UNIQUE INDEX "fca_disclosures_dealFinanceProductId_key" ON "fca_disclosures"("dealFinanceProductId");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_module_overrides" ADD CONSTRAINT "user_module_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_audits" ADD CONSTRAINT "login_audits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_licenses" ADD CONSTRAINT "module_licenses_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_allocatedAdvisorId_fkey" FOREIGN KEY ("allocatedAdvisorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdi_jobs" ADD CONSTRAINT "pdi_jobs_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdi_jobs" ADD CONSTRAINT "pdi_jobs_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdi_jobs" ADD CONSTRAINT "pdi_jobs_bayId_fkey" FOREIGN KEY ("bayId") REFERENCES "bays"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdi_jobs" ADD CONSTRAINT "pdi_jobs_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "job_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdi_checklist_items" ADD CONSTRAINT "pdi_checklist_items_pdiJobId_fkey" FOREIGN KEY ("pdiJobId") REFERENCES "pdi_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_appointments" ADD CONSTRAINT "handover_appointments_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_appointments" ADD CONSTRAINT "handover_appointments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_appointments" ADD CONSTRAINT "handover_appointments_usedVehicleId_fkey" FOREIGN KEY ("usedVehicleId") REFERENCES "used_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bays" ADD CONSTRAINT "bays_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_bayId_fkey" FOREIGN KEY ("bayId") REFERENCES "bays"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_assignedTechnicianId_fkey" FOREIGN KEY ("assignedTechnicianId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_serviceAdvisorId_fkey" FOREIGN KEY ("serviceAdvisorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_card_time_entries" ADD CONSTRAINT "job_card_time_entries_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "job_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_card_time_entries" ADD CONSTRAINT "job_card_time_entries_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacity_blocks" ADD CONSTRAINT "capacity_blocks_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacity_blocks" ADD CONSTRAINT "capacity_blocks_bayId_fkey" FOREIGN KEY ("bayId") REFERENCES "bays"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_allocations" ADD CONSTRAINT "part_allocations_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_allocations" ADD CONSTRAINT "part_allocations_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "job_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "used_vehicles" ADD CONSTRAINT "used_vehicles_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_usedVehicleId_fkey" FOREIGN KEY ("usedVehicleId") REFERENCES "used_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history_entries" ADD CONSTRAINT "price_history_entries_usedVehicleId_fkey" FOREIGN KEY ("usedVehicleId") REFERENCES "used_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_exchange_appraisals" ADD CONSTRAINT "part_exchange_appraisals_usedVehicleId_fkey" FOREIGN KEY ("usedVehicleId") REFERENCES "used_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_sheets" ADD CONSTRAINT "deal_sheets_usedVehicleId_fkey" FOREIGN KEY ("usedVehicleId") REFERENCES "used_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "job_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_operation_lines" ADD CONSTRAINT "warranty_operation_lines_warrantyClaimId_fkey" FOREIGN KEY ("warrantyClaimId") REFERENCES "warranty_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_clock_entries" ADD CONSTRAINT "warranty_clock_entries_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "warranty_operation_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_clock_entries" ADD CONSTRAINT "warranty_clock_entries_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_usedVehicleId_fkey" FOREIGN KEY ("usedVehicleId") REFERENCES "used_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignedSalespersonId_fkey" FOREIGN KEY ("assignedSalespersonId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_enrollments" ADD CONSTRAINT "workflow_enrollments_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_enrollments" ADD CONSTRAINT "workflow_enrollments_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_enrollments" ADD CONSTRAINT "workflow_enrollments_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vhc_inspections" ADD CONSTRAINT "vhc_inspections_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vhc_inspections" ADD CONSTRAINT "vhc_inspections_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "job_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vhc_items" ADD CONSTRAINT "vhc_items_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "vhc_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_platforms" ADD CONSTRAINT "listing_platforms_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_listings" ADD CONSTRAINT "vehicle_listings_usedVehicleId_fkey" FOREIGN KEY ("usedVehicleId") REFERENCES "used_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_listings" ADD CONSTRAINT "vehicle_listings_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "listing_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_integrations" ADD CONSTRAINT "accounting_integrations_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_transactions" ADD CONSTRAINT "accounting_transactions_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "accounting_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courtesy_vehicles" ADD CONSTRAINT "courtesy_vehicles_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courtesy_bookings" ADD CONSTRAINT "courtesy_bookings_courtesyVehicleId_fkey" FOREIGN KEY ("courtesyVehicleId") REFERENCES "courtesy_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_products" ADD CONSTRAINT "finance_products_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_finance_products" ADD CONSTRAINT "deal_finance_products_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_finance_products" ADD CONSTRAINT "deal_finance_products_usedVehicleId_fkey" FOREIGN KEY ("usedVehicleId") REFERENCES "used_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_finance_products" ADD CONSTRAINT "deal_finance_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "finance_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fca_disclosures" ADD CONSTRAINT "fca_disclosures_dealFinanceProductId_fkey" FOREIGN KEY ("dealFinanceProductId") REFERENCES "deal_finance_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
