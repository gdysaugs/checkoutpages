import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isAuthConfigured, supabase } from '../lib/supabaseClient'
import { PURCHASE_PLANS } from '../lib/purchasePlans'
import { toUserFacingErrorMessage, userFacingMessages } from '../lib/userFacingError'
import { TopNav } from '../components/TopNav'
import './camera.css'
import './purchase.css'

const OAUTH_REDIRECT_URL =
  import.meta.env.VITE_SUPABASE_REDIRECT_URL ?? (typeof window !== 'undefined' ? window.location.origin : undefined)
const DAILY_BONUS_AMOUNT = 1

const PLAN_COPY: Record<string, { title: string; note: string }> = {
  trial: { title: 'ライト', note: 'まず試したい方向け' },
  value: { title: 'スタンダード', note: '一番使いやすい標準量' },
  mega: { title: 'ヘビー', note: 'まとめて使う方向け' },
}

const formatRemaining = (targetIso: string | null) => {
  if (!targetIso) return ''
  const target = new Date(targetIso).getTime()
  if (!Number.isFinite(target)) return ''
  const diff = target - Date.now()
  if (diff <= 0) return ''
  const hours = Math.floor(diff / 3_600_000)
  const minutes = Math.floor((diff % 3_600_000) / 60_000)
  return `${hours}時間${minutes.toString().padStart(2, '0')}分`
}

const formatTokenCount = (value: number) => `${value}トークン`

const normalizeErrorMessage = (value: unknown) => toUserFacingErrorMessage(value, userFacingMessages.generic)

