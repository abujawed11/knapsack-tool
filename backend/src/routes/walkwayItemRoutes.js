const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/walkwayItemController');
const { authenticateToken, checkPasswordChange } = require('../middleware/authMiddleware');
const { forbidBasicMasterItemMutation } = require('../middleware/bomPermissions');

router.use(authenticateToken);
router.use(checkPasswordChange);

// GET /api/walkway-items
router.get('/', ctrl.getAll);

// PUT /api/walkway-items/:id  — manager-only (canUpdateMasterItem)
router.put('/:id', forbidBasicMasterItemMutation, ctrl.update);

module.exports = router;
