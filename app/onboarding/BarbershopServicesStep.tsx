'use client'

import { Button } from '@/components/ui/button'
import { fr } from '@/lib/barbershop-fr'
import { STARTER_SERVICES, isValidChoice, type StarterChoice, type StarterKey } from '@/lib/barbershop-onboarding'

const S = fr.onboarding

type StarterState = Record<StarterKey, { on: boolean; price: string; duration: string }>

export function initialStarterState(): StarterState {
  return Object.fromEntries(
    STARTER_SERVICES.map((s) => [s.key, { on: s.preselected, price: String(s.price), duration: String(s.duration) }]),
  ) as StarterState
}

export function toStarterChoices(state: StarterState): StarterChoice[] {
  return STARTER_SERVICES.filter((s) => state[s.key].on).map((s) => ({
    key: s.key,
    price: Number(state[s.key].price.replace(',', '.')),
    duration: Number(state[s.key].duration),
  }))
}

interface Props {
  starters: StarterState
  onStartersChange: (next: StarterState) => void
  sellsProducts: boolean
  onSellsProductsChange: (next: boolean) => void
  onBack: () => void
  onSkip: () => void
  onContinue: () => void
}

const inputClass = 'w-full mt-1 min-h-[48px] border border-gray-200 rounded-lg px-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500'

export function BarbershopServicesStep({
  starters, onStartersChange, sellsProducts, onSellsProductsChange, onBack, onSkip, onContinue,
}: Props) {
  const choices = toStarterChoices(starters)
  const canContinue = choices.length > 0 && choices.every(isValidChoice)

  function patch(key: StarterKey, value: Partial<StarterState[StarterKey]>) {
    onStartersChange({ ...starters, [key]: { ...starters[key], ...value } })
  }

  return (
    <div lang="fr">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">{S.heading}</h2>
      <p className="text-sm text-gray-500 mb-4">{S.subheading}</p>

      <div className="space-y-2">
        {STARTER_SERVICES.map((s) => (
          <div key={s.key} className={`rounded-xl border px-3 ${starters[s.key].on ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
            <label className="flex items-center gap-3 min-h-[48px] text-sm font-medium text-gray-900">
              <input type="checkbox" className="w-5 h-5" checked={starters[s.key].on}
                onChange={(e) => patch(s.key, { on: e.target.checked })} />
              {s.name}
            </label>
            {starters[s.key].on && (
              <div className="grid grid-cols-2 gap-3 pb-3">
                <label className="text-xs font-medium text-gray-500">
                  {S.price}
                  <input type="text" inputMode="decimal" value={starters[s.key].price} className={inputClass}
                    onChange={(e) => patch(s.key, { price: e.target.value })} />
                </label>
                <label className="text-xs font-medium text-gray-500">
                  {S.duration}
                  <input type="number" inputMode="numeric" min={5} step={5} value={starters[s.key].duration} className={inputClass}
                    onChange={(e) => patch(s.key, { duration: e.target.value })} />
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      <label className="flex items-start gap-3 mt-5 pt-4 border-t border-gray-100">
        <input type="checkbox" className="w-5 h-5 mt-0.5" checked={sellsProducts}
          onChange={(e) => onSellsProductsChange(e.target.checked)} />
        <span>
          <span className="block text-sm font-medium text-gray-900">{S.products}</span>
          <span className="block text-xs text-gray-500">{S.productsHint}</span>
        </span>
      </label>
      <p className="mt-3 text-xs text-gray-500">{S.hours}</p>

      <div className="flex gap-3 mt-6">
        <Button variant="outline" onClick={onBack}>{S.back}</Button>
        <Button variant="ghost" onClick={onSkip}>{S.skip}</Button>
        <Button className="flex-1" onClick={onContinue} disabled={!canContinue}>{S.next}</Button>
      </div>
    </div>
  )
}
