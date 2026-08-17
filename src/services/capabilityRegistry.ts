import { RoleType } from '@prisma/client';

export type CapabilityRiskLevel =
  | 'READ_ONLY'
  | 'NAVIGATION'
  | 'LOW_RISK_WRITE'
  | 'CONSEQUENTIAL_WRITE'
  | 'FINANCIAL'
  | 'DESTRUCTIVE';

export interface ApplicationCapability {
  capabilityId: string;
  name: string;
  description: string;
  screenRoute: string;
  category:
    | 'NAVIGATION'
    | 'DASHBOARD'
    | 'ORDERS'
    | 'KITCHEN'
    | 'INVENTORY'
    | 'CONSUMPTION'
    | 'WASTE'
    | 'MENU'
    | 'RECIPES'
    | 'PROCUREMENT'
    | 'SUPPLIERS'
    | 'DELIVERIES'
    | 'RECEIVING'
    | 'INVOICES'
    | 'RECONCILIATION'
    | 'ANALYTICS'
    | 'REPORTS'
    | 'ADMIN'
    | 'SETTINGS';
  actionType: string;
  requiredPermissions: RoleType[];
  confirmationRequired: boolean;
  riskLevel: CapabilityRiskLevel;
  parameters: Record<string, { type: string; required: boolean; description: string }>;
  backendService?: string;
  frontendAction: string;
}

