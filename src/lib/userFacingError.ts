const GENERIC_ERROR_MESSAGE = '\u51e6\u7406\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\u6642\u9593\u3092\u304a\u3044\u3066\u518d\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002'
const LOGIN_START_ERROR_MESSAGE = '\u30ed\u30b0\u30a4\u30f3\u3092\u958b\u59cb\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u6642\u9593\u3092\u304a\u3044\u3066\u518d\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002'
const LOGIN_REQUIRED_MESSAGE = '\u30ed\u30b0\u30a4\u30f3\u304c\u5fc5\u8981\u3067\u3059\u3002'
const GOOGLE_LOGIN_ONLY_MESSAGE = 'Google\u30ed\u30b0\u30a4\u30f3\u3067\u3054\u5229\u7528\u304f\u3060\u3055\u3044\u3002'
const TOKEN_SHORTAGE_MESSAGE = '\u30c8\u30fc\u30af\u30f3\u304c\u8db3\u308a\u307e\u305b\u3093\u3002'
const IMAGE_REQUIRED_MESSAGE = '\u7d20\u6750\u3092\u8aad\u307f\u8fbc\u3093\u3067\u304b\u3089\u518d\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002'
const PROMPT_REQUIRED_MESSAGE = '\u52d5\u304d\u306e\u6307\u793a\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002'
const NETWORK_ERROR_MESSAGE = '\u901a\u4fe1\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\u6642\u9593\u3092\u304a\u3044\u3066\u518d\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002'
const TIMEOUT_ERROR_MESSAGE = '\u51e6\u7406\u306b\u6642\u9593\u304c\u304b\u304b\u3063\u3066\u3044\u307e\u3059\u3002\u6642\u9593\u3092\u304a\u3044\u3066\u518d\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002'
const MEMORY_ERROR_MESSAGE = 'GPU\u30e1\u30e2\u30ea\u304c\u8db3\u308a\u307e\u305b\u3093\u3002\u753b\u50cf\u30b5\u30a4\u30ba\u3092\u5c0f\u3055\u304f\u3057\u3066\u518d\u8a66\u884c\u3057\u3066\u304f\u3060\u3055\u3044\u3002'
const PAYMENT_ERROR_MESSAGE = '\u6c7a\u6e08\u306e\u6e96\u5099\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\u6642\u9593\u3092\u304a\u3044\u3066\u518d\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002'
const INPUT_ERROR_MESSAGE = '\u5165\u529b\u5185\u5bb9\u3092\u78ba\u8a8d\u3057\u3066\u518d\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002'
const CONTENT_BLOCKED_MESSAGE = '\u3053\u306e\u7d20\u6750\u3067\u306f\u751f\u6210\u3067\u304d\u307e\u305b\u3093\u3002\u5225\u306e\u7d20\u6750\u3067\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002'
const RESULT_FETCH_ERROR_MESSAGE = '\u751f\u6210\u7d50\u679c\u306e\u53d6\u5f97\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\u6642\u9593\u3092\u304a\u3044\u3066\u518d\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002'

const pickMessageLikeValue = (value: unknown): string => {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.message || ''
  if (typeof value === 'object') {
    const maybe = value as { error?: unknown; message?: unknown; detail?: unknown }
    return (
      pickMessageLikeValue(maybe.error) ||
      pickMessageLikeValue(maybe.message) ||
      pickMessageLikeValue(maybe.detail)
    )
  }
  return String(value)
}

