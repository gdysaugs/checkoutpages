import { createClient, type User } from '@supabase/supabase-js'
import { buildCorsHeaders, isCorsBlocked } from '../_shared/cors'
import { getSupabaseAdminClient } from '../_shared/runtime-env'

type Env = {
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}

type TicketRow = {
  id: string
  email: string | null
  user_id: string | null
  tickets: number
  updated_at: string | null
}

const PLAY_COST = 1
const SIGNUP_TICKET_GRANT = 3
const corsMethods = 'POST, OPTIONS'

const ERROR_LOGIN_REQUIRED = 'ログインが必要です。'
const ERROR_AUTH_FAILED = '認証に失敗しました。'
const ERROR_GOOGLE_ONLY = 'Googleログインのみ対応しています。'
const ERROR_EMAIL_MISSING = 'メールアドレスが取得できません。'
const ERROR_NO_TOKENS = 'トークンが不足しています。'
const ERROR_SUPABASE_NOT_SET = '認証設定が見つかりません。'
const INTERNAL_SERVER_ERROR_MESSAGE = 'サーバー内部エラーが発生しました。時間をおいて再度お試しください。'

const jsonResponse = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

const extractBearerToken = (request: Request) => {
  const header = request.headers.get('Authorization') || ''
  const match = header.match(/Bearer\s+(.+)/i)
  return match ? match[1] : ''
}

const makeUsageId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const isGoogleUser = (user: User) => {
  if (user.app_metadata?.provider === 'google') return true
  if (Array.isArray(user.identities)) {
    return user.identities.some((identity) => identity.provider === 'google')
  }
  return false
}

const fetchTicketRow = async (admin: ReturnType<typeof createClient>, user: User) => {
  const email = user.email
  const { data: byUser, error: userError } = await admin
    .from('user_tickets')
    .select('id, email, user_id, tickets, updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (userError) {
    return { data: null as TicketRow | null, error: userError }
  }
  if (byUser) {
    return {
      data: {
        id: String(byUser.id),
        email: byUser.email ? String(byUser.email) : null,
        user_id: byUser.user_id ? String(byUser.user_id) : null,
        tickets: Number(byUser.tickets ?? 0),
        updated_at: byUser.updated_at ? String(byUser.updated_at) : null,
      } satisfies TicketRow,
      error: null,
    }
  }
  if (!email) {
    return { data: null as TicketRow | null, error: null }
  }

  const { data: byEmail, error: emailError } = await admin
    .from('user_tickets')
    .select('id, email, user_id, tickets, updated_at')
    .ilike('email', email)
    .maybeSingle()

  if (emailError) {
    return { data: null as TicketRow | null, error: emailError }
  }

  return {
    data: byEmail
      ? ({
          id: String(byEmail.id),
          email: byEmail.email ? String(byEmail.email) : null,
          user_id: byEmail.user_id ? String(byEmail.user_id) : null,
          tickets: Number(byEmail.tickets ?? 0),
          updated_at: byEmail.updated_at ? String(byEmail.updated_at) : null,
        } satisfies TicketRow)
      : null,
    error: null,
  }
}

const ensureTicketRow = async (admin: ReturnType<typeof createClient>, user: User) => {
  const email = user.email
  if (!email) {
    return { data: null as TicketRow | null, error: null }
  }

  const existing = await fetchTicketRow(admin, user)
  if (existing.error || existing.data) {
    return existing
  }

  const { data: inserted, error: insertError } = await admin
    .from('user_tickets')
    .insert({ email, user_id: user.id, tickets: SIGNUP_TICKET_GRANT })
    .select('id, email, user_id, tickets, updated_at')
    .maybeSingle()

  if (insertError || !inserted) {
    return fetchTicketRow(admin, user)
  }

  await admin.from('ticket_events').insert({
    usage_id: makeUsageId(),
    email,
    user_id: user.id,
    delta: SIGNUP_TICKET_GRANT,
    reason: 'signup_bonus',
    metadata: { source: 'auto_grant' },
  })

  return {
    data: {
      id: String(inserted.id),
      email: inserted.email ? String(inserted.email) : null,
      user_id: inserted.user_id ? String(inserted.user_id) : null,
      tickets: Number(inserted.tickets ?? 0),
      updated_at: inserted.updated_at ? String(inserted.updated_at) : null,
    } satisfies TicketRow,
    error: null,
  }
}

