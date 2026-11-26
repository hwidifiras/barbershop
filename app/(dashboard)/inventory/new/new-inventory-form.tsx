'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UnitSelect } from '../unit-select'
import { CategoryCombobox } from '../category-combobox'
import { useTranslations } from 'next-intl'
import { fr } from '@/lib/barbershop-fr'

interface Props {
  categories: string[]
  /** Barbershop mode: name, price and stock first; the rest behind "Avancé" (SPEC 4.6). */
  barbershop?: boolean
}

export function NewInventoryForm({ categories, barbershop = false }: Props) {
  const t = useTranslations('newInventoryItem')
  const router = useRouter()
  const [unit, setUnit] = useState('pcs')
  const [category, setCategory] = useState('')
  const [skuError, setSkuError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const advanced = barbershop ? (advancedOpen ? 'order-5' : 'order-5 hidden') : undefined
  // In barbershop mode the two-column wrappers dissolve so single fields can be reordered.
  const pair = barbershop ? 'contents' : 'grid grid-cols-2 gap-4'

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSkuError('')
    setSubmitting(true)
    const fd = new FormData(e.currentTarget)
    const res = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: fd.get('name'),
        sku: fd.get('sku'),
        category,
        unit,
        quantity: fd.get('quantity'),
        cost_price: fd.get('cost_price'),
        sell_price: fd.get('sell_price'),
        low_stock_threshold: fd.get('low_stock_threshold'),
      }),
    })
    if (res.status === 409) {
      const json = await res.json()
      if (json.error === 'sku_taken') { setSkuError(json.message); setAdvancedOpen(true) }
    } else if (res.ok) {
      const { id } = await res.json()
      router.push(`/inventory/${id}`)
      router.refresh()
    }
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className={barbershop ? 'flex flex-col gap-4' : 'space-y-4'}>
      <div className={barbershop ? 'order-1' : undefined}>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('fields.name')}</label>
        <input
          type="text"
          name="name"
          required
          placeholder={t('fields.namePlaceholder')}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className={pair}>
        <div className={advanced}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('fields.sku')}</label>
          <input
            type="text"
            name="sku"
            placeholder={t('fields.skuPlaceholder')}
            onChange={() => skuError && setSkuError('')}
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
              skuError ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-blue-500'
            }`}
          />
          {skuError && <p className="mt-1 text-xs text-red-500">{skuError}</p>}
        </div>
        <div className={advanced}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('fields.category')}</label>
          <CategoryCombobox
            value={category}
            onChange={setCategory}
            categories={categories}
            placeholder={t('fields.categoryPlaceholder')}
          />
        </div>
      </div>

      <div className={pair}>
        <div className={advanced}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('fields.unit')}</label>
          <UnitSelect value={unit} onChange={setUnit} />
        </div>
        <div className={barbershop ? 'order-3' : undefined}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('fields.quantity')}</label>
          <input
            type="number"
            name="quantity"
            min={0}
            defaultValue={0}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className={pair}>
        <div className={advanced}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('fields.costPrice')}</label>
          <input
            type="number"
            name="cost_price"
            min={0}
            step="0.01"
            placeholder="0.00"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className={barbershop ? 'order-2' : undefined}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('fields.sellPrice')}</label>
          <input
            type="number"
            name="sell_price"
            min={0}
            step="0.01"
            placeholder="0.00"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {barbershop && (
        <button type="button" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((open) => !open)}
          className="order-4 self-start min-h-[48px] text-sm font-medium text-gray-700 underline underline-offset-4">
          {advancedOpen ? fr.settingsPage.advancedHide : fr.settingsPage.advancedShow}
        </button>
      )}

      <div className={advanced}>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('fields.lowStockThreshold')}</label>
        <input
          type="number"
          name="low_stock_threshold"
          min={0}
          defaultValue={5}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className={barbershop ? 'order-6 flex gap-3 pt-2' : 'flex gap-3 pt-2'}>
        <Link
          href="/inventory"
          className="flex-1 text-center border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          {t('cancelButton')}
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
        >
          {submitting ? '…' : t('submitButton')}
        </button>
      </div>
    </form>
  )
}
