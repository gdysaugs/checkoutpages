# checkoutpages

SparkHeart の購入専用サイトです。  
別ドメインで動かしつつ、Supabase は `sparkheart` と同じ project を共有します。

## 含まれる機能

- Google ログイン
- 保有トークン表示
- 24時間ごとのログインボーナス表示 / 受け取り
- Stripe Checkout への遷移
- 利用規約 / 特商法ページ

## 共有するもの

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

`user_tickets` / `ticket_events` / `daily_bonus` / `stripe purchase` の DB は `sparkheart` と共通です。

## 必要な設定

Cloudflare Pages:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

必要に応じて:

- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`
- `CORS_ALLOWED_ORIGINS`

## OAuth 注意点

Supabase Auth の Redirect URL 許可リストに、少なくとも次を追加してください。

- `https://checkoutpages.pages.dev`
- `https://checkoutpages.uk`
- `https://www.checkoutpages.uk`

## 開発

```bash
npm install
npm run build
```