const requireGoogleUser = async (request: Request, env: Env, corsHeaders: HeadersInit) => {
  const token = extractBearerToken(request)
  if (!token) {
    return { response: jsonResponse({ error: ERROR_LOGIN_REQUIRED }, 401, corsHeaders) }
  }
  const admin = getSupabaseAdminClient(env)
  if (!admin) {
    return { response: jsonResponse({ error: ERROR_SUPABASE_NOT_SET }, 500, corsHeaders) }
  }
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) {
    return { response: jsonResponse({ error: ERROR_AUTH_FAILED }, 401, corsHeaders) }
  }
  if (!isGoogleUser(data.user)) {
    return { response: jsonResponse({ error: ERROR_GOOGLE_ONLY }, 403, corsHeaders) }
  }
  return { admin, user: data.user }
}

const rollbackTicketEvent = async (admin: ReturnType<typeof createClient>, usageId: string) =>
  admin.from('ticket_events').delete().eq('usage_id', usageId)

const consumePlayToken = async (
  admin: ReturnType<typeof createClient>,
  user: User,
  corsHeaders: HeadersInit,
) => {
  const email = user.email
  if (!email) {
    return { response: jsonResponse({ error: ERROR_EMAIL_MISSING }, 400, corsHeaders) }
  }

  const ensured = await ensureTicketRow(admin, user)
  if (ensured.error) {
    return { response: jsonResponse({ error: INTERNAL_SERVER_ERROR_MESSAGE }, 500, corsHeaders) }
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: latestRow, error: latestError } = await fetchTicketRow(admin, user)
    if (latestError) {
      return { response: jsonResponse({ error: INTERNAL_SERVER_ERROR_MESSAGE }, 500, corsHeaders) }
    }
    if (!latestRow || latestRow.tickets < PLAY_COST) {
      return { response: jsonResponse({ error: ERROR_NO_TOKENS }, 402, corsHeaders) }
    }
    if (!latestRow.user_id) {
      const { error: linkError } = await admin.from('user_tickets').update({ user_id: user.id }).eq('id', latestRow.id)
      if (linkError) {
        return { response: jsonResponse({ error: INTERNAL_SERVER_ERROR_MESSAGE }, 500, corsHeaders) }
      }
    }

    const usageId = makeUsageId()
    const { error: eventError } = await admin.from('ticket_events').insert({
      usage_id: usageId,
      email,
      user_id: user.id,
      delta: -PLAY_COST,
      reason: 'invader_play',
      metadata: { source: 'checkoutpages', cost: PLAY_COST },
    })

    if (eventError) {
      return { response: jsonResponse({ error: INTERNAL_SERVER_ERROR_MESSAGE }, 500, corsHeaders) }
    }

    let updateQuery = admin
      .from('user_tickets')
      .update({ tickets: latestRow.tickets - PLAY_COST, updated_at: new Date().toISOString() })
      .eq('id', latestRow.id)
      .eq('tickets', latestRow.tickets)

    if (latestRow.updated_at) {
      updateQuery = updateQuery.eq('updated_at', latestRow.updated_at)
    }

    const { data: updated, error: updateError } = await updateQuery.select('tickets').maybeSingle()
    if (!updateError && updated) {
      return { ticketsLeft: Number(updated.tickets ?? 0), usageId }
    }

    await rollbackTicketEvent(admin, usageId)
  }

  return { response: jsonResponse({ error: INTERNAL_SERVER_ERROR_MESSAGE }, 500, corsHeaders) }
}

export const onRequestOptions: PagesFunction<Env> = async ({ request, env }) => {
  const corsHeaders = buildCorsHeaders(request, env, corsMethods)
  if (isCorsBlocked(request, env)) {
    return new Response(null, { status: 403, headers: corsHeaders })
  }
  return new Response(null, { headers: corsHeaders })
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const corsHeaders = buildCorsHeaders(request, env, corsMethods)
  if (isCorsBlocked(request, env)) {
    return new Response(null, { status: 403, headers: corsHeaders })
  }

  const auth = await requireGoogleUser(request, env, corsHeaders)
  if ('response' in auth) {
    return auth.response
  }

  const result = await consumePlayToken(auth.admin, auth.user, corsHeaders)
  if ('response' in result) {
    return result.response
  }

  return jsonResponse({ ok: true, ticketsLeft: result.ticketsLeft, usageId: result.usageId }, 200, corsHeaders)
}
