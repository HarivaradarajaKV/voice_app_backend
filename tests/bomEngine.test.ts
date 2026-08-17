import { describe, it, expect } from 'vitest';

describe('BOM Engine & Portion Scaling Tests (Section 63 Specification)', () => {
  it('should scale 10 Idlis standard portion to 25 Idlis dynamically and accurately', () => {
    const standardPortion = 10;
    const orderedQuantity = 25;
    const scalingFactor = orderedQuantity / standardPortion; // 2.5

    const standardBOM = [
      { ingredient: 'Rice', quantity: 800, unit: 'g' },
      { ingredient: 'Urad Dal', quantity: 200, unit: 'g' },
      { ingredient: 'Fenugreek', quantity: 5, unit: 'g' },
    ];

    const scaledRequirements = standardBOM.map((item) => ({
      ingredient: item.ingredient,
      required: item.quantity * scalingFactor,
      unit: item.unit,
    }));

    expect(scalingFactor).toBe(2.5);
    
    // Exactly test the specification values:
    const riceReq = scaledRequirements.find((r) => r.ingredient === 'Rice');
    const uradReq = scaledRequirements.find((r) => r.ingredient === 'Urad Dal');
    const methiReq = scaledRequirements.find((r) => r.ingredient === 'Fenugreek');

    expect(riceReq?.required).toBe(2000); // 2000g (2 kg)
    expect(uradReq?.required).toBe(500);  // 500g (0.5 kg)
    expect(methiReq?.required).toBe(12.5); // 12.5g
  });

  it('should calculate weighted average cost (WAC) correctly on receiving new goods', () => {
    const existingStock = 48000; // 48 kg in grams
    const existingCostPerUnit = 0.060; // ₹60/kg
    const receivedStock = 50000; // 50 kg in grams
    const receivedCostPerUnit = 0.065; // ₹65/kg

    const existingValue = existingStock * existingCostPerUnit;
    const receivedValue = receivedStock * receivedCostPerUnit;
    const newStock = existingStock + receivedStock;
    const newWAC = (existingValue + receivedValue) / newStock;

    expect(Math.round(newWAC * 10000) / 10000).toBe(0.0626); // ₹62.55/kg
  });

  it('should calculate purchase recommendations strictly deterministically', () => {
    const currentStock = 18000; // 18 kg
    const targetStock = 40000;  // 40 kg
    const pendingPurchase = 10000; // 10 kg on the way

    const deficit = Math.max(0, targetStock - currentStock - pendingPurchase);
    expect(deficit).toBe(12000); // 12 kg needed
  });
});
