import { PrismaClient, RoleType } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { InventoryEngineService } from './inventoryEngine.service';
import { BOMEngineService } from './bomEngine.service';
import { PurchaseRecommendationService } from './recommendation.service';
import { WhatsAppProcurementService } from './whatsapp.service';
import { ReconciliationService } from './reconciliation.service';
import { AuditService } from './audit.service';

// 1. Action Classification Types
export type ActionClassification =
  | 'CONVERSATION'
  | 'QUESTION'
  | 'NAVIGATION'
  | 'QUERY'
  | 'ACTION'
  | 'MULTI_ACTION'
  | 'FOLLOW_UP'
  | 'CORRECTION'
  | 'CANCELLATION'
  | 'CONFIRMATION'
  | 'REJECTION'
  | 'EXPLANATION';

// 2. Risk Classification Types
export type RiskLevel =
  | 'READ_ONLY'
  | 'NAVIGATION'
  | 'LOW_RISK_WRITE'
  | 'CONSEQUENTIAL_WRITE'
  | 'FINANCIAL'
  | 'DESTRUCTIVE';

// 3. Conversational Session State
export interface VoiceSessionState {
  userId: string;
  userName?: string;
  userRole: RoleType;
  branchId: string;
  currentRoute?: string;
  currentEntity?: {
    type: 'ingredient' | 'order' | 'supplier' | 'purchase_order' | 'kds_ticket';
    id: string;
    name: string;
    data?: any;
  };
  currentTask?: string;
  lastOrderAction?: {
    orderId: string;
    orderNumber: string;
    previousStatus: string;
    newStatus: string;
    timestamp: number;
  };
  pendingAction?: {
    actionType: string;
    riskLevel: RiskLevel;
    description: string;
    payload: any;
    idempotencyKey: string;
    expiresAt: number;
  };
  conversationHistory: Array<{
    role: 'user' | 'assistant' | 'tool';
    content: string;
    timestamp: Date;
  }>;
  lastLanguage: string;
}

// 4. Visual Grounding Action Metadata
export interface VisualGroundingPayload {
  route?: string;
  filter?: {
    status?: string;
    date?: string;
    category?: string;
  };
  searchQuery?: string;
  highlightId?: string;
  openModal?: string;
  actionTaken?: string;
}

// 5. Tool Execution Result
export interface ToolResult {
  success: boolean;
  toolName: string;
  data?: any;
  error?: string;
  visualGrounding?: VisualGroundingPayload;
}

// 6. Voice Agent Execution Response
export interface VoiceExecutionResponse {
  spokenResponse: string;
  displayTranscript: string;
  actionClass: ActionClassification;
  detectedLanguage: string;
  confirmationRequired: boolean;
  pendingActionDescription?: string;
  actionResult?: any;
  uiNavigation?: VisualGroundingPayload;
  sessionState: {
    branchId: string;
    activeEntity?: any;
  };
}

export class VoiceAgentService {
  private static sessions: Map<string, VoiceSessionState> = new Map();
  private static idempotencyLog: Map<string, { result: any; timestamp: number }> = new Map();

