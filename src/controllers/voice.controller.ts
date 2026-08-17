import { Request, Response } from 'express';
import { VoiceAgentService } from '../services/voiceAgent.service';

export class VoiceController {
  /**
   * POST /api/v1/voice/action
   */
  static async handleVoiceAction(req: Request, res: Response): Promise<void> {
    try {
      const { transcript, sessionId, branchId, currentRoute } = req.body;
      const userId = (req as any).user?.id || 'sys_manager';
      const userRole = (req as any).user?.role || 'BRANCH_MANAGER';
      const userName = (req as any).user?.name || req.body?.userName || 'Arivardhan';
      const activeBranchId = branchId || (req as any).user?.branchId;

      if (!transcript || typeof transcript !== 'string') {
        res.status(400).json({ error: 'Transcript string is required' });
        return;
      }

      if (!activeBranchId) {
        res.status(400).json({ error: 'Branch context is required' });
        return;
      }

      const sessionKey = sessionId || `session_${userId}_${activeBranchId}`;

      const result = await VoiceAgentService.processConversationalTurn(
        transcript,
        sessionKey,
        userId,
        userRole,
        activeBranchId,
        currentRoute,
        userName
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Voice action processing error:', error);
      res.json({
        success: true,
        data: {
          spokenResponse: "I'm having a little trouble connecting to that operational service right now. Please try your request again in a moment.",
          displayTranscript: req.body?.transcript || '',
          actionClass: 'CONVERSATION',
          detectedLanguage: 'english',
          confirmationRequired: false,
          sessionState: { branchId: req.body?.branchId || '' },
        },
      });
    }
  }

  /**
   * POST /api/v1/voice/confirm
   */
  static async confirmPendingAction(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, branchId, currentRoute } = req.body;
      const userId = (req as any).user?.id || 'sys_manager';
      const userRole = (req as any).user?.role || 'BRANCH_MANAGER';
      const activeBranchId = branchId || (req as any).user?.branchId;

      const result = await VoiceAgentService.processConversationalTurn(
        'Yes',
        sessionId || `session_${userId}_${activeBranchId}`,
        userId,
        userRole,
        activeBranchId,
        currentRoute
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Voice confirmation error:', error);
      res.status(500).json({ error: 'Failed to process confirmation' });
    }
  }
}
