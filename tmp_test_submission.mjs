import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const supabase = createClient(url, key)

const filePath = '/tmp/test-upload.pdf'
fs.writeFileSync(filePath, 'teste de upload')
const fileBuffer = fs.readFileSync(filePath)

const submissionPayload = {
  cliente: 'ALESC',
  campanha: '2026 - Demandas Bancadas Regionais - Fevereiro',
  numero_pi: '9999',
  tipo_veiculo: 'Portal',
  nome_veiculo: 'Portal Teste Exec',
  cidade: 'Xaxim',
  contato_nome: 'Teste',
  contato_email: 'teste@example.com',
  contato_telefone: '49999999999',
  status: 'pendente'
}

const { data: sub, error: subError } = await supabase.from('submissions').insert(submissionPayload).select().single()
console.log(JSON.stringify({ stage: 'submission', sub, subError }, null, 2))
if (subError || !sub) process.exit(1)

const storagePath = `${sub.cliente}/${sub.campanha}/${sub.numero_pi}/PI ${sub.numero_pi} - ${sub.nome_veiculo} - ${sub.cidade} - Nota Fiscal.pdf`
const { data: upData, error: upError } = await supabase.storage.from('documentos').upload(storagePath, fileBuffer, { upsert: true, contentType: 'application/pdf' })
console.log(JSON.stringify({ stage: 'upload', upData, upError }, null, 2))

const { data: docData, error: docError } = await supabase.from('documents').insert({
  submission_id: sub.id,
  doc_type: 'notaFiscal',
  doc_label: 'Nota Fiscal',
  file_name: `PI ${sub.numero_pi} - ${sub.nome_veiculo} - ${sub.cidade} - Nota Fiscal.pdf`,
  storage_path: storagePath
}).select().single()
console.log(JSON.stringify({ stage: 'document', docData, docError }, null, 2))
