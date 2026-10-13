import { Link, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import SubmissionDetail from "@/components/SubmissionDetail";
import EmptyState from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { useChangeStatus, useSubmission } from "@/hooks/use-submissions";
import { FileQuestion } from "lucide-react";

const DocumentoDetalhe = () => {
  const { id } = useParams();
  const { data: submission, isLoading } = useSubmission(id);
  const changeStatus = useChangeStatus();

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!submission) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Envio não encontrado"
        description="O link pode estar errado ou o envio foi removido."
        action={
          <Button asChild variant="outline">
            <Link to="/app/documentos">Voltar aos documentos</Link>
          </Button>
        }
      />
    );
  }

  return <SubmissionDetail key={submission.id + submission.status} submission={submission} onStatusUpdate={changeStatus} />;
};

export default DocumentoDetalhe;
