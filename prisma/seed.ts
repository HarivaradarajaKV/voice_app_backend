import { RoleType, StockStatus, TransactionType, OrderType, OrderStatus, PaymentStatus, KitchenItemStatus, POStatus, DeliveryStatus, ReconciliationStatus, DiscrepancyType, WasteReason } from '@prisma/client';
import { prisma } from '../src/utils/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Seeding Data Udipi platform database...');

  // 1. Clear existing data in reverse order of dependencies
  await prisma.reconciliationDiscrepancy.deleteMany();
  await prisma.reconciliationRecord.deleteMany();
  await prisma.invoiceExtraction.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.receivingItem.deleteMany();
  await prisma.receivingRecord.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.supplierConfirmation.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.purchaseRecommendationItem.deleteMany();
  await prisma.purchaseRecommendation.deleteMany();
  await prisma.supplierIngredient.deleteMany();
  await prisma.kitchenOrderItem.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.recipeVersion.deleteMany();
  await prisma.recipeBOMItem.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.menuCategory.deleteMany();
  await prisma.wasteRecord.deleteMany();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.inventoryBatch.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.ingredientCategory.deleteMany();
  await prisma.unitConversion.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.kitchenStation.deleteMany();
  await prisma.dailyReport.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.restaurant.deleteMany();

  // 2. Units & Conversions
  console.log('Adding Units & Conversions...');
  await prisma.unit.createMany({
    data: [
      { name: 'Kilogram', symbol: 'kg', unitType: 'WEIGHT', baseUnit: 'kg', factorToBase: 1.0 },
      { name: 'Gram', symbol: 'g', unitType: 'WEIGHT', baseUnit: 'kg', factorToBase: 0.001 },
      { name: 'Litre', symbol: 'L', unitType: 'VOLUME', baseUnit: 'L', factorToBase: 1.0 },
      { name: 'Millilitre', symbol: 'ml', unitType: 'VOLUME', baseUnit: 'L', factorToBase: 0.001 },
      { name: 'Piece', symbol: 'pc', unitType: 'COUNT', baseUnit: 'pc', factorToBase: 1.0 },
      { name: 'Packet', symbol: 'pkt', unitType: 'COUNT', baseUnit: 'pkt', factorToBase: 1.0 },
      { name: 'Box', symbol: 'box', unitType: 'COUNT', baseUnit: 'box', factorToBase: 1.0 },
      { name: 'Dozen', symbol: 'doz', unitType: 'COUNT', baseUnit: 'doz', factorToBase: 12.0 },
    ],
  });

  await prisma.unitConversion.createMany({
    data: [
      { fromUnit: 'kg', toUnit: 'g', factor: 1000.0 },
      { fromUnit: 'g', toUnit: 'kg', factor: 0.001 },
      { fromUnit: 'L', toUnit: 'ml', factor: 1000.0 },
      { fromUnit: 'ml', toUnit: 'L', factor: 0.001 },
      { fromUnit: 'doz', toUnit: 'pc', factor: 12.0 },
      { fromUnit: 'box', toUnit: 'pkt', factor: 10.0 },
    ],
  });

  // 3. Restaurant
  console.log('Creating Restaurant...');
  const restaurant = await prisma.restaurant.create({
    data: {
      name: 'Data Udipi Restaurant',
      legalName: 'Data Udipi Hospitality Private Limited',
      address: '100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560038',
      phone: '+91 80 4123 4567',
      email: 'contact@dataudipi.com',
      gstNumber: '29AABCD1234E1Z5',
      taxInfo: 'GST 5% Composition Scheme for Dining & Takeaway',
      defaultCurrency: 'INR',
      defaultTimezone: 'Asia/Kolkata',
      businessHours: '06:30 AM - 11:00 PM (Daily)',
    },
  });

  // 4. Branches
  console.log('Creating Branches...');
  const branchIndiranagar = await prisma.branch.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Indiranagar Flagship',
      code: 'UDIPI-BLR-01',
      address: '100 Feet Road, Indiranagar, Bengaluru',
      contact: '+91 80 4123 4567',
      managerName: 'Kishore Hegde',
      openingTime: '06:30',
      closingTime: '23:00',
    },
  });

  const branchWhitefield = await prisma.branch.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Whitefield Tech Park',
      code: 'UDIPI-BLR-02',
      address: 'ITPL Main Road, Whitefield, Bengaluru',
      contact: '+91 80 4987 6543',
      managerName: 'Ramesh Rao',
      openingTime: '07:00',
      closingTime: '22:30',
    },
  });

  const branchKoramangala = await prisma.branch.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Koramangala 4th Block',
      code: 'UDIPI-BLR-03',
      address: '80 Feet Road, Koramangala 4th Block, Bengaluru',
      contact: '+91 80 4321 8765',
      managerName: 'Anand Upadhyaya',
      openingTime: '06:30',
      closingTime: '23:00',
    },
  });

  // 5. Kitchen Stations
  console.log('Creating Kitchen Stations...');
  const stationBreakfast = await prisma.kitchenStation.create({
    data: { branchId: branchIndiranagar.id, name: 'Breakfast & Tiffin Station', code: 'STN-BFAST', description: 'Idli, Vada, Upma, Pongal steamers & fryers' },
  });
  const stationDosa = await prisma.kitchenStation.create({
    data: { branchId: branchIndiranagar.id, name: 'Dosa Griddle Station', code: 'STN-DOSA', description: 'Flat top hot plates for Masala Dosa, Plain Dosa, Uttapam' },
  });
  const stationCurry = await prisma.kitchenStation.create({
    data: { branchId: branchIndiranagar.id, name: 'Sambar & Curry Station', code: 'STN-CURRY', description: 'Large boiling kettles for Sambar, Chutney, Kurma' },
  });
  const stationBeverage = await prisma.kitchenStation.create({
    data: { branchId: branchIndiranagar.id, name: 'Filter Coffee & Beverage', code: 'STN-BEV', description: 'South Indian Filter Coffee, Tea, Badam Milk' },
  });
  const stationPacking = await prisma.kitchenStation.create({
    data: { branchId: branchIndiranagar.id, name: 'Packing & Dispatch Station', code: 'STN-PACK', description: 'Takeaway and delivery packing unit' },
  });

  // 6. Suppliers
  console.log('Creating Suppliers...');
  const supplierGrains = await prisma.supplier.create({
    data: {
      name: 'Udipi Organic Agro & Grains',
      contactPerson: 'Suresh Bhat',
      phone: '+91 98450 11223',
      whatsappNumber: '919845011223',
      email: 'orders@udipiorganicfarms.com',
      address: 'APMC Yard, Yeshwanthpur, Bengaluru - 560022',
      gstNumber: '29AAAPL1234D1Z2',
      paymentTerms: 'Net 15',
      deliverySchedule: 'Daily Morning 06:00 AM',
      leadTimeDays: 1,
      rating: 4.9,
      reliabilityScore: 98.0,
    },
  });

  const supplierVeggies = await prisma.supplier.create({
    data: {
      name: 'Karnataka Fresh Vegetable Farms',
      contactPerson: 'Manjunath Gowda',
      phone: '+91 98801 44556',
      whatsappNumber: '919880144556',
      email: 'sales@karnatakafresh.in',
      address: 'Binny Mill Market, Cottonpet, Bengaluru - 560053',
      gstNumber: '29BBBPG5678F1Z8',
      paymentTerms: 'Net 7',
      deliverySchedule: 'Daily Morning 05:30 AM',
      leadTimeDays: 1,
      rating: 4.7,
      reliabilityScore: 94.0,
    },
  });

  const supplierSpices = await prisma.supplier.create({
    data: {
      name: 'Coastal Spices & Oil Mill',
      contactPerson: 'Prabhakar Shenoy',
      phone: '+91 99002 77889',
      whatsappNumber: '919900277889',
      email: 'orders@coastalspices.com',
      address: 'Industrial Area, Rajajinagar, Bengaluru - 560010',
      gstNumber: '29CCCCS9012G1Z4',
      paymentTerms: 'Net 30',
      deliverySchedule: 'Tuesdays & Fridays',
      leadTimeDays: 2,
      rating: 4.8,
      reliabilityScore: 96.0,
    },
  });

  const supplierDairy = await prisma.supplier.create({
    data: {
      name: 'Sri Krishna Dairy & Coconuts',
      contactPerson: 'Narayana Murthy',
      phone: '+91 97413 33221',
      whatsappNumber: '919741333221',
      email: 'supply@srikrishnadairy.com',
      address: 'K.R. Market, Bengaluru - 560002',
      gstNumber: '29DDDDM3456H1Z1',
      paymentTerms: 'Daily Cash / UPI',
      deliverySchedule: 'Daily 05:00 AM',
      leadTimeDays: 1,
      rating: 4.9,
      reliabilityScore: 99.0,
    },
  });

  // 7. Users
  console.log('Creating Users with roles...');
  const passwordHash = await bcrypt.hash('password123', 10);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@dataudipi.com',
      passwordHash,
      name: 'Raghavendra Rao (Super Admin)',
      phone: '+91 98450 00001',
      role: RoleType.SUPER_ADMIN,
      branchId: branchIndiranagar.id,
    },
  });

  const ownerUser = await prisma.user.create({
    data: {
      email: 'owner@dataudipi.com',
      passwordHash,
      name: 'Venkatesh Prasad (Owner)',
      phone: '+91 98450 00002',
      role: RoleType.RESTAURANT_OWNER,
      branchId: branchIndiranagar.id,
    },
  });

  const managerUser = await prisma.user.create({
    data: {
      email: 'manager@dataudipi.com',
      passwordHash,
      name: 'Kishore Hegde (Manager)',
      phone: '+91 98450 00003',
      role: RoleType.MANAGER,
      branchId: branchIndiranagar.id,
    },
  });

  const inventoryUser = await prisma.user.create({
    data: {
      email: 'inventory@dataudipi.com',
      passwordHash,
      name: 'Srinivas Acharya (Inventory Manager)',
      phone: '+91 98450 00004',
      role: RoleType.INVENTORY_MANAGER,
      branchId: branchIndiranagar.id,
    },
  });

  const chefUser = await prisma.user.create({
    data: {
      email: 'chef@dataudipi.com',
      passwordHash,
      name: 'Master Chef Shivaram',
      phone: '+91 98450 00005',
      role: RoleType.CHEF,
      branchId: branchIndiranagar.id,
    },
  });

  const procurementUser = await prisma.user.create({
    data: {
      email: 'procurement@dataudipi.com',
      passwordHash,
      name: 'Ganesh Shastry (Procurement)',
      phone: '+91 98450 00006',
      role: RoleType.PROCUREMENT_STAFF,
      branchId: branchIndiranagar.id,
    },
  });

  const staffUser = await prisma.user.create({
    data: {
      email: 'staff@dataudipi.com',
      passwordHash,
      name: 'Kumar Swamy (Floor Staff)',
      phone: '+91 98450 00007',
      role: RoleType.STAFF,
      branchId: branchIndiranagar.id,
    },
  });

  const supplierUser = await prisma.user.create({
    data: {
      email: 'supplier@udipifarms.com',
      passwordHash,
      name: 'Suresh Bhat (Supplier Portal)',
      phone: '+91 98450 11223',
      role: RoleType.SUPPLIER,
      supplierId: supplierGrains.id,
      branchId: branchIndiranagar.id,
    },
  });

  // 8. Ingredient Categories
  console.log('Creating Ingredient Categories...');
  const catGrains = await prisma.ingredientCategory.create({ data: { name: 'Grains & Pulses', description: 'Rice, Dal, Lentils, Flours' } });
  const catVeggies = await prisma.ingredientCategory.create({ data: { name: 'Fresh Vegetables & Herbs', description: 'Onions, Tomatoes, Potatoes, Chillies, Coriander' } });
  const catSpices = await prisma.ingredientCategory.create({ data: { name: 'Spices & Seasonings', description: 'Turmeric, Mustard, Fenugreek, Sambar Powder, Salt' } });
  const catOils = await prisma.ingredientCategory.create({ data: { name: 'Oils, Dairy & Coconuts', description: 'Sunflower Oil, Ghee, Fresh Coconuts, Milk' } });

  // 9. Ingredients for Indiranagar Branch
  console.log('Creating Ingredients for Indiranagar...');
  // All stock is stored internally in stockUnit (g or ml)
  const ingRice = await prisma.ingredient.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Raw Idli Rice (Ponni / Sona Masoori)',
      sku: 'ING-RICE-01',
      categoryId: catGrains.id,
      baseUnit: 'kg',
      purchaseUnit: 'kg',
      stockUnit: 'g',
      conversionFactor: 1000.0,
      currentStock: 48000.0, // 48 kg in grams
      minStock: 15000.0,     // 15 kg
      reorderLevel: 25000.0, // 25 kg
      targetStock: 60000.0,  // 60 kg
      maxStock: 100000.0,    // 100 kg
      unitCost: 0.060,       // ₹60 per kg -> ₹0.060 per g
      weightedAverageCost: 0.060,
      storageLocation: 'Dry Storage Rack A-1',
      status: StockStatus.HEALTHY,
      preferredSupplierId: supplierGrains.id,
    },
  });

  const ingUradDal = await prisma.ingredient.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Urad Dal (Gota / Whole)',
      sku: 'ING-URAD-01',
      categoryId: catGrains.id,
      baseUnit: 'kg',
      purchaseUnit: 'kg',
      stockUnit: 'g',
      conversionFactor: 1000.0,
      currentStock: 22000.0, // 22 kg
      minStock: 8000.0,      // 8 kg
      reorderLevel: 15000.0, // 15 kg
      targetStock: 30000.0,  // 30 kg
      maxStock: 50000.0,
      unitCost: 0.140,       // ₹140 per kg -> ₹0.140 per g
      weightedAverageCost: 0.140,
      storageLocation: 'Dry Storage Rack A-2',
      status: StockStatus.HEALTHY,
      preferredSupplierId: supplierGrains.id,
    },
  });

  const ingFenugreek = await prisma.ingredient.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Fenugreek Seeds (Methi)',
      sku: 'ING-METHI-01',
      categoryId: catSpices.id,
      baseUnit: 'kg',
      purchaseUnit: 'kg',
      stockUnit: 'g',
      conversionFactor: 1000.0,
      currentStock: 1800.0, // 1.8 kg
      minStock: 500.0,
      reorderLevel: 1000.0,
      targetStock: 3000.0,
      maxStock: 5000.0,
      unitCost: 0.110,      // ₹110 per kg -> ₹0.110 per g
      weightedAverageCost: 0.110,
      storageLocation: 'Spice Cabinet S-1',
      status: StockStatus.HEALTHY,
      preferredSupplierId: supplierSpices.id,
    },
  });

  const ingOnion = await prisma.ingredient.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Red Onion (Bellary)',
      sku: 'ING-ONION-01',
      categoryId: catVeggies.id,
      baseUnit: 'kg',
      purchaseUnit: 'kg',
      stockUnit: 'g',
      conversionFactor: 1000.0,
      currentStock: 18000.0, // 18 kg (Low Stock! Below reorder 20 kg)
      minStock: 10000.0,
      reorderLevel: 20000.0,
      targetStock: 40000.0,
      maxStock: 60000.0,
      unitCost: 0.035,       // ₹35 per kg -> ₹0.035 per g
      weightedAverageCost: 0.035,
      storageLocation: 'Vegetable Crate V-1',
      status: StockStatus.LOW_STOCK,
      preferredSupplierId: supplierVeggies.id,
    },
  });

  const ingTomato = await prisma.ingredient.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Hybrid Tomato',
      sku: 'ING-TOMATO-01',
      categoryId: catVeggies.id,
      baseUnit: 'kg',
      purchaseUnit: 'kg',
      stockUnit: 'g',
      conversionFactor: 1000.0,
      currentStock: 12000.0, // 12 kg
      minStock: 6000.0,
      reorderLevel: 12000.0,
      targetStock: 25000.0,
      maxStock: 40000.0,
      unitCost: 0.040,       // ₹40 per kg -> ₹0.040 per g
      weightedAverageCost: 0.040,
      storageLocation: 'Vegetable Crate V-2',
      status: StockStatus.HEALTHY,
      preferredSupplierId: supplierVeggies.id,
    },
  });

  const ingPotato = await prisma.ingredient.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Hassan Potato',
      sku: 'ING-POTATO-01',
      categoryId: catVeggies.id,
      baseUnit: 'kg',
      purchaseUnit: 'kg',
      stockUnit: 'g',
      conversionFactor: 1000.0,
      currentStock: 35000.0, // 35 kg
      minStock: 15000.0,
      reorderLevel: 25000.0,
      targetStock: 50000.0,
      maxStock: 80000.0,
      unitCost: 0.030,       // ₹30 per kg -> ₹0.030 per g
      weightedAverageCost: 0.030,
      storageLocation: 'Vegetable Crate V-3',
      status: StockStatus.HEALTHY,
      preferredSupplierId: supplierVeggies.id,
    },
  });

  const ingOil = await prisma.ingredient.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Refined Sunflower Cooking Oil',
      sku: 'ING-OIL-01',
      categoryId: catOils.id,
      baseUnit: 'L',
      purchaseUnit: 'L',
      stockUnit: 'ml',
      conversionFactor: 1000.0,
      currentStock: 28000.0, // 28 Litres in ml
      minStock: 15000.0,
      reorderLevel: 25000.0,
      targetStock: 50000.0,
      maxStock: 80000.0,
      unitCost: 0.125,       // ₹125 per L -> ₹0.125 per ml
      weightedAverageCost: 0.125,
      storageLocation: 'Oil Barrel Storage O-1',
      status: StockStatus.HEALTHY,
      preferredSupplierId: supplierSpices.id,
    },
  });

  const ingCoconut = await prisma.ingredient.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Fresh Grated Coconut',
      sku: 'ING-COCO-01',
      categoryId: catOils.id,
      baseUnit: 'kg',
      purchaseUnit: 'kg',
      stockUnit: 'g',
      conversionFactor: 1000.0,
      currentStock: 8000.0, // 8 kg
      minStock: 5000.0,
      reorderLevel: 10000.0,
      targetStock: 20000.0,
      maxStock: 30000.0,
      unitCost: 0.080,      // ₹80 per kg -> ₹0.080 per g
      weightedAverageCost: 0.080,
      storageLocation: 'Walk-in Chiller C-1',
      status: StockStatus.LOW_STOCK,
      preferredSupplierId: supplierDairy.id,
    },
  });

  const ingCoriander = await prisma.ingredient.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Fresh Green Coriander Leaves',
      sku: 'ING-CORI-01',
      categoryId: catVeggies.id,
      baseUnit: 'kg',
      purchaseUnit: 'kg',
      stockUnit: 'g',
      conversionFactor: 1000.0,
      currentStock: 2500.0,
      minStock: 1000.0,
      reorderLevel: 2000.0,
      targetStock: 5000.0,
      maxStock: 8000.0,
      unitCost: 0.070,
      weightedAverageCost: 0.070,
      storageLocation: 'Walk-in Chiller C-2',
      status: StockStatus.HEALTHY,
      preferredSupplierId: supplierVeggies.id,
    },
  });

  const ingGreenChilli = await prisma.ingredient.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Spicy Green Chilli',
      sku: 'ING-CHILLI-01',
      categoryId: catVeggies.id,
      baseUnit: 'kg',
      purchaseUnit: 'kg',
      stockUnit: 'g',
      conversionFactor: 1000.0,
      currentStock: 3500.0,
      minStock: 1500.0,
      reorderLevel: 3000.0,
      targetStock: 6000.0,
      maxStock: 10000.0,
      unitCost: 0.060,
      weightedAverageCost: 0.060,
      storageLocation: 'Walk-in Chiller C-2',
      status: StockStatus.HEALTHY,
      preferredSupplierId: supplierVeggies.id,
    },
  });

  const ingSalt = await prisma.ingredient.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Iodized Crystal Cooking Salt',
      sku: 'ING-SALT-01',
      categoryId: catSpices.id,
      baseUnit: 'kg',
      purchaseUnit: 'kg',
      stockUnit: 'g',
      conversionFactor: 1000.0,
      currentStock: 25000.0,
      minStock: 10000.0,
      reorderLevel: 15000.0,
      targetStock: 40000.0,
      maxStock: 60000.0,
      unitCost: 0.020,
      weightedAverageCost: 0.020,
      storageLocation: 'Dry Storage Rack A-3',
      status: StockStatus.HEALTHY,
      preferredSupplierId: supplierSpices.id,
    },
  });

  const ingTurmeric = await prisma.ingredient.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Pure Turmeric Powder',
      sku: 'ING-TURM-01',
      categoryId: catSpices.id,
      baseUnit: 'kg',
      purchaseUnit: 'kg',
      stockUnit: 'g',
      conversionFactor: 1000.0,
      currentStock: 3000.0,
      minStock: 1000.0,
      reorderLevel: 2000.0,
      targetStock: 5000.0,
      maxStock: 8000.0,
      unitCost: 0.220,
      weightedAverageCost: 0.220,
      storageLocation: 'Spice Cabinet S-2',
      status: StockStatus.HEALTHY,
      preferredSupplierId: supplierSpices.id,
    },
  });

  const ingChilliPowder = await prisma.ingredient.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Kashmiri & Byadgi Red Chilli Powder',
      sku: 'ING-RCHILLI-01',
      categoryId: catSpices.id,
      baseUnit: 'kg',
      purchaseUnit: 'kg',
      stockUnit: 'g',
      conversionFactor: 1000.0,
      currentStock: 4500.0,
      minStock: 2000.0,
      reorderLevel: 3000.0,
      targetStock: 8000.0,
      maxStock: 12000.0,
      unitCost: 0.320,
      weightedAverageCost: 0.320,
      storageLocation: 'Spice Cabinet S-3',
      status: StockStatus.HEALTHY,
      preferredSupplierId: supplierSpices.id,
    },
  });

  const ingSambarPowder = await prisma.ingredient.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Udipi Special Authentic Sambar Powder',
      sku: 'ING-SAMBAR-01',
      categoryId: catSpices.id,
      baseUnit: 'kg',
      purchaseUnit: 'kg',
      stockUnit: 'g',
      conversionFactor: 1000.0,
      currentStock: 6500.0,
      minStock: 3000.0,
      reorderLevel: 5000.0,
      targetStock: 12000.0,
      maxStock: 20000.0,
      unitCost: 0.380,
      weightedAverageCost: 0.380,
      storageLocation: 'Spice Cabinet S-4',
      status: StockStatus.HEALTHY,
      preferredSupplierId: supplierSpices.id,
    },
  });

  const ingToorDal = await prisma.ingredient.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Premium Toor Dal (Pigeon Pea)',
      sku: 'ING-TOOR-01',
      categoryId: catGrains.id,
      baseUnit: 'kg',
      purchaseUnit: 'kg',
      stockUnit: 'g',
      conversionFactor: 1000.0,
      currentStock: 18000.0,
      minStock: 8000.0,
      reorderLevel: 14000.0,
      targetStock: 30000.0,
      maxStock: 50000.0,
      unitCost: 0.160,
      weightedAverageCost: 0.160,
      storageLocation: 'Dry Storage Rack A-4',
      status: StockStatus.HEALTHY,
      preferredSupplierId: supplierGrains.id,
    },
  });

  const ingMustard = await prisma.ingredient.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Mustard Seeds (Rai / Sasive)',
      sku: 'ING-MUST-01',
      categoryId: catSpices.id,
      baseUnit: 'kg',
      purchaseUnit: 'kg',
      stockUnit: 'g',
      conversionFactor: 1000.0,
      currentStock: 2200.0,
      minStock: 800.0,
      reorderLevel: 1500.0,
      targetStock: 4000.0,
      maxStock: 6000.0,
      unitCost: 0.130,
      weightedAverageCost: 0.130,
      storageLocation: 'Spice Cabinet S-5',
      status: StockStatus.HEALTHY,
      preferredSupplierId: supplierSpices.id,
    },
  });

  const ingCurryLeaves = await prisma.ingredient.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Fresh Curry Leaves (Karibevu)',
      sku: 'ING-CURRY-01',
      categoryId: catVeggies.id,
      baseUnit: 'kg',
      purchaseUnit: 'kg',
      stockUnit: 'g',
      conversionFactor: 1000.0,
      currentStock: 1200.0,
      minStock: 500.0,
      reorderLevel: 1000.0,
      targetStock: 2500.0,
      maxStock: 4000.0,
      unitCost: 0.090,
      weightedAverageCost: 0.090,
      storageLocation: 'Walk-in Chiller C-3',
      status: StockStatus.HEALTHY,
      preferredSupplierId: supplierVeggies.id,
    },
  });

  const ingGhee = await prisma.ingredient.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Pure Desi Cow Ghee (Nandini)',
      sku: 'ING-GHEE-01',
      categoryId: catOils.id,
      baseUnit: 'kg',
      purchaseUnit: 'kg',
      stockUnit: 'g',
      conversionFactor: 1000.0,
      currentStock: 9000.0,
      minStock: 4000.0,
      reorderLevel: 8000.0,
      targetStock: 15000.0,
      maxStock: 25000.0,
      unitCost: 0.650,
      weightedAverageCost: 0.650,
      storageLocation: 'Walk-in Chiller C-4',
      status: StockStatus.HEALTHY,
      preferredSupplierId: supplierDairy.id,
    },
  });

  const ingRava = await prisma.ingredient.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Roasted Upma Rava (Semolina)',
      sku: 'ING-RAVA-01',
      categoryId: catGrains.id,
      baseUnit: 'kg',
      purchaseUnit: 'kg',
      stockUnit: 'g',
      conversionFactor: 1000.0,
      currentStock: 16000.0,
      minStock: 6000.0,
      reorderLevel: 12000.0,
      targetStock: 25000.0,
      maxStock: 40000.0,
      unitCost: 0.055,
      weightedAverageCost: 0.055,
      storageLocation: 'Dry Storage Rack A-5',
      status: StockStatus.HEALTHY,
      preferredSupplierId: supplierGrains.id,
    },
  });

  const ingTamarind = await prisma.ingredient.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Seedless Pressed Tamarind (Hunase Hannu)',
      sku: 'ING-TAMARIND-01',
      categoryId: catSpices.id,
      baseUnit: 'kg',
      purchaseUnit: 'kg',
      stockUnit: 'g',
      conversionFactor: 1000.0,
      currentStock: 4200.0,
      minStock: 2000.0,
      reorderLevel: 3500.0,
      targetStock: 8000.0,
      maxStock: 12000.0,
      unitCost: 0.180,
      weightedAverageCost: 0.180,
      storageLocation: 'Dry Storage Rack A-6',
      status: StockStatus.HEALTHY,
      preferredSupplierId: supplierSpices.id,
    },
  });

  // 10. Supplier-Ingredient Pricing Map
  console.log('Mapping Supplier Ingredients...');
  await prisma.supplierIngredient.createMany({
    data: [
      { supplierId: supplierGrains.id, ingredientId: ingRice.id, isPrimary: true, price: 60.0, minOrderQty: 25.0, leadTimeDays: 1, reliabilityScore: 99.0 },
      { supplierId: supplierGrains.id, ingredientId: ingUradDal.id, isPrimary: true, price: 140.0, minOrderQty: 10.0, leadTimeDays: 1, reliabilityScore: 98.0 },
      { supplierId: supplierGrains.id, ingredientId: ingToorDal.id, isPrimary: true, price: 160.0, minOrderQty: 10.0, leadTimeDays: 1, reliabilityScore: 97.0 },
      { supplierId: supplierGrains.id, ingredientId: ingRava.id, isPrimary: true, price: 55.0, minOrderQty: 10.0, leadTimeDays: 1, reliabilityScore: 98.0 },
      
      { supplierId: supplierVeggies.id, ingredientId: ingOnion.id, isPrimary: true, price: 35.0, minOrderQty: 20.0, leadTimeDays: 1, reliabilityScore: 95.0 },
      { supplierId: supplierVeggies.id, ingredientId: ingTomato.id, isPrimary: true, price: 40.0, minOrderQty: 10.0, leadTimeDays: 1, reliabilityScore: 94.0 },
      { supplierId: supplierVeggies.id, ingredientId: ingPotato.id, isPrimary: true, price: 30.0, minOrderQty: 20.0, leadTimeDays: 1, reliabilityScore: 96.0 },
      { supplierId: supplierVeggies.id, ingredientId: ingGreenChilli.id, isPrimary: true, price: 60.0, minOrderQty: 2.0, leadTimeDays: 1, reliabilityScore: 93.0 },
      { supplierId: supplierVeggies.id, ingredientId: ingCoriander.id, isPrimary: true, price: 70.0, minOrderQty: 2.0, leadTimeDays: 1, reliabilityScore: 94.0 },
      { supplierId: supplierVeggies.id, ingredientId: ingCurryLeaves.id, isPrimary: true, price: 90.0, minOrderQty: 1.0, leadTimeDays: 1, reliabilityScore: 95.0 },

      { supplierId: supplierSpices.id, ingredientId: ingOil.id, isPrimary: true, price: 125.0, minOrderQty: 15.0, leadTimeDays: 2, reliabilityScore: 97.0 },
      { supplierId: supplierSpices.id, ingredientId: ingFenugreek.id, isPrimary: true, price: 110.0, minOrderQty: 1.0, leadTimeDays: 2, reliabilityScore: 98.0 },
      { supplierId: supplierSpices.id, ingredientId: ingSalt.id, isPrimary: true, price: 20.0, minOrderQty: 25.0, leadTimeDays: 2, reliabilityScore: 99.0 },
      { supplierId: supplierSpices.id, ingredientId: ingTurmeric.id, isPrimary: true, price: 220.0, minOrderQty: 2.0, leadTimeDays: 2, reliabilityScore: 98.0 },
      { supplierId: supplierSpices.id, ingredientId: ingChilliPowder.id, isPrimary: true, price: 320.0, minOrderQty: 2.0, leadTimeDays: 2, reliabilityScore: 97.0 },
      { supplierId: supplierSpices.id, ingredientId: ingSambarPowder.id, isPrimary: true, price: 380.0, minOrderQty: 5.0, leadTimeDays: 2, reliabilityScore: 99.0 },
      { supplierId: supplierSpices.id, ingredientId: ingMustard.id, isPrimary: true, price: 130.0, minOrderQty: 2.0, leadTimeDays: 2, reliabilityScore: 98.0 },
      { supplierId: supplierSpices.id, ingredientId: ingTamarind.id, isPrimary: true, price: 180.0, minOrderQty: 5.0, leadTimeDays: 2, reliabilityScore: 96.0 },

      { supplierId: supplierDairy.id, ingredientId: ingCoconut.id, isPrimary: true, price: 80.0, minOrderQty: 10.0, leadTimeDays: 1, reliabilityScore: 99.0 },
      { supplierId: supplierDairy.id, ingredientId: ingGhee.id, isPrimary: true, price: 650.0, minOrderQty: 5.0, leadTimeDays: 1, reliabilityScore: 99.0 },
    ],
  });

  // 11. Menu Categories
  console.log('Creating Menu Categories...');
  const menuCatTiffin = await prisma.menuCategory.create({ data: { name: 'Traditional Tiffin & Breakfast', sortOrder: 1 } });
  const menuCatDosa = await prisma.menuCategory.create({ data: { name: 'Crispy Dosas & Uttapams', sortOrder: 2 } });
  const menuCatSides = await prisma.menuCategory.create({ data: { name: 'Accompaniments & Curries', sortOrder: 3 } });

  // 12. Menu Items & Recipes with BOMs
  console.log('Creating Menu Items & Deterministic BOMs...');

  // --- ITEM 1: IDLI (10 Pieces Standard Portion) ---
  const itemIdli = await prisma.menuItem.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Steamed Udipi Idli (Plate of 2 / 10 pcs batch standard)',
      code: 'MENU-IDLI',
      categoryId: menuCatTiffin.id,
      description: 'Ultra soft, naturally fermented steamed rice cakes served with Sambar and Chutney',
      sellingPrice: 40.0, // ₹40 per plate of 2 (Standard portion for BOM is 10 pcs = 5 plates = ₹200)
      taxRate: 5.0,
      stationId: stationBreakfast.id,
      standardPortion: 10.0, // 10 idlis
    },
  });
  // Recipe for 10 idlis: Rice 800g (₹48), Urad Dal 200g (₹28), Fenugreek 5g (₹0.55), Salt 10g (₹0.20) = Total Cost ~₹76.75
  const recipeIdli = await prisma.recipe.create({
    data: {
      menuItemId: itemIdli.id,
      name: 'Authentic 10-Piece Idli Batter Recipe',
      standardPortion: 10.0,
      version: 1,
      totalCost: 76.75,
      grossMargin: 61.6,
    },
  });
  await prisma.recipeBOMItem.createMany({
    data: [
      { recipeId: recipeIdli.id, ingredientId: ingRice.id, quantity: 800.0, unit: 'g', prepLossPercent: 2.0, yieldPercent: 100.0 },
      { recipeId: recipeIdli.id, ingredientId: ingUradDal.id, quantity: 200.0, unit: 'g', prepLossPercent: 1.0, yieldPercent: 100.0 },
      { recipeId: recipeIdli.id, ingredientId: ingFenugreek.id, quantity: 5.0, unit: 'g', prepLossPercent: 0.0, yieldPercent: 100.0 },
      { recipeId: recipeIdli.id, ingredientId: ingSalt.id, quantity: 10.0, unit: 'g', prepLossPercent: 0.0, yieldPercent: 100.0 },
    ],
  });

  // --- ITEM 2: MEDU VADA (4 Pieces Standard Portion) ---
  const itemVada = await prisma.menuItem.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Crispy Medu Vada (Plate of 2 / 4 pcs batch)',
      code: 'MENU-VADA',
      categoryId: menuCatTiffin.id,
      description: 'Golden crispy lentil fritters with crushed black pepper, green chillies and curry leaves',
      sellingPrice: 50.0,
      taxRate: 5.0,
      stationId: stationBreakfast.id,
      standardPortion: 4.0, // 4 vadas
    },
  });
  const recipeVada = await prisma.recipe.create({
    data: {
      menuItemId: itemVada.id,
      name: 'Crispy 4-Piece Medu Vada Recipe',
      standardPortion: 4.0,
      version: 1,
      totalCost: 70.80,
      grossMargin: 29.2,
    },
  });
  await prisma.recipeBOMItem.createMany({
    data: [
      { recipeId: recipeVada.id, ingredientId: ingUradDal.id, quantity: 400.0, unit: 'g', prepLossPercent: 2.0 },
      { recipeId: recipeVada.id, ingredientId: ingOnion.id, quantity: 50.0, unit: 'g', prepLossPercent: 5.0 },
      { recipeId: recipeVada.id, ingredientId: ingGreenChilli.id, quantity: 15.0, unit: 'g' },
      { recipeId: recipeVada.id, ingredientId: ingOil.id, quantity: 100.0, unit: 'ml', notes: 'Frying absorption' },
      { recipeId: recipeVada.id, ingredientId: ingSalt.id, quantity: 5.0, unit: 'g' },
      { recipeId: recipeVada.id, ingredientId: ingCurryLeaves.id, quantity: 5.0, unit: 'g' },
    ],
  });

  // --- ITEM 3: MASALA DOSA (1 Piece Standard Portion) ---
  const itemMasalaDosa = await prisma.menuItem.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Butter Masala Dosa',
      code: 'MENU-MDOSA',
      categoryId: menuCatDosa.id,
      description: 'Crispy golden crepe smeared with red chutney and stuffed with spiced potato mash',
      sellingPrice: 85.0,
      taxRate: 5.0,
      stationId: stationDosa.id,
      standardPortion: 1.0, // 1 dosa
    },
  });
  const recipeMDosa = await prisma.recipe.create({
    data: {
      menuItemId: itemMasalaDosa.id,
      name: 'Single Butter Masala Dosa Standard BOM',
      standardPortion: 1.0,
      version: 1,
      totalCost: 19.85,
      grossMargin: 76.6,
    },
  });
  await prisma.recipeBOMItem.createMany({
    data: [
      { recipeId: recipeMDosa.id, ingredientId: ingRice.id, quantity: 120.0, unit: 'g' },
      { recipeId: recipeMDosa.id, ingredientId: ingUradDal.id, quantity: 30.0, unit: 'g' },
      { recipeId: recipeMDosa.id, ingredientId: ingPotato.id, quantity: 150.0, unit: 'g' },
      { recipeId: recipeMDosa.id, ingredientId: ingOnion.id, quantity: 40.0, unit: 'g' },
      { recipeId: recipeMDosa.id, ingredientId: ingOil.id, quantity: 20.0, unit: 'ml' },
      { recipeId: recipeMDosa.id, ingredientId: ingMustard.id, quantity: 2.0, unit: 'g' },
      { recipeId: recipeMDosa.id, ingredientId: ingTurmeric.id, quantity: 2.0, unit: 'g' },
      { recipeId: recipeMDosa.id, ingredientId: ingGreenChilli.id, quantity: 5.0, unit: 'g' },
      { recipeId: recipeMDosa.id, ingredientId: ingSalt.id, quantity: 5.0, unit: 'g' },
    ],
  });

  // --- ITEM 4: PLAIN DOSA ---
  const itemPlainDosa = await prisma.menuItem.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Golden Plain Dosa',
      code: 'MENU-PDOSA',
      categoryId: menuCatDosa.id,
      description: 'Thin crispy golden crepe served hot with chutneys and sambar',
      sellingPrice: 65.0,
      taxRate: 5.0,
      stationId: stationDosa.id,
      standardPortion: 1.0,
    },
  });
  const recipePDosa = await prisma.recipe.create({
    data: {
      menuItemId: itemPlainDosa.id,
      name: 'Plain Dosa Standard BOM',
      standardPortion: 1.0,
      version: 1,
      totalCost: 13.35,
      grossMargin: 79.4,
    },
  });
  await prisma.recipeBOMItem.createMany({
    data: [
      { recipeId: recipePDosa.id, ingredientId: ingRice.id, quantity: 120.0, unit: 'g' },
      { recipeId: recipePDosa.id, ingredientId: ingUradDal.id, quantity: 30.0, unit: 'g' },
      { recipeId: recipePDosa.id, ingredientId: ingOil.id, quantity: 15.0, unit: 'ml' },
      { recipeId: recipePDosa.id, ingredientId: ingSalt.id, quantity: 3.0, unit: 'g' },
    ],
  });

  // --- ITEM 5: SAMBAR (1 Portion / 200ml) ---
  const itemSambar = await prisma.menuItem.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Udipi Signature Sambar (200ml portion)',
      code: 'MENU-SAMBAR',
      categoryId: menuCatSides.id,
      description: 'Slow-cooked lentil and vegetable stew with freshly ground aromatic spices',
      sellingPrice: 35.0,
      taxRate: 5.0,
      stationId: stationCurry.id,
      standardPortion: 1.0,
    },
  });
  const recipeSambar = await prisma.recipe.create({
    data: {
      menuItemId: itemSambar.id,
      name: 'Single Portion Sambar BOM',
      standardPortion: 1.0,
      version: 1,
      totalCost: 16.65,
      grossMargin: 52.4,
    },
  });
  await prisma.recipeBOMItem.createMany({
    data: [
      { recipeId: recipeSambar.id, ingredientId: ingToorDal.id, quantity: 40.0, unit: 'g' },
      { recipeId: recipeSambar.id, ingredientId: ingTomato.id, quantity: 30.0, unit: 'g' },
      { recipeId: recipeSambar.id, ingredientId: ingOnion.id, quantity: 30.0, unit: 'g' },
      { recipeId: recipeSambar.id, ingredientId: ingSambarPowder.id, quantity: 15.0, unit: 'g' },
      { recipeId: recipeSambar.id, ingredientId: ingTamarind.id, quantity: 10.0, unit: 'g' },
      { recipeId: recipeSambar.id, ingredientId: ingOil.id, quantity: 10.0, unit: 'ml' },
      { recipeId: recipeSambar.id, ingredientId: ingSalt.id, quantity: 5.0, unit: 'g' },
      { recipeId: recipeSambar.id, ingredientId: ingCurryLeaves.id, quantity: 2.0, unit: 'g' },
      { recipeId: recipeSambar.id, ingredientId: ingCoriander.id, quantity: 3.0, unit: 'g' },
    ],
  });

  // --- ITEM 6: COCONUT CHUTNEY ---
  const itemChutney = await prisma.menuItem.create({
    data: {
      branchId: branchIndiranagar.id,
      name: 'Fresh Coconut White Chutney (100g portion)',
      code: 'MENU-CHUTNEY',
      categoryId: menuCatSides.id,
      description: 'Ground fresh coconut with green chillies, tempered with mustard seeds and curry leaves',
      sellingPrice: 25.0,
      taxRate: 5.0,
      stationId: stationCurry.id,
      standardPortion: 1.0,
    },
  });
  const recipeChutney = await prisma.recipe.create({
    data: {
      menuItemId: itemChutney.id,
      name: 'Fresh Coconut Chutney 100g BOM',
      standardPortion: 1.0,
      version: 1,
      totalCost: 6.55,
      grossMargin: 73.8,
    },
  });
  await prisma.recipeBOMItem.createMany({
    data: [
      { recipeId: recipeChutney.id, ingredientId: ingCoconut.id, quantity: 60.0, unit: 'g' },
      { recipeId: recipeChutney.id, ingredientId: ingGreenChilli.id, quantity: 10.0, unit: 'g' },
      { recipeId: recipeChutney.id, ingredientId: ingOil.id, quantity: 5.0, unit: 'ml' },
      { recipeId: recipeChutney.id, ingredientId: ingMustard.id, quantity: 2.0, unit: 'g' },
      { recipeId: recipeChutney.id, ingredientId: ingSalt.id, quantity: 3.0, unit: 'g' },
      { recipeId: recipeChutney.id, ingredientId: ingCurryLeaves.id, quantity: 2.0, unit: 'g' },
    ],
  });

  // 13. Initial Inventory Transactions & Batches
  console.log('Creating Initial Batches & Transactions...');
  const batchRice = await prisma.inventoryBatch.create({
    data: {
      ingredientId: ingRice.id,
      branchId: branchIndiranagar.id,
      batchNumber: 'BATCH-RC-20260810',
      initialQuantity: 50000.0,
      remainingQuantity: 48000.0,
      unitCost: 0.060,
      purchaseDate: new Date('2026-08-10'),
      supplierId: supplierGrains.id,
    },
  });

  await prisma.inventoryTransaction.create({
    data: {
      branchId: branchIndiranagar.id,
      ingredientId: ingRice.id,
      batchId: batchRice.id,
      transactionType: TransactionType.PURCHASE_RECEIPT,
      quantity: 50000.0,
      unit: 'g',
      unitCost: 0.060,
      totalCost: 3000.0,
      previousStock: 0.0,
      newStock: 50000.0,
      reason: 'Initial Opening Stock Receipt from PO-1001',
      referenceType: 'PO',
      performedByUserId: inventoryUser.id,
    },
  });

  // 14. Initial Purchase Orders, Deliveries, Invoices & Reconciliations
  console.log('Creating Seed Purchase Orders & Procurement Flow...');
  const po1 = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-0801',
      branchId: branchIndiranagar.id,
      supplierId: supplierGrains.id,
      orderDate: new Date('2026-08-14'),
      expectedDeliveryDate: new Date('2026-08-15'),
      status: POStatus.RECEIVED,
      subtotal: 5800.0,
      taxAmount: 290.0,
      totalAmount: 6090.0,
      notes: 'Weekly staple grains procurement for Indiranagar kitchen',
      whatsappMessage: 'Hello Suresh Bhat,\nPurchase Order: PO-2026-0801\nPlease supply:\n- Raw Idli Rice: 50 kg\n- Urad Dal: 20 kg\nRequired Delivery: Tomorrow 06:00 AM.\nThank you, Data Udipi.',
      whatsappStatus: 'SENT',
      createdByUserId: procurementUser.id,
      approvedByUserId: managerUser.id,
    },
  });

  await prisma.purchaseOrderItem.createMany({
    data: [
      { purchaseOrderId: po1.id, ingredientId: ingRice.id, quantity: 50.0, unit: 'kg', unitPrice: 60.0, totalPrice: 3000.0, receivedQty: 50.0, acceptedQty: 50.0 },
      { purchaseOrderId: po1.id, ingredientId: ingUradDal.id, quantity: 20.0, unit: 'kg', unitPrice: 140.0, totalPrice: 2800.0, receivedQty: 20.0, acceptedQty: 20.0 },
    ],
  });

  const delivery1 = await prisma.delivery.create({
    data: {
      purchaseOrderId: po1.id,
      supplierId: supplierGrains.id,
      branchId: branchIndiranagar.id,
      dispatchDate: new Date('2026-08-15T05:00:00Z'),
      expectedArrival: new Date('2026-08-15T06:30:00Z'),
      actualArrival: new Date('2026-08-15T06:20:00Z'),
      status: DeliveryStatus.RECEIVED,
      driverName: 'Ramu (KA-04-E-4521)',
      driverContact: '+91 98451 99887',
      trackingNotes: 'Arrived on time in clean covered truck',
    },
  });

  const receiving1 = await prisma.receivingRecord.create({
    data: {
      purchaseOrderId: po1.id,
      deliveryId: delivery1.id,
      branchId: branchIndiranagar.id,
      receivingNumber: 'RCV-20260815-01',
      receivedByUserId: inventoryUser.id,
      receivedAt: new Date('2026-08-15T06:45:00Z'),
      status: 'COMPLETED',
      notes: 'All sacks intact, weighed accurately, verified against PO items.',
    },
  });

  await prisma.receivingItem.createMany({
    data: [
      { receivingRecordId: receiving1.id, ingredientId: ingRice.id, expectedQty: 50.0, receivedQty: 50.0, damagedQty: 0.0, rejectedQty: 0.0, acceptedQty: 50.0, unit: 'kg', unitCost: 60.0, batchNumber: 'BATCH-RC-20260810' },
      { receivingRecordId: receiving1.id, ingredientId: ingUradDal.id, expectedQty: 20.0, receivedQty: 20.0, damagedQty: 0.0, rejectedQty: 0.0, acceptedQty: 20.0, unit: 'kg', unitCost: 140.0, batchNumber: 'BATCH-UD-20260810' },
    ],
  });

  const invoice1 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-UAF-8841',
      purchaseOrderId: po1.id,
      supplierId: supplierGrains.id,
      branchId: branchIndiranagar.id,
      invoiceDate: new Date('2026-08-15'),
      subtotal: 5800.0,
      taxAmount: 290.0,
      totalAmount: 6090.0,
      documentUrl: '/uploads/invoices/inv_uaf_8841.pdf',
      fileName: 'inv_uaf_8841.pdf',
      mimeType: 'application/pdf',
      fileSize: 142850,
      processingStatus: 'PROCESSED',
      uploadedByUserId: inventoryUser.id,
    },
  });

  await prisma.invoiceItem.createMany({
    data: [
      { invoiceId: invoice1.id, itemName: 'Raw Idli Rice (50 kg bag)', ingredientId: ingRice.id, quantity: 50.0, unit: 'kg', unitPrice: 60.0, taxAmount: 150.0, totalPrice: 3150.0 },
      { invoiceId: invoice1.id, itemName: 'Urad Dal Gota (20 kg)', ingredientId: ingUradDal.id, quantity: 20.0, unit: 'kg', unitPrice: 140.0, taxAmount: 140.0, totalPrice: 2940.0 },
    ],
  });

  const recon1 = await prisma.reconciliationRecord.create({
    data: {
      purchaseOrderId: po1.id,
      invoiceId: invoice1.id,
      receivingRecordId: receiving1.id,
      branchId: branchIndiranagar.id,
      status: ReconciliationStatus.APPROVED,
      totalVariance: 0.0,
      approvedByUserId: managerUser.id,
      approvedAt: new Date('2026-08-15T08:00:00Z'),
      reviewNotes: 'Perfect match between PO, Receiving inspection, and Invoice line items.',
    },
  });

  // 15. Create Active PO for Veggies (Pending Confirmation/Delivery)
  const po2 = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-0802',
      branchId: branchIndiranagar.id,
      supplierId: supplierVeggies.id,
      orderDate: new Date('2026-08-16'),
      expectedDeliveryDate: new Date('2026-08-17'),
      status: POStatus.CONFIRMED,
      subtotal: 2150.0,
      taxAmount: 107.5,
      totalAmount: 2257.5,
      notes: 'Morning fresh vegetable replenishment (Onions, Potatoes, Chillies)',
      whatsappMessage: 'Hello Manjunath Gowda,\nPurchase Order: PO-2026-0802\nPlease supply:\n- Red Onion: 30 kg\n- Hassan Potato: 25 kg\n- Green Chilli: 5 kg\nRequired Delivery: Tomorrow 05:30 AM.\nThank you, Data Udipi.',
      whatsappStatus: 'SENT',
      createdByUserId: procurementUser.id,
      approvedByUserId: managerUser.id,
    },
  });

  await prisma.purchaseOrderItem.createMany({
    data: [
      { purchaseOrderId: po2.id, ingredientId: ingOnion.id, quantity: 30.0, unit: 'kg', unitPrice: 35.0, totalPrice: 1050.0 },
      { purchaseOrderId: po2.id, ingredientId: ingPotato.id, quantity: 25.0, unit: 'kg', unitPrice: 30.0, totalPrice: 750.0 },
      { purchaseOrderId: po2.id, ingredientId: ingGreenChilli.id, quantity: 5.0, unit: 'kg', unitPrice: 60.0, totalPrice: 300.0 },
    ],
  });

  await prisma.supplierConfirmation.create({
    data: {
      purchaseOrderId: po2.id,
      supplierId: supplierVeggies.id,
      status: 'CONFIRMED',
      confirmedDeliveryDate: new Date('2026-08-17T05:30:00Z'),
      supplierNotes: 'Order confirmed. Grade A onions packed from fresh morning harvest.',
    },
  });

  // 16. Sample Orders in Progress
  console.log('Creating Active Customer Orders & KDS queue...');
  const order1 = await prisma.order.create({
    data: {
      branchId: branchIndiranagar.id,
      orderNumber: 'ORD-101',
      orderType: OrderType.DINE_IN,
      tableNumber: 'T-04',
      customerName: 'Ananya Sharma',
      customerPhone: '+91 99112 33445',
      priority: false,
      paymentStatus: PaymentStatus.PAID,
      orderStatus: OrderStatus.PREPARING,
      subtotal: 215.0,
      taxAmount: 10.75,
      totalAmount: 225.75,
      notes: 'Extra crispy masala dosa, sambar piping hot',
      createdByUserId: staffUser.id,
      acceptedAt: new Date(),
    },
  });

  const oi1 = await prisma.orderItem.create({
    data: {
      orderId: order1.id,
      menuItemId: itemMasalaDosa.id,
      quantity: 2.0,
      unitPrice: 85.0,
      totalPrice: 170.0,
      stationId: stationDosa.id,
      itemStatus: KitchenItemStatus.PREPARING,
    },
  });

  const oi2 = await prisma.orderItem.create({
    data: {
      orderId: order1.id,
      menuItemId: itemIdli.id,
      quantity: 1.0, // 1 portion (2 idlis)
      unitPrice: 40.0,
      totalPrice: 40.0,
      stationId: stationBreakfast.id,
      itemStatus: KitchenItemStatus.READY,
    },
  });

  await prisma.kitchenOrderItem.createMany({
    data: [
      { orderId: order1.id, orderItemId: oi1.id, stationId: stationDosa.id, status: KitchenItemStatus.PREPARING, elapsedMinutes: 6, priority: false, startedAt: new Date() },
      { orderId: order1.id, orderItemId: oi2.id, stationId: stationBreakfast.id, status: KitchenItemStatus.READY, elapsedMinutes: 8, priority: false, startedAt: new Date(), readyAt: new Date() },
    ],
  });

  // 17. Waste Record Sample
  await prisma.wasteRecord.create({
    data: {
      branchId: branchIndiranagar.id,
      ingredientId: ingTomato.id,
      quantity: 1500.0, // 1.5 kg
      unit: 'g',
      unitCost: 0.040,
      totalLoss: 60.0,
      reason: WasteReason.SPOILAGE,
      notes: 'Overripe tomatoes rejected during morning sorting',
      recordedByUserId: chefUser.id,
    },
  });

  // 18. Audit Logs & Notifications
  await prisma.auditLog.createMany({
    data: [
      { branchId: branchIndiranagar.id, userId: managerUser.id, action: 'BOM_ACTIVATED', entity: 'Recipe', entityId: recipeIdli.id, newValue: 'Version 1 Activated (Idli 10-pc)', ipAddress: '192.168.1.101' },
      { branchId: branchIndiranagar.id, userId: procurementUser.id, action: 'PO_CREATED', entity: 'PurchaseOrder', entityId: po2.id, newValue: 'PO-2026-0802 created for Karnataka Fresh', ipAddress: '192.168.1.105' },
      { branchId: branchIndiranagar.id, userId: inventoryUser.id, action: 'RECONCILIATION_APPROVED', entity: 'ReconciliationRecord', entityId: recon1.id, newValue: 'PO-2026-0801 matched & approved', ipAddress: '192.168.1.104' },
    ],
  });

  await prisma.notification.createMany({
    data: [
      { branchId: branchIndiranagar.id, userId: managerUser.id, title: 'Low Stock Alert', message: 'Red Onion (Bellary) is at 18 kg, below reorder level of 20 kg.', type: 'STOCK_ALERT', severity: 'WARNING', link: '/procurement/intelligence' },
      { branchId: branchIndiranagar.id, userId: procurementUser.id, title: 'Supplier Confirmation Received', message: 'Karnataka Fresh confirmed delivery for PO-2026-0802.', type: 'PO_UPDATE', severity: 'NORMAL', link: '/procurement/purchase-orders' },
    ],
  });

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
