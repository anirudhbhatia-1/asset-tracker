const express = require('express');
const { body, param } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const categoryService = require('../services/categoryService');

const router = express.Router();

// GET /api/categories — list all categories
router.get('/', async (req, res, next) => {
  try {
    const categories = await categoryService.getCategories();
    res.status(200).json({
      data: categories,
      total: categories.length,
      message: 'OK',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/categories/:id — get single category
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  validateRequest,
], async (req, res, next) => {
  try {
    const category = await categoryService.getCategoryById(Number(req.params.id));
    res.status(200).json({
      data: category,
      message: 'OK',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/categories — create category
router.post('/', [
  body('name').notEmpty().withMessage('Category name is required').trim().isLength({ max: 100 }),
  body('description').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 500 }),
  body('badgeChar').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 1 }).withMessage('badgeChar must be at most 1 character'),
  body('color').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 50 }),
  validateRequest,
], async (req, res, next) => {
  try {
    const created = await categoryService.createCategory(req.body);
    res.status(201).json({
      data: created,
      message: 'Category created successfully',
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/categories/:id — update category
router.put('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('name').optional({ nullable: true, checkFalsy: true }).notEmpty().trim().isLength({ max: 100 }),
  body('description').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 500 }),
  body('badgeChar').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 1 }),
  body('color').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 50 }),
  validateRequest,
], async (req, res, next) => {
  try {
    const updated = await categoryService.updateCategory(Number(req.params.id), req.body);
    res.status(200).json({
      data: updated,
      message: 'Category updated successfully',
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/categories/:id — delete category with conflict check
router.delete('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  validateRequest,
], async (req, res, next) => {
  try {
    const result = await categoryService.deleteCategory(Number(req.params.id));
    res.status(200).json({
      data: result,
      message: 'Category deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
