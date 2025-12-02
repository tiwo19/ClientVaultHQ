import { createContext, useContext, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import type { Party, Agreement, Document, Person, Activity } from "./mockData";

interface DataContextType {
  // Queries
  parties: Party[];
  agreements: Agreement[];
  documents: Document[];
  persons: Person[];
  activities: Activity[];
  isLoading: boolean;

  // Mutations
  addParty: (party: Omit<Party, "id">) => Promise<void>;
  removeParty: (id: string) => Promise<void>;
  
  addAgreement: (agreement: Omit<Agreement, "id">) => Promise<Agreement>;
  removeAgreement: (id: string) => Promise<void>;
  
  addDocument: (doc: { agreementId?: string; partyId?: string; name: string; type: string; file?: File }) => Promise<void>;
  removeDocument: (id: string) => Promise<void>;

  addPerson: (person: Omit<Person, "id">) => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // Queries
  const { data: parties = [], isLoading: partiesLoading } = useQuery({
    queryKey: ["parties"],
    queryFn: api.fetchParties
  });

  const { data: agreements = [], isLoading: agreementsLoading } = useQuery({
    queryKey: ["agreements"],
    queryFn: api.fetchAgreements
  });

  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: api.fetchDocuments
  });

  const { data: persons = [], isLoading: personsLoading } = useQuery({
    queryKey: ["persons"],
    queryFn: api.fetchPersons
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ["activities"],
    queryFn: api.fetchActivities
  });

  const isLoading = partiesLoading || agreementsLoading || documentsLoading || personsLoading || activitiesLoading;

  // Mutations
  const addPartyMutation = useMutation({
    mutationFn: api.createParty,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parties"] });
    }
  });

  const removePartyMutation = useMutation({
    mutationFn: api.deleteParty,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parties"] });
    }
  });

  const addAgreementMutation = useMutation({
    mutationFn: api.createAgreement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agreements"] });
    }
  });

  const removeAgreementMutation = useMutation({
    mutationFn: api.deleteAgreement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agreements"] });
    }
  });

  const addDocumentMutation = useMutation({
    mutationFn: ({ file, agreementId, partyId, type }: { file: File; agreementId?: string; partyId?: string; type: string }) => 
      api.uploadDocument(file, agreementId, partyId, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    }
  });

  const removeDocumentMutation = useMutation({
    mutationFn: api.deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    }
  });

  // Helper functions
  const addParty = async (party: Omit<Party, "id">) => {
    await addPartyMutation.mutateAsync(party);
  };

  const removeParty = async (id: string) => {
    await removePartyMutation.mutateAsync(id);
  };

  const addAgreement = async (agreement: Omit<Agreement, "id">) => {
    return await addAgreementMutation.mutateAsync(agreement);
  };

  const removeAgreement = async (id: string) => {
    await removeAgreementMutation.mutateAsync(id);
  };

  const addDocument = async (doc: { agreementId?: string; partyId?: string; name: string; type: string; file?: File }) => {
    if (doc.file) {
      await addDocumentMutation.mutateAsync({
        file: doc.file,
        agreementId: doc.agreementId,
        partyId: doc.partyId,
        type: doc.type
      });
    }
  };

  const removeDocument = async (id: string) => {
    await removeDocumentMutation.mutateAsync(id);
  };

  const addPerson = async (person: Omit<Person, "id">) => {
    // TODO: Implement person creation endpoint
    console.log("Person creation not yet implemented:", person);
  };

  return (
    <DataContext.Provider value={{
      parties,
      agreements,
      documents,
      persons,
      activities,
      isLoading,
      addParty,
      removeParty,
      addAgreement,
      removeAgreement,
      addDocument,
      removeDocument,
      addPerson
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
