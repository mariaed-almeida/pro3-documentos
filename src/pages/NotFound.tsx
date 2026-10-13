import { Link } from "react-router-dom";

const NotFound = () => (
  <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
    <p className="eyebrow mb-3">Erro 404</p>
    <h1 className="text-4xl">Página não encontrada</h1>
    <p className="mt-3 max-w-sm text-sm text-muted-foreground">O endereço não existe ou foi movido.</p>
    <Link to="/" className="mt-6 text-sm font-medium text-primary underline-offset-4 hover:underline">
      Voltar ao início
    </Link>
  </div>
);

export default NotFound;
