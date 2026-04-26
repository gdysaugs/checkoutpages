import { createClient } from '@supabase/supabase-js'

type Env = {
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
  STRIPE_WEBHOOK_SIGNING_SECRET?: string
  STRIPE_SIGNING_SECRET?: string
}

type TicketRow = {
  id: string
  email: string
  user_id: string
  tickets: number
}

const PRICE_MAP = new Map([
  ['price_1TQHacALU0WO3UpeDfbtdmME', { label: 'プラン 1', tickets: 30 }],
  ['price_1TQHaqALU0WO3Uped9KXpkn7', { label: 'プラン 2', tickets: 100 }],
  ['price_1TQHb8ALU0WO3UpehLwhhUNR', { label: 'プラン 3', tickets: 250 }],
  ['price_1TQHbUALU0WO3UpeQpDRNFUO', { label: 'プラン 4', tickets: 700 }],
  ['price_1TQHblALU0WO3UpeYhHH8WRB', { label: 'プラン 5', tickets: 2100 }],
])

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature',
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const getSupabaseAdmin = (env: Env) => {
  const url = env.SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const resolveStripeWebhookSecret = (env: Env) => {
  const candidates = [env.STRIPE_WEBHOOK_SECRET, env.STRIPE_WEBHOOK_SIGNING_SECRET, env.STRIPE_SIGNING_SECRET]
  for (const value of candidates) {
    const normalized = String(value ?? '').trim()
    if (normalized) return normalized
  }
  return ''
}

const textEncoder = new TextEncoder()

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

const verifyStripeSignature = async (payload: string, signature: string, secret: string) => {
  const parts = signature.split(',').map((item) => item.trim())
  const timestampPart = parts.find((item) => item.startsWith('t='))
  const v1Parts = parts.filter((item) => item.startsWith('v1='))
  if (!timestampPart || v1Parts.length === 0) return false

  const timestamp = timestampPart.slice(2)
  const signedPayload = `${timestamp}.${payload}`
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, textEncoder.encode(signedPayload))
  const expected = toHex(signatureBuffer)
  return v1Parts.some((part) => timingSafeEqual(part.slice(3), expected))
}

const isMissingGrantRpcFunctionError = (error: { code?: unknown; message?: unknown } | null | undefined) => {
  const code = String(error?.code ?? '')
  const message = String(error?.message ?? '')
  return code === 'PGRST202' || message.includes('Could not find the function public.grant_tickets')
}

const isDuplicateUsageError = (error: { code?: unknown; message?: unknown } | null | undefined) => {
  const code = String(error?.code ?? '')
  const message = String(error?.message ?? '').toLowerCase()
  return code === '23505' || message.includes('duplicate key')
}

const fetchExistingUsage = async (admin: ReturnType<typeof createClient>, usageId: string) => {
  const { data, error } = await admin.from('ticket_events').select('id').eq('usage_id', usageId).maybeSingle()
  return { data, error }
}

const fetchTicketRow = async (admin: ReturnType<typeof createClient>, userId: string, email: string) => {
  const byUser = await admin.from('user_tickets').select('id, email, user_id, tickets').eq('user_id', userId).maybeSingle()
  if (byUser.error) return { data: null as TicketRow | null, error: byUser.error }
  if (byUser.data) return { data: byUser.data as TicketRow, error: null }

  const byEmail = await admin.from('user_tickets').select('id, email, user_id, tickets').ilike('email', email).maybeSingle()
  if (byEmail.error) return { data: null as TicketRow | null, error: byEmail.error }
  return { data: (byEmail.data as TicketRow | null) ?? null, error: null }
}

const ensureTicketRow = async (admin: ReturnType<typeof createClient>, userId: string, email: string) => {
  const existing = await fetchTicketRow(admin, userId, email)
  if (existing.error) return existing
  if (existing.data) {
    if (existing.data.user_id !== userId) {
      const { error } = await admin.from('user_tickets').update({ user_id: userId }).eq('id', existing.data.id)
      if (error) return { data: null as TicketRow | null, error }
      return { data: { ...existing.data, user_id: userId }, error: null }
    }
    return existing
  }

  const inserted = await admin
    .from('user_tickets')
    .insert({ user_id: userId, email, tickets: 0 })
    .select('id, email, user_id, tickets')
    .maybeSingle()

  if (inserted.error || !inserted.data) {
    return fetchTicketRow(admin, userId, email)
  }

  return { data: inserted.data as TicketRow, error: null }
}

const rollbackTicketEvent = async (admin: ReturnType<typeof createClient>, usageId: string) => {
  await admin.from('ticket_events').delete().eq('usage_id', usageId)
}