const tryParseJsonMessage = (raw: string): string => {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (!((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')))) {
    return raw
  }

  try {
    const parsed = JSON.parse(trimmed)
    return pickMessageLikeValue(parsed) || raw
  } catch {
    return raw
  }
}

const looksInternal = (raw: string) => {
  const lowered = raw.toLowerCase()
  return (
    lowered.includes('pgrst') ||
    lowered.includes('23505') ||
    lowered.includes('could not find the function') ||
    lowered.includes('schema cache') ||
    lowered.includes('service_role') ||
    lowered.includes('supabase') ||
    lowered.includes('runpod') ||
    lowered.includes('endpoint_url') ||
    lowered.includes('workflow override') ||
    lowered.includes('rpc') ||
    lowered.includes('sql') ||
    lowered.includes('duplicate key') ||
    lowered.includes('internal_error_detail') ||
    lowered.includes('upstream response') ||
    lowered.includes('invalid request body')
  )
}

export const toUserFacingErrorMessage = (value: unknown, fallback = GENERIC_ERROR_MESSAGE) => {
  const picked = pickMessageLikeValue(value)
  if (!picked) return fallback

  const raw = tryParseJsonMessage(picked).trim()
  if (!raw) return fallback

  const lowered = raw.toLowerCase()

  if (
    lowered.includes('out of memory') ||
    lowered.includes('would exceed allowed memory') ||
    lowered.includes('allocation on device') ||
    lowered.includes('cuda') ||
    lowered.includes('oom')
  ) {
    return MEMORY_ERROR_MESSAGE
  }

  if (
    lowered.includes('t_ticket_shortage') ||
    lowered.includes('ticket_shortage') ||
    lowered.includes('no ticket') ||
    lowered.includes('no tickets') ||
    lowered.includes('insufficient_tickets') ||
    lowered.includes('insufficient tickets') ||
    lowered.includes('token') ||
    lowered.includes('credit')
  ) {
    return TOKEN_SHORTAGE_MESSAGE
  }

  if (
    lowered.includes('\u30ed\u30b0\u30a4\u30f3\u304c\u5fc5\u8981') ||
    lowered.includes('login required') ||
    lowered.includes('auth required') ||
    lowered.includes('unauthorized')
  ) {
    return LOGIN_REQUIRED_MESSAGE
  }

  if (lowered.includes('google') && (lowered.includes('\u306e\u307f') || lowered.includes('only'))) {
    return GOOGLE_LOGIN_ONLY_MESSAGE
  }

  if (
    (lowered.includes('\u8a8d\u8a3c') && lowered.includes('url')) ||
    lowered.includes('oauth') ||
    lowered.includes('sign in') ||
    lowered.includes('sign-in') ||
    lowered.includes('login url')
  ) {
    return LOGIN_START_ERROR_MESSAGE
  }

  if (
    lowered.includes('\u753b\u50cf\u304c\u5fc5\u8981') ||
    lowered.includes('image is required') ||
    lowered.includes('image is empty') ||
    lowered.includes('video is empty') ||
    lowered.includes('image required')
  ) {
    return IMAGE_REQUIRED_MESSAGE
  }

  if (
    lowered.includes('\u30d7\u30ed\u30f3\u30d7\u30c8') && lowered.includes('\u5165\u529b') ||
    lowered.includes('prompt is required')
  ) {
    return PROMPT_REQUIRED_MESSAGE
  }

  if (
    lowered.includes('timeout') ||
    lowered.includes('\u30bf\u30a4\u30e0\u30a2\u30a6\u30c8')
  ) {
    return TIMEOUT_ERROR_MESSAGE
  }

  if (
    lowered.includes('failed to fetch') ||
    lowered.includes('networkerror') ||
    lowered.includes('network request failed') ||
    lowered.includes('fetch_failed') ||
    lowered.includes('load failed') ||
    lowered.includes('communication')
  ) {
    return NETWORK_ERROR_MESSAGE
  }

  if (
    lowered.includes('stripe') ||
    lowered.includes('\u6c7a\u6e08')
  ) {
    return PAYMENT_ERROR_MESSAGE
  }

  if (
    lowered.includes('invalid request') ||
    lowered.includes('\u4e0d\u6b63\u306a\u30d7\u30e9\u30f3') ||
    lowered.includes('invalid plan') ||
    lowered.includes('prompt is too long') ||
    lowered.includes('negative prompt is too long') ||
    lowered.includes('cfg must be between')
  ) {
    return INPUT_ERROR_MESSAGE
  }

  if (
    lowered.includes('underage') ||
    lowered.includes('\u672a\u6210\u5e74') ||
    lowered.includes('\u3053\u306e\u7d20\u6750\u3067\u306f\u751f\u6210\u3067\u304d\u307e\u305b\u3093')
  ) {
    return CONTENT_BLOCKED_MESSAGE
  }

  if (
    lowered.includes('job not found') ||
    lowered.includes('jobid') ||
    lowered.includes('job id') ||
    lowered.includes('\u751f\u6210\u7d50\u679c\u3092\u53d6\u5f97\u3067\u304d\u307e\u305b\u3093')
  ) {
    return RESULT_FETCH_ERROR_MESSAGE
  }

  if (looksInternal(raw)) {
    return fallback
  }

  if (raw.length > 180 && (raw.includes('{') || raw.includes('[') || raw.includes(':'))) {
    return fallback
  }

  return raw
}

export const userFacingMessages = {
  generic: GENERIC_ERROR_MESSAGE,
  loginStart: LOGIN_START_ERROR_MESSAGE,
  loginRequired: LOGIN_REQUIRED_MESSAGE,
  tokenShortage: TOKEN_SHORTAGE_MESSAGE,
  network: NETWORK_ERROR_MESSAGE,
}
