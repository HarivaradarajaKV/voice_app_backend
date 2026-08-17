import { prisma } from '../utils/prisma';

export interface WhatsAppPOMessageResult {
  poNumber: string;
  supplierName: string;
  phone: string;
  formattedMessage: string;
  directWhatsAppUrl: string;
}

export class WhatsAppProcurementService {
  /**
   * Generates professional, structured WhatsApp procurement text for a given PO
   */
  static async generatePOMessage(purchaseOrderId: string): Promise<WhatsAppPOMessageResult> {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        branch: {
          include: { restaurant: true },
        },
        supplier: true,
        items: {
          include: { ingredient: true },
        },
      },
    });

    if (!po) throw new Error('Purchase Order not found');

    const deliveryDateFormatted = new Date(po.expectedDeliveryDate).toLocaleDateString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    const itemsText = po.items
      .map(
        (item, idx) =>
          `${idx + 1}. *${item.ingredient.name}* — ${item.quantity} ${item.unit} (@ ₹${item.unitPrice}/${item.unit})`
      )
      .join('\n');

    const message = [
      `*PURCHASE ORDER: ${po.poNumber}*`,
      `🏢 *${po.branch.restaurant.name}* (${po.branch.name})`,
      `📍 Delivery Address: ${po.branch.address}`,
      `📅 *Required Delivery:* ${deliveryDateFormatted} (${po.supplier.deliverySchedule || 'Morning'})`,
      ``,
      `Hello ${po.supplier.contactPerson || po.supplier.name},`,
      `Please supply the following ingredients as per our agreement:`,
      ``,
      itemsText,
      ``,
      `💰 *Estimated Total:* ₹${po.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      po.notes ? `📝 *Notes/Instructions:* ${po.notes}` : '',
      ``,
      `Please reply with confirmation and expected dispatch time.`,
      `Thank you!`,
    ]
      .filter((line) => line !== '')
      .join('\n');

    const cleanPhone = (po.supplier.whatsappNumber || po.supplier.phone).replace(/[^0-9]/g, '');
    const encodedMessage = encodeURIComponent(message);
    const directWhatsAppUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

    // Update PO with generated message
    await prisma.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        whatsappMessage: message,
        whatsappStatus: 'READY_TO_SEND',
      },
    });

    return {
      poNumber: po.poNumber,
      supplierName: po.supplier.name,
      phone: cleanPhone,
      formattedMessage: message,
      directWhatsAppUrl,
    };
  }
}
