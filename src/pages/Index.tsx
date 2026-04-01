import { Link } from "react-router-dom";
import { FileText, Settings, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="text-center mb-12 animate-fade-in">
        <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-accent">
          <FileText className="h-5 w-5 text-accent-foreground" />
          <span className="text-sm font-semibold text-accent-foreground">PRO3 COMUNICAÇÃO</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
          Sistema de Documentação
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Envie e gerencie toda a documentação necessária de Pedidos de Inserção de forma organizada e segura.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl animate-fade-in">
        <Link to="/veiculo" className="group">
          <div className="bg-card rounded-lg border p-8 hover:shadow-lg hover:border-primary/30 transition-all duration-300 h-full">
            <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
              <Upload className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Sou Veículo</h2>
            <p className="text-muted-foreground text-sm">
              Envie a documentação referente ao seu PI. Selecione o cliente, campanha e anexe os documentos necessários.
            </p>
            <Button variant="ghost" className="mt-4 text-primary p-0 h-auto font-semibold">
              Enviar documentação →
            </Button>
          </div>
        </Link>

        <Link to="/operador" className="group">
          <div className="bg-card rounded-lg border p-8 hover:shadow-lg hover:border-primary/30 transition-all duration-300 h-full">
            <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
              <Settings className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Sou Operador</h2>
            <p className="text-muted-foreground text-sm">
              Acesse o painel de gestão para revisar, organizar e validar a documentação recebida dos veículos.
            </p>
            <Button variant="ghost" className="mt-4 text-primary p-0 h-auto font-semibold">
              Acessar painel →
            </Button>
          </div>
        </Link>
      </div>

      <p className="text-xs text-muted-foreground mt-12">
        © 2026 Pro3 Comunicação Ltda. Todos os direitos reservados.
      </p>
    </div>
  );
};

export default Index;
