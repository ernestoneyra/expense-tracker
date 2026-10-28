import mongoose, { type Model } from 'mongoose'
import { connectDb } from './db.ts'
import { Budget } from './models/Budget.ts'
import { Category } from './models/Category.ts'
import { CategoryBudget } from './models/CategoryBudget.ts'
import { Debt } from './models/Debt.ts'
import { Expense } from './models/Expense.ts'
import { Goal } from './models/Goal.ts'
import { Income } from './models/Income.ts'
import { Recurring } from './models/Recurring.ts'
import { User } from './models/User.ts'
import { accountScope } from './sandbox.ts'

// Before accounts existed there was one shared dataset, stored with no owner. This hands it to an
// account: `npm run claim-data -- <username>`. Register the account first. The account has to be
// empty (nothing but the default categories) so nothing of theirs is overwritten.
const username = process.argv[2]?.trim().toLowerCase()
if (!username) {
  console.error('Usage: npm run claim-data -- <username>')
  process.exit(1)
}

try {
  await connectDb()
  const user = await User.findOne({ usernameKey: username })
  if (!user) throw new Error(`There is no account called "${username}". Register it first.`)
  const sandbox = accountScope(user._id)

  // Every model has the same `sandbox` field; typed as one shape so they can be handled in a list.
  type Owned = Model<{ sandbox?: string | null }>
  const models = [Expense, Income, Budget, CategoryBudget, Goal, Debt, Recurring] as unknown as Owned[]
  const categories = Category as unknown as Owned
  const owned = (await Promise.all(models.map((m) => m.countDocuments({ sandbox })))).reduce((a, b) => a + b, 0)
  if (owned > 0) throw new Error(`"${username}" already has data. Claim it into an empty account.`)

  const waiting = await Promise.all([...models, categories].map((m) => m.countDocuments({ sandbox: null })))
  if (waiting.every((n) => n === 0)) throw new Error('There is no data without an owner to claim.')

  // The new account starts with the default categories; the old data brings its own.
  await Category.deleteMany({ sandbox })
  for (const model of [...models, categories]) {
    const { modifiedCount } = await model.updateMany({ sandbox: null }, { $set: { sandbox } })
    console.log(`${model.modelName}: ${modifiedCount}`)
  }
  console.log(`Done. "${user.username}" now owns it.`)
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
