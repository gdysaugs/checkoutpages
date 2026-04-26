import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { TopNav } from '../components/TopNav'
import { PURCHASE_PLANS } from '../lib/purchasePlans'
import { isAuthConfigured, supabase } from '../lib/supabaseClient'
import { toUserFacingErrorMessage, userFacingMessages } from '../lib/userFacingError'
import './camera.css'
import './purchase.css'

const getOAuthRedirectUrl = () => {
  if (typeof window === 'undefined') return undefined
  const url = new URL(window.location.href)
  url.searchParams.delete('code')
  url.searchParams.delete('state')
  url.hash = ''
  return url.toString()
}

const PLAN_COPY: Record<string, { title: string; note: string }> = {
  plan1: { title: 'プラン 1', note: '30トークン' },
  plan2: { title: 'プラン 2', note: '100トークン' },
  plan3: { title: 'プラン 3', note: '250トークン' },
  plan4: { title: 'プラン 4', note: '700トークン' },
  plan5: { title: 'プラン 5', note: '2100トークン' },
}

const formatTokenCount = (value: number) => `${value}トークン`

export function Purchase() {
  const [session, setSession] = useState<Session | null>(null)
  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [authMessage, setAuthMessage] = useState('')
  const [ticketCount, setTicketCount] = useState<number | null>(null)
  const [ticketStatus, setTicketStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [ticketMessage, setTicketMessage] = useState('')
  const [purchaseStatus, setPurchaseStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [purchaseMessage, setPurchaseMessage] = useState('')

  const accessToken = session?.access_token ?? ''
  const bestValuePlanId = useMemo(() => {
    if (!PURCHASE_PLANS.length) return null
    return [...PURCHASE_PLANS].sort((a, b) => a.price / a.tickets - b.price / b.tickets)[0]?.id ?? null
  }, [])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthStatus('idle')
      setAuthMessage('')
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase) return
    const hasCode = typeof window !== 'undefined' && window.location.search.includes('code=')
    const hasState = typeof window !== 'undefined' && window.location.search.includes('state=')
    if (!hasCode || !hasState) return
    supabase.auth.exchangeCodeForSession(window.location.href).then(({ error }) => {
      if (error) {
        setAuthStatus('error')
        setAuthMessage(toUserFacingErrorMessage(error, userFacingMessages.loginStart))
        return
      }
      const url = new URL(window.location.href)
      url.searchParams.delete('code')
      url.searchParams.delete('state')
      url.hash = ''
      window.history.replaceState({}, document.title, url.toString())
    })
  }, [])

  const fetchTickets = useCallback(async (token: string) => {
    if (!token) return
    setTicketStatus('loading')
    setTicketMessage('')
    const res = await fetch('/api/tickets', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setTicketStatus('error')
      setTicketMessage(toUserFacingErrorMessage(data?.error, 'トークン残高の取得に失敗しました。'))
      setTicketCount(null)
      return
    }
    setTicketStatus('idle')
    setTicketMessage('')
    setTicketCount(Number(data?.tickets ?? 0))
  }, [])

  useEffect(() => {
    if (!session || !accessToken) {
      setTicketCount(null)
      setTicketStatus('idle')
      setTicketMessage('')
      return
    }
    void fetchTickets(accessToken)
  }, [accessToken, fetchTickets, session])

  const handleGoogleSignIn = async () => {
    if (!supabase || !isAuthConfigured) {
      setAuthStatus('error')
      setAuthMessage('認証設定が未完了です。')
      return
    }

    setAuthStatus('loading')
    setAuthMessage('')

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getOAuthRedirectUrl(), skipBrowserRedirect: true },
    })

    if (error) {
      setAuthStatus('error')
      setAuthMessage(toUserFacingErrorMessage(error, userFacingMessages.loginStart))
      return
    }

    if (data?.url) {
      window.location.assign(data.url)
      return
    }

    setAuthStatus('error')
    setAuthMessage('ログイン URL の取得に失敗しました。')
  }

  const handleSignOut = async () => {
    if (!supabase) return
    try {
      await supabase.auth.signOut({ scope: 'local' })
      window.location.assign('/purchage')
    } catch (error) {
      setAuthStatus('error')
      setAuthMessage(toUserFacingErrorMessage(error, 'ログアウトに失敗しました。'))
    }
  }

  const handleCheckout = async (priceId: string) => {
    if (!session || !accessToken) {
      setPurchaseStatus('error')
      setPurchaseMessage('購入するにはログインが必要です。')
      return
    }

    setPurchaseStatus('loading')
    setPurchaseMessage('決済ページへ移動しています...')

    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ price_id: priceId }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.url) {
      setPurchaseStatus('error')
      setPurchaseMessage(toUserFacingErrorMessage(data?.error, '決済ページの起動に失敗しました。'))
      return
    }

    window.location.assign(data.url)
  }

  return (
    <div className="purchase-page">
      <TopNav />
      <main className="purchase-shell">
        <section className="purchase-grid">
          <article className="purchase-panel purchase-panel--account">
            <div className="purchase-panel__head">
              <div>
                <p className="purchase-panel__eyebrow">ACCOUNT</p>
                <h2>ログインとトークン</h2>
              </div>
              <span className={`purchase-chip${session ? ' is-live' : ''}`}>{session ? 'ログイン中' : 'ゲスト'}</span>
            </div>

            {session ? (
              <div className="purchase-account">
                <div className="purchase-account__row">
                  <span>メール</span>
                  <strong>{session.user.email}</strong>
                </div>
                <div className="purchase-account__row">
                  <span>保有トークン</span>
                  <strong>{ticketStatus === 'loading' ? '更新中...' : formatTokenCount(ticketCount ?? 0)}</strong>
                </div>
                <div className="purchase-account__actions">
                  <button type="button" className="purchase-button purchase-button--ghost" onClick={handleSignOut}>
                    ログアウト
                  </button>
                </div>
              </div>
            ) : (
              <div className="purchase-auth-empty">
                <p>購入するには Google ログインが必要です。</p>
                <button
                  type="button"
                  className="purchase-button purchase-button--primary"
                  onClick={handleGoogleSignIn}
                  disabled={authStatus === 'loading'}
                >
                  {authStatus === 'loading' ? 'ログイン中...' : 'Googleでログイン'}
                </button>
              </div>
            )}

            {authMessage ? <p className="purchase-message purchase-message--error">{authMessage}</p> : null}
            {session && ticketStatus === 'error' && ticketMessage ? (
              <p className="purchase-message purchase-message--error">{ticketMessage}</p>
            ) : null}
          </article>

          <article className="purchase-panel purchase-panel--plans">
            <div className="purchase-panel__head">
              <div>
                <p className="purchase-panel__eyebrow">PLANS</p>
                <h2>購入プラン</h2>
              </div>
            </div>

            <div className="purchase-plan-grid">
              {PURCHASE_PLANS.map((plan) => {
                const unitPrice = plan.price / plan.tickets
                const unitPriceDisplay = unitPrice.toLocaleString('ja-JP', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })
                const isBestValue = plan.id === bestValuePlanId
                const planCopy = PLAN_COPY[plan.id] ?? { title: plan.label, note: '' }

                return (
                  <article key={plan.id} className={`purchase-plan${isBestValue ? ' is-featured' : ''}`}>
                    <div className="purchase-plan__head">
                      <div>
                        <p className="purchase-plan__title">{planCopy.title}</p>
                        <p className="purchase-plan__note">{planCopy.note}</p>
                      </div>
                      {isBestValue ? <span className="purchase-plan__badge">おすすめ</span> : null}
                    </div>

                    <div className="purchase-plan__points">
                      <strong>{plan.tickets}</strong>
                      <span>トークン</span>
                    </div>

                    <div className="purchase-plan__meta">
                      <div className="purchase-plan__price">¥{plan.price.toLocaleString()}</div>
                      <div className="purchase-plan__unit">1トークン {unitPriceDisplay}円</div>
                    </div>

                    <button
                      type="button"
                      className="purchase-button purchase-button--buy"
                      onClick={() => handleCheckout(plan.priceId)}
                      disabled={!session || purchaseStatus === 'loading'}
                    >
                      {purchaseStatus === 'loading' ? '移動中...' : '購入に進む'}
                    </button>
                  </article>
                )
              })}
            </div>

            {!session ? <p className="purchase-message">購入前にログインしてください。</p> : null}
            {purchaseMessage ? (
              <p className={`purchase-message${purchaseStatus === 'error' ? ' purchase-message--error' : ''}`}>
                {purchaseMessage}
              </p>
            ) : null}
          </article>
        </section>
      </main>
    </div>
  )
}