const grantTicketsDirectly = async (
  admin: ReturnType<typeof createClient>,
  {
    usageId,
    userId,
    email,
    amount,
    reason,
    metadata,
  }: {
    usageId: string
    userId: string
    email: string
    amount: number
    reason: string
    metadata: Record<string, unknown>
  },
) => {
  const existingUsage = await fetchExistingUsage(admin, usageId)
  if (existingUsage.error) return { error: existingUsage.error, alreadyProcessed: false }
  if (existingUsage.data) return { error: null, alreadyProcessed: true }

  const rowResult = await ensureTicketRow(admin, userId, email)
  if (rowResult.error || !rowResult.data) return { error: rowResult.error ?? new Error('ticket row missing'), alreadyProcessed: false }

  const ticketRow = rowResult.data
  const eventInsert = await admin.from('ticket_events').insert({
    usage_id: usageId,
    user_id: userId,
    email,
    delta: amount,
    reason,
    metadata,
  })

  if (eventInsert.error) {
    if (isDuplicateUsageError(eventInsert.error)) {
      return { error: null, alreadyProcessed: true }
    }
    return { error: eventInsert.error, alreadyProcessed: false }
  }

  const nextTickets = Number(ticketRow.tickets ?? 0) + amount
  const balanceUpdate = await admin
    .from('user_tickets')
    .update({ tickets: nextTickets, updated_at: new Date().toISOString() })
    .eq('id', ticketRow.id)
    .eq('tickets', ticketRow.tickets)

  if (balanceUpdate.error) {
    await rollbackTicketEvent(admin, usageId)
    return { error: balanceUpdate.error, alreadyProcessed: false }
  }

  return { error: null, alreadyProcessed: false }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { headers: corsHeaders })

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const secret = resolveStripeWebhookSecret(env)
  if (!secret) {
    return jsonResponse({ error: 'STRIPE_WEBHOOK_SECRET is not set.' }, 500)
  }

  const signature = request.headers.get('stripe-signature') || ''
  const body = await request.text()
  const isValid = await verifyStripeSignature(body, signature, secret)
  if (!isValid) {
    return jsonResponse({ error: 'Invalid signature.' }, 401)
  }

  const event = body ? JSON.parse(body) : null
  if (!event?.type) {
    return jsonResponse({ error: 'Invalid event payload.' }, 400)
  }

  if (event.type !== 'checkout.session.completed') {
    return jsonResponse({ received: true })
  }

  const session = event.data?.object ?? {}
  if (session.payment_status && session.payment_status !== 'paid') {
    return jsonResponse({ received: true })
  }

  const appTag = String(session.metadata?.app ?? '')
  if (appTag !== 'sparkheart') {
    return jsonResponse({ received: true })
  }

  const priceId = String(session.metadata?.price_id ?? '')
  const plan = PRICE_MAP.get(priceId)
  if (!priceId || !plan) {
    return jsonResponse({ received: true })
  }

  const tickets = plan.tickets
  const email = String(session.metadata?.email ?? session.customer_details?.email ?? '')
  const userId = String(session.metadata?.user_id ?? session.client_reference_id ?? '')
  const usageId = String(event.id ?? session.id ?? '')
  const stripeCustomerId = session.customer ? String(session.customer) : null

  if (!tickets || !email || !userId || !usageId) {
    return jsonResponse({ error: 'Missing metadata.' }, 400)
  }

  const admin = getSupabaseAdmin(env)
  if (!admin) {
    return jsonResponse({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.' }, 500)
  }

  const { data: userCheck, error: userCheckError } = await admin.auth.admin.getUserById(userId)
  if (userCheckError || !userCheck?.user) {
    return jsonResponse({ received: true })
  }

  const metadata = {
    price_id: priceId,
    plan_label: plan.label,
    metadata_tickets: session.metadata?.tickets ?? null,
    session_id: session.id ?? null,
    stripe_customer_id: stripeCustomerId,
  }

  const { data: rpcData, error: rpcError } = await admin.rpc('grant_tickets', {
    p_usage_id: usageId,
    p_user_id: userId,
    p_email: email,
    p_amount: tickets,
    p_reason: 'stripe_purchase',
    p_metadata: metadata,
    p_stripe_customer_id: stripeCustomerId,
  })

  if (rpcError) {
    if (isMissingGrantRpcFunctionError(rpcError)) {
      const fallback = await grantTicketsDirectly(admin, {
        usageId,
        userId,
        email,
        amount: tickets,
        reason: 'stripe_purchase',
        metadata,
      })

      if (fallback.error) {
        const message = typeof fallback.error === 'object' && fallback.error && 'message' in fallback.error
          ? String((fallback.error as { message?: unknown }).message ?? 'Failed to grant tickets.')
          : 'Failed to grant tickets.'
        return jsonResponse({ error: message }, 500)
      }

      return jsonResponse({ received: true, duplicate: fallback.alreadyProcessed || false })
    }

    const message = rpcError.message ?? 'Failed to grant tickets.'
    if (message.includes('INVALID')) {
      return jsonResponse({ error: message }, 400)
    }
    return jsonResponse({ error: message }, 500)
  }

  const result = Array.isArray(rpcData) ? rpcData[0] : rpcData
  if (result?.already_processed) {
    return jsonResponse({ received: true, duplicate: true })
  }

  return jsonResponse({ received: true })
}
