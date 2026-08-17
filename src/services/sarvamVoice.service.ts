import WebSocket from 'ws';
import { VoiceAgentService } from './voiceAgent.service';
import { config } from '../config';

/**
 * Configurable language-to-speaker mapping for Sarvam Bulbul v3
 */
export const SARVAM_SPEAKER_MAP: Record<string, { code: string; speaker: string }> = {
  'en-IN': { code: 'en-IN', speaker: 'aditya' },
  'hi-IN': { code: 'hi-IN', speaker: 'shubh' },
  'kn-IN': { code: 'kn-IN', speaker: 'ishita' },
  'ta-IN': { code: 'ta-IN', speaker: 'ritu' },
  'te-IN': { code: 'te-IN', speaker: 'neha' },
  'ml-IN': { code: 'ml-IN', speaker: 'pooja' },
  'mr-IN': { code: 'mr-IN', speaker: 'aditya' },
  'gu-IN': { code: 'gu-IN', speaker: 'shubh' },
  'bn-IN': { code: 'bn-IN', speaker: 'shubh' },
  'pa-IN': { code: 'pa-IN', speaker: 'shubh' },
  'od-IN': { code: 'od-IN', speaker: 'shubh' },
  'kannada_english': { code: 'kn-IN', speaker: 'ishita' },
  'hindi_english': { code: 'hi-IN', speaker: 'shubh' },
  'tamil_english': { code: 'ta-IN', speaker: 'ritu' },
  'telugu_english': { code: 'te-IN', speaker: 'neha' },
  'malayalam_english': { code: 'ml-IN', speaker: 'pooja' },
  'english': { code: 'en-IN', speaker: 'aditya' },
};

export interface SarvamVoiceSession {
  sessionId: string;
  clientWs: WebSocket;
  sarvamWs: WebSocket | null;
  branchId: string;
  userId: string;
  userRole: string;
  userName: string;
  currentRoute: string;
  detectedLanguage: string;
  isProcessingTurn: boolean;
}

export class SarvamVoiceService {
  private static readonly SARVAM_STT_WS_URL =
    'wss://api.sarvam.ai/speech-to-text/ws?model=saaras:v3&mode=transcribe&sample_rate=16000&input_audio_codec=pcm_s16le';
  private static readonly SARVAM_TTS_REST_URL = 'https://api.sarvam.ai/text-to-speech';

