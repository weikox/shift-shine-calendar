import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CloudDocument {
  id: string;
  name: string;
  type: string;
  storagePath: string;
}

interface UploadProgress {
  uploading: boolean;
  progress: number;
}

export const useDocumentStorage = () => {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    uploading: false,
    progress: 0,
  });

  const uploadDocument = async (
    file: File,
    transactionId: string
  ): Promise<CloudDocument | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Debes iniciar sesión para subir documentos");
        return null;
      }

      setUploadProgress({ uploading: true, progress: 0 });

      // Create unique file path: user_id/transaction_id/timestamp_filename
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `${user.id}/${transactionId}/${timestamp}_${sanitizedName}`;

      setUploadProgress({ uploading: true, progress: 30 });

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("transaction-documents")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast.error(`Error al subir archivo: ${uploadError.message}`);
        setUploadProgress({ uploading: false, progress: 0 });
        return null;
      }

      setUploadProgress({ uploading: true, progress: 70 });

      // Save reference in database
      const { data: docRef, error: dbError } = await supabase
        .from("transaction_documents")
        .insert({
          user_id: user.id,
          transaction_id: transactionId,
          file_name: file.name,
          file_type: file.type,
          storage_path: storagePath,
        })
        .select()
        .single();

      if (dbError) {
        console.error("DB error:", dbError);
        // Rollback: delete uploaded file
        await supabase.storage.from("transaction-documents").remove([storagePath]);
        toast.error(`Error al guardar referencia: ${dbError.message}`);
        setUploadProgress({ uploading: false, progress: 0 });
        return null;
      }

      setUploadProgress({ uploading: true, progress: 100 });
      
      setTimeout(() => {
        setUploadProgress({ uploading: false, progress: 0 });
      }, 500);

      return {
        id: docRef.id,
        name: file.name,
        type: file.type,
        storagePath: storagePath,
      };
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Error inesperado al subir documento");
      setUploadProgress({ uploading: false, progress: 0 });
      return null;
    }
  };

  const deleteDocument = async (documentId: string): Promise<boolean> => {
    try {
      // Get the document to find storage path
      const { data: doc, error: fetchError } = await supabase
        .from("transaction_documents")
        .select("storage_path")
        .eq("id", documentId)
        .single();

      if (fetchError || !doc) {
        console.error("Fetch error:", fetchError);
        return false;
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("transaction-documents")
        .remove([doc.storage_path]);

      if (storageError) {
        console.error("Storage delete error:", storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("transaction_documents")
        .delete()
        .eq("id", documentId);

      if (dbError) {
        console.error("DB delete error:", dbError);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Delete error:", error);
      return false;
    }
  };

  const getDocuments = async (transactionId: string): Promise<CloudDocument[]> => {
    try {
      const { data, error } = await supabase
        .from("transaction_documents")
        .select("id, file_name, file_type, storage_path")
        .eq("transaction_id", transactionId);

      if (error) {
        console.error("Fetch documents error:", error);
        return [];
      }

      return (data || []).map((doc) => ({
        id: doc.id,
        name: doc.file_name,
        type: doc.file_type,
        storagePath: doc.storage_path,
      }));
    } catch (error) {
      console.error("Get documents error:", error);
      return [];
    }
  };

  const getDocumentUrl = async (storagePath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from("transaction-documents")
        .createSignedUrl(storagePath, 3600); // 1 hour expiry

      if (error) {
        console.error("Get URL error:", error);
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      console.error("Get URL error:", error);
      return null;
    }
  };

  const deleteDocumentsByTransaction = async (transactionId: string): Promise<boolean> => {
    try {
      const docs = await getDocuments(transactionId);
      
      for (const doc of docs) {
        await deleteDocument(doc.id);
      }
      
      return true;
    } catch (error) {
      console.error("Delete by transaction error:", error);
      return false;
    }
  };

  return {
    uploadDocument,
    deleteDocument,
    getDocuments,
    getDocumentUrl,
    deleteDocumentsByTransaction,
    uploadProgress,
  };
};