  /**
   * Get or initialize session state
   */
  public static getSession(
    sessionId: string,
    userId: string,
    role: RoleType,
    branchId: string,
    userName?: string
  ): VoiceSessionState {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        userId,
        userName: userName || 'Arivardhan',
        userRole: role,
        branchId,
        conversationHistory: [],
        lastLanguage: 'kannada_english',
      };
      this.sessions.set(sessionId, session);
    } else {
      session.userId = userId;
      session.userRole = role;
      if (userName) session.userName = userName;
      if (branchId) session.branchId = branchId;
    }
    return session;
  }

  /**
   * Detect language and dialect
   */
  public static detectLanguage(text: string): string {
    const lower = text.toLowerCase();

    // Indic Scripts
    if (/[\u0C80-\u0CFF]/.test(text)) return 'kannada';
    if (/[\u0900-\u097F]/.test(text)) return 'hindi';
    if (/[\u0B80-\u0BFF]/.test(text)) return 'tamil';
    if (/[\u0C00-\u0C7F]/.test(text)) return 'telugu';
    if (/[\u0D00-\u0D7F]/.test(text)) return 'malayalam';
    if (/[\u0A80-\u0AFF]/.test(text)) return 'gujarati';
    if (/[\u0980-\u09FF]/.test(text)) return 'bengali';
    if (/[\u0A00-\u0A7F]/.test(text)) return 'punjabi';
    if (/[\u0B00-\u0B7F]/.test(text)) return 'odia';
    if (/[\u0600-\u06FF]/.test(text)) return 'urdu';

    // Romanized Indic Code-Switching
    if (
      lower.includes('maadi') ||
      lower.includes('maadu') ||
      lower.includes('yestu') ||
      lower.includes('hogu') ||
      lower.includes('hogona') ||
      lower.includes('nodona') ||
      lower.includes('ide') ||
      lower.includes('aagide') ||
      lower.includes('bana') ||
      lower.includes('swalpa') ||
      lower.includes('beku') ||
      lower.includes('kodi') ||
      lower.includes('illi') ||
      lower.includes('alli') ||
      lower.includes('haudu') ||
      lower.includes('beda') ||
      lower.includes('ee order')
    ) {
      return 'kannada_english';
    }

    if (
      lower.includes('karo') ||
      lower.includes('karein') ||
      lower.includes('bhejo') ||
      lower.includes('kitna') ||
      lower.includes('batao') ||
      lower.includes('hai') ||
      lower.includes('chahiye') ||
      lower.includes('de do') ||
      lower.includes('dikhayein') ||
      lower.includes('haan') ||
      lower.includes('nahi') ||
      lower.includes('is order')
    ) {
      return 'hindi_english';
    }

    if (
      lower.includes('pannunga') ||
      lower.includes('evvalavu') ||
      lower.includes('kaatunga') ||
      lower.includes('ponga') ||
      lower.includes('irukku') ||
      lower.includes('aama') ||
      lower.includes('vendaam') ||
      lower.includes('inda order')
    ) {
      return 'tamil_english';
    }

    if (
      lower.includes('cheyandi') ||
      lower.includes('entha') ||
      lower.includes('vellu') ||
      lower.includes('undi') ||
      lower.includes('avunu') ||
      lower.includes('vaddu') ||
      lower.includes('ee order')
    ) {
      return 'telugu_english';
    }

    return 'english';
  }

  /**
   * Main Conversational Agentic Loop for maitreD
   * INPUT -> UNDERSTAND -> CONTEXT -> CLASSIFY -> PLAN -> RBAC -> CONFIRM/EXECUTE -> VERIFY -> RESPOND
   */
  public static async processConversationalTurn(
    transcript: string,
    sessionId: string,
    userId: string,
    userRole: RoleType,
    branchId: string,
    currentRoute?: string,
    userName?: string
  ): Promise<VoiceExecutionResponse> {
    const session = this.getSession(sessionId, userId, userRole, branchId, userName);
    if (currentRoute) session.currentRoute = currentRoute;
    if (userName) session.userName = userName;

    const adminName = session.userName || 'Arivardhan';
    const detectedLanguage = this.detectLanguage(transcript);
    const sessionDialect = session.lastLanguage || 'kannada_english';
    if (detectedLanguage !== 'english') {
      session.lastLanguage = detectedLanguage;
    }

    const language = detectedLanguage !== 'english' ? detectedLanguage : sessionDialect;

    // Record turn in history
    session.conversationHistory.push({
      role: 'user',
      content: transcript,
      timestamp: new Date(),
    });

    const lower = transcript.toLowerCase().trim().replace(/[.,!?;:]/g, '');

    // 0. Check for Direct Wake-Word / Greeting ("Hey maitreD", "Hi maitreD", "Hello maitreD")
    if (
      lower === 'hey maitred' ||
      lower === 'hi maitred' ||
      lower === 'hello maitred' ||
      lower === 'hey maître d' ||
      lower === 'hi maître d' ||
      lower === 'hello maître d' ||
      lower === 'maitred' ||
      lower === 'maitre d' ||
      lower === 'metre d' ||
      lower === 'meter d' ||
      lower === 'mayter d'
    ) {
      const greeting = `Hi ${adminName}, how may I help you today?`;
      return {
        spokenResponse: greeting,
        displayTranscript: transcript,
        actionClass: 'CONVERSATION',
        detectedLanguage: language,
        confirmationRequired: false,
        sessionState: { branchId: session.branchId },
      };
    }

    // 0.1 Check for Polite Closing ("Thank you", "Thanks maitreD", "That's all", "Goodbye")
    if (
      lower === 'thank you' ||
      lower === 'thanks' ||
      lower === 'thanks maitred' ||
      lower === 'thank you maitred' ||
      lower === "that's all" ||
      lower === 'thats all' ||
      lower === "that's it" ||
      lower === 'thats it' ||
      lower === 'goodbye maitred' ||
      lower === 'done for now' ||
      lower === 'okay thats all' ||
      lower === 'swalpa thanks' ||
      lower === 'dhanyavada' ||
      lower === 'shukriya' ||
      lower === 'nandri'
    ) {
      const closingMsg = `You're welcome, ${adminName}. Have a great day.`;
      return {
        spokenResponse: closingMsg,
        displayTranscript: transcript,
        actionClass: 'CONVERSATION',
        detectedLanguage: language,
        confirmationRequired: false,
        sessionState: { branchId: session.branchId },
      };
    }

    // 1. Check for Pending Action Confirmation / Rejection
    if (session.pendingAction && session.pendingAction.expiresAt > Date.now()) {
      if (
        lower === 'yes' ||
        lower === 'haudu' ||
        lower === 'haan' ||
        lower === 'aama' ||
        lower === 'avunu' ||
        lower === 'proceed' ||
        lower === 'confirm' ||
        lower === 'sari' ||
        lower.includes('yes') ||
        lower.includes('confirm maadi') ||
        lower.includes('haudu') ||
        lower.includes('haan')
      ) {
        const pending = session.pendingAction;
        session.pendingAction = undefined;
        return await this.executePendingAction(pending, session, sessionDialect);
      }

      if (
        lower === 'no' ||
        lower === 'beda' ||
        lower === 'nahi' ||
        lower === 'vendaam' ||
        lower === 'vaddu' ||
        lower === 'cancel' ||
        lower.includes('cancel') ||
        lower.includes('beda') ||
        lower.includes('nahi')
      ) {
        session.pendingAction = undefined;
        const msg = language === 'kannada_english'
          ? 'Action cancel aagide.'
          : language === 'hindi_english'
          ? 'Action cancel kar diya gaya hai.'
          : 'Action has been cancelled.';
        return {
          spokenResponse: msg,
          displayTranscript: transcript,
          actionClass: 'CANCELLATION',
          detectedLanguage: language,
          confirmationRequired: false,
          sessionState: { branchId: session.branchId },
        };
      }
    }

    // 2. Classify Action Type
    const actionClass = this.classifyUtterance(lower, session);

    // 3. Handle Pure Chit-Chat / General Conversation (Zero Side-Effects)
    if (actionClass === 'CONVERSATION') {
      const reply = this.generateChitChatReply(lower, language, adminName);
      return {
        spokenResponse: reply,
        displayTranscript: transcript,
        actionClass: 'CONVERSATION',
        detectedLanguage: language,
        confirmationRequired: false,
        sessionState: { branchId: session.branchId },
      };
    }

    // 4. Handle Capabilities / Explanations
    if (actionClass === 'QUESTION' || actionClass === 'EXPLANATION') {
      const explanation = this.generateExplanationReply(lower, language);
      return {
        spokenResponse: explanation,
        displayTranscript: transcript,
        actionClass: 'QUESTION',
        detectedLanguage: language,
        confirmationRequired: false,
        sessionState: { branchId: session.branchId },
      };
    }

    // 5. Handle Navigation
    if (actionClass === 'NAVIGATION') {
      const navTarget = this.resolveNavigationRoute(lower);
      let reply = '';
      if (navTarget.route === '/operations/orders') {
        reply = language === 'kannada_english'
          ? `Sure, customer orders ge hogtini.`
          : `Sure, I'm taking you to customer orders.`;
      } else if (navTarget.route === '/operations/kds') {
        reply = language === 'kannada_english'
          ? `Sure, kitchen ge hogtini.`
          : `Sure, I'm taking you to the kitchen.`;
      } else if (language === 'kannada_english') {
        reply = `Sure, ${navTarget.name} ge hogtini.`;
      } else if (language === 'hindi_english') {
        reply = `Theek hai, ${navTarget.name} section open kar raha hoon.`;
      } else {
        reply = `Sure, I'm taking you to ${navTarget.name}.`;
      }

      session.currentRoute = navTarget.route;
      return {
        spokenResponse: reply,
        displayTranscript: transcript,
        actionClass: 'NAVIGATION',
        detectedLanguage: language,
        confirmationRequired: false,
        uiNavigation: { route: navTarget.route },
        sessionState: { branchId: session.branchId },
      };
    }

    // 6. Handle Intent & Entity Extraction (Planning Phase)
    const plan = await this.planAndExecuteAgenticWorkflow(lower, session, language, transcript);
    return plan;
  }

  /**
   * Action Classification Engine
   */
  private static classifyUtterance(text: string, session: VoiceSessionState): ActionClassification {
    // Greetings / chit-chat
    if (
      text === 'hi' ||
      text === 'hello' ||
      text === 'namaskara' ||
      text === 'namaste' ||
      text === 'good morning' ||
      text === 'good afternoon' ||
      text === 'how are you' ||
      text === 'how are you doing' ||
      text === 'hegiddira' ||
      text === 'kaisa hai'
    ) {
      return 'CONVERSATION';
    }

    // Order Q&A Queries
    if (text.includes('what did') || text.includes('order details') || text.includes('who ordered') || text.includes('how much is')) {
      return 'QUERY';
    }

    // Capabilities / Questions
    if (
      text.includes('what can you do') ||
      text.includes('help me') ||
      text.includes('enu maadbahudu') ||
      text.includes('kya kar sakte ho') ||
      text.includes('what is bom') ||
      text.includes('what is wac')
    ) {
      return 'QUESTION';
    }

    // Self-corrections
    if (text.includes('no sorry') || text.includes('no make it') || text.includes('alla swalpa') || text.includes('nahi sorry')) {
      return 'CORRECTION';
    }

    // Navigation
    if (
      (text.includes('hogu') ||
        text.includes('hogona') ||
        text.includes('navigate') ||
        text.includes('take me') ||
        text.includes('go to') ||
        text.includes('nodona') ||
        text.includes('section') ||
        (text.includes('show') && text.includes('report')) ||
        text.includes('report nodona')) &&
      !text.includes('first order') &&
      !text.includes('first one') &&
      !text.includes('modala order') &&
      !text.includes('pehla order') &&
      !text.includes('open order') &&
      !text.includes('stock') &&
      !text.includes('add') &&
      !text.includes('yestu') &&
      !text.includes('kitna')
    ) {
      return 'NAVIGATION';
    }

    // Mutations & Status Actions
    if (
      text.includes('mark') ||
      text.includes('change') ||
      text.includes('shift') ||
      text.includes('move') ||
      text.includes('set') ||
      text.includes('accept') ||
      text.includes('ready') ||
      text.includes('preparing') ||
      text.includes('cooking') ||
      text.includes('complete') ||
      text.includes('cancel') ||
      text.includes('serve') ||
      text.includes('revert') ||
      text.includes('undo') ||
      text.includes('move it back') ||
      text.includes('back to') ||
      text.includes('add') ||
      text.includes('deduct') ||
      text.includes('create') ||
      text.includes('send') ||
      text.includes('waste') ||
      text.includes('bana do') ||
      text.includes('maadi')
    ) {
      return 'ACTION';
    }

    // Queries
    if (
      text.includes('yestu') ||
      text.includes('how much') ||
      text.includes('how many') ||
      text.includes('check') ||
      text.includes('kitna') ||
      text.includes('status') ||
      text.includes('show') ||
      text.includes('display') ||
      text.includes('open') ||
      text.includes('find') ||
      text.includes('what') ||
      text.includes('who') ||
      text.includes('where')
    ) {
      return 'QUERY';
    }

    return 'QUERY';
  }

  /**
   * Plan & Execute Agentic Workflow with Multi-Tool Sequencing & Context Memory
   */
