import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { SiteFooter } from '../components/SiteFooter'
import { TopNav } from '../components/TopNav'
import { isAuthConfigured, supabase } from '../lib/supabaseClient'
import { toUserFacingErrorMessage, userFacingMessages } from '../lib/userFacingError'
import './camera.css'
import './invader.css'

const getOAuthRedirectUrl = () => {
  if (typeof window === 'undefined') return undefined
  const url = new URL(window.location.href)
  url.searchParams.delete('code')
  url.searchParams.delete('state')
  url.hash = ''
  return url.toString()
}

type PlayState = 'idle' | 'loading' | 'playing' | 'won' | 'lost'

type Enemy = {
  x: number
  y: number
  alive: boolean
}

type Bullet = {
  x: number
  y: number
}

type GameData = {
  playerX: number
  enemies: Enemy[]
  bullets: Bullet[]
  enemyBullets: Bullet[]
  enemyDir: number
  enemyShootTimer: number
  score: number
  lives: number
  lastShotAt: number
  active: boolean
}

const formatTokenCount = (value: number | null) => `${value ?? 0}トークン`

const createEnemies = () => {
  const enemies: Enemy[] = []
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      enemies.push({ x: 160 + col * 72, y: 86 + row * 48, alive: true })
    }
  }
  return enemies
}

const createGameData = (): GameData => ({
  playerX: 480,
  enemies: createEnemies(),
  bullets: [],
  enemyBullets: [],
  enemyDir: 1,
  enemyShootTimer: 0,
  score: 0,
  lives: 3,
  lastShotAt: 0,
  active: true,
})

