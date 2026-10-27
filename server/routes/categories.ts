import { Router } from 'express'
import { Category, NAME_COLLATION } from '../models/Category.ts'
import { Expense } from '../models/Expense.ts'
import { DEMO_MODE, MAX_CATEGORIES, sandboxOf } from '../sandbox.ts'

export const categoriesRouter = Router()

// Each category with how many expenses use it; the client does the sorting.
categoriesRouter.get('/', async (_req, res) => {
  const sandbox = sandboxOf(res)
  const [categories, counts] = await Promise.all([
    Category.find({ sandbox }).collation(NAME_COLLATION).sort({ name: 1 }),
    Expense.aggregate<{ _id: string; count: number }>([
      { $match: { sandbox } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
  ])
  const countByName = new Map(counts.map((c) => [c._id, c.count]))
  res.json(categories.map((c) => ({ ...c.toJSON(), count: countByName.get(c.name) ?? 0 })))
})

categoriesRouter.post('/', async (req, res) => {
  const sandbox = sandboxOf(res)
  if (DEMO_MODE && (await Category.countDocuments({ sandbox })) >= MAX_CATEGORIES) {
    res.status(400).json({ error: `The demo is limited to ${MAX_CATEGORIES} categories` })
    return
  }
  try {
    const category = await Category.create({ sandbox, name: req.body?.name })
    res.status(201).json({ ...category.toJSON(), count: 0 })
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      res.status(409).json({ error: 'That category already exists' })
      return
    }
    throw err
  }
})

// Expenses keep the name they were saved with, so deleting a category never touches them.
categoriesRouter.delete('/:id', async (req, res) => {
  const deleted = await Category.findOneAndDelete({ _id: req.params.id, sandbox: sandboxOf(res) })
  if (!deleted) {
    res.status(404).json({ error: 'Category not found' })
    return
  }
  res.status(204).end()
})
