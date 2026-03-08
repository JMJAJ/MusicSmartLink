import { Pool, PoolClient, QueryResult } from "pg"

let pool: Pool | null = null

function getNeonPool(): Pool {
  if (!pool) {
    const connectionString = buildNeonConnectionString()
    
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })

    pool.on("error", (err) => {
      console.error("[Neon] Unexpected error on idle client", err)
    })
  }

  return pool
}

function buildNeonConnectionString(): string {
  const host = process.env.PGHOST
  const database = process.env.PGDATABASE
  const user = process.env.PGUSER
  const password = process.env.PGPASSWORD
  const sslmode = process.env.PGSSLMODE || "require"

  if (!host || !database || !user || !password) {
    throw new Error("[Neon] Missing required environment variables for Neon connection")
  }

  return `postgres://${user}:${password}@${host}/${database}?sslmode=${sslmode}`
}

export async function getNeonClient(): Promise<PoolClient> {
  const pool = getNeonPool()
  return pool.connect()
}

export async function queryNeon<T = unknown>(text: string, values?: unknown[]): Promise<T[]> {
  const client = await getNeonClient()
  try {
    const result: QueryResult<T> = await client.query(text, values)
    return result.rows
  } finally {
    client.release()
  }
}

export async function checkNeonConnection(): Promise<boolean> {
  try {
    await queryNeon("SELECT 1")
    return true
  } catch (error) {
    console.error("[Neon] Connection check failed:", error)
    return false
  }
}

export async function closeNeonPool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}
