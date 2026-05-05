const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    INSERT INTO walkway_master_items (item_key, description, profile, material, wt_pc, fixed_rate_pc, cut_length, is_active, created_at, updated_at)
    VALUES
      ('walkwaySection', 'Walkway Section (310mm width, 2010mm)', 'Walkway Section 310x35x10x0.9mm', 'Magnelis',   7.63800, NULL,  2010, 1, NOW(), NOW()),
      ('walkwayCleat',   'Walkway Cleat (L-Angle, 40mm)',         'L-Angle 35x45x1.2',               'Magnelis',   0.04800, NULL,  40,   1, NOW(), NOW()),
      ('jointer',        'Jointer (200mm)',                       'L-Angle 35x45x2',                 'Magnelis',   0.24000, NULL,  200,  1, NOW(), NOW()),
      ('baseRail',       'Base Rail (400mm)',                     'Strut Channel 41x41x1.2mm',       'Magnelis',   0.50000, NULL,  400,  1, NOW(), NOW()),
      ('railNut',        'Rail Nut',                              'Rail Nut MA01',                   'Al 6063-T6', 0.01540, NULL,  23,   1, NOW(), NOW()),
      ('blindRivets',    'Blind Rivets (4.8x15mm)',               'Blind Rivet 4.8x15mm',            'Al 5000',    NULL,    1.20, NULL, 1, NOW(), NOW()),
      ('epdmPad',        'EPDM Pad (30x30x2mm)',                  'EPDM Pad 30x30x2mm',              'Al 5001',    NULL,    3.00, NULL, 1, NOW(), NOW()),
      ('m8Bolt',         'M8x20 Allen Hex Bolt',                  'Allen Hex Bolt M8x20',            'SS 304',     NULL,   10.00,  20,  1, NOW(), NOW()),
      ('m8Washer',       'M8 Plain & Spring Washer',              'M8 Plain & Spring Washer',        'SS 304',     NULL,    5.00, NULL, 1, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      description = VALUES(description), profile = VALUES(profile), material = VALUES(material),
      wt_pc = VALUES(wt_pc), fixed_rate_pc = VALUES(fixed_rate_pc), cut_length = VALUES(cut_length), updated_at = NOW()
  `);

  const rows = await prisma.$queryRawUnsafe('SELECT item_key, wt_pc, fixed_rate_pc FROM walkway_master_items ORDER BY id');
  console.log('Seeded walkway master items:');
  rows.forEach(r => console.log(' ', r.item_key, '| wtPc:', r.wt_pc, '| fixedRatePc:', r.fixed_rate_pc));
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
