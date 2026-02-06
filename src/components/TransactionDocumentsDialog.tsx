import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Download, ExternalLink, Loader2 } from "lucide-react";
import { Transaction, FileDocument } from "@/contexts/FinancesContext";
import { useDocumentStorage, CloudDocument } from "@/hooks/useDocumentStorage";
import { useStorageMethod } from "@/hooks/useStorageMethod";
import { cn } from "@/lib/utils";

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
        window.open(url, "_blank");
      }
    } finally {
      setOpeningDoc(null);
    }
  };

  const handleOpenLocalDoc = (doc: FileDocument) => {
    const link = document.createElement("a");
    link.href = doc.data;
    link.download = doc.name;
    // For images and PDFs, open in new tab
    if (doc.type.startsWith("image/") || doc.type === "application/pdf") {
      const win = window.open();
      if (win) {
        win.document.write(
          doc.type.startsWith("image/")
            ? `<img src="${doc.data}" style="max-width:100%;height:auto;" />`
            : `<iframe src="${doc.data}" style="width:100%;height:100%;border:none;"></iframe>`
        );
      }
    } else {
      link.click();
    }
  };

  const totalDocs = localDocs.length + cloudDocs.length;
  const hasNoDocs = !loading && totalDocs === 0;

  return (
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
  );
};