  /**
   * Generates a standard WAV header for PCM Linear16 samples (16kHz, 16-bit, mono)
   */
  private static createWavBuffer(pcmSamples: Buffer, sampleRate = 16000): Buffer {
    const numChannels = 1;
    const byteRate = sampleRate * numChannels * 2;
    const blockAlign = numChannels * 2;
    const dataSize = pcmSamples.length;
    const header = Buffer.alloc(44);

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size
    header.writeUInt16LE(1, 20);  // PCM format
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(16, 34); // 16-bit
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmSamples]);
  }

  /**
   * Initializes a real-time streaming bridge between a browser client and Sarvam Saaras v3 STT.
   */
  public static handleClientConnection(clientWs: WebSocket, queryParams: any) {
    const sessionId = queryParams.sessionId || `sarvam_${Date.now()}`;
    const branchId = queryParams.branchId || 'cmsva145f000gitlp27vm05f5';
    const userId = queryParams.userId || 'usr_manager_01';
    const userRole = queryParams.userRole || 'MANAGER';
    const userName = queryParams.userName || 'Manager';
    const currentRoute = queryParams.currentRoute || '/';

    console.log('[Sarvam] Frontend WS connected');

    const session: SarvamVoiceSession = {
      sessionId,
      clientWs,
      sarvamWs: null,
      branchId,
      userId,
      userRole,
      userName,
      currentRoute,
      detectedLanguage: 'kannada_english',
      isProcessingTurn: false,
    };

    const sarvamApiKey = process.env.SARVAM_API_KEY || (config as any).sarvamApiKey || '';
    if (!sarvamApiKey) {
      console.warn('[Sarvam] ⚠️ SARVAM_API_KEY is not set in backend environment.');
      clientWs.send(
        JSON.stringify({
          type: 'error',
          message: 'SARVAM_API_KEY is not configured on the backend server.',
        })
      );
      return;
    }

    let framesReceived = 0;
    let framesSent = 0;
    const pendingAudioQueue: Buffer[] = [];

    // Connect to Sarvam Official Streaming STT WebSocket
    let sarvamWs: WebSocket | null = null;
    try {
      sarvamWs = new WebSocket(this.SARVAM_STT_WS_URL, {
        headers: {
          'api-subscription-key': sarvamApiKey,
        },
      });
      session.sarvamWs = sarvamWs;
    } catch (err: any) {
      console.error('[Sarvam] Failed to create Sarvam WebSocket:', err);
      clientWs.send(
        JSON.stringify({
          type: 'error',
          message: `Failed to connect to Sarvam STT: ${err.message}`,
        })
      );
      return;
    }

    sarvamWs.on('open', () => {
      console.log('[Sarvam] Sarvam STT WS connected');
      clientWs.send(
        JSON.stringify({
          type: 'ready',
          sessionId,
          engine: 'sarvam_saaras_v3',
        })
      );

      // Flush buffered audio frames
      while (pendingAudioQueue.length > 0) {
        const chunk = pendingAudioQueue.shift()!;
        const wavBuffer = SarvamVoiceService.createWavBuffer(chunk, 16000);
        const payload = {
          audio: {
            data: wavBuffer.toString('base64'),
            encoding: 'audio/wav',
            sample_rate: 16000,
          },
        };
        sarvamWs.send(JSON.stringify(payload));
        framesSent++;
      }
      if (framesSent > 0) {
        console.log(`[Sarvam] Audio frames sent to Sarvam: ${framesSent}`);
      }
    });

    let lastTranscript = '';
    let turnTimer: any = null;

    sarvamWs.on('message', async (data: WebSocket.Data) => {
      try {
        const rawStr = data.toString();
        const msg = JSON.parse(rawStr);

        // 1. Server-side speech detection -> Trigger Barge-In on client
        if (msg.event === 'speech_started' || msg.type === 'speech_started' || msg.speech_detected) {
          if (turnTimer) clearTimeout(turnTimer);
          clientWs.send(
            JSON.stringify({
              type: 'barge_in',
              reason: 'user_speech_detected',
            })
          );
        }

        // 2. Extract transcript from official Sarvam Streaming STT formats
        const transcriptText =
          msg.transcript ||
          msg.text ||
          msg.data?.transcript ||
          msg.data?.text ||
          (msg.results && msg.results[0]?.transcript) ||
          (msg.data?.results && msg.data.results[0]?.transcript) ||
          '';

        const isFinal =
          msg.is_final === true ||
          msg.type === 'final' ||
          msg.event === 'final_transcript' ||
          msg.data?.is_final === true ||
          msg.event === 'speech_ended' ||
          msg.type === 'speech_ended';

        if (transcriptText) {
          lastTranscript = transcriptText.trim();
          console.log(`[Sarvam] Transcript: ${lastTranscript}`);

          const langCode = msg.language_code || msg.data?.language_code;
          if (langCode) {
            session.detectedLanguage = langCode;
            console.log(`[Sarvam] Detected language: ${langCode}`);
          }

          clientWs.send(
            JSON.stringify({
              type: 'transcript',
              transcript: transcriptText,
              isFinal,
              languageCode: session.detectedLanguage,
            })
          );

          if (isFinal && lastTranscript.length > 0 && !session.isProcessingTurn) {
            if (turnTimer) clearTimeout(turnTimer);
            session.isProcessingTurn = true;
            await this.processVoiceTurn(session, lastTranscript);
            session.isProcessingTurn = false;
            lastTranscript = '';
          } else if (!isFinal && lastTranscript.length > 0) {
            // Silence timer: finalize if no new audio received in 1200ms
            if (turnTimer) clearTimeout(turnTimer);
            turnTimer = setTimeout(async () => {
              if (lastTranscript.length > 0 && !session.isProcessingTurn) {
                session.isProcessingTurn = true;
                const toProcess = lastTranscript;
                lastTranscript = '';
                await this.processVoiceTurn(session, toProcess);
                session.isProcessingTurn = false;
              }
            }, 1200);
          }
        }
      } catch (parseErr) {
        console.error('[Sarvam] Error handling Sarvam STT message:', parseErr);
      }
    });

    sarvamWs.on('error', (err) => {
      console.error('[Sarvam] ❌ Sarvam STT WebSocket Error:', err);
      clientWs.send(
        JSON.stringify({
          type: 'error',
          message: `Sarvam STT error: ${err.message}`,
        })
      );
    });

    sarvamWs.on('close', (code, reason) => {
      console.log(`[Sarvam] 🔴 Sarvam STT WebSocket closed: ${code} - ${reason.toString()}`);
    });

    // Client WebSocket message handler (receiving 16kHz PCM audio stream or control commands)
    clientWs.on('message', async (data: WebSocket.Data) => {
      try {
        if (Buffer.isBuffer(data)) {
          framesReceived++;
          if (framesReceived % 10 === 0) {
            console.log(`[Sarvam] Audio frames received: ${framesReceived}`);
          }

          if (sarvamWs && sarvamWs.readyState === WebSocket.OPEN) {
            const wavBuffer = SarvamVoiceService.createWavBuffer(data, 16000);
            const payload = {
              audio: {
                data: wavBuffer.toString('base64'),
                encoding: 'audio/wav',
                sample_rate: 16000,
              },
            };
            sarvamWs.send(JSON.stringify(payload));
            framesSent++;
            if (framesSent % 10 === 0) {
              console.log(`[Sarvam] Audio frames sent to Sarvam: ${framesSent}`);
            }
          } else {
            pendingAudioQueue.push(data);
          }
        } else {
          // Text / JSON command from client
          const msg = JSON.parse(data.toString());

          if (msg.type === 'audio_chunk' && msg.audio) {
            framesReceived++;
            const rawPcm = Buffer.from(msg.audio, 'base64');
            if (sarvamWs && sarvamWs.readyState === WebSocket.OPEN) {
              const wavBuffer = SarvamVoiceService.createWavBuffer(rawPcm, 16000);
              const payload = {
                audio: {
                  data: wavBuffer.toString('base64'),
                  encoding: 'audio/wav',
                  sample_rate: 16000,
                },
              };
              sarvamWs.send(JSON.stringify(payload));
              framesSent++;
            } else {
              pendingAudioQueue.push(rawPcm);
            }
          } else if (msg.type === 'text_command' && msg.text) {
            console.log(`[Sarvam] Transcript: ${msg.text}`);
            await this.processVoiceTurn(session, msg.text);
          } else if (msg.type === 'update_context') {
            if (msg.currentRoute) session.currentRoute = msg.currentRoute;
            if (msg.branchId) session.branchId = msg.branchId;
          }
        }
      } catch (err) {
        console.error('[Sarvam] Error processing client message:', err);
      }
    });

    clientWs.on('close', () => {
      console.log(`[Sarvam] Client disconnected for session: ${sessionId}`);
      if (sarvamWs && sarvamWs.readyState === WebSocket.OPEN) {
        sarvamWs.close();
      }
    });
  }

  /**
   * Executes the voice turn through existing VoiceAgentService and synthesizes response with Bulbul v3.
   */
  public static async processVoiceTurn(session: SarvamVoiceSession, transcript: string) {
    const { clientWs, sessionId, userId, userRole, branchId, currentRoute, userName } = session;

    // Send Thinking status to client
    clientWs.send(
      JSON.stringify({
        type: 'status',
        status: 'THINKING',
        transcript,
      })
    );

    try {
      // 1. Authoritative Intent, Canonical Navigation, and Order Status Mutation Engine
      const result = await VoiceAgentService.processConversationalTurn(
        transcript,
        sessionId,
        userId,
        userRole as any,
        branchId,
        currentRoute,
        userName
      );

      const responseText = result.spokenResponse;
      const detectedLanguage = result.detectedLanguage || session.detectedLanguage || 'kannada_english';

      console.log(`[Sarvam] Detected language: ${detectedLanguage}`);
      console.log(`[Sarvam] VoiceAgent response: ${responseText}`);

      // 2. Synthesize with Sarvam Bulbul v3 TTS
      const ttsAudio = await this.synthesizeSpeechBulbulV3(responseText, detectedLanguage);

      // 3. Emit completed turn result to client
      clientWs.send(
        JSON.stringify({
          type: 'turn_result',
          transcript,
          detectedLanguage,
          intent: result.actionClass,
          uiNavigation: result.uiNavigation,
          actionResult: result.actionResult,
          confirmationRequired: result.confirmationRequired,
          responseText,
          responseLanguage: detectedLanguage,
          audioBase64: ttsAudio.audioBase64,
          audioFormat: ttsAudio.format,
        })
      );
    } catch (err: any) {
      console.error('[SarvamVoiceService] Error in processVoiceTurn:', err);
      clientWs.send(
        JSON.stringify({
          type: 'error',
          message: `Failed to execute voice command: ${err.message}`,
        })
      );
    }
  }

  /**
   * Synthesizes text to speech using Sarvam Bulbul v3 with dynamic Indic language selection.
   */
  public static async synthesizeSpeechBulbulV3(
    text: string,
    languageHint: string
  ): Promise<{ audioBase64: string | null; format: string }> {
    const sarvamApiKey = process.env.SARVAM_API_KEY || (config as any).sarvamApiKey || '';
    if (!sarvamApiKey || !text || !text.trim()) {
      return { audioBase64: null, format: 'none' };
    }

    const mapping = SARVAM_SPEAKER_MAP[languageHint] || SARVAM_SPEAKER_MAP['kannada_english'] || {
      code: 'kn-IN',
      speaker: 'ishita',
    };

    try {
      const res = await fetch(this.SARVAM_TTS_REST_URL, {
        method: 'POST',
        headers: {
          'api-subscription-key': sarvamApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          target_language_code: mapping.code,
          model: 'bulbul:v3',
          speaker: mapping.speaker,
          pace: 1.0,
          output_audio_codec: 'mp3',
        }),
      });

      if (res.ok) {
        const data: any = await res.json();
        if (data.audios && data.audios.length > 0) {
          return {
            audioBase64: data.audios[0],
            format: 'mp3',
          };
        }
      } else {
        const errText = await res.text();
        console.error('[SarvamVoiceService] Bulbul v3 TTS HTTP Error:', res.status, errText);
      }
    } catch (err: any) {
      console.error('[SarvamVoiceService] Bulbul v3 TTS Error:', err.message);
    }

    return { audioBase64: null, format: 'none' };
  }
}
