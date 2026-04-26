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
            本表記は、当サイトで提供するトークン購入およびデジタルサービスの提供条件を、特定商取引法に基づいて記載したものです。
            ご購入前に、販売条件、支払方法、提供時期、キャンセル条件などを必ずご確認ください。
          </p>

          <div className="legal-table">
            <div className="legal-row">
              <div className="legal-key">販売事業者</div>
              <div className="legal-value">加藤拓巳</div>
            </div>
            <div className="legal-row">
              <div className="legal-key">運営責任者</div>
              <div className="legal-value">加藤拓巳</div>
            </div>
            <div className="legal-row">
              <div className="legal-key">所在地</div>
              <div className="legal-value">愛知県一宮市今伊勢町本神戸472-1</div>
            </div>
            <div className="legal-row">
              <div className="legal-key">電話番号</div>
              <div className="legal-value">09041570958</div>
            </div>
            <div className="legal-row">
              <div className="legal-key">問い合わせ先</div>
              <div className="legal-value">
                お問い合わせは、サイト内で案内する連絡手段または上記電話番号にて受け付けます。
                内容確認後、順次対応します。
              </div>
            </div>
            <div className="legal-row">
              <div className="legal-key">販売URL</div>
              <div className="legal-value">https://checkoutpages.uk/</div>
            </div>
            <div className="legal-row">
              <div className="legal-key">販売商品</div>
              <div className="legal-value">
                サイト内で利用できるデジタルトークンを販売します。購入したトークンは、当サイト上の対象機能やサービス利用時に消費されます。
              </div>
            </div>
            <div className="legal-row">
              <div className="legal-key">販売価格</div>
              <div className="legal-value">
                各商品ごとに購入ページへ表示します。表示価格は消費税込みです。
              </div>
            </div>
            <div className="legal-row">
              <div className="legal-key">商品代金以外の必要料金</div>
              <div className="legal-value">
                インターネット接続に必要な通信料金、プロバイダ料金、端末利用料などはお客様負担です。
                決済会社やカード会社の契約内容により、別途手数料等が発生する場合があります。
              </div>
            </div>
            <div className="legal-row">
              <div className="legal-key">支払方法</div>
              <div className="legal-value">
                クレジットカード決済を予定しています。実際に利用可能な決済方法は、購入手続き画面に表示される内容に従います。
              </div>
            </div>
            <div className="legal-row">
              <div className="legal-key">支払時期</div>
              <div className="legal-value">
                ご注文手続き完了時点で決済処理を行います。請求日や引き落とし日は、ご利用の決済会社またはカード会社の規約に従います。
              </div>
            </div>
            <div className="legal-row">
              <div className="legal-key">商品の提供時期</div>
              <div className="legal-value">
                決済完了後、通常は直ちにアカウントへ反映され、利用可能となります。
                ただし、システムメンテナンス、通信障害、外部決済基盤や認証基盤の障害等により、反映まで時間を要する場合があります。
              </div>
            </div>
            <div className="legal-row">
              <div className="legal-key">販売数量の制限</div>
              <div className="legal-value">
                不正利用防止、決済上限、システム都合その他の理由により、1回あたりまたは一定期間あたりの購入数量を制限する場合があります。
              </div>
            </div>
            <div className="legal-row">
              <div className="legal-key">返品・交換・キャンセル</div>
              <div className="legal-value">
                デジタル商品の性質上、購入手続き完了後の返品、交換、キャンセルは原則として受け付けていません。
                内容を十分にご確認のうえ、ご購入ください。
              </div>
            </div>
            <div className="legal-row">
              <div className="legal-key">返金について</div>
              <div className="legal-value">
                法令上返金義務がある場合または当方に明らかな不具合が認められる場合を除き、返金には対応していません。
                個別の返金可否は、利用状況、決済状況、障害内容等を確認のうえ判断します。
              </div>
            </div>
            <div className="legal-row">
              <div className="legal-key">サービス不具合時の対応</div>
              <div className="legal-value">
                反映遅延、重複決済、明らかなシステム不具合などが確認された場合は、調査のうえ必要に応じて補填、取消し、または個別対応を行います。
              </div>
            </div>
            <div className="legal-row">
              <div className="legal-key">動作環境</div>
              <div className="legal-value">
                最新の主要ブラウザ（Chrome、Edge、Safari 等）および安定したインターネット接続環境での利用を推奨します。
                すべての端末・ブラウザ環境での完全な動作を保証するものではありません。
              </div>
            </div>
            <div className="legal-row">
              <div className="legal-key">特別条件</div>
              <div className="legal-value">
                キャンペーン、無料付与トークン、特典、提供内容、価格改定などの条件は、予告なく変更または終了する場合があります。
                最新の内容は当サイト上の表示を優先します。
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
