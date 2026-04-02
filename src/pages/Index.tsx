import { Link, useNavigate } from "react-router-dom";
import { FileText, Upload, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoPro3 from "@/assets/logo-pro3.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar with operator access */}
      <div className="flex justify-end px-6 py-3 relative z-50">
        <button
          type="button"
          onClick={() => navigate("/operador/login")}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md border border-border hover:border-primary/30 bg-card cursor-pointer relative z-50"
        >
          <Lock className="h-3 w-3" />
          Espaço de Operações
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 -mt-12">
        <div className="text-center mb-10 animate-fade-in">
          <img src={logoPro3} alt="Pro3 Comunicação" className="h-20 mx-auto mb-6" />
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Sistema de Documentação
          </h1>
          <p className="text-base text-muted-foreground max-w-lg mx-auto">
            Envie toda a documentação necessária de Pedidos de Inserção de forma organizada e segura.
          </p>
        </div>

        <Link to="/veiculo" className="group w-full max-w-xl animate-fade-in">
          <div className="bg-card rounded-xl border-2 border-primary/20 p-10 hover:shadow-xl hover:border-primary/50 transition-all duration-300 text-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 group-hover:scale-105 transition-all">
              <Upload className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Enviar Documentos para Faturamento</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Selecione o cliente, campanha e anexe os documentos necessários referentes ao seu PI.
            </p>
            <Button size="lg" className="gap-2 px-8">
              <FileText className="h-5 w-5" /> Iniciar envio
            </Button>
          </div>
        </Link>
      </div>

      <p className="text-xs text-muted-foreground text-center pb-6">
        © 2026 Pro3 Comunicação Ltda. Todos os direitos reservados.
      </p>

    </div>
  );
};

export default Index;