export function Invader() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const gameRef = useRef<GameData>(createGameData())
  const inputRef = useRef({ left: false, right: false, shoot: false })
  const finishRef = useRef<(next: 'won' | 'lost') => void>(() => undefined)

  const [session, setSession] = useState<Session | null>(null)
  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [authMessage, setAuthMessage] = useState('')
  const [ticketCount, setTicketCount] = useState<number | null>(null)
  const [ticketMessage, setTicketMessage] = useState('')
  const [playState, setPlayState] = useState<PlayState>('idle')
  const [playMessage, setPlayMessage] = useState('1トークンで1回プレイできます。')

  const accessToken = session?.access_token ?? ''

  const fetchTickets = useCallback(async (token: string) => {
    if (!token) return
    setTicketMessage('')
    const res = await fetch('/api/tickets', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setTicketCount(null)
      setTicketMessage(toUserFacingErrorMessage(data?.error, 'トークンの取得に失敗しました。'))
      return
    }
    setTicketCount(Number(data?.tickets ?? 0))
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

  useEffect(() => {
    if (!session || !accessToken) {
      setTicketCount(null)
      return
    }
    void fetchTickets(accessToken)
  }, [accessToken, fetchTickets, session])

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
    setAuthMessage('認証URLの取得に失敗しました。')
  }

  const shoot = useCallback((now: number) => {
    const game = gameRef.current
    if (!game.active || now - game.lastShotAt < 260) return
    game.bullets.push({ x: game.playerX, y: 462 })
    game.lastShotAt = now
  }, [])

  const resetCanvas = useCallback(() => {
    gameRef.current = createGameData()
    setPlayMessage('1トークンで1回プレイできます。')
  }, [])

  const draw = useCallback((ctx: CanvasRenderingContext2D, game: GameData) => {
    ctx.clearRect(0, 0, 960, 540)
    ctx.fillStyle = '#050305'
    ctx.fillRect(0, 0, 960, 540)

    ctx.strokeStyle = 'rgba(216, 86, 140, 0.08)'
    ctx.lineWidth = 1
    for (let x = 0; x < 960; x += 48) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, 540)
      ctx.stroke()
    }
    for (let y = 0; y < 540; y += 48) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(960, y)
      ctx.stroke()
    }

    ctx.fillStyle = '#f7d7e4'
    ctx.font = '700 18px sans-serif'
    ctx.fillText(`SCORE ${game.score}`, 28, 36)
    ctx.fillText(`LIFE ${game.lives}`, 820, 36)

    ctx.fillStyle = '#f2e6eb'
    ctx.beginPath()
    ctx.moveTo(game.playerX, 452)
    ctx.lineTo(game.playerX - 28, 488)
    ctx.lineTo(game.playerX + 28, 488)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#d8568c'
    ctx.fillRect(game.playerX - 36, 488, 72, 10)

    for (const enemy of game.enemies) {
      if (!enemy.alive) continue
      ctx.fillStyle = '#d8568c'
      ctx.fillRect(enemy.x - 22, enemy.y - 14, 44, 26)
      ctx.fillStyle = '#050305'
      ctx.fillRect(enemy.x - 12, enemy.y - 5, 7, 7)
      ctx.fillRect(enemy.x + 5, enemy.y - 5, 7, 7)
      ctx.fillStyle = '#f8c6d9'
      ctx.fillRect(enemy.x - 28, enemy.y + 12, 16, 8)
      ctx.fillRect(enemy.x + 12, enemy.y + 12, 16, 8)
    }

    ctx.fillStyle = '#ffffff'
    for (const bullet of game.bullets) {
      ctx.fillRect(bullet.x - 3, bullet.y - 16, 6, 18)
    }

    ctx.fillStyle = '#ff8bb8'
    for (const bullet of game.enemyBullets) {
      ctx.fillRect(bullet.x - 4, bullet.y, 8, 18)
    }
  }, [])

  const update = useCallback(
    (dt: number, now: number) => {
      const game = gameRef.current
      if (!game.active) return

      if (inputRef.current.left) game.playerX -= 330 * dt
      if (inputRef.current.right) game.playerX += 330 * dt
      game.playerX = Math.max(44, Math.min(916, game.playerX))
      if (inputRef.current.shoot) shoot(now)

      game.bullets = game.bullets.map((bullet) => ({ ...bullet, y: bullet.y - 520 * dt })).filter((bullet) => bullet.y > 0)
      game.enemyBullets = game.enemyBullets
        .map((bullet) => ({ ...bullet, y: bullet.y + 260 * dt }))
        .filter((bullet) => bullet.y < 540)

      const aliveEnemies = game.enemies.filter((enemy) => enemy.alive)
      const speed = 34 + (36 - aliveEnemies.length) * 1.4
      let shouldDrop = false
      for (const enemy of aliveEnemies) {
        enemy.x += game.enemyDir * speed * dt
        if (enemy.x > 914 || enemy.x < 46) shouldDrop = true
      }
      if (shouldDrop) {
        game.enemyDir *= -1
        for (const enemy of aliveEnemies) enemy.y += 18
      }

      game.enemyShootTimer -= dt
      if (game.enemyShootTimer <= 0 && aliveEnemies.length > 0) {
        const shooter = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)]
        game.enemyBullets.push({ x: shooter.x, y: shooter.y + 18 })
        game.enemyShootTimer = 0.46 + Math.random() * 0.64
      }

      for (const bullet of game.bullets) {
        for (const enemy of aliveEnemies) {
          if (!enemy.alive) continue
          if (Math.abs(bullet.x - enemy.x) < 28 && Math.abs(bullet.y - enemy.y) < 24) {
            enemy.alive = false
            bullet.y = -20
            game.score += 100
          }
        }
      }
      game.bullets = game.bullets.filter((bullet) => bullet.y > 0)

      for (const bullet of game.enemyBullets) {
        if (Math.abs(bullet.x - game.playerX) < 34 && bullet.y > 452 && bullet.y < 504) {
          bullet.y = 560
          game.lives -= 1
          if (game.lives <= 0) {
            game.active = false
            finishRef.current('lost')
            return
          }
        }
      }

      if (game.enemies.every((enemy) => !enemy.alive)) {
        game.active = false
        finishRef.current('won')
        return
      }
      if (game.enemies.some((enemy) => enemy.alive && enemy.y > 420)) {
        game.active = false
        finishRef.current('lost')
      }
    },
    [shoot],
  )

  useEffect(() => {
    finishRef.current = (next) => {
      setPlayState(next)
      setPlayMessage(next === 'won' ? 'クリアしました。もう一度遊ぶには1トークンを使います。' : 'ゲームオーバー。もう一度遊ぶには1トークンを使います。')
      if (accessToken) void fetchTickets(accessToken)
    }
  }, [accessToken, fetchTickets])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let lastTime = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - lastTime) / 1000)
      lastTime = now
      if (playState === 'playing') {
        update(dt, now)
      }
      draw(ctx, gameRef.current)
      frameRef.current = window.requestAnimationFrame(loop)
    }

    frameRef.current = window.requestAnimationFrame(loop)
    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
    }
  }, [draw, playState, update])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') inputRef.current.left = true
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') inputRef.current.right = true
      if (event.key === ' ' || event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') {
        event.preventDefault()
        inputRef.current.shoot = true
      }
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') inputRef.current.left = false
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') inputRef.current.right = false
      if (event.key === ' ' || event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') inputRef.current.shoot = false
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const handleStart = async () => {
    if (!session || !accessToken) {
      setPlayMessage('プレイするにはログインしてください。')
      return
    }
    if (playState === 'loading' || playState === 'playing') return

    setPlayState('loading')
    setPlayMessage('トークンを確認しています...')

    const res = await fetch('/api/play', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setPlayState('idle')
      setPlayMessage(toUserFacingErrorMessage(data?.error, 'プレイ開始に失敗しました。'))
      if (res.status === 402) setTicketCount(0)
      return
    }

    setTicketCount(Number(data?.ticketsLeft ?? 0))
    resetCanvas()
    setPlayState('playing')
    setPlayMessage('矢印キーまたは画面ボタンで操作できます。')
  }

  const touchControl = (key: 'left' | 'right' | 'shoot', value: boolean) => {
    inputRef.current[key] = value
  }

  return (
    <div className="invader-page">
      <TopNav />
      <main className="invader-shell">
        <section className="invader-hero">
          <div className="invader-copy">
            <p className="invader-kicker">TOKEN GAME</p>
            <h1>トークンで遊ぶインベーダー</h1>
            <p>1トークンで1回プレイ。敵を撃ち落としてスコアを伸ばします。</p>
          </div>
          <div className="invader-status">
            <span>{session ? 'ログイン中' : 'ゲスト'}</span>
            <strong>{session ? formatTokenCount(ticketCount) : 'ログインしてください'}</strong>
          </div>
        </section>

        <section className="invader-board">
          <div className="invader-canvas-wrap">
            <canvas ref={canvasRef} width={960} height={540} aria-label="インベーダーゲーム" />
            {playState !== 'playing' && (
              <div className="invader-overlay">
                <p>{playState === 'won' ? 'CLEAR' : playState === 'lost' ? 'GAME OVER' : 'READY'}</p>
                <span>{playMessage}</span>
              </div>
            )}
          </div>

          <div className="invader-panel">
            <div>
              <p className="invader-kicker">PLAY</p>
              <h2>1回 1トークン</h2>
              <p className="invader-panel__text">開始ボタンを押した時点で1トークンを消費します。</p>
            </div>

            {session ? (
              <button
                type="button"
                className="invader-button invader-button--primary"
                onClick={handleStart}
                disabled={playState === 'loading' || playState === 'playing'}
              >
                {playState === 'loading' ? '確認中...' : playState === 'playing' ? 'プレイ中' : '1トークンで開始'}
              </button>
            ) : (
              <button
                type="button"
                className="invader-button invader-button--primary"
                onClick={handleGoogleSignIn}
                disabled={authStatus === 'loading'}
              >
                {authStatus === 'loading' ? 'ログイン中...' : 'Googleでログイン'}
              </button>
            )}

            <Link className="invader-button invader-button--ghost" to="/purchage">
              トークンを購入
            </Link>

            {(authMessage || ticketMessage) && (
              <p className="invader-message invader-message--error">{authMessage || ticketMessage}</p>
            )}
            {playMessage && <p className="invader-message">{playMessage}</p>}
          </div>
        </section>

        <section className="invader-controls" aria-label="ゲーム操作">
          <button
            type="button"
            onPointerDown={() => touchControl('left', true)}
            onPointerUp={() => touchControl('left', false)}
            onPointerLeave={() => touchControl('left', false)}
          >
            ←
          </button>
          <button
            type="button"
            onPointerDown={() => touchControl('shoot', true)}
            onPointerUp={() => touchControl('shoot', false)}
            onPointerLeave={() => touchControl('shoot', false)}
          >
            SHOOT
          </button>
          <button
            type="button"
            onPointerDown={() => touchControl('right', true)}
            onPointerUp={() => touchControl('right', false)}
            onPointerLeave={() => touchControl('right', false)}
          >
            →
          </button>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
