const walkwayItemService = require('../services/walkwayItemService');

module.exports = {
  async getAll(req, res, next) {
    try {
      const items = await walkwayItemService.getAll();
      res.json(items);
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const result = await walkwayItemService.update(req.params.id, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};
