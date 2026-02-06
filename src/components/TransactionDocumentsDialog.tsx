import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, ExternalLink, Loader2 } from "lucide-react";
import { Transaction, FileDocument } from "@/contexts/FinancesContext";
import { useDocumentStorage, CloudDocument } from "@/hooks/useDocumentStorage";
import { useStorageMethod } from "@/hooks/useStorageMethod";
import { cn } from "@/lib/utils";
import { DocumentViewer } from "@/components/DocumentViewer";

interface TransactionDocumentsDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TransactionDocumentsDialog = ({
  transaction,
  open,
  onOpenChange,
}: TransactionDocumentsDialogProps) => {
  const { getDocuments, getDocumentUrl } = useDocumentStorage();
  const { storageMethod } = useStorageMethod();
  const isCloudMode = storageMethod === "cloud" || storageMethod === "hybrid";

  const [cloudDocs, setCloudDocs] = useState<CloudDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [openingDoc, setOpeningDoc] = useState<string | null>(null);

  // Viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [viewerName, setViewerName] = useState<string>("");
  const [viewerType, setViewerType] = useState<string>("");

  const localDocs: FileDocument[] = transaction?.documents || [];

  useEffect(() => {
    if (!open || !transaction || !isCloudMode) {
      setCloudDocs([]);
      return;
    }

    const fetchDocs = async () => {
      setLoading(true);
      try {
        const docs = await getDocuments(transaction.id);
        setCloudDocs(docs);
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, [open, transaction?.id, isCloudMode]);

  const handleOpenCloudDoc = async (doc: CloudDocument) => {
    setOpeningDoc(doc.id);
    try {
      const url = await getDocumentUrl(doc.storagePath);
      if (url) {
        setViewerSrc(url);
        setViewerName(doc.name);
        setViewerType(doc.type);
        setViewerOpen(true);
      }
    } finally {
      setOpeningDoc(null);
    }
  };

  const handleOpenLocalDoc = (doc: FileDocument) => {
    setViewerSrc(doc.data);
    setViewerName(doc.name);
    setViewerType(doc.type);
    setViewerOpen(true);
  };

  const totalDocs = localDocs.length + cloudDocs.length;
  const hasNoDocs = !loading && totalDocs === 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documentos — {transaction?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {hasNoDocs && (
              <p className="text-center text-muted-foreground text-sm py-6">
                Sin documentos adjuntos
              </p>
            )}

            {/* Local documents */}
            {localDocs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => handleOpenLocalDoc(doc)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 text-left text-sm transition-colors"
              >
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="truncate flex-1">{doc.name}</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              </button>
            ))}

            {/* Cloud documents */}
            {cloudDocs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => handleOpenCloudDoc(doc)}
                disabled={openingDoc === doc.id}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 text-left text-sm transition-colors",
                  openingDoc === doc.id && "opacity-50"
                )}
              >
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="truncate flex-1">{doc.name}</span>
                {openingDoc === doc.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground flex-shrink-0" />
                ) : (
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <DocumentViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        src={viewerSrc}
        name={viewerName}
        type={viewerType}
      />
    </>
  );
};
