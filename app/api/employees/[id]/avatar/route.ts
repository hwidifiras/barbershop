import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getBusinessForOwner } from '@/lib/business'

// Barber photo upload (barbershop mode, docs/barbershop-mode/SPEC.md 4.7 / 8).
// Same storage convention as the business logo (app/api/business/logo/route.ts): files go in the
// public `logos` bucket, under <businessId>/barbers/. The owner must own the employee's business.

const BUCKET = 'logos'
const ALLOWED_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
const MAX_SIZE = 2 * 1024 * 1024 // 2 MB

function keyFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const i = url.indexOf(marker)
  if (i === -1) return null
  const key = url.slice(i + marker.length)
  return key.length > 0 ? key : null
}

async function authorize(employeeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const

  const business = await getBusinessForOwner(user.id)
  if (!business) return { error: NextResponse.json({ error: 'Business not found' }, { status: 404 }) } as const

  const { data: employee } = await supabase
    .from('employees')
    .select('id, avatar_url')
    .eq('id', employeeId)
    .eq('business_id', business.id)
    .maybeSingle()
  if (!employee) return { error: NextResponse.json({ error: 'Employee not found' }, { status: 404 }) } as const

  return { supabase, business, employee } as const
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const auth = await authorize(id)
    if ('error' in auth) return auth.error
    const { supabase, business, employee } = auth

    let formData: FormData
    try { formData = await req.formData() } catch { return NextResponse.json({ error: 'Invalid form data' }, { status: 400 }) }

    const file = formData.get('photo')
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided (field name must be "photo")' }, { status: 400 })

    const ext = ALLOWED_TYPES[file.type]
    if (!ext) return NextResponse.json({ error: 'Invalid file type. Allowed: PNG, JPG, WebP' }, { status: 400 })
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large. Maximum size is 2MB' }, { status: 400 })

    const admin = createServiceClient()
    const key = `${business.id}/barbers/${employee.id}-${Date.now()}.${ext}`
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(key, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true })
    if (uploadError) {
      console.error('[employees/avatar POST] storage upload error:', uploadError.message)
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
    }

    const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(key)
    const { error: updateError } = await supabase.from('employees').update({ avatar_url: publicUrl }).eq('id', employee.id)
    if (updateError) {
      console.error('[employees/avatar POST] employees update error:', updateError.message)
      return NextResponse.json({ error: 'Could not save the photo' }, { status: 500 })
    }

    if (employee.avatar_url) {
      const oldKey = keyFromPublicUrl(employee.avatar_url)
      if (oldKey && oldKey !== key) await admin.storage.from(BUCKET).remove([oldKey]).catch(() => {})
    }
    return NextResponse.json({ avatar_url: publicUrl })
  } catch (err) {
    console.error('[employees/avatar POST] unexpected error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const auth = await authorize(id)
    if ('error' in auth) return auth.error
    const { supabase, employee } = auth

    const { error } = await supabase.from('employees').update({ avatar_url: null }).eq('id', employee.id)
    if (error) return NextResponse.json({ error: 'Could not remove the photo' }, { status: 500 })

    if (employee.avatar_url) {
      const oldKey = keyFromPublicUrl(employee.avatar_url)
      if (oldKey) await createServiceClient().storage.from(BUCKET).remove([oldKey]).catch(() => {})
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[employees/avatar DELETE] unexpected error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
