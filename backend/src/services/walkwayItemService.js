const prisma = require('../prismaClient');

class WalkwayItemService {
  async getAll() {
    return await prisma.$queryRawUnsafe(
      'SELECT id, item_key AS itemKey, description, profile, material, wt_pc AS wtPc, fixed_rate_pc AS fixedRatePc, cut_length AS cutLength FROM walkway_master_items WHERE is_active = 1 ORDER BY id'
    );
  }

  async update(id, data) {
    const fields = [];
    const values = [];

    if (data.wtPc !== undefined) {
      fields.push('wt_pc = ?');
      values.push(data.wtPc === null ? null : parseFloat(data.wtPc));
    }
    if (data.fixedRatePc !== undefined) {
      fields.push('fixed_rate_pc = ?');
      values.push(data.fixedRatePc === null ? null : parseFloat(data.fixedRatePc));
    }

    if (fields.length === 0) return { message: 'No supported fields provided' };

    fields.push('updated_at = NOW()');
    values.push(parseInt(id));

    await prisma.$executeRawUnsafe(
      `UPDATE walkway_master_items SET ${fields.join(', ')} WHERE id = ?`,
      ...values
    );

    const rows = await prisma.$queryRawUnsafe(
      'SELECT id, item_key AS itemKey, description, wt_pc AS wtPc, fixed_rate_pc AS fixedRatePc FROM walkway_master_items WHERE id = ?',
      parseInt(id)
    );
    return rows[0] || null;
  }
}

module.exports = new WalkwayItemService();
