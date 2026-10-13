import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy } from "react";
import AppLayout from "./components/app/AppLayout.tsx";
import Index from "./pages/Index.tsx";
import VeiculoForm from "./pages/VeiculoForm.tsx";
import OperadorLogin from "./pages/OperadorLogin.tsx";
import OAuthConsent from "./pages/OAuthConsent.tsx";
import NotFound from "./pages/NotFound.tsx";
const Overview = lazy(() => import("./pages/app/Overview.tsx"));
const Documentos = lazy(() => import("./pages/app/Documentos.tsx"));
const DocumentoDetalhe = lazy(() => import("./pages/app/DocumentoDetalhe.tsx"));
const Aprovacoes = lazy(() => import("./pages/app/Aprovacoes.tsx"));
const Analises = lazy(() => import("./pages/app/Analises.tsx"));
const Clientes = lazy(() => import("./pages/app/Clientes.tsx"));
const Campanhas = lazy(() => import("./pages/app/Campanhas.tsx"));
const Veiculos = lazy(() => import("./pages/app/Veiculos.tsx"));
const Faturamento = lazy(() => import("./pages/app/Faturamento.tsx"));
const Gerencial = lazy(() => import("./pages/app/Gerencial.tsx"));
const Usuarios = lazy(() => import("./pages/app/Usuarios.tsx"));
const Pedidos = lazy(() => import("./pages/app/Pedidos.tsx"));
const PedidoEditor = lazy(() => import("./pages/app/PedidoEditor.tsx"));
const Agencia = lazy(() => import("./pages/app/Agencia.tsx"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/veiculo" element={<VeiculoForm />} />
          <Route path="/operador/login" element={<OperadorLogin />} />
          <Route path="/operador" element={<Navigate to="/app" replace />} />
          <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />

          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Overview />} />
            <Route path="documentos" element={<Documentos />} />
            <Route path="documentos/:id" element={<DocumentoDetalhe />} />
            <Route path="aprovacoes" element={<Aprovacoes />} />
            <Route path="pedidos" element={<Pedidos />} />
            <Route path="pedidos/novo" element={<PedidoEditor />} />
            <Route path="pedidos/:id" element={<PedidoEditor />} />
            <Route path="faturamento" element={<Faturamento />} />
            <Route path="gerencial" element={<Gerencial />} />
            <Route path="analises" element={<Analises />} />
            <Route path="cadastros" element={<Navigate to="/app/cadastros/clientes" replace />} />
            <Route path="cadastros/clientes" element={<Clientes />} />
            <Route path="cadastros/campanhas" element={<Campanhas />} />
            <Route path="cadastros/veiculos" element={<Veiculos />} />
            <Route path="cadastros/usuarios" element={<Usuarios />} />
            <Route path="cadastros/agencia" element={<Agencia />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
