import dns from 'node:dns'
import mongoose from 'mongoose'

// Operator injection: a client that sends {"$ne": null} where a string was expected must not be able to
// turn "equals" into "anything" just because a handler put the value into a query as it arrived. With
// this on, Mongoose treats any object with `$` keys inside a query filter as a literal value (it wraps
// it in `$eq`, which then fails to cast), and refuses `$where`. A filter that really does use an
// operator, written by us and never built from a request, says so with `trusted({ ... })`.
mongoose.set('sanitizeFilter', true)

export async function connectDb() {
  // mongodb+srv:// needs an SRV lookup; some networks/VPNs leave Node with a resolver that refuses it
  const dnsServers = process.env.DNS_SERVERS?.split(',').map((s) => s.trim()).filter(Boolean)
  if (dnsServers?.length) dns.setServers(dnsServers)

  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env and fill it in.')
  }

  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'))
  mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message))

  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB || undefined,
    serverSelectionTimeoutMS: 10_000,
  })
  console.log(`MongoDB connected (db: ${mongoose.connection.name})`)
}
