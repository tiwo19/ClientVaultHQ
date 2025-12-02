import { createContext, useContext, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import { useAuth } from "./auth";
import type { Party, Agreement, Document, Person, Activity, PartyRelationship } from "@shared/schema";

interface DataContextType {
  // Queries
  parties: Party[];
  agreements: Agreement[];
  documents: Document[];
  persons: Person[];
  activities: Activity[];
  partyRelationships: PartyRelationship[];
  isLoading: boolean;

  // Mutations
  addParty: (party: Omit<Party, "id">) => Promise<void>;
  updateParty: (id: string, data: Partial<Party>) => Promise<Party>;
  removeParty: (id: string) => Promise<void>;
  
  addAgreement: (agreement: Omit<Agreement, "id">) => Promise<Agreement>;
  updateAgreement: (id: string, data: Partial<Agreement>) => Promise<Agreement>;
  removeAgreement: (id: string) => Promise<void>;
  bulkUpdateAgreementStatus: (ids: string[], status: string) => Promise<void>;
  
  addDocument: (doc: { agreementId?: string; partyId?: string; name: string; type: string; category?: string; expirationDate?: string; notes?: string; file?: File }) => Promise<Document | null>;
  removeDocument: (id: string) => Promise<void>;

  addPerson: (person: Omit<Person, "id">) => Promise<void>;
  removePerson: (id: string) => Promise<void>;

  addActivity: (activity: api.ActivityData) => Promise<void>;
  removeActivity: (id: string) => Promise<void>;

  addPartyRelationship: (rel: api.PartyRelationshipData) => Promise<void>;
  removePartyRelationship: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  
  // Only fetch data when user is authenticated
  const isAuthenticated = !authLoading && !!user;

  // Queries - only enabled when authenticated
  const { data: parties = [], isLoading: partiesLoading } = useQuery({
    queryKey: ["parties"],
    queryFn: api.fetchParties,
    enabled: isAuthenticated
  });

  const { data: agreements = [], isLoading: agreementsLoading } = useQuery({
    queryKey: ["agreements"],
    queryFn: api.fetchAgreements,
    enabled: isAuthenticated
  });

  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: api.fetchDocuments,
    enabled: isAuthenticated
  });

  const { data: persons = [], isLoading: personsLoading } = useQuery({
    queryKey: ["persons"],
    queryFn: api.fetchPersons,
    enabled: isAuthenticated
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ["activities"],
    queryFn: api.fetchActivities,
    enabled: isAuthenticated
  });

  const { data: partyRelationships = [], isLoading: relationshipsLoading } = useQuery({
    queryKey: ["partyRelationships"],
    queryFn: api.fetchPartyRelationships,
    enabled: isAuthenticated
  });

  const isLoading = authLoading || (isAuthenticated && (partiesLoading || agreementsLoading || documentsLoading || personsLoading || activitiesLoading || relationshipsLoading));

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

  const updatePartyMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Party> }) => api.updateParty(id, data),
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

  const updateAgreementMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Agreement> }) => api.updateAgreement(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agreements"] });
    }
  });

  const addDocumentMutation = useMutation({
    mutationFn: (options: api.DocumentUploadOptions) => api.uploadDocument(options),
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

  const updateParty = async (id: string, data: Partial<Party>) => {
    return await updatePartyMutation.mutateAsync({ id, data });
  };

  const addAgreement = async (agreement: Omit<Agreement, "id">) => {
    return await addAgreementMutation.mutateAsync(agreement);
  };

  const removeAgreement = async (id: string) => {
    await removeAgreementMutation.mutateAsync(id);
  };

  const updateAgreement = async (id: string, data: Partial<Agreement>) => {
    return await updateAgreementMutation.mutateAsync({ id, data });
  };

  const addDocument = async (doc: { 
    agreementId?: string; 
    partyId?: string; 
    name: string; 
    type: string; 
    category?: string;
    expirationDate?: string;
    notes?: string;
    file?: File 
  }): Promise<Document | null> => {
    if (doc.file) {
      const result = await addDocumentMutation.mutateAsync({
        file: doc.file,
        agreementId: doc.agreementId,
        partyId: doc.partyId,
        type: doc.type,
        category: doc.category,
        expirationDate: doc.expirationDate,
        notes: doc.notes
      });
      return result as Document;
    }
    return null;
  };

  const removeDocument = async (id: string) => {
    await removeDocumentMutation.mutateAsync(id);
  };

  const addPersonMutation = useMutation({
    mutationFn: api.createPerson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["persons"] });
    }
  });

  const removePersonMutation = useMutation({
    mutationFn: api.deletePerson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["persons"] });
    }
  });

  const addPerson = async (person: Omit<Person, "id">) => {
    await addPersonMutation.mutateAsync(person);
  };

  const removePerson = async (id: string) => {
    await removePersonMutation.mutateAsync(id);
  };

  const addActivityMutation = useMutation({
    mutationFn: api.createActivity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    }
  });

  const addActivity = async (activity: api.ActivityData) => {
    await addActivityMutation.mutateAsync(activity);
  };

  const removeActivityMutation = useMutation({
    mutationFn: api.deleteActivity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    }
  });

  const removeActivity = async (id: string) => {
    await removeActivityMutation.mutateAsync(id);
  };

  // Party Relationships
  const addPartyRelationshipMutation = useMutation({
    mutationFn: api.createPartyRelationship,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partyRelationships"] });
    }
  });

  const removePartyRelationshipMutation = useMutation({
    mutationFn: api.deletePartyRelationship,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partyRelationships"] });
    }
  });

  const addPartyRelationship = async (rel: api.PartyRelationshipData) => {
    await addPartyRelationshipMutation.mutateAsync(rel);
  };

  const removePartyRelationship = async (id: string) => {
    await removePartyRelationshipMutation.mutateAsync(id);
  };

  // Bulk operations
  const bulkUpdateMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) => 
      api.bulkUpdateAgreementStatus(ids, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agreements"] });
    }
  });

  const bulkUpdateAgreementStatus = async (ids: string[], status: string) => {
    await bulkUpdateMutation.mutateAsync({ ids, status });
  };

  return (
    <DataContext.Provider value={{
      parties,
      agreements,
      documents,
      persons,
      activities,
      partyRelationships,
      isLoading,
      addParty,
      updateParty,
      removeParty,
      addAgreement,
      updateAgreement,
      removeAgreement,
      bulkUpdateAgreementStatus,
      addDocument,
      removeDocument,
      addPerson,
      removePerson,
      addActivity,
      removeActivity,
      addPartyRelationship,
      removePartyRelationship
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
