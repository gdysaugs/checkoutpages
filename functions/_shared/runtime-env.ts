import { createClient } from '@supabase/supabase-js'

type RuntimeEnv = Record<string, unknown> | null | undefined

const readString = (value: unknown) => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export const getRuntimeEnv = (env: RuntimeEnv, key: string) => {
  const bindingValue = readString(env?.[key])
  if (bindingValue) return bindingValue

  if (typeof process === 'undefined' || !process.env) return undefined
  return readString(process.env[key])
}

export const getSupabaseAdminClient = (env: RuntimeEnv) => {
  const url = getRuntimeEnv(env, 'SUPABASE_URL')
  const serviceKey = getRuntimeEnv(env, 'SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return null

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
