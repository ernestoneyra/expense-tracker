import dns from 'node:dns'
import mongoose from 'mongoose'

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