export function Purchase() {
  const [session, setSession] = useState<Session | null>(null)
  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [authMessage, setAuthMessage] = useState('')
  const [ticketCount, setTicketCount] = useState<number | null>(null)
  const [ticketStatus, setTicketStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [ticketMessage, setTicketMessage] = useState('')
  const [purchaseStatus, setPurchaseStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [purchaseMessage, setPurchaseMessage] = useState('')
  const [dailyClaimStatus, setDailyClaimStatus] = useState<string | null>(null)
  const [dailyNextEligibleAt, setDailyNextEligibleAt] = useState<string | null>(null)
  const [dailyCanClaim, setDailyCanClaim] = useState(false)
  const [dailyCountdown, setDailyCountdown] = useState('')
  const [isLoadingDailyStatus, setIsLoadingDailyStatus] = useState(false)
  const [isClaimingDaily, setIsClaimingDaily] = useState(false)

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
      setTicketMessage(toUserFacingErrorMessage(data?.error, 'トークンの取得に失敗しました。'))
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
      setDailyCanClaim(false)
      setDailyNextEligibleAt(null)
      setDailyCountdown('')
      return
    }
    void fetchTickets(accessToken)
  }, [accessToken, fetchTickets, session])

  const fetchDailyBonusStatus = useCallback(async (token: string) => {
    if (!token) return
    setIsLoadingDailyStatus(true)
    try {
      const res = await fetch('/api/daily-bonus', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDailyCanClaim(false)
        setDailyNextEligibleAt(null)
        setDailyCountdown('')
        return
      }
      const canClaim = Boolean(data?.can_claim)
      const nextEligibleAt = data?.next_eligible_at ? String(data.next_eligible_at) : null
      setDailyCanClaim(canClaim)
      setDailyNextEligibleAt(nextEligibleAt)
      if (!canClaim && nextEligibleAt) {
        setDailyCountdown(formatRemaining(nextEligibleAt))
      } else {
        setDailyCountdown('')
      }
    } finally {
      setIsLoadingDailyStatus(false)
    }
  }, [])

  useEffect(() => {
    if (!session || !accessToken) return
    void fetchDailyBonusStatus(accessToken)
  }, [accessToken, fetchDailyBonusStatus, session])

  useEffect(() => {
    if (!dailyNextEligibleAt || dailyCanClaim) {
      setDailyCountdown('')
      return
    }
    let didRefresh = false
    const update = () => {
      const remain = formatRemaining(dailyNextEligibleAt)
      setDailyCountdown(remain)
      if (!remain && !didRefresh && accessToken) {
        didRefresh = true
        void fetchDailyBonusStatus(accessToken)
      }
    }
    update()
    const timer = window.setInterval(update, 15_000)
    return () => window.clearInterval(timer)
  }, [accessToken, dailyCanClaim, dailyNextEligibleAt, fetchDailyBonusStatus])

  const dailyStatusText = isLoadingDailyStatus
    ? '確認中...'
    : dailyCanClaim
      ? '受け取り可能'
      : dailyCountdown
        ? `次回ログインボーナスまで ${dailyCountdown}`
        : '次回待ち'

  const handleGoogleSignIn = async () => {
    if (!supabase || !isAuthConfigured) {
      setAuthStatus('error')
      setAuthMessage('認証設定が見つかりません。')
      return
    }
    setAuthStatus('loading')
    setAuthMessage('')
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: OAUTH_REDIRECT_URL, skipBrowserRedirect: true },
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
    setAuthMessage('認証URLの取得に失敗しました。')
  }

  const handleSignOut = async () => {
    if (!supabase) return
    try {
      await supabase.auth.signOut({ scope: 'local' })
      window.location.assign('/')
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
      setPurchaseMessage(toUserFacingErrorMessage(data?.error, '決済ページの準備に失敗しました。'))
      return
    }
    window.location.assign(data.url)
  }

  const handleClaimDaily = async () => {
    if (!accessToken || !session) {
      setDailyClaimStatus('ログインしてください。')
      return
    }
    if (isClaimingDaily) return
    setIsClaimingDaily(true)
    setDailyClaimStatus(null)
    try {
      const res = await fetch('/api/daily-bonus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message = normalizeErrorMessage(data?.error ?? data?.message ?? data?.detail)
        setDailyClaimStatus(message)
        window.alert(message)
        return
      }
      if (data?.granted) {
        setDailyClaimStatus(`${formatTokenCount(DAILY_BONUS_AMOUNT)} を追加しました。`)
        void fetchTickets(accessToken)
        setDailyCanClaim(false)
        setDailyNextEligibleAt(data?.next_eligible_at ? String(data.next_eligible_at) : null)
      } else {
        const reason = data?.reason
        if (reason === 'cooldown' || reason === 'not_eligible_yet') {
          const remain = formatRemaining(data?.next_eligible_at ?? null)
          setDailyClaimStatus(remain ? `次回ログインボーナスまで ${remain}` : 'まだ受け取れません。')
          setDailyCanClaim(false)
          setDailyNextEligibleAt(data?.next_eligible_at ? String(data.next_eligible_at) : null)
        } else {
          setDailyClaimStatus('まだ受け取れません。')
        }
      }
    } catch (error) {
      const message = normalizeErrorMessage(error)
      setDailyClaimStatus(message)
      window.alert(message)
    } finally {
      setIsClaimingDaily(false)
      void fetchDailyBonusStatus(accessToken)
    }
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
                <div className="purchase-account__row">
                  <span>ログインボーナス</span>
                  <strong>{dailyStatusText}</strong>
                </div>
              </div>
            ) : (
              <div className="purchase-auth-empty">
                <p>購入とボーナス受け取りには Google ログインが必要です。</p>
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

            {authMessage && <p className="purchase-message purchase-message--error">{authMessage}</p>}
            {session && ticketStatus === 'error' && ticketMessage && (
              <p className="purchase-message purchase-message--error">{ticketMessage}</p>
            )}

            {session && (
              <div className="purchase-daily">
                <div className="purchase-daily__head">
                  <div>
                    <p className="purchase-panel__eyebrow">LOGIN BONUS</p>
                    <h3>{`${formatTokenCount(DAILY_BONUS_AMOUNT)} を24時間ごとに受け取る`}</h3>
                  </div>
                  <span className={`purchase-chip purchase-chip--bonus${dailyCanClaim ? ' is-ready' : ''}`}>{dailyStatusText}</span>
                </div>
                <div className="purchase-daily__actions">
                  <button
                    type="button"
                    className="purchase-button purchase-button--primary"
                    onClick={handleClaimDaily}
                    disabled={isClaimingDaily || isLoadingDailyStatus || !dailyCanClaim}
                  >
                    {isClaimingDaily ? '受け取り中...' : isLoadingDailyStatus ? '確認中...' : dailyCanClaim ? '受け取る' : '受け取り待ち'}
                  </button>
                  <button type="button" className="purchase-button purchase-button--ghost" onClick={handleSignOut}>
                    ログアウト
                  </button>
                </div>
                {dailyClaimStatus && <p className="purchase-message">{dailyClaimStatus}</p>}
              </div>
            )}
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
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
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
                      {isBestValue && <span className="purchase-plan__badge">おすすめ</span>}
                    </div>
                    <div className="purchase-plan__points">
                      <strong>{plan.tickets}</strong>
                      <span>トークン</span>
                    </div>
                    <div className="purchase-plan__meta">
                      <div className="purchase-plan__price">¥{plan.price.toLocaleString()}</div>
                      <div className="purchase-plan__unit">1トークン あたり ¥{unitPriceDisplay}</div>
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

            {!session && <p className="purchase-message">購入前にログインしてください。</p>}
            {purchaseMessage && (
              <p className={`purchase-message${purchaseStatus === 'error' ? ' purchase-message--error' : ''}`}>{purchaseMessage}</p>
            )}
          </article>
        </section>
      </main>
    </div>
  )
}
