import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { OCRExtractionService } from '../services/ocrExtraction.service';
import { AuditService } from '../services/audit.service';

export class InvoicesController {
  static async getInvoices(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const branchId = (req.query.branchId as string) || req.user?.branchId;
      const supplierId = req.query.supplierId as string;

      const where: any = { branchId };
      if (supplierId) where.supplierId = supplierId;

      const invoices = await prisma.invoice.findMany({
        where,
        include: {
          supplier: true,
          purchaseOrder: true,
          items: true,
          extractions: true,
          reconciliations: { include: { discrepancies: true } },
          uploadedByUser: { select: { id: true, name: true, role: true } },
        },
        orderBy: { uploadedAt: 'desc' },
      });

      res.json({ success: true, data: invoices });
    } catch (err) {
      next(err);
    }
  }

  static async getInvoiceById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: {
          supplier: true,
          purchaseOrder: {
            include: { items: { include: { ingredient: true } } },
          },
          items: true,
          extractions: true,
          reconciliations: { include: { discrepancies: true } },
          uploadedByUser: { select: { id: true, name: true, role: true } },
        },
      });

      if (!invoice) {
        res.status(404).json({ success: false, error: 'Invoice not found' });
        return;
      }

      res.json({ success: true, data: invoice });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Upload Invoice Document & Run OCR Extraction Engine
   */
  static async uploadAndExtractInvoice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const file = req.file;
      const branchId = (req.body.branchId as string) || req.user?.branchId;
      const purchaseOrderId = req.body.purchaseOrderId as string;

      if (!file) {
        res.status(400).json({ success: false, error: 'No invoice document was uploaded' });
        return;
      }

      if (!branchId) {
        res.status(400).json({ success: false, error: 'Branch ID is required' });
        return;
      }

      // Execute OCR Extraction Service
      const ocrResult = await OCRExtractionService.extractInvoiceData(
        file.path,
        file.originalname,
        branchId
      );

      // Create Invoice record in database
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: ocrResult.invoiceNumber,
          purchaseOrderId: purchaseOrderId || null,
          supplierId: ocrResult.matchedSupplierId || (await prisma.supplier.findFirst())!.id,
          branchId,
          invoiceDate: new Date(ocrResult.invoiceDate),
          subtotal: ocrResult.subtotal,
          taxAmount: ocrResult.taxAmount,
          totalAmount: ocrResult.totalAmount,
          documentUrl: `/uploads/invoices/${file.filename}`,
          fileName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          processingStatus: 'PROCESSED',
          uploadedByUserId: req.user?.id,
          items: {
            create: ocrResult.lineItems.map((li) => ({
              itemName: li.itemName,
              ingredientId: li.matchedIngredientId || null,
              quantity: li.quantity,
              unit: li.unit,
              unitPrice: li.unitPrice,
              taxAmount: li.taxAmount,
              totalPrice: li.totalPrice,
            })),
          },
          extractions: {
            create: {
              extractedJson: JSON.stringify(ocrResult),
              confidenceScore: ocrResult.confidenceScore,
              rawText: ocrResult.rawText,
            },
          },
        },
        include: {
          supplier: true,
          items: true,
          extractions: true,
        },
      });

      await AuditService.log({
        branchId,
        userId: req.user?.id,
        action: 'INVOICE_UPLOADED_OCR',
        entity: 'Invoice',
        entityId: invoice.id,
        newValue: `Invoice #${invoice.invoiceNumber} uploaded & parsed via OCR (Total: ₹${invoice.totalAmount})`,
        ipAddress: req.ip,
      });

      res.status(201).json({
        success: true,
        data: invoice,
        ocrResult,
      });
    } catch (err) {
      next(err);
    }
  }
}
