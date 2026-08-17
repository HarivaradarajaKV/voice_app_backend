import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import url from 'url';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler.middleware';
import { SarvamVoiceService } from './services/sarvamVoice.service';

const app = express();

// Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow any origin (localhost:5173, Vercel, Netlify, etc.) with credentials
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'bypass-tunnel-reminder'],
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Bypass localtunnel splash page for all requests (safe header, ignored in production)
app.use((_req, res, next) => {
  res.setHeader('bypass-tunnel-reminder', '1');
  next();
});

// Static file serving for uploaded invoice files
app.use('/uploads', express.static(config.uploadDir));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Data Udipi Operating Platform API',
    timestamp: new Date(),
    environment: config.nodeEnv,
  });
});

// API Routes mounting
app.use('/api/v1', routes);

// Global Error Handler
app.use(errorHandler);

const PORT = config.port;
const server = http.createServer(app);

// Attach WebSocket server for real-time Sarvam Saaras v3 STT streaming
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const parsedUrl = url.parse(request.url || '', true);
  const pathname = parsedUrl.pathname;

  if (pathname === '/api/v1/voice/sarvam-stream') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws, request) => {
  const parsedUrl = url.parse(request.url || '', true);
  SarvamVoiceService.handleClientConnection(ws, parsedUrl.query);
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Data Udipi Server running at http://0.0.0.0:${PORT}`);
    console.log(`📡 API Endpoints available at http://localhost:${PORT}/api/v1`);
    console.log(`🎙️ Sarvam Voice WebSocket available at ws://localhost:${PORT}/api/v1/voice/sarvam-stream`);
  });
}

export default app;
