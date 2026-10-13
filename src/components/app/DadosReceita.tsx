import { useState } from "react";
import { enderecoLinha, formatarCnae } from "@/lib/cnpj";
import { formatBRL } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Socio } from "@/hooks/use-clientes";

export interface ViewReceita {
  razaoSocial: string | null;
  nomeFantasia: string | null;
  situacao: string | null;
  dataSituacao: string | null;
  dataAbertura: string | null;
  naturezaJuridica: string | null;
  porte: string | null;
  cnaePrincipal: string | null;
  cnaesSecundarios: string[];
  capitalSocial: number | null;
  optanteSimples: boolean | null;
  endereco: Parameters<typeof enderecoLinha>[0];
  telefone: string | null;
  email: string | null;
  socios: Socio[];
}

const Linha = ({ rotulo, children }: { rotulo: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[8.5rem_1fr] gap-x-4 py-2 text-sm">
    <dt className="text-muted-foreground">{rotulo}</dt>
    <dd className="min-w-0 break-words">{children}</dd>
  </div>
);

const DadosReceita = ({ d, fonte, consultadoEm }: { d: ViewReceita; fonte?: string; consultadoEm?: string | null }) => {
  const [verCnaes, setVerCnaes] = useState(false);
  const ativa = !d.situacao || d.situacao.toUpperCase() === "ATIVA";
  const endereco = enderecoLinha(d.endereco);

  return (
    <div>
      <dl className="divide-y border-y">
        <Linha rotulo="Razão social">{d.razaoSocial || "—"}</Linha>
        {d.nomeFantasia && <Linha rotulo="Nome fantasia">{d.nomeFantasia}</Linha>}
        <Linha rotulo="Situação">
          <span className={cn(!ativa && "font-medium text-destructive")}>{d.situacao || "—"}</span>
          {d.dataSituacao && <span className="num text-muted-foreground"> desde {formatDate(d.dataSituacao)}</span>}
        </Linha>
        {d.dataAbertura && <Linha rotulo="Abertura"><span className="num">{formatDate(d.dataAbertura)}</span></Linha>}
        {d.naturezaJuridica && <Linha rotulo="Natureza jurídica">{d.naturezaJuridica}</Linha>}
        {d.porte && <Linha rotulo="Porte">{d.porte}</Linha>}
        {d.capitalSocial !== null && <Linha rotulo="Capital social"><span className="num">{formatBRL(d.capitalSocial)}</span></Linha>}
        {d.optanteSimples !== null && <Linha rotulo="Simples Nacional">{d.optanteSimples ? "Optante" : "Não optante"}</Linha>}
        {d.cnaePrincipal && (
          <Linha rotulo="Atividade principal">
            <span className="num">{formatarCnae(d.cnaePrincipal)}</span>
          </Linha>
        )}
        {d.cnaesSecundarios.length > 0 && (
          <Linha rotulo="Atividades secundárias">
            <button type="button" onClick={() => setVerCnaes((v) => !v)} className="text-xs font-medium text-primary hover:underline" aria-expanded={verCnaes}>
              {verCnaes ? "Ocultar" : `Ver ${d.cnaesSecundarios.length}`}
            </button>
            {verCnaes && (
              <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                {d.cnaesSecundarios.map((c) => <li key={c} className="num">{formatarCnae(c)}</li>)}
              </ul>
            )}
          </Linha>
        )}
        {endereco && <Linha rotulo="Endereço">{endereco}</Linha>}
        {d.telefone && <Linha rotulo="Telefone"><span className="num">{d.telefone}</span></Linha>}
        {d.email && <Linha rotulo="E-mail">{d.email}</Linha>}
        {d.socios.length > 0 && (
          <Linha rotulo="Quadro societário">
            <ul className="space-y-0.5">
              {d.socios.map((s) => (
                <li key={s.nome}>
                  {s.nome}
                  {s.qualificacao && <span className="text-xs text-muted-foreground"> · {s.qualificacao}</span>}
                </li>
              ))}
            </ul>
          </Linha>
        )}
      </dl>
      {(fonte || consultadoEm) && (
        <p className="mt-2 text-xs text-muted-foreground">
          {fonte && <>Fonte: {fonte}. </>}
          {consultadoEm && <>Consultado em {formatDate(consultadoEm)}.</>}
        </p>
      )}
      {!ativa && (
        <p className="mt-3 border-l-2 border-destructive/50 pl-3 text-sm text-destructive">
          Este CNPJ não está ativo na Receita Federal. Confirme antes de abrir campanhas para ele.
        </p>
      )}
    </div>
  );
};

export default DadosReceita;
