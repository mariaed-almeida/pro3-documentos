// Edge Function: analisar-documentacao
//
// Esta função é chamada SOMENTE quando o operador clica no botão "Analisar com IA"
// na tela de detalhe de um PI. Ela nunca é disparada automaticamente.
//
// O que faz: busca os documentos anexados a uma submission, gera links temporários
// de acesso, e pede para o modelo de IA (via Lovable AI Gateway) fazer 5 checagens
// objetivas. O resultado é salvo na coluna "analise_ia" da tabela submissions e
// devolvido para o frontend exibir como sugestão — nunca como decisão automática.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Texto fixo com o número do contrato/edital de cada cliente, usado na checagem 2.
// Quando novos clientes forem cadastrados no futuro, adicione aqui também.
const REFERENCIAS_CONTRATO: Record<string, string[]> = {
  "ALESC": ["Contrato nº 031/2023", "Edital nº 001/2022"],
  "Prefeitura de Chapecó": ["Contrato nº 371/2025", "Concorrência nº 186/2025"],
  "Prefeitura de Xanxerê": ["Processo Licitatório nº 0066/2025", "Concorrência nº 0001/2025", "Contrato nº 0180/2025"],
};

// Texto obrigatório específico de Xanxerê (checagem 5)
const TEXTO_OBRIGATORIO_XANXERE = "Documento emitido em nome do tomador do serviço aos cuidados da Agência Pro3 Comunicação";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { submissionId } = await req.json();
    if (!submissionId) {
      return new Response(
        JSON.stringify({ error: "submissionId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Usamos a service role aqui porque esta função roda no servidor (acionada pelo
    // operador autenticado) e precisa ler dados/arquivos que o RLS normalmente
    // restringiria para o público — isso é seguro porque só o operador chama esta função.
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: submission, error: subError } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", submissionId)
      .single();

    if (subError || !submission) {
      return new Response(
        JSON.stringify({ error: "Submission não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: documents, error: docsError } = await supabase
      .from("documents")
      .select("*")
      .eq("submission_id", submissionId);

    if (docsError || !documents || documents.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum documento encontrado para análise" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Geramos links temporários (1 hora) para os documentos relevantes às checagens:
    // Nota Fiscal, Nota Fiscal Gráfica e as 5 Certidões Negativas.
    const docsRelevantes = documents.filter((d: any) =>
      d.doc_type === "notaFiscal" || d.doc_type === "notaFiscalGrafica" || d.doc_type.startsWith("certidao")
    );

    const arquivosParaAnalise: { tipo: string; label: string; url: string }[] = [];
    for (const doc of docsRelevantes) {
      const { data: signed } = await supabase.storage
        .from("documentos")
        .createSignedUrl(doc.storage_path, 3600);
      if (signed?.signedUrl) {
        arquivosParaAnalise.push({ tipo: doc.doc_type, label: doc.doc_label, url: signed.signedUrl });
      }
    }

    if (arquivosParaAnalise.length === 0) {
      return new Response(
        JSON.stringify({ error: "Não foi possível gerar acesso aos arquivos para análise" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const referenciasContrato = REFERENCIAS_CONTRATO[submission.cliente] || [];
    const isXanxere = submission.cliente === "Prefeitura de Xanxerê";

    // Montamos o conteúdo multimodal: um texto de instrução + os PDFs como anexos.
    // O Lovable AI Gateway aceita PDFs via URL no formato de mensagem multimodal.
    const conteudoMensagem: any[] = [
      {
        type: "text",
        text: `Você é um assistente que ajuda um operador humano a revisar documentos fiscais de campanhas publicitárias de órgãos públicos brasileiros. Você NUNCA decide se um documento está aprovado ou rejeitado — você apenas sinaliza pontos que merecem atenção humana, sempre com cautela.

Dados do PI em análise:
- Número do PI: ${submission.numero_pi}
- Cliente: ${submission.cliente}
- Referências contratuais obrigatórias na Nota Fiscal: ${referenciasContrato.join(", ") || "nenhuma referência específica cadastrada"}
${isXanxere ? `- Texto obrigatório que deve constar na Nota Fiscal: "${TEXTO_OBRIGATORIO_XANXERE}"` : ""}

Documentos anexados para análise (anexados abaixo, na ordem listada):
${arquivosParaAnalise.map((a, i) => `${i + 1}. ${a.label} (tipo: ${a.tipo})`).join("\n")}

Faça as seguintes checagens objetivas, e APENAS estas:

1. O número do PI (${submission.numero_pi}) aparece no texto da Nota Fiscal?
2. As referências contratuais obrigatórias (${referenciasContrato.join(", ") || "N/A"}) aparecem no texto da Nota Fiscal?
3. As Certidões Negativas têm data de validade visível? Alguma já está vencida (considerando a data de hoje: ${new Date().toISOString().split("T")[0]})?
4. Algum arquivo parece estar no tipo de documento errado (ex: um boleto ou recibo anexado como Nota Fiscal)?
${isXanxere ? "5. O texto obrigatório de Xanxerê aparece literalmente na Nota Fiscal?" : ""}

Responda SOMENTE em JSON, no seguinte formato exato, sem nenhum texto antes ou depois:
{
  "achados": [
    { "checagem": "string curta identificando qual checagem", "resultado": "atencao" | "ok" | "nao_verificavel", "detalhe": "explicação breve em português, em tom de sugestão, nunca afirmando com certeza absoluta" }
  ]
}`,
      },
    ];

    for (const arquivo of arquivosParaAnalise) {
      conteudoMensagem.push({
        type: "file",
        file: { filename: arquivo.label, file_data: arquivo.url },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: conteudoMensagem }],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Erro no Lovable AI Gateway:", errText);
      return new Response(
        JSON.stringify({ error: "Falha ao chamar a IA", details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const textoResposta = aiData.choices?.[0]?.message?.content || "";

    let achados;
    try {
      // O modelo pode às vezes envolver o JSON em ```json — removemos isso por segurança.
      const limpo = textoResposta.replace(/```json\s*|```\s*/g, "").trim();
      achados = JSON.parse(limpo);
    } catch (parseErr) {
      console.error("Erro ao interpretar resposta da IA:", textoResposta);
      return new Response(
        JSON.stringify({ error: "A IA retornou um formato inesperado. Tente novamente." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const analiseCompleta = {
      geradoEm: new Date().toISOString(),
      ...achados,
    };

    // Salvamos o resultado para o operador ver mesmo se recarregar a página depois.
    await supabase
      .from("submissions")
      .update({ analise_ia: analiseCompleta })
      .eq("id", submissionId);

    return new Response(
      JSON.stringify({ success: true, analise: analiseCompleta }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro inesperado:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno ao processar a análise" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
