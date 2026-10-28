import { createUser, UsernameTaken } from './accounts.ts'
import { hashPassword } from './password.ts'
import { User } from '../models/User.ts'

// Two shared demo accounts, so there's something to sign in to straight away. Their password is
// public (it's in the README), so they hold sample data only, and can't be deleted or have their
// password changed. Turn them off with SEED_GUESTS=false for a deployment with real users.
const GUESTS = ['guest1', 'guest2']
const GUEST_PASSWORD = 'password'

export async function seedGuests() {
  if (process.env.SEED_GUESTS === 'false') return
  for (const username of GUESTS) {
    // Only ever created, never reset: whatever the guests have entered since is left alone.
    if (await User.exists({ usernameKey: username })) continue
    try {
      await createUser({ username, passwordHash: await hashPassword(GUEST_PASSWORD), isGuest: true })
      console.log(`Created demo account ${username}`)
    } catch (err) {
      // Another instance starting at the same time got there first.
      if (!(err instanceof UsernameTaken)) throw err
    }
  }
}
