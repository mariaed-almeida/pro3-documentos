import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoPro3 from "@/assets/logo-pro3.png";

const PASSOS = [
  { n: "01", t: "Identifique o PI", d: "Cliente, campanha, número do PI e dados do veículo." },
  { n: "02", t: "Anexe os documentos", d: "A lista muda conforme o cliente e o regime tributário." },
  { n: "03", t: "Acompanhe a conferência", d: "Se faltar algo, você recebe por e-mail o que corrigir." },
];

const Index = () => (
  <div className="flex min-h-screen flex-col">
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
      <img src={logoPro3} alt="Pró3 Comunicação" className="h-10 w-auto" />
      <Link to="/operador/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
        Espaço de operações
      </Link>
    </header>

    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-12">
      <p className="eyebrow mb-4">Para veículos de mídia</p>
      <h1 className="max-w-3xl text-5xl leading-[1.05] sm:text-6xl">
        Envie os documentos do seu PI para faturamento.
      </h1>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
        Um único formulário para notas fiscais, certidões e comprovantes. Os arquivos chegam organizados e já nomeados
        para a conferência da Pró3.
      </p>
      <div className="mt-10">
        <Button asChild size="lg" className="h-12 px-7 text-base">
          <Link to="/veiculo">
            Iniciar envio <ArrowRight />
          </Link>
        </Button>
      </div>

      <ol className="mt-20 grid gap-8 border-t pt-8 sm:grid-cols-3">
        {PASSOS.map((p) => (
          <li key={p.n}>
            <span className="num font-serif text-sm text-primary">{p.n}</span>
            <h2 className="mt-2 font-serif text-xl">{p.t}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{p.d}</p>
          </li>
        ))}
      </ol>
    </main>

    <footer className="mx-auto w-full max-w-5xl px-6 py-6 text-xs text-muted-foreground">
      © {new Date().getFullYear()} Pró3 Comunicação Ltda.
    </footer>
  </div>
);

export default Index;
