import { SiteFooter } from '../components/SiteFooter'
import { TopNav } from '../components/TopNav'
import './camera.css'
import './legal.css'

export function Tokushoho() {
  return (
    <div className="camera-app">
      <TopNav />
      <main className="legal-shell">
        <section className="legal-card">
          <h1>特定商取引法に基づく表記</h1>
          <p>
            本表記は、当サイトで提供するトークン購入その他デジタルサービスに関する取引条件を、特定商取引法に基づいて
            表示するものです。ご利用前に内容をご確認ください。
          </p>

          <div className="legal-table">
            <div className="legal-row">
              <div className="legal-key">販売事業者</div>
              <div className="legal-value">要求があれば開示</div>
            </div>
            <div className="legal-row">
              <div className="legal-key">事業責任者</div>
              <div className="legal-value">要求があれば開示</div>
            </div>
            <div className="legal-row">
              <div className="legal-key">所在地</div>
              <div className="legal-value">要求があれば開示</div>
            </div>
            <div className="legal-row">
              <div className="legal-key">電話番号</div>
              <div className="legal-value">要求があれば開示</div>
            </div>
            <div className="legal-row">
              <div className="legal-key">お問い合わせ先</div>
              <div className="legal-value">
                お問い合わせはサイト内で案内する連絡手段から受け付けます。開示請求が必要な場合は、正当な請求に基づき遅滞なく対応します。
              </div>
            </div>
            <div className="legal-row">
              <div className="legal-key">販売URL</div>
              <div className="legal-value">https://checkoutpages.uk/</div>
            </div>
            <div className="legal-row">
              <div className="legal-key">販売価格</div>
              <div className="legal-value">
                各購入ページに表示された金額によります。表示価格は税込みです。
              </div>
            </div>
            <div className="legal-row">
              <div className="legal-key">商品代金以外の必要料金</div>
              <div className="legal-value">
                インターネット接続料金、通信料金、端末利用に伴う費用等は利用者の負担となります。
              </div>
            </div>
            <div className="legal-row">
              <div className="legal-key">支払方法</div>
              <div className="legal-value">
                クレジットカードその他、購入画面で表示する決済手段によりお支払いいただきます。
              </div>
            </div>
            <div className="legal-row">
              <div className="legal-key">支払時期</div>
              <div className="legal-value">
                購入手続完了時に決済が行われます。実際の引落時期は各決済事業者の定めによります。
              </div>
            </div>
            <div className="legal-row">
              <div className="legal-key">商品の提供時期</div>
              <div className="legal-value">
                決済完了後、通常は速やかに購入トークンを反映します。システム障害、通信障害、決済確認の遅延その他の事情により反映まで時間を要する場合があります。
              </div>
            </div>
            <div className="legal-row">
              <div className="legal-key">返品・キャンセル</div>
              <div className="legal-value">
                デジタル商品の性質上、法令上義務付けられる場合を除き、購入後の返品、返金、キャンセルは受け付けません。
              </div>
            </div>
            <div className="legal-row">
              <div className="legal-key">動作環境</div>
              <div className="legal-value">
                最新の主要ブラウザ環境での利用を推奨します。端末やブラウザの設定、通信環境により正常に動作しない場合があります。
              </div>
            </div>
            <div className="legal-row">
              <div className="legal-key">特別条件</div>
              <div className="legal-value">
                キャンペーン、無料付与、販売条件、提供内容等は、予告なく追加、変更、終了する場合があります。最新の条件は購入画面その他の表示をご確認ください。
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
