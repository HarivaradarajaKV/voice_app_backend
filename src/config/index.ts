import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'data-udipi-super-secret-jwt-key-2026',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  databaseUrl: process.env.DATABASE_URL,
  uploadDir: path.resolve(__dirname, '../../uploads'),
  whatsappApiUrl: process.env.WHATSAPP_API_URL || 'https://api.whatsapp.mock/v1/messages',
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || 'mock_whatsapp_token_2026',
  ocrApiKey: process.env.OCR_API_KEY || 'mock_ocr_key_2026',
};