export const UNIVERSAL_CAPABILITY_REGISTRY: ApplicationCapability[] = [
  // ==========================================
  // 1. NAVIGATION CAPABILITIES
  // ==========================================
  {
    capabilityId: 'nav.dashboard',
    name: 'Navigate to Dashboard',
    description: 'Open the main executive operations dashboard',
    screenRoute: '/',
    category: 'NAVIGATION',
    actionType: 'NAVIGATE',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.INVENTORY_MANAGER, RoleType.HEAD_CHEF, RoleType.STAFF],
    confirmationRequired: false,
    riskLevel: 'NAVIGATION',
    parameters: {},
    frontendAction: 'navigate("/")',
  },
  {
    capabilityId: 'nav.inventory',
    name: 'Navigate to Inventory',
    description: 'Open ingredient stock and batch management',
    screenRoute: '/operations/inventory',
    category: 'NAVIGATION',
    actionType: 'NAVIGATE',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.INVENTORY_MANAGER, RoleType.HEAD_CHEF, RoleType.STAFF],
    confirmationRequired: false,
    riskLevel: 'NAVIGATION',
    parameters: {},
    frontendAction: 'navigate("/operations/inventory")',
  },
  {
    capabilityId: 'nav.orders',
    name: 'Navigate to Orders',
    description: 'Open live POS orders pipeline and customer orders',
    screenRoute: '/operations/orders',
    category: 'NAVIGATION',
    actionType: 'NAVIGATE',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.INVENTORY_MANAGER, RoleType.HEAD_CHEF, RoleType.STAFF],
    confirmationRequired: false,
    riskLevel: 'NAVIGATION',
    parameters: {},
    frontendAction: 'navigate("/operations/orders")',
  },
  {
    capabilityId: 'nav.kds',
    name: 'Navigate to Kitchen Display System (KDS)',
    description: 'Open active kitchen stations and ticket queue',
    screenRoute: '/operations/kds',
    category: 'NAVIGATION',
    actionType: 'NAVIGATE',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.HEAD_CHEF, RoleType.STAFF],
    confirmationRequired: false,
    riskLevel: 'NAVIGATION',
    parameters: {},
    frontendAction: 'navigate("/operations/kds")',
  },
  {
    capabilityId: 'nav.procurement',
    name: 'Navigate to Procurement & Purchase Orders',
    description: 'Open purchase order creation and supplier tracking',
    screenRoute: '/procurement/purchase-orders',
    category: 'NAVIGATION',
    actionType: 'NAVIGATE',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.INVENTORY_MANAGER],
    confirmationRequired: false,
    riskLevel: 'NAVIGATION',
    parameters: {},
    frontendAction: 'navigate("/procurement/purchase-orders")',
  },
  {
    capabilityId: 'nav.recommendations',
    name: 'Navigate to Purchase Intelligence',
    description: 'Open AI forecast and deterministic purchase recommendations',
    screenRoute: '/procurement/intelligence',
    category: 'NAVIGATION',
    actionType: 'NAVIGATE',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.INVENTORY_MANAGER],
    confirmationRequired: false,
    riskLevel: 'NAVIGATION',
    parameters: {},
    frontendAction: 'navigate("/procurement/intelligence")',
  },
  {
    capabilityId: 'nav.suppliers',
    name: 'Navigate to Suppliers',
    description: 'Open approved vendor directory and contact terms',
    screenRoute: '/procurement/suppliers',
    category: 'NAVIGATION',
    actionType: 'NAVIGATE',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.INVENTORY_MANAGER],
    confirmationRequired: false,
    riskLevel: 'NAVIGATION',
    parameters: {},
    frontendAction: 'navigate("/procurement/suppliers")',
  },
  {
    capabilityId: 'nav.receiving',
    name: 'Navigate to Goods Receiving',
    description: 'Open physical delivery inspection and GRN logging',
    screenRoute: '/procurement/receiving',
    category: 'NAVIGATION',
    actionType: 'NAVIGATE',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.INVENTORY_MANAGER],
    confirmationRequired: false,
    riskLevel: 'NAVIGATION',
    parameters: {},
    frontendAction: 'navigate("/procurement/receiving")',
  },
  {
    capabilityId: 'nav.invoices',
    name: 'Navigate to Invoices',
    description: 'Open vendor invoice uploads and OCR extraction',
    screenRoute: '/procurement/invoices',
    category: 'NAVIGATION',
    actionType: 'NAVIGATE',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.INVENTORY_MANAGER],
    confirmationRequired: false,
    riskLevel: 'NAVIGATION',
    parameters: {},
    frontendAction: 'navigate("/procurement/invoices")',
  },
  {
    capabilityId: 'nav.reconciliation',
    name: 'Navigate to 3-Way Reconciliation',
    description: 'Open PO vs Receiving vs Invoice 3-way matching and discrepancy review',
    screenRoute: '/procurement/reconciliation',
    category: 'NAVIGATION',
    actionType: 'NAVIGATE',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER],
    confirmationRequired: false,
    riskLevel: 'NAVIGATION',
    parameters: {},
    frontendAction: 'navigate("/procurement/reconciliation")',
  },
  {
    capabilityId: 'nav.recipes',
    name: 'Navigate to Recipe BOM',
    description: 'Open menu item recipe bill of materials and portion formulas',
    screenRoute: '/menu/recipes',
    category: 'NAVIGATION',
    actionType: 'NAVIGATE',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.HEAD_CHEF],
    confirmationRequired: false,
    riskLevel: 'NAVIGATION',
    parameters: {},
    frontendAction: 'navigate("/menu/recipes")',
  },
  {
    capabilityId: 'nav.menuItems',
    name: 'Navigate to Menu Items',
    description: 'Open menu catalogue, categories, and selling prices',
    screenRoute: '/menu/items',
    category: 'NAVIGATION',
    actionType: 'NAVIGATE',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.HEAD_CHEF],
    confirmationRequired: false,
    riskLevel: 'NAVIGATION',
    parameters: {},
    frontendAction: 'navigate("/menu/items")',
  },
  {
    capabilityId: 'nav.waste',
    name: 'Navigate to Waste Management',
    description: 'Open food wastage tracking and spoilage logs',
    screenRoute: '/operations/waste',
    category: 'NAVIGATION',
    actionType: 'NAVIGATE',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.INVENTORY_MANAGER, RoleType.HEAD_CHEF],
    confirmationRequired: false,
    riskLevel: 'NAVIGATION',
    parameters: {},
    frontendAction: 'navigate("/operations/waste")',
  },
  {
    capabilityId: 'nav.analytics',
    name: 'Navigate to Analytics',
    description: 'Open restaurant revenue analytics, food cost variance, and charts',
    screenRoute: '/analytics',
    category: 'NAVIGATION',
    actionType: 'NAVIGATE',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER],
    confirmationRequired: false,
    riskLevel: 'NAVIGATION',
    parameters: {},
    frontendAction: 'navigate("/analytics")',
  },
  {
    capabilityId: 'nav.dailyReports',
    name: 'Navigate to Daily EOD Reports',
    description: 'Open End of Day consolidated reports and financial statements',
    screenRoute: '/reports/daily',
    category: 'NAVIGATION',
    actionType: 'NAVIGATE',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER],
    confirmationRequired: false,
    riskLevel: 'NAVIGATION',
    parameters: {},
    frontendAction: 'navigate("/reports/daily")',
  },
  {
    capabilityId: 'nav.adminUsers',
    name: 'Navigate to User Management',
    description: 'Open staff accounts, roles, and branch assignments',
    screenRoute: '/admin/users',
    category: 'NAVIGATION',
    actionType: 'NAVIGATE',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER],
    confirmationRequired: false,
    riskLevel: 'NAVIGATION',
    parameters: {},
    frontendAction: 'navigate("/admin/users")',
  },
  {
    capabilityId: 'nav.adminBranches',
    name: 'Navigate to Branch Management',
    description: 'Open restaurant locations and branch profiles',
    screenRoute: '/admin/branches',
    category: 'NAVIGATION',
    actionType: 'NAVIGATE',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER],
    confirmationRequired: false,
    riskLevel: 'NAVIGATION',
    parameters: {},
    frontendAction: 'navigate("/admin/branches")',
  },
  {
    capabilityId: 'nav.auditLogs',
    name: 'Navigate to Audit Logs',
    description: 'Open immutable system audit trails',
    screenRoute: '/admin/audit-logs',
    category: 'NAVIGATION',
    actionType: 'NAVIGATE',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER],
    confirmationRequired: false,
    riskLevel: 'NAVIGATION',
    parameters: {},
    frontendAction: 'navigate("/admin/audit-logs")',
  },

  // ==========================================
  // 2. INVENTORY OPERATIONS
  // ==========================================
  {
    capabilityId: 'inventory.queryStock',
    name: 'Check Ingredient Stock',
    description: 'Query live stock level, unit, and health status for an ingredient',
    screenRoute: '/operations/inventory',
    category: 'INVENTORY',
    actionType: 'QUERY',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.INVENTORY_MANAGER, RoleType.HEAD_CHEF, RoleType.STAFF],
    confirmationRequired: false,
    riskLevel: 'READ_ONLY',
    parameters: {
      ingredientName: { type: 'string', required: true, description: 'Ingredient name or partial match' },
    },
    backendService: 'InventoryEngineService.getStock',
    frontendAction: 'highlightRow(ingredientId) & setSearchQuery(ingredientName)',
  },
  {
    capabilityId: 'inventory.addStock',
    name: 'Add Stock to Inventory',
    description: 'Perform manual stock addition or purchase receipt with audit reason',
    screenRoute: '/operations/inventory',
    category: 'INVENTORY',
    actionType: 'MUTATION',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.INVENTORY_MANAGER],
    confirmationRequired: true,
    riskLevel: 'LOW_RISK_WRITE',
    parameters: {
      ingredientName: { type: 'string', required: true, description: 'Ingredient name' },
      quantity: { type: 'number', required: true, description: 'Quantity in purchase/stock unit' },
      unit: { type: 'string', required: false, description: 'Unit (kg, g, ltr, pkts)' },
      reason: { type: 'string', required: false, description: 'Audit reason' },
    },
    backendService: 'InventoryEngineService.adjustStock',
    frontendAction: 'refreshInventory() & highlightRow(ingredientId)',
  },
  {
    capabilityId: 'inventory.deductStock',
    name: 'Deduct Stock from Inventory',
    description: 'Perform manual stock consumption or transfer deduction',
    screenRoute: '/operations/inventory',
    category: 'INVENTORY',
    actionType: 'MUTATION',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.INVENTORY_MANAGER, RoleType.HEAD_CHEF],
    confirmationRequired: true,
    riskLevel: 'LOW_RISK_WRITE',
    parameters: {
      ingredientName: { type: 'string', required: true, description: 'Ingredient name' },
      quantity: { type: 'number', required: true, description: 'Quantity to deduct' },
      unit: { type: 'string', required: false, description: 'Unit' },
      reason: { type: 'string', required: false, description: 'Reason for deduction' },
    },
    backendService: 'InventoryEngineService.adjustStock',
    frontendAction: 'refreshInventory() & highlightRow(ingredientId)',
  },
  {
    capabilityId: 'inventory.filterLowStock',
    name: 'Filter Low and Critical Stock',
    description: 'Filter inventory table to show only items at or below reorder level',
    screenRoute: '/operations/inventory',
    category: 'INVENTORY',
    actionType: 'FILTER',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.INVENTORY_MANAGER, RoleType.HEAD_CHEF, RoleType.STAFF],
    confirmationRequired: false,
    riskLevel: 'READ_ONLY',
    parameters: {
      status: { type: 'string', required: false, description: 'LOW_STOCK | CRITICAL | OUT_OF_STOCK' },
    },
    frontendAction: 'setFilter({ status: "LOW_STOCK" })',
  },
  {
    capabilityId: 'inventory.openAddModal',
    name: 'Open Add Ingredient Drawer',
    description: 'Open the UI drawer to create a new inventory ingredient',
    screenRoute: '/operations/inventory',
    category: 'INVENTORY',
    actionType: 'UI_INTERACTION',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.INVENTORY_MANAGER],
    confirmationRequired: false,
    riskLevel: 'NAVIGATION',
    parameters: {},
    frontendAction: 'openDrawer("addIngredient")',
  },

  // ==========================================
  // 3. ORDERS & KITCHEN (KDS)
  // ==========================================
  {
    capabilityId: 'orders.queryActive',
    name: 'Query Active Orders',
    description: 'Count and list pending or preparing orders',
    screenRoute: '/operations/orders',
    category: 'ORDERS',
    actionType: 'QUERY',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.HEAD_CHEF, RoleType.STAFF],
    confirmationRequired: false,
    riskLevel: 'READ_ONLY',
    parameters: {
      status: { type: 'string', required: false, description: 'PENDING | PREPARING | READY | DELIVERED' },
    },
    frontendAction: 'setFilter({ status })',
  },
  {
    capabilityId: 'orders.openDetails',
    name: 'Open Order Details',
    description: 'Open order ticket modal or inspect customer bill',
    screenRoute: '/operations/orders',
    category: 'ORDERS',
    actionType: 'UI_INTERACTION',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.HEAD_CHEF, RoleType.STAFF],
    confirmationRequired: false,
    riskLevel: 'READ_ONLY',
    parameters: {
      orderId: { type: 'string', required: false, description: 'Order ID or index (first, latest)' },
    },
    frontendAction: 'openModal("orderDetails", { orderId })',
  },
  {
    capabilityId: 'orders.updateStatus',
    name: 'Update Order Status',
    description: 'Change order lifecycle status (Preparing, Ready, Served, Cancelled)',
    screenRoute: '/operations/orders',
    category: 'ORDERS',
    actionType: 'MUTATION',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.HEAD_CHEF, RoleType.STAFF],
    confirmationRequired: false,
    riskLevel: 'LOW_RISK_WRITE',
    parameters: {
      orderId: { type: 'string', required: true, description: 'Order ID' },
      status: { type: 'string', required: true, description: 'New order status' },
    },
    backendService: 'OrderService.updateStatus',
    frontendAction: 'refreshOrders()',
  },
  {
    capabilityId: 'kds.queryPreparing',
    name: 'Query Kitchen Preparing Items',
    description: 'Query live KDS station item counts and active cook queue',
    screenRoute: '/operations/kds',
    category: 'KITCHEN',
    actionType: 'QUERY',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.HEAD_CHEF, RoleType.STAFF],
    confirmationRequired: false,
    riskLevel: 'READ_ONLY',
    parameters: {},
    frontendAction: 'navigate("/operations/kds")',
  },
  {
    capabilityId: 'kds.markItemReady',
    name: 'Mark Kitchen Item Ready',
    description: 'Mark a KDS order ticket item as cooked and ready to serve',
    screenRoute: '/operations/kds',
    category: 'KITCHEN',
    actionType: 'MUTATION',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.HEAD_CHEF, RoleType.STAFF],
    confirmationRequired: false,
    riskLevel: 'LOW_RISK_WRITE',
    parameters: {
      orderItemId: { type: 'string', required: true, description: 'Order item ticket ID' },
    },
    backendService: 'KDSService.updateItemStatus',
    frontendAction: 'refreshKDS()',
  },

  // ==========================================
  // 4. PROCUREMENT & PURCHASE ORDERS
  // ==========================================
  {
    capabilityId: 'procurement.generateRecommendations',
    name: 'Generate Purchase Recommendations',
    description: 'Run deterministic formula to calculate tomorrow replenishment requirements',
    screenRoute: '/procurement/intelligence',
    category: 'PROCUREMENT',
    actionType: 'QUERY',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.INVENTORY_MANAGER],
    confirmationRequired: false,
    riskLevel: 'READ_ONLY',
    parameters: {},
    backendService: 'RecommendationEngineService.generateRecommendations',
    frontendAction: 'navigate("/procurement/intelligence")',
  },
  {
    capabilityId: 'procurement.createPO',
    name: 'Create Purchase Order',
    description: 'Prepare and draft a Purchase Order for supplier',
    screenRoute: '/procurement/purchase-orders',
    category: 'PROCUREMENT',
    actionType: 'MUTATION',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.INVENTORY_MANAGER],
    confirmationRequired: true,
    riskLevel: 'CONSEQUENTIAL_WRITE',
    parameters: {
      supplierName: { type: 'string', required: true, description: 'Supplier name' },
      ingredientName: { type: 'string', required: true, description: 'Ingredient name' },
      quantity: { type: 'number', required: true, description: 'Quantity' },
    },
    backendService: 'ProcurementService.createPO',
    frontendAction: 'refreshPOs() & openDrawer("poDetails")',
  },
  {
    capabilityId: 'procurement.approvePO',
    name: 'Approve Purchase Order',
    description: 'Approve a pending purchase order and authorize supplier dispatch',
    screenRoute: '/procurement/purchase-orders',
    category: 'PROCUREMENT',
    actionType: 'MUTATION',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER],
    confirmationRequired: true,
    riskLevel: 'FINANCIAL',
    parameters: {
      poId: { type: 'string', required: true, description: 'PO ID' },
    },
    backendService: 'ProcurementService.approvePO',
    frontendAction: 'refreshPOs()',
  },
  {
    capabilityId: 'procurement.sendWhatsApp',
    name: 'Dispatch PO via WhatsApp',
    description: 'Generate supplier WhatsApp payload and transmit PO message',
    screenRoute: '/procurement/purchase-orders',
    category: 'PROCUREMENT',
    actionType: 'MUTATION',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.INVENTORY_MANAGER],
    confirmationRequired: true,
    riskLevel: 'CONSEQUENTIAL_WRITE',
    parameters: {
      poId: { type: 'string', required: true, description: 'PO ID' },
    },
    backendService: 'WhatsAppService.sendPurchaseOrder',
    frontendAction: 'showToast("PO sent via WhatsApp")',
  },

  // ==========================================
  // 5. INVOICES & 3-WAY RECONCILIATION
  // ==========================================
  {
    capabilityId: 'reconciliation.runMatch',
    name: 'Run 3-Way Reconciliation',
    description: 'Compare PO vs GRN vs Vendor Invoice and calculate variances',
    screenRoute: '/procurement/reconciliation',
    category: 'RECONCILIATION',
    actionType: 'QUERY',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER],
    confirmationRequired: false,
    riskLevel: 'READ_ONLY',
    parameters: {
      poId: { type: 'string', required: true, description: 'PO ID' },
    },
    backendService: 'ReconciliationService.reconcile',
    frontendAction: 'navigate("/procurement/reconciliation")',
  },
  {
    capabilityId: 'reconciliation.approve',
    name: 'Approve 3-Way Reconciliation',
    description: 'Authorize payment for reconciled invoice with verified variance',
    screenRoute: '/procurement/reconciliation',
    category: 'RECONCILIATION',
    actionType: 'MUTATION',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER],
    confirmationRequired: true,
    riskLevel: 'FINANCIAL',
    parameters: {
      reconciliationId: { type: 'string', required: true, description: 'Reconciliation record ID' },
    },
    backendService: 'ReconciliationService.approve',
    frontendAction: 'refreshReconciliations()',
  },

  // ==========================================
  // 6. ANALYTICS & DAILY REPORTS
  // ==========================================
  {
    capabilityId: 'analytics.querySales',
    name: 'Query Today Sales & Revenue',
    description: 'Retrieve real-time revenue, order count, and average ticket size',
    screenRoute: '/analytics',
    category: 'ANALYTICS',
    actionType: 'QUERY',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER],
    confirmationRequired: false,
    riskLevel: 'READ_ONLY',
    parameters: {
      period: { type: 'string', required: false, description: 'TODAY | 7_DAYS | 30_DAYS' },
    },
    frontendAction: 'navigate("/analytics")',
  },
  {
    capabilityId: 'reports.exportDaily',
    name: 'Export Daily EOD Report',
    description: 'Trigger print/export of daily financial and inventory reconciliation',
    screenRoute: '/reports/daily',
    category: 'REPORTS',
    actionType: 'UI_INTERACTION',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER],
    confirmationRequired: false,
    riskLevel: 'READ_ONLY',
    parameters: {},
    frontendAction: 'triggerPrint()',
  },

  // ==========================================
  // 7. RECIPE & MENU BOM
  // ==========================================
  {
    capabilityId: 'recipes.queryBOM',
    name: 'Query Recipe BOM Breakdown',
    description: 'View ingredient portion formula and food cost for a menu item',
    screenRoute: '/menu/recipes',
    category: 'RECIPES',
    actionType: 'QUERY',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.HEAD_CHEF],
    confirmationRequired: false,
    riskLevel: 'READ_ONLY',
    parameters: {
      menuItemName: { type: 'string', required: true, description: 'Menu item name (Idli, Dosa, etc.)' },
    },
    frontendAction: 'navigate("/menu/recipes") & openDrawer("recipeDetails")',
  },

  // ==========================================
  // 8. WASTE MANAGEMENT
  // ==========================================
  {
    capabilityId: 'waste.logRecord',
    name: 'Log Food Spoilage / Wastage',
    description: 'Record wasted ingredient quantity and reason (spoilage, burn, expired)',
    screenRoute: '/operations/waste',
    category: 'WASTE',
    actionType: 'MUTATION',
    requiredPermissions: [RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.HEAD_CHEF, RoleType.INVENTORY_MANAGER],
    confirmationRequired: true,
    riskLevel: 'LOW_RISK_WRITE',
    parameters: {
      ingredientName: { type: 'string', required: true, description: 'Ingredient name' },
      quantity: { type: 'number', required: true, description: 'Quantity wasted' },
      reason: { type: 'string', required: true, description: 'SPOILAGE | COOKING_LOSS | EXPIRED' },
    },
    backendService: 'InventoryEngineService.logWaste',
    frontendAction: 'refreshWaste()',
  },
];
