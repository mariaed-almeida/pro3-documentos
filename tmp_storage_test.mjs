import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY)
const buffer = Buffer.from('teste')
for (const [label, options] of Object.entries({
  no_upsert: { upsert: false, contentType: 'application/pdf' },
  with_upsert: { upsert: true, contentType: 'application/pdf' }
})) {
  const path = `ALESC/testes/${Date.now()}-${label}.pdf`
  const { data, error } = await supabase.storage.from('documentos').upload(path, buffer, options)
  console.log(label, JSON.stringify({ path, data, error }, null, 2))
}
