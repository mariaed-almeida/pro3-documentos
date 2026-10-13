import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Mail, Phone, Radio, Search } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import EmptyState from "@/components/app/EmptyState";
import { Input } from "@/components/ui/input";
import { useSubmissions } from "@/hooks/use-submissions";
import { formatDate } from "@/lib/format";

const norm = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const Veiculos = () => {
  const { data: submissions = [] } = useSubmissions();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";

  const veiculos = useMemo(() => {
    const map = new Map<string, typeof submissions>();
    for (const s of submissions) {
      const key = norm(`${s.nomeVeiculo}|${s.cidade}`);
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.values()]
      .map((envios) => {
        const ult = envios[0]; // a lista já vem do mais recente para o mais antigo
        return {
          nome: ult.nomeVeiculo,
          cidade: ult.cidade,
          tipo: ult.tipoVeiculo === "Outro" && ult.outroTipo ? ult.outroTipo : ult.tipoVeiculo,
          contato: ult.contatoNome,
          email: ult.contatoEmail,
          telefone: ult.contatoTelefone,
          envios: envios.length,
          devolvidos: envios.filter((e) => e.status === "em_revisao").length,
          ultimo: ult.dataEnvio,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [submissions]);

  const lista = veiculos.filter((v) => !q || norm(`${v.nome} ${v.cidade} ${v.contato}`).includes(norm(q)));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cadastros"
        title="Veículos"
        description="Fornecedores que já enviaram documentos, reunidos a partir dos envios. O contato é o do último PI recebido."
      />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
          placeholder="Buscar veículo, cidade ou contato"
          className="pl-9"
          aria-label="Buscar veículos"
        />
      </div>

      {lista.length === 0 ? (
        <EmptyState icon={Radio} title="Nenhum veículo encontrado" description="Veículos aparecem aqui depois do primeiro envio." />
      ) : (
        <div className="overflow-hidden rounded-md border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="eyebrow px-4 py-2.5">Veículo</th>
                <th className="eyebrow hidden px-4 py-2.5 md:table-cell">Contato</th>
                <th className="eyebrow px-4 py-2.5 text-right">Envios</th>
                <th className="eyebrow hidden px-4 py-2.5 text-right sm:table-cell">Devolvidos</th>
                <th className="eyebrow hidden px-4 py-2.5 text-right lg:table-cell">Último envio</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lista.map((v) => (
                <tr key={`${v.nome}${v.cidade}`} className="align-top hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <Link to={`/app/documentos?q=${encodeURIComponent(v.nome)}`} className="font-medium hover:text-primary">
                      {v.nome}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {v.tipo}
                      {v.cidade && ` · ${v.cidade}`}
                    </p>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <p>{v.contato}</p>
                    <p className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <a href={`mailto:${v.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                        <Mail className="h-3 w-3" />
                        {v.email}
                      </a>
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {v.telefone}
                      </span>
                    </p>
                  </td>
                  <td className="num px-4 py-3 text-right">{v.envios}</td>
                  <td className="num hidden px-4 py-3 text-right sm:table-cell">
                    {v.devolvidos > 0 ? (
                      <span className="text-warning">{v.devolvidos}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="num hidden px-4 py-3 text-right text-muted-foreground lg:table-cell">
                    {formatDate(v.ultimo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Veiculos;
