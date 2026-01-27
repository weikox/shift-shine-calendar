import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useStorageMethod } from './useStorageMethod';

export const useTransactionDocumentCounts = (transactionIds: string[]) => {
  const [documentCounts, setDocumentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const { storageMethod } = useStorageMethod();
  const isCloudMode = storageMethod === 'cloud' || storageMethod === 'hybrid';

  useEffect(() => {
    const fetchDocumentCounts = async () => {
      if (!isCloudMode || transactionIds.length === 0) {
        setDocumentCounts({});
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('transaction_documents')
          .select('transaction_id')
          .in('transaction_id', transactionIds);

        if (error) {
          console.error('Error fetching document counts:', error);
          setDocumentCounts({});
          return;
        }

        // Count documents per transaction
        const counts: Record<string, number> = {};
        (data || []).forEach(doc => {
          counts[doc.transaction_id] = (counts[doc.transaction_id] || 0) + 1;
        });
        setDocumentCounts(counts);
      } catch (error) {
        console.error('Error fetching document counts:', error);
        setDocumentCounts({});
      } finally {
        setLoading(false);
      }
    };

    fetchDocumentCounts();
  }, [transactionIds.join(','), isCloudMode]);

  const hasDocuments = (transactionId: string): boolean => {
    return (documentCounts[transactionId] || 0) > 0;
  };

  return { documentCounts, hasDocuments, loading };
};
