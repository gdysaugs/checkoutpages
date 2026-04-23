const createNonce = () => {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const buildHtmlCsp = (nonce: string) =>
  [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `script-src 'self' 'nonce-${nonce}' https://static.cloudflareinsights.com 'sha256-ayVAq9ZEAIH3BNUsyDnjgrBG5bfUdcT5JtWPplcHNOs=' 'sha256-u8cnqzOE/tHOznlnUFzEXI6TumrUaMAgdLYLH1tgG9w=' 'sha256-HyOTz7zt9QTrX5obsFZKkpUxoDLg+0TiMS+3ywj61BY='`,
    "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co wss://*.supabase.in https://cloudflareinsights.com https://*.cloudflareinsights.com https://static.cloudflareinsights.com",
  ].join('; ')

export const onRequest: PagesFunction = async ({ next }) => {
  const response = await next()
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html')) {
    return response
  }

  const nonce = createNonce()
  const headers = new Headers(response.headers)
  headers.set('Content-Security-Policy', buildHtmlCsp(nonce))

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
