export type PurchasePlan = {
  id: string
  label: string
  price: number
  tickets: number
  priceId: string
}

export const PURCHASE_PLANS: PurchasePlan[] = [
  { id: 'plan1', label: 'プラン 1', price: 480, tickets: 30, priceId: 'price_1TQHacALU0WO3UpeDfbtdmME' },
  { id: 'plan2', label: 'プラン 2', price: 1550, tickets: 100, priceId: 'price_1TQHaqALU0WO3Uped9KXpkn7' },
  { id: 'plan3', label: 'プラン 3', price: 3750, tickets: 250, priceId: 'price_1TQHb8ALU0WO3UpehLwhhUNR' },
  { id: 'plan4', label: 'プラン 4', price: 10150, tickets: 700, priceId: 'price_1TQHbUALU0WO3UpeQpDRNFUO' },
  { id: 'plan5', label: 'プラン 5', price: 29400, tickets: 2100, priceId: 'price_1TQHblALU0WO3UpeYhHH8WRB' },
]
