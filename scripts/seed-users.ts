// scripts/seed-users.ts
// Run locally: npx tsx scripts/seed-users.ts
// Requires SUPABASE_SERVICE_ROLE_KEY in your local .env — NEVER expose this key client-side or commit it.
import dns from 'dns'
dns.setDefaultResultOrder('ipv4first')

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SEED_USERS = [
  { email: 'admin@assetflow.test',      password: 'AssetFlow@2026', full_name: 'Ananya Rao',    role: 'admin' },
  { email: 'manager@assetflow.test',    password: 'AssetFlow@2026', full_name: 'Karan Mehta',   role: 'asset_manager' },
  { email: 'depthead@assetflow.test',   password: 'AssetFlow@2026', full_name: 'Priya Nair',    role: 'department_head', department_code: 'IT' },
  { email: 'employee@assetflow.test',   password: 'AssetFlow@2026', full_name: 'Rahul Verma',   role: 'employee', department_code: 'IT' },
]

async function run() {
  for (const u of SEED_USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
    })
    if (error) { console.error(`Failed: ${u.email}`, JSON.stringify(error, null, 2)); continue }

    let department_id: string | null = null
    if ('department_code' in u && u.department_code) {
      const { data: dept } = await supabase.from('departments').select('id').eq('code', u.department_code).single()
      department_id = dept?.id ?? null
    }

    await supabase.from('profiles').update({ role: u.role, department_id }).eq('id', data.user!.id)
    console.log(`Seeded ${u.role}: ${u.email} / ${u.password}`)
  }

  // Set IT department head now that the profile exists
  const { data: head } = await supabase.from('profiles').select('id').eq('email', 'depthead@assetflow.test').single()
  if (head) await supabase.from('departments').update({ head_id: head.id }).eq('code', 'IT')
}

run()