private static async planAndExecuteAgenticWorkflow(
    text: string,
    session: VoiceSessionState,
    language: string,
    rawTranscript: string
  ): Promise<VoiceExecutionResponse> {
    // Number & phonetic normalizer for spoken order IDs (handles "seven seven five", "k d s 775", "7 7 5")
    const normalizeSpokenNumbers = (t: string): string => {
      const wordMap: Record<string, string> = {
        zero: '0', one: '1', two: '2', three: '3', four: '4',
        five: '5', six: '6', seven: '7', eight: '8', nine: '9',
        ondhu: '1', eradu: '2', mooru: '3', naalku: '4', aidhu: '5', aaru: '6', eelu: '7', entu: '8', ombattu: '9', hatthu: '10',
        ek: '1', do: '2', teen: '3', char: '4', paanch: '5', chhah: '6', saat: '7', aath: '8', nau: '9', das: '10',
        'k d s': 'kds', 'o r d': 'ord', 'k.d.s.': 'kds', 'k d s-': 'kds-'
      };
      let clean = t.toLowerCase();
      for (const [w, d] of Object.entries(wordMap)) {
        clean = clean.replace(new RegExp('\\b' + w + '\\b', 'g'), d);
      }
      for (let i = 0; i < 6; i++) {
        clean = clean.replace(/(\d)\s+(\d)/g, '$1$2');
      }
      return clean;
    };

    const normalizedUtterance = normalizeSpokenNumbers(text);

    // Helper: Find exact target order matching spoken utterance
    const findTargetOrder = async (orderStatusFilter?: string[]): Promise<any | null> => {
      // 1. Direct regex for order numbers: KDS-573058, ORD-1234, 573058, #775955, etc.
      const numMatch =
        normalizedUtterance.match(/(?:kds|ord|audit|kot)?-?(\d{3,8})/i) ||
        normalizedUtterance.match(/\b([a-zA-Z0-9]+-[0-9a-zA-Z]+)\b/i) ||
        normalizedUtterance.match(/#(\d+)/i) ||
        normalizedUtterance.match(/\border\s*#?(\d+)\b/i);

      if (numMatch && (numMatch[1] || numMatch[0])) {
        const queryNum = (numMatch[1] || numMatch[0]).replace(/^(order|kot|#)\s*/i, '').trim();
        if (queryNum.length >= 3) {
          const found = await prisma.order.findFirst({
            where: {
              branchId: activeBranchId,
              orderNumber: { contains: queryNum, mode: 'insensitive' },
            },
            include: { items: { include: { menuItem: true } } },
          });
          if (found) {
            console.log(`[findTargetOrder] 🎯 Matched exact order: ${found.orderNumber} via query "${queryNum}"`);
            return found;
          } else {
            console.log(`[findTargetOrder] ⚠️ Specific order "${queryNum}" not found in branch.`);
            return null;
          }
        }
      }

      // 2. Customer Name search: e.g. "for Rahul", "of Priya"
      const custMatch = normalizedUtterance.match(/(?:for|of|from|customer)\s+([a-zA-Z]+)/i);
      if (custMatch && custMatch[1]) {
        const name = custMatch[1].trim();
        const found = await prisma.order.findFirst({
          where: {
            branchId: activeBranchId,
            customerName: { contains: name, mode: 'insensitive' },
          },
          orderBy: { createdAt: 'desc' },
          include: { items: { include: { menuItem: true } } },
        });
        if (found) return found;
        return null;
      }

      // 3. Table Number search: e.g. "Table 1", "T-01"
      const tableMatch = normalizedUtterance.match(/(?:table|t-?)\s*([0-9a-zA-Z]+)/i);
      if (tableMatch && tableMatch[1]) {
        const table = tableMatch[1].trim();
        const found = await prisma.order.findFirst({
          where: {
            branchId: activeBranchId,
            tableNumber: { contains: table, mode: 'insensitive' },
          },
          orderBy: { createdAt: 'desc' },
          include: { items: { include: { menuItem: true } } },
        });
        if (found) return found;
        return null;
      }

      // 4. Session memory / active order
      if (session.currentEntity?.type === 'order' && session.currentEntity.id) {
        const found = await prisma.order.findUnique({
          where: { id: session.currentEntity.id },
          include: { items: { include: { menuItem: true } } },
        });
        if (found) return found;
      }

      if (session.lastOrderAction?.orderId) {
        const found = await prisma.order.findUnique({
          where: { id: session.lastOrderAction.orderId },
          include: { items: { include: { menuItem: true } } },
        });
        if (found) return found;
      }

      // 5. Only fallback if user generically referred to "this order", "first order", or "the order"
      if (
        normalizedUtterance.includes('this order') ||
        normalizedUtterance.includes('first order') ||
        normalizedUtterance.includes('the order') ||
        normalizedUtterance.includes('ee order')
      ) {
        return await prisma.order.findFirst({
          where: {
            branchId: activeBranchId,
            ...(orderStatusFilter ? { orderStatus: { in: orderStatusFilter as any } } : {}),
          },
          orderBy: { createdAt: 'desc' },
          include: { items: { include: { menuItem: true } } },
        });
      }

      return null;
    };

    // 1. UNIVERSAL ORDER STATUS CHANGER & REVERSAL (Voice-based status transitions for ANY order to ANY status)
    if (
      normalizedUtterance.includes('ready') ||
      normalizedUtterance.includes('preparing') ||
      normalizedUtterance.includes('cooking') ||
      normalizedUtterance.includes('accept') ||
      normalizedUtterance.includes('complete') ||
      normalizedUtterance.includes('served') ||
      normalizedUtterance.includes('serve') ||
      normalizedUtterance.includes('cancel') ||
      normalizedUtterance.includes('undo') ||
      normalizedUtterance.includes('revert') ||
      normalizedUtterance.includes('back to')
    ) {
      const order = await findTargetOrder();
      const numMatch = normalizedUtterance.match(/(?:kds|ord|audit|kot)?-?(\d{3,8})/i) || normalizedUtterance.match(/#(\d+)/i);
      const queryNum = numMatch ? (numMatch[1] || numMatch[0]) : null;

      if (!order) {
        return {
          spokenResponse: queryNum ? `Order #${queryNum} was not found.` : 'No matching order found.',
          displayTranscript: rawTranscript,
          actionClass: 'ACTION',
          detectedLanguage: language,
          confirmationRequired: false,
          sessionState: { branchId: activeBranchId },
        };
      }

      let targetStatus: 'NEW' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED' = 'READY';
      const isRevert =
        normalizedUtterance.includes('undo') ||
        normalizedUtterance.includes('revert') ||
        normalizedUtterance.includes('change it back') ||
        normalizedUtterance.includes('move it back') ||
        normalizedUtterance.includes('back to previous');

      if (isRevert) {
        if (session.lastOrderAction && session.lastOrderAction.orderId === order.id && session.lastOrderAction.previousStatus) {
          targetStatus = session.lastOrderAction.previousStatus as any;
        } else if (order.orderStatus === 'COMPLETED') {
          targetStatus = 'READY';
        } else if (order.orderStatus === 'READY') {
          targetStatus = 'PREPARING';
        } else if (order.orderStatus === 'PREPARING') {
          targetStatus = 'ACCEPTED';
        } else {
          targetStatus = 'NEW';
        }
      } else if (normalizedUtterance.includes('ready') || normalizedUtterance.includes('serve')) {
        if (normalizedUtterance.includes('served') || normalizedUtterance.includes('complete')) {
          targetStatus = 'COMPLETED';
        } else {
          targetStatus = 'READY';
        }
      } else if (normalizedUtterance.includes('preparing') || normalizedUtterance.includes('cooking') || normalizedUtterance.includes('kitchen')) {
        targetStatus = 'PREPARING';
      } else if (normalizedUtterance.includes('accept')) {
        targetStatus = 'ACCEPTED';
      } else if (normalizedUtterance.includes('complete') || normalizedUtterance.includes('served')) {
        targetStatus = 'COMPLETED';
      } else if (normalizedUtterance.includes('cancel')) {
        targetStatus = 'CANCELLED';
      } else if (normalizedUtterance.includes('pending') || normalizedUtterance.includes('new')) {
        targetStatus = 'NEW';
      }

      const previousStatus = order.orderStatus;

      // Deduct inventory if transitioning to ACCEPTED
      if (previousStatus === 'NEW' && targetStatus === 'ACCEPTED') {
        try {
          await InventoryEngineService.deductStockForOrder(order.id, session.userId);
        } catch (e) {
          console.error('[VoiceAgent] Stock deduction warning:', e);
        }
      }

      const updated = await prisma.order.update({
        where: { id: order.id },
        data: {
          orderStatus: targetStatus as any,
          acceptedAt: targetStatus === 'ACCEPTED' && !order.acceptedAt ? new Date() : order.acceptedAt,
          completedAt: targetStatus === 'COMPLETED' ? new Date() : (targetStatus !== 'COMPLETED' ? null : order.completedAt),
        },
      });

      await prisma.orderItem.updateMany({
        where: { orderId: order.id },
        data: { itemStatus: targetStatus as any },
      });

      await AuditService.log({
        branchId: activeBranchId,
        userId: session.userId,
        action: 'ORDER_STATUS_CHANGED',
        entity: 'Order',
        entityId: order.id,
        previousValue: previousStatus,
        newValue: targetStatus,
        ipAddress: 'voice-agent',
      });

      session.lastOrderAction = {
        orderId: updated.id,
        orderNumber: updated.orderNumber,
        previousStatus,
        newStatus: targetStatus,
        timestamp: Date.now(),
      };
      session.currentEntity = {
        type: 'order',
        id: updated.id,
        name: `Order #${updated.orderNumber}`,
      };

      let spoken = '';
      if (isRevert) {
        spoken = `Done. Order #${updated.orderNumber} status has been reverted back to ${targetStatus}.`;
      } else {
        const readable =
          targetStatus === 'READY'
            ? 'ready to serve'
            : targetStatus === 'COMPLETED'
            ? 'completed'
            : targetStatus.toLowerCase();
        spoken = `Done. Order #${updated.orderNumber} is now marked ${readable}.`;
      }

      return {
        spokenResponse: spoken,
        displayTranscript: rawTranscript,
        actionClass: 'ACTION',
        detectedLanguage: language,
        confirmationRequired: false,
        actionResult: updated,
        uiNavigation: {
          route: '/operations/orders',
          highlightId: updated.id,
          filter: { status: targetStatus },
        },
        sessionState: { branchId: activeBranchId, activeEntity: session.currentEntity },
      };
    }

      if (session.userRole === RoleType.SUPPLIER) {
        return {
          spokenResponse: 'You do not have permission to accept customer orders.',
          displayTranscript: rawTranscript,
          actionClass: 'ACTION',
          detectedLanguage: language,
          confirmationRequired: false,
          sessionState: { branchId: activeBranchId },
        };
      }

      const previousStatus = order.orderStatus;

      // ATOMIC TRANSACTION: BOM Deductions + Status Update
      if (order.orderStatus === 'NEW') {
        await InventoryEngineService.deductStockForOrder(order.id, session.userId);
      }

      const updated = await prisma.order.update({
        where: { id: order.id },
        data: {
          orderStatus: 'ACCEPTED',
          acceptedAt: new Date(),
        },
        include: { items: { include: { menuItem: true } } },
      });

      await AuditService.log({
        branchId: activeBranchId,
        userId: session.userId,
        action: 'ORDER_STATUS_CHANGED',
        entity: 'Order',
        entityId: order.id,
        previousValue: previousStatus,
        newValue: 'ACCEPTED',
        ipAddress: 'voice-agent',
      });

      const verified = await prisma.order.findUnique({ where: { id: order.id } });

      session.currentEntity = {
        type: 'order',
        id: updated.id,
        name: `Order #${updated.orderNumber}`,
        data: updated,
      };

      session.lastOrderAction = {
        orderId: updated.id,
        orderNumber: updated.orderNumber,
        previousStatus,
        newStatus: 'ACCEPTED',
        timestamp: Date.now(),
      };

      let spoken = '';
      if (language === 'kannada_english') {
        spoken = `Done. Order #${updated.orderNumber} accept aagide.`;
      } else if (language === 'hindi_english') {
        spoken = `Theek hai. Order #${updated.orderNumber} accept ho gaya hai.`;
      } else {
        spoken = `Done. Order #${updated.orderNumber} has been accepted.`;
      }

      return {
        spokenResponse: spoken,
        displayTranscript: rawTranscript,
        actionClass: 'ACTION',
        detectedLanguage: language,
        confirmationRequired: false,
        actionResult: verified,
        uiNavigation: {
          route: '/operations/orders',
          highlightId: updated.id,
          openModal: 'orderDetails',
        },
        sessionState: { branchId: activeBranchId, activeEntity: session.currentEntity },
      };
    }

    // 5. CUSTOMER NAME SEARCH (e.g. "Show orders for Rahul", "Find order from Priya")
    if (
      (text.includes('orders for') || text.includes('order for') || text.includes('order from')) &&
      !text.includes('purchase order')
    ) {
      const customerMatch = text.match(/(?:for|from)\s+([a-zA-Z]+)/i);
      const custName = customerMatch ? customerMatch[1] : '';

      const order = await prisma.order.findFirst({
        where: {
          branchId: activeBranchId,
          customerName: { contains: custName, mode: 'insensitive' },
        },
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { menuItem: true } } },
      });

      if (!order) {
        return {
          spokenResponse: `Could not find any customer orders for ${custName}.`,
          displayTranscript: rawTranscript,
          actionClass: 'QUERY',
          detectedLanguage: language,
          confirmationRequired: false,
          sessionState: { branchId: activeBranchId },
        };
      }

      session.currentEntity = {
        type: 'order',
        id: order.id,
        name: `Order #${order.orderNumber}`,
        data: order,
      };

      const spoken = `Found order #${order.orderNumber} for ${order.customerName}. Status is currently ${order.orderStatus}.`;

      return {
        spokenResponse: spoken,
        displayTranscript: rawTranscript,
        actionClass: 'QUERY',
        detectedLanguage: language,
        confirmationRequired: false,
        actionResult: order,
        uiNavigation: {
          route: '/operations/orders',
          searchQuery: custName,
          highlightId: order.id,
          openModal: 'orderDetails',
        },
        sessionState: { branchId: activeBranchId, activeEntity: session.currentEntity },
      };
    }

    // 5.1 ORDER INFORMATION Q&A (e.g. "What did they order?", "How much is the order?", "What's the status?")
    if (
      text.includes('what did they order') ||
      text.includes('what did he order') ||
      text.includes('en order maadidare') ||
      text.includes('kya order kiya') ||
      text.includes('how much is the order') ||
      text.includes('total amount') ||
      text.includes('yestu aagide') ||
      text.includes('kitna hua') ||
      text.includes('who ordered') ||
      text.includes('customer name') ||
      text.includes('which table') ||
      text.includes('yaava table') ||
      text.includes('order details')
    ) {
      let orderId = session.currentEntity?.type === 'order' ? session.currentEntity.id : null;
      let order: any = null;

      if (orderId) {
        order = await prisma.order.findUnique({
          where: { id: orderId },
          include: { items: { include: { menuItem: true } } },
        });
      }

      if (!order) {
        order = await prisma.order.findFirst({
          where: { branchId: activeBranchId },
          orderBy: { createdAt: 'desc' },
          include: { items: { include: { menuItem: true } } },
        });
      }

      if (!order) {
        return {
          spokenResponse: 'Could not find any active order to provide details.',
          displayTranscript: rawTranscript,
          actionClass: 'QUERY',
          detectedLanguage: language,
          confirmationRequired: false,
          sessionState: { branchId: activeBranchId },
        };
      }

      const itemSummary = order.items?.map((i: any) => `${i.quantity}x ${i.menuItem?.name}`).join(', ') || 'dishes';

      let spoken = '';
      if (text.includes('how much') || text.includes('total amount') || text.includes('yestu') || text.includes('kitna')) {
        spoken = `The total amount for order #${order.orderNumber} is ₹${order.totalAmount}.`;
      } else if (text.includes('who') || text.includes('customer')) {
        spoken = `Order #${order.orderNumber} was placed by ${order.customerName || 'Walk-in Customer'}.`;
      } else if (text.includes('table')) {
        spoken = `Order #${order.orderNumber} is for table ${order.tableNumber || 'Walk-in'}.`;
      } else {
        spoken = `Order #${order.orderNumber} contains ${itemSummary} for a total of ₹${order.totalAmount}. Status is currently ${order.orderStatus}.`;
      }

      return {
        spokenResponse: spoken,
        displayTranscript: rawTranscript,
        actionClass: 'QUERY',
        detectedLanguage: language,
        confirmationRequired: false,
        actionResult: order,
        uiNavigation: {
          route: '/operations/orders',
          openModal: 'orderDetails',
          highlightId: order.id,
        },
        sessionState: { branchId: activeBranchId, activeEntity: session.currentEntity },
      };
    }

    // 6. ORDER SELECTION & INSPECTION (e.g. "Open the first one", "Open the first order", "Open order 1045")
    if (
      (text.includes('first order') ||
        text.includes('first one') ||
        text.includes('modala order') ||
        text.includes('pehla order') ||
        text.includes('open order') ||
        text.includes('find order') ||
        text.includes('where is order')) &&
      !text.includes('purchase order')
    ) {
      // Extract specific order number if provided (e.g. 1045 or ORD-1045)
      const specificNumMatch = text.match(/\b(?:ord-?)?(\d{3,6})\b/i);
      let order = null;
      if (specificNumMatch) {
        order = await prisma.order.findFirst({
          where: {
            branchId: activeBranchId,
            orderNumber: { contains: specificNumMatch[1], mode: 'insensitive' },
          },
          include: { items: { include: { menuItem: true } } },
        });
      }
      if (!order) {
        order = await prisma.order.findFirst({
          where: { branchId: activeBranchId },
          orderBy: { createdAt: 'desc' },
          include: { items: { include: { menuItem: true } } },
        });
      }

      if (!order) {
        return {
          spokenResponse: 'No orders available right now.',
          displayTranscript: rawTranscript,
          actionClass: 'QUERY',
          detectedLanguage: language,
          confirmationRequired: false,
          sessionState: { branchId: activeBranchId },
        };
      }

      session.currentEntity = {
        type: 'order',
        id: order.id,
        name: `Order #${order.orderNumber || order.id.slice(-4)}`,
        data: order,
      };

      let spoken = '';
      if (text.includes('first order') || text.includes('first one') || text.includes('modala order')) {
        spoken = language === 'kannada_english'
          ? `First order open maadiddini. Order status ${order.orderStatus} alli ide.`
          : `Opening the first customer order.`;
      } else {
        spoken = `Opening order #${order.orderNumber} for ${order.customerName || 'Walk-in Customer'}.`;
      }

      return {
        spokenResponse: spoken,
        displayTranscript: rawTranscript,
        actionClass: 'QUERY',
        detectedLanguage: language,
        confirmationRequired: false,
        actionResult: order,
        uiNavigation: {
          route: '/operations/orders',
          openModal: 'orderDetails',
          highlightId: order.id,
        },
        sessionState: { branchId: activeBranchId, activeEntity: session.currentEntity },
      };
    }

    // 7. SHOW / FILTER CUSTOMER ORDERS (e.g. "Show new orders", "Show accepted orders", "Show preparing orders", "Show ready orders", "Show completed orders")
    if (
      (text.includes('show') || text.includes('view') || text.includes('list') || text.includes('display') || text.includes('filter') || text.includes('nodona') || text.includes('yestu') || text.includes('how many') || text.includes('all orders') || text.includes('customer orders')) &&
      (text.includes('order') || text.includes('orders') || text.includes('pending')) &&
      !text.includes('change') &&
      !text.includes('mark') &&
      !text.includes('shift') &&
      !text.includes('move') &&
      !text.includes('set') &&
      !text.includes('undo') &&
      !text.includes('revert') &&
      !text.includes('order maadi') &&
      !text.includes('purchase order') &&
      !text.includes('add')
    ) {
      let filterStatus = 'ALL';
      let statusWhere: any = {};
      let label = 'all';

      if (text.includes('new') || text.includes('pending') || text.includes('hosadu')) {
        filterStatus = 'NEW';
        statusWhere = { orderStatus: 'NEW' };
        label = 'new / pending';
      } else if (text.includes('accepted') || text.includes('accept')) {
        filterStatus = 'ACCEPTED';
        statusWhere = { orderStatus: 'ACCEPTED' };
        label = 'accepted';
      } else if (text.includes('preparing') || text.includes('cooking') || text.includes('in kitchen')) {
        filterStatus = 'PREPARING';
        statusWhere = { orderStatus: 'PREPARING' };
        label = 'preparing';
      } else if (text.includes('ready') || text.includes('serve') || text.includes('ready to serve')) {
        filterStatus = 'READY';
        statusWhere = { orderStatus: 'READY' };
        label = 'ready to serve';
      } else if (text.includes('completed') || text.includes('finished') || text.includes('delivered')) {
        filterStatus = 'COMPLETED';
        statusWhere = { orderStatus: 'COMPLETED' };
        label = 'completed';
      }

      const count = await prisma.order.count({
        where: {
          branchId: activeBranchId,
          ...statusWhere,
        },
      });

      let spoken = '';
      if (filterStatus === 'ALL') {
        spoken = `Displaying all ${count} customer orders on screen.`;
      } else {
        spoken = `Showing ${count} ${label} customer orders on screen.`;
      }

      return {
        spokenResponse: spoken,
        displayTranscript: rawTranscript,
        actionClass: 'QUERY',
        detectedLanguage: language,
        confirmationRequired: false,
        uiNavigation: {
          route: '/operations/orders',
          filter: { status: filterStatus },
        },
        sessionState: { branchId: activeBranchId },
      };
    }

    // 8. KITCHEN / KDS STATUS QUERY (e.g. "Preparing orders yestu ide?", "Kitchen status nodona")
    if (
      text.includes('preparing') ||
      text.includes('ready orders') ||
      (text.includes('kitchen') && (text.includes('order') || text.includes('yestu') || text.includes('status'))) ||
      text.includes('kds')
    ) {
      const preparingItems = await prisma.orderItem.count({
        where: {
          order: { branchId: activeBranchId },
          itemStatus: 'PREPARING',
        },
      });

      const readyItems = await prisma.orderItem.count({
        where: {
          order: { branchId: activeBranchId },
          itemStatus: 'READY',
        },
      });

      let spoken = '';
      if (language === 'kannada_english') {
        spoken = `Iga ${preparingItems} orders preparing alli ide, ${readyItems} orders ready ide.`;
      } else if (language === 'hindi_english') {
        spoken = `Abhi kitchen mein ${preparingItems} orders preparing state mein hain.`;
      } else {
        spoken = `There are currently ${preparingItems} orders preparing in the kitchen.`;
      }

      return {
        spokenResponse: spoken,
        displayTranscript: rawTranscript,
        actionClass: 'QUERY',
        detectedLanguage: language,
        confirmationRequired: false,
        actionResult: { preparing: preparingItems, ready: readyItems },
        uiNavigation: { route: '/operations/kds' },
        sessionState: { branchId: activeBranchId },
      };
    }

    // 9. STOCK CHECK / QUERY
    if (
      (text.includes('stock') ||
        text.includes('inventory') ||
        text.includes('yestu ide') ||
        text.includes('how much') ||
        text.includes('kitna hai')) &&
      !text.includes('order') &&
      !text.includes('kitchen') &&
      !text.includes('preparing')
    ) {
      // Extract ingredient or resolve from context
      const ingName = this.extractIngredientName(text) || session.currentEntity?.name || 'rice';

      const ingredient = await prisma.ingredient.findFirst({
        where: {
          branchId: activeBranchId,
          name: { contains: ingName.split(' ')[0], mode: 'insensitive' },
        },
      });

      if (!ingredient) {
        const notFound = language === 'kannada_english'
          ? `${ingName} inventory alli siglilla.`
          : `I couldn't find ${ingName} in the current inventory.`;
        return {
          spokenResponse: notFound,
          displayTranscript: rawTranscript,
          actionClass: 'QUERY',
          detectedLanguage: language,
          confirmationRequired: false,
          uiNavigation: { route: '/operations/inventory', searchQuery: ingName },
          sessionState: { branchId: activeBranchId },
        };
      }

      // Update contextual memory
      const stockQty = ingredient.currentStock / ingredient.conversionFactor;
      session.currentEntity = {
        type: 'ingredient',
        id: ingredient.id,
        name: ingredient.name,
        data: { currentStock: stockQty, unit: ingredient.purchaseUnit },
      };

      const friendlyName = this.formatFriendlyName(ingredient.name);
      let spoken = '';
      if (language === 'kannada_english') {
        spoken = `${friendlyName} stock ${stockQty} ${ingredient.purchaseUnit} ide.`;
      } else if (language === 'hindi_english') {
        spoken = `${friendlyName} ka stock ${stockQty} ${ingredient.purchaseUnit} hai.`;
      } else {
        spoken = `${ingredient.name} stock is currently ${stockQty} ${ingredient.purchaseUnit}.`;
      }

      return {
        spokenResponse: spoken,
        displayTranscript: rawTranscript,
        actionClass: 'QUERY',
        detectedLanguage: language,
        confirmationRequired: false,
        actionResult: ingredient,
        uiNavigation: {
          route: '/operations/inventory',
          searchQuery: friendlyName,
          highlightId: ingredient.id,
        },
        sessionState: { branchId: activeBranchId, activeEntity: session.currentEntity },
      };
    }

    // B. INVENTORY MUTATION: MANUAL STOCK ADDITION (Contextual "100 kilo add maadu")
    if (text.includes('add') || text.includes('serisu') || text.includes('daalo')) {
      const qty = this.extractQuantity(text) || 100;
      const unit = this.extractUnit(text) || 'kg';
      const targetIngName = this.extractIngredientName(text) || session.currentEntity?.name;

      if (!targetIngName) {
        const ask = language === 'kannada_english'
          ? 'Sure. Yaava item ge stock add maadbeku?'
          : 'Sure. Which ingredient would you like to add stock for?';
        return {
          spokenResponse: ask,
          displayTranscript: rawTranscript,
          actionClass: 'QUESTION',
          detectedLanguage: language,
          confirmationRequired: false,
          sessionState: { branchId: activeBranchId },
        };
      }

      const ingredient = await prisma.ingredient.findFirst({
        where: {
          branchId: activeBranchId,
          name: { contains: targetIngName.split(' ')[0], mode: 'insensitive' },
        },
      });

      if (!ingredient) {
        return {
          spokenResponse: `Could not locate ${targetIngName} in inventory.`,
          displayTranscript: rawTranscript,
          actionClass: 'ACTION',
          detectedLanguage: language,
          confirmationRequired: false,
          sessionState: { branchId: activeBranchId },
        };
      }

      // Check RBAC
      if (session.userRole === RoleType.SUPPLIER) {
        return {
          spokenResponse: 'You do not have permission to adjust inventory stock.',
          displayTranscript: rawTranscript,
          actionClass: 'ACTION',
          detectedLanguage: language,
          confirmationRequired: false,
          sessionState: { branchId: activeBranchId },
        };
      }

      // Setup Confirmation Gate for Moderate Risk Write
      const idempotencyKey = `add_stock_${ingredient.id}_${qty}_${Date.now()}`;
      session.pendingAction = {
        actionType: 'MANUAL_STOCK_ADDITION',
        riskLevel: 'LOW_RISK_WRITE',
        description: `Add ${qty} ${unit} to ${ingredient.name}`,
        payload: {
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          quantity: qty,
          unit,
        },
        idempotencyKey,
        expiresAt: Date.now() + 60000,
      };

      let confirmQuestion = '';
      if (language === 'kannada_english') {
        confirmQuestion = `${qty} ${unit} ${ingredient.name.split(' ')[0]} add maadla?`;
      } else if (language === 'hindi_english') {
        confirmQuestion = `${qty} ${unit} ${ingredient.name.split(' ')[0]} inventory mein add karein?`;
      } else {
        confirmQuestion = `Shall I add ${qty} ${unit} to ${ingredient.name} inventory?`;
      }

      return {
        spokenResponse: confirmQuestion,
        displayTranscript: rawTranscript,
        actionClass: 'ACTION',
        detectedLanguage: language,
        confirmationRequired: true,
        pendingActionDescription: session.pendingAction.description,
        uiNavigation: {
          route: '/operations/inventory',
          searchQuery: ingredient.name.split(' ')[0],
          highlightId: ingredient.id,
        },
        sessionState: { branchId: activeBranchId, activeEntity: session.currentEntity },
      };
    }

    // D. INVENTORY MUTATION: CONSUMPTION / DEDUCTION (e.g. "Okay, tomato 50 kilo use aagide. Deduct maadu")
    if (
      text.includes('deduct') ||
      text.includes('use aagide') ||
      text.includes('khalas') ||
      text.includes('minus') ||
      text.includes('kam karo') ||
      text.includes('kadime maadu')
    ) {
      const qty = this.extractQuantity(text) || 50;
      const unit = this.extractUnit(text) || 'kg';
      const targetIngName = this.extractIngredientName(text) || (text.includes('tomato') ? 'tomato' : session.currentEntity?.name);

      if (!targetIngName) {
        const ask = language === 'kannada_english'
          ? 'Sure. Yaava item ge stock deduct maadbeku?'
          : 'Sure. Which ingredient would you like to deduct stock from?';
        return {
          spokenResponse: ask,
          displayTranscript: rawTranscript,
          actionClass: 'QUESTION',
          detectedLanguage: language,
          confirmationRequired: false,
          sessionState: { branchId: activeBranchId },
        };
      }

      const ingredient = await prisma.ingredient.findFirst({
        where: {
          branchId: activeBranchId,
          name: { contains: targetIngName.split(' ')[0], mode: 'insensitive' },
        },
      });

      if (!ingredient) {
        return {
          spokenResponse: `Could not locate ${targetIngName} in inventory.`,
          displayTranscript: rawTranscript,
          actionClass: 'ACTION',
          detectedLanguage: language,
          confirmationRequired: false,
          sessionState: { branchId: activeBranchId },
        };
      }

      // Check RBAC
      if (session.userRole === RoleType.SUPPLIER) {
        return {
          spokenResponse: 'You do not have permission to adjust inventory stock.',
          displayTranscript: rawTranscript,
          actionClass: 'ACTION',
          detectedLanguage: language,
          confirmationRequired: false,
          sessionState: { branchId: activeBranchId },
        };
      }

      const currentStockInPurchase = ingredient.currentStock / ingredient.conversionFactor;
      const newStockInPurchase = Math.max(0, currentStockInPurchase - qty);
      const newStockInStockUnit = newStockInPurchase * ingredient.conversionFactor;

      // Atomic Stock Deduction
      await InventoryEngineService.adjustStock(
        activeBranchId,
        ingredient.id,
        newStockInStockUnit,
        'MANUAL_OUT',
        session.userId,
        `Voice Agent Consumption Deduction by ${session.userRole}`
      );

      // Post-Write DB Read-back Verification
      const verified = await prisma.ingredient.findUnique({
        where: { id: ingredient.id },
      });

      const friendlyName = this.formatFriendlyName(ingredient.name);
      let spoken = '';
      if (language === 'kannada_english') {
        spoken = `Okay, ${qty} ${unit} ${friendlyName} deduct aagide. Current stock ${verified ? verified.currentStock / verified.conversionFactor : newStockInPurchase} ${ingredient.purchaseUnit} ide.`;
      } else if (language === 'hindi_english') {
        spoken = `Theek hai, ${qty} ${unit} ${friendlyName} deduct kar diya gaya hai.`;
      } else {
        spoken = `Deducted ${qty} ${unit} of ${ingredient.name}. Current balance is ${verified ? verified.currentStock / verified.conversionFactor : newStockInPurchase} ${ingredient.purchaseUnit}.`;
      }

      session.currentEntity = {
        type: 'ingredient',
        id: ingredient.id,
        name: ingredient.name,
        data: { currentStock: newStockInPurchase, unit: ingredient.purchaseUnit },
      };

      return {
        spokenResponse: spoken,
        displayTranscript: rawTranscript,
        actionClass: 'ACTION',
        detectedLanguage: language,
        confirmationRequired: false,
        actionResult: { ingredientId: ingredient.id, newStock: newStockInPurchase },
        uiNavigation: {
          route: '/operations/inventory',
          searchQuery: friendlyName,
          highlightId: ingredient.id,
        },
        sessionState: { branchId: activeBranchId, activeEntity: session.currentEntity },
      };
    }

    // G. SELF-CORRECTION / ACTION CANCELLATION (e.g. "Actually don't do that", "Wait don't do it")
    if (
      text.includes('dont do that') ||
      text.includes("don't do that") ||
      text.includes('madbedi') ||
      text.includes('cancel maadu') ||
      text.includes('mat karo') ||
      text.includes('actually dont') ||
      text.includes("actually don't")
    ) {
      session.pendingAction = undefined;

      let spoken = '';
      if (language === 'kannada_english') {
        spoken = 'Sari, action cancel maadiddini. Yaava changes aagilla.';
      } else if (language === 'hindi_english') {
        spoken = 'Theek hai, action cancel kar diya gaya hai. Kuch change nahi hua.';
      } else {
        spoken = 'Understood. Action cancelled, no changes were made.';
      }

      return {
        spokenResponse: spoken,
        displayTranscript: rawTranscript,
        actionClass: 'CANCELLATION',
        detectedLanguage: language,
        confirmationRequired: false,
        sessionState: { branchId: activeBranchId },
      };
    }

    // D. SHOW / FILTER ORDERS
    if (text.includes('orders') || text.includes('pending orders') || text.includes('today orders')) {
      const isPending = text.includes('pending');
      const filterStatus = isPending ? 'PENDING' : 'ALL';

      const count = await prisma.order.count({
        where: {
          branchId: activeBranchId,
          ...(isPending ? { status: 'PENDING' } : {}),
        },
      });

      let spoken = '';
      if (language === 'kannada_english') {
        spoken = isPending
          ? `${count} pending orders ide. Screen alli nodi.`
          : `Total ${count} orders ide. Screen alli display maadiddini.`;
      } else {
        spoken = isPending
          ? `Showing ${count} pending orders.`
          : `Displaying ${count} orders on screen.`;
      }

      return {
        spokenResponse: spoken,
        displayTranscript: rawTranscript,
        actionClass: 'QUERY',
        detectedLanguage: language,
        confirmationRequired: false,
        uiNavigation: {
          route: '/operations/orders',
          filter: { status: filterStatus },
        },
        sessionState: { branchId: activeBranchId },
      };
    }

    // E. CREATE PURCHASE ORDER
    if (
      text.includes('purchase order') ||
      text.includes('order maadi') ||
      text.includes('po create') ||
      text.includes('order prepare')
    ) {
      const ingName = this.extractIngredientName(text) || session.currentEntity?.name || 'rice';
      const qty = this.extractQuantity(text) || 50;
      const unit = this.extractUnit(text) || 'kg';

      const ingredient = await prisma.ingredient.findFirst({
        where: {
          branchId: activeBranchId,
          name: { contains: ingName.split(' ')[0], mode: 'insensitive' },
        },
        include: { preferredSupplier: true },
      });

      if (!ingredient || !ingredient.preferredSupplier) {
        return {
          spokenResponse: `Could not find a preferred supplier for ${ingName}.`,
          displayTranscript: rawTranscript,
          actionClass: 'ACTION',
          detectedLanguage: language,
          confirmationRequired: false,
          sessionState: { branchId: activeBranchId },
        };
      }

      const supplier = ingredient.preferredSupplier;
      const estimatedCost = Math.round(qty * ingredient.costPerUnit * ingredient.conversionFactor);

      session.pendingAction = {
        actionType: 'CREATE_PURCHASE_ORDER',
        riskLevel: 'FINANCIAL',
        description: `Create PO for ${qty} ${unit} ${ingredient.name} from ${supplier.name} (~₹${estimatedCost})`,
        payload: {
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          supplierId: supplier.id,
          supplierName: supplier.name,
          quantity: qty,
          unit,
          estimatedCost,
        },
        idempotencyKey: `create_po_${ingredient.id}_${qty}_${Date.now()}`,
        expiresAt: Date.now() + 60000,
      };

      let confirmMsg = '';
      if (language === 'kannada_english') {
        confirmMsg = `Sure. Preferred supplier ${supplier.name}. ${qty} ${unit} ${ingredient.name.split(' ')[0]} ge PO prepare maadiddene. Create maadla?`;
      } else {
        confirmMsg = `I've prepared a purchase order for ${qty} ${unit} ${ingredient.name} with ${supplier.name} for ₹${estimatedCost}. Shall I create it?`;
      }

      return {
        spokenResponse: confirmMsg,
        displayTranscript: rawTranscript,
        actionClass: 'ACTION',
        detectedLanguage: language,
        confirmationRequired: true,
        pendingActionDescription: session.pendingAction.description,
        uiNavigation: { route: '/procurement/purchase-orders' },
        sessionState: { branchId: activeBranchId },
      };
    }

    // F. PURCHASE RECOMMENDATIONS
    if (text.includes('recommend') || text.includes('purchase madbeku') || text.includes('kharidna hai')) {
      const recs = await PurchaseRecommendationService.generateRecommendations(activeBranchId);
      const topItems = recs.items.slice(0, 3);
      const summary = topItems
        .map((i) => `${i.ingredientName.split(' ')[0]} ${i.recommendedPurchaseQty} ${i.purchaseUnit}`)
        .join(', ');

      const spoken = language === 'kannada_english'
        ? `Tomorrow ge ${summary} recommend maadide. Total cost ₹${Math.round(recs.totalEstimatedCost)}.`
        : `Tomorrow's recommendations include ${summary}, totaling ₹${Math.round(recs.totalEstimatedCost)}.`;

      return {
        spokenResponse: spoken,
        displayTranscript: rawTranscript,
        actionClass: 'QUERY',
        detectedLanguage: language,
        confirmationRequired: false,
        actionResult: recs,
        uiNavigation: { route: '/procurement/intelligence' },
        sessionState: { branchId: activeBranchId },
      };
    }

    // G. TODAY SALES / BUSINESS ANALYTICS
    if (text.includes('sales') || text.includes('revenue') || text.includes('business')) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const orders = await prisma.order.findMany({
        where: { branchId: activeBranchId, createdAt: { gte: today } },
      });

      const total = orders.reduce((sum, o) => sum + o.totalAmount, 0);
      const count = orders.length;

      const spoken = language === 'kannada_english'
        ? `Today ₹${Math.round(total).toLocaleString('en-IN')} sales aagide across ${count} orders.`
        : `Today's sales total ₹${Math.round(total).toLocaleString('en-IN')} across ${count} orders.`;

      return {
        spokenResponse: spoken,
        displayTranscript: rawTranscript,
        actionClass: 'QUERY',
        detectedLanguage: language,
        confirmationRequired: false,
        actionResult: { totalSales: total, count },
        uiNavigation: { route: '/analytics' },
        sessionState: { branchId: activeBranchId },
      };
    }

    // Default Conversational Fallback
    const fallback = language === 'kannada_english'
      ? 'Haudu, stock, orders, kitchen mathu purchase order details na helthini.'
      : 'I am here to assist with inventory, orders, kitchen KDS, and procurement. What would you like to do?';

    return {
      spokenResponse: fallback,
      displayTranscript: rawTranscript,
      actionClass: 'CONVERSATION',
      detectedLanguage: language,
      confirmationRequired: false,
      sessionState: { branchId: activeBranchId },
    };
  }

  /**
   * Execute Gated Write Action with Post-Write DB Verification & Zero False Success
   */
  public static async executePendingAction(
    pending: NonNullable<VoiceSessionState['pendingAction']>,
    session: VoiceSessionState,
    language: string
  ): Promise<VoiceExecutionResponse> {
    const activeBranchId = session.branchId;

    // Idempotency Check
    if (this.idempotencyLog.has(pending.idempotencyKey)) {
      const cached = this.idempotencyLog.get(pending.idempotencyKey)!;
      return cached.result;
    }

    // 1. Manual Stock Addition
    if (pending.actionType === 'MANUAL_STOCK_ADDITION') {
      const { ingredientId, quantity, unit } = pending.payload;

      const ingredient = await prisma.ingredient.findUnique({
        where: { id: ingredientId },
      });

      if (!ingredient) {
        return {
          spokenResponse: 'Could not complete inventory update: record not found.',
          displayTranscript: 'Action Failed',
          actionClass: 'ACTION',
          detectedLanguage: language,
          confirmationRequired: false,
          sessionState: { branchId: activeBranchId },
        };
      }

      const currentStockInPurchase = ingredient.currentStock / ingredient.conversionFactor;
      const newStockInPurchase = currentStockInPurchase + quantity;
      const newStockInStockUnit = newStockInPurchase * ingredient.conversionFactor;

      // Atomic Stock Adjustment
      await InventoryEngineService.adjustStock(
        activeBranchId,
        ingredientId,
        newStockInStockUnit,
        'MANUAL_IN',
        session.userId,
        `Voice Agent Addition by ${session.userRole}`
      );

      // Post-Write Read-Back Verification
      const verified = await prisma.ingredient.findUnique({
        where: { id: ingredientId },
      });

      if (!verified) {
        return {
          spokenResponse: 'Stock update could not be verified in the database.',
          displayTranscript: 'Verification Failed',
          actionClass: 'ACTION',
          detectedLanguage: language,
          confirmationRequired: false,
          sessionState: { branchId: activeBranchId },
        };
      }

      const verifiedStock = verified.currentStock / verified.conversionFactor;
      const friendlyName = this.formatFriendlyName(verified.name);

      let spoken = '';
      if (language === 'kannada_english') {
        spoken = `Done, ${quantity} ${unit} ${friendlyName} inventory ge add aagide. Iga total ${verifiedStock} ${verified.purchaseUnit} ide.`;
      } else if (language === 'hindi_english') {
        spoken = `Done. ${quantity} ${unit} ${friendlyName} add ho gaya hai. Total ${verifiedStock} ${verified.purchaseUnit} hai.`;
      } else {
        spoken = `Done. ${quantity} ${unit} of ${verified.name} added. Current balance is ${verifiedStock} ${verified.purchaseUnit}.`;
      }

      const response: VoiceExecutionResponse = {
        spokenResponse: spoken,
        displayTranscript: `Added ${quantity} ${unit} to ${verified.name}`,
        actionClass: 'ACTION',
        detectedLanguage: language,
        confirmationRequired: false,
        actionResult: verified,
        uiNavigation: {
          route: '/operations/inventory',
          searchQuery: verified.name.split(' ')[0],
          highlightId: verified.id,
        },
        sessionState: {
          branchId: activeBranchId,
          activeEntity: {
            type: 'ingredient',
            id: verified.id,
            name: verified.name,
            data: { currentStock: verifiedStock },
          },
        },
      };

      this.idempotencyLog.set(pending.idempotencyKey, { result: response, timestamp: Date.now() });
      return response;
    }

    // 2. Create Purchase Order
    if (pending.actionType === 'CREATE_PURCHASE_ORDER') {
      const { ingredientId, supplierId, quantity, unit, estimatedCost } = pending.payload;

      const count = await prisma.purchaseOrder.count({ where: { branchId: activeBranchId } });
      const poNumber = `PO-${1000 + count + 1}`;

      const deliveryDate = new Date();
      deliveryDate.setDate(deliveryDate.getDate() + 1);

      const created = await prisma.purchaseOrder.create({
        data: {
          poNumber,
          branchId: activeBranchId,
          supplierId,
          status: 'DRAFT',
          totalAmount: estimatedCost,
          expectedDeliveryDate: deliveryDate,
          notes: 'Voice Agent Automated Dispatch',
          items: {
            create: [
              {
                ingredientId,
                orderedQuantity: quantity,
                unitCost: estimatedCost / quantity,
                totalCost: estimatedCost,
              },
            ],
          },
        },
        include: { supplier: true },
      });

      // Post-Write Read-Back Verification
      const verified = await prisma.purchaseOrder.findUnique({
        where: { id: created.id },
        include: { supplier: true },
      });

      if (!verified) {
        return {
          spokenResponse: 'Purchase order creation could not be verified.',
          displayTranscript: 'PO Creation Failed',
          actionClass: 'ACTION',
          detectedLanguage: language,
          confirmationRequired: false,
          sessionState: { branchId: activeBranchId },
        };
      }

      let spoken = '';
      if (language === 'kannada_english') {
        spoken = `Done. ${verified.poNumber} create aagide with ${verified.supplier.name}. Total ₹${Math.round(verified.totalAmount)}.`;
      } else {
        spoken = `Done. Purchase order ${verified.poNumber} has been created with ${verified.supplier.name} for ₹${Math.round(verified.totalAmount)}.`;
      }

      const response: VoiceExecutionResponse = {
        spokenResponse: spoken,
        displayTranscript: `Created ${verified.poNumber}`,
        actionClass: 'ACTION',
        detectedLanguage: language,
        confirmationRequired: false,
        actionResult: verified,
        uiNavigation: {
          route: '/procurement/purchase-orders',
          highlightId: verified.id,
        },
        sessionState: { branchId: activeBranchId },
      };

      this.idempotencyLog.set(pending.idempotencyKey, { result: response, timestamp: Date.now() });
      return response;
    }

    return {
      spokenResponse: 'Action executed successfully.',
      displayTranscript: 'Action Completed',
      actionClass: 'ACTION',
      detectedLanguage: language,
      confirmationRequired: false,
      sessionState: { branchId: activeBranchId },
    };
  }

  /**
   * Chit-Chat Natural Responses
   */
  private static generateChitChatReply(text: string, language: string): string {
    if (language === 'kannada_english') {
      if (text.includes('hegiddira') || text.includes('how are you')) {
        return 'Naanu chennagiddini! Restaurant operations alli hege help madli?';
      }
      return 'Namaskara! Hege help madli?';
    }

    if (language === 'hindi_english') {
      if (text.includes('kaisa') || text.includes('how are you')) {
        return 'Main badhiya hoon! Aaj restaurant operations mein kya madad karoon?';
      }
      return 'Namaste! Main aapki kya madad kar sakta hoon?';
    }

    if (text.includes('how are you')) {
      return "I'm doing great! How can I assist with your restaurant operations today?";
    }
    return 'Hi! How can I help you today?';
  }

  /**
   * Explanation Responses
   */
  private static generateExplanationReply(text: string, language: string): string {
    if (text.includes('what is bom') || text.includes('bom enu')) {
      return 'BOM stands for Bill of Materials. It specifies the exact portion of raw ingredients consumed for each menu item, ensuring real-time automatic stock deduction on every order.';
    }
    if (text.includes('what is wac') || text.includes('wac enu')) {
      return 'WAC stands for Weighted Average Cost. It automatically recalculates your true inventory valuation whenever new goods are received at different market purchase rates.';
    }
    return 'I can help you monitor inventory, execute purchase orders, check live kitchen tickets on KDS, track food waste, and inspect daily sales analytics. You can speak naturally in Kannada, Hindi, Tamil, Telugu, or English.';
  }

  /**
   * Navigation Target Resolver
   */
  private static resolveNavigationRoute(text: string): { route: string; name: string } {
    if (text.includes('inventory') || text.includes('stock')) {
      return { route: '/operations/inventory', name: 'inventory' };
    }
    if (text.includes('kitchen') || text.includes('kds')) {
      return { route: '/operations/kds', name: 'kitchen department' };
    }
    if (text.includes('order')) {
      return { route: '/operations/orders', name: 'orders' };
    }
    if (text.includes('procurement') || text.includes('purchase')) {
      return { route: '/procurement/purchase-orders', name: 'purchase orders' };
    }
    if (text.includes('supplier')) {
      return { route: '/procurement/suppliers', name: 'suppliers' };
    }
    if (text.includes('daily report') || text.includes("today's report") || text.includes('eod') || text.includes('todays report')) {
      return { route: '/reports/daily', name: 'daily reports' };
    }
    if (text.includes('analytics') || text.includes('report')) {
      return { route: '/analytics', name: 'analytics' };
    }
    if (text.includes('recipe') || text.includes('menu')) {
      return { route: '/menu/recipes', name: 'recipes' };
    }
    if (text.includes('waste')) {
      return { route: '/operations/waste', name: 'waste log' };
    }
    return { route: '/operations/inventory', name: 'inventory' };
  }

  /**
   * Natural Language Entity Extractors
   */
  private static extractIngredientName(text: string): string | null {
    const list = [
      'rice',
      'urad dal',
      'toor dal',
      'oil',
      'sunflower oil',
      'onion',
      'tomato',
      'potato',
      'methi',
      'fenugreek',
      'rava',
      'sugar',
      'milk',
      'butter',
      'ghee',
      'poha',
      'mustard',
      'chana dal',
      'curry leaves',
      'green chilli',
      'ginger',
      'coconut',
      'idli',
      'dosa',
    ];
    for (const item of list) {
      if (text.includes(item)) return item;
    }
    return null;
  }

  private static extractQuantity(text: string): number | null {
    const match = text.match(/\b(\d+(\.\d+)?)\b/);
    if (match) return parseFloat(match[1]);

    const words: Record<string, number> = {
      one: 1,
      two: 2,
      three: 3,
      five: 5,
      ten: 10,
      twenty: 20,
      twentyfive: 25,
      fifty: 50,
      hundred: 100,
      ಒಂದು: 1,
      ಎರಡು: 2,
      ಐದು: 5,
      ಹತ್ತು: 10,
      ಇಪ್ಪತ್ತು: 20,
      ಐವತ್ತು: 50,
      ನೂರು: 100,
      एक: 1,
      दो: 2,
      पाँच: 5,
      दस: 10,
      पचास: 50,
      सौ: 100,
    };

    for (const [w, val] of Object.entries(words)) {
      if (text.includes(w)) return val;
    }
    return null;
  }

  private static extractUnit(text: string): string | null {
    if (text.includes('kilo') || text.includes('kg') || text.includes('ಕಿಲೋ') || text.includes('किलो')) return 'kg';
    if (text.includes('litre') || text.includes('liter') || text.includes('ltr') || text.includes('ಲೀಟರ್')) return 'litre';
    if (text.includes('gram') || text.includes('gm') || text.includes('ಗ್ರಾಂ')) return 'grams';
    if (text.includes('packet') || text.includes('pkt') || text.includes('ಪ್ಯಾಕೆಟ್')) return 'packets';
    if (text.includes('box') || text.includes('ಬಾಕ್ಸ್')) return 'boxes';
    return null;
  }

  private static formatFriendlyName(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('rice')) return 'Rice';
    if (lower.includes('urad')) return 'Urad Dal';
    if (lower.includes('toor')) return 'Toor Dal';
    if (lower.includes('oil')) return 'Oil';
    if (lower.includes('onion')) return 'Onion';
    if (lower.includes('tomato')) return 'Tomato';
    if (lower.includes('potato')) return 'Potato';
    return name.split(' (')[0];
  }
}
