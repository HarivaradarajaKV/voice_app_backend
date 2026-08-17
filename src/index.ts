import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler.middleware';

const app = express();

// Middlewares
app.use(cors({ origin: config.corsOrigin, credentials: true }));
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
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Data Udipi Server running at http://0.0.0.0:${PORT}`);
    console.log(`📡 API Endpoints available at http://localhost:${PORT}/api/v1`);
  });
}

export default app;
