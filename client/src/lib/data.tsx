import { createContext, useContext, useState, ReactNode } from "react";
import { 
  parties as initialParties, 
  agreements as initialAgreements, 
  documents as initialDocuments, 
  persons as initialPersons,
  activities as initialActivities,
  Party, Agreement, Document, Person, Activity 
} from "./mockData";

interface DataContextType {
  parties: Party[];
  agreements: Agreement[];
  documents: Document[];
  persons: Person[];
  activities: Activity[];
  
  addParty: (party: Omit<Party, "id">) => void;
  removeParty: (id: string) => void;
  
  addAgreement: (agreement: Omit<Agreement, "id">) => void;
  removeAgreement: (id: string) => void;
  
  addDocument: (doc: Omit<Document, "id" | "dateUploaded">) => void;
  removeDocument: (id: string) => void;

  addPerson: (person: Omit<Person, "id">) => void;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [parties, setParties] = useState<Party[]>(initialParties);
  const [agreements, setAgreements] = useState<Agreement[]>(initialAgreements);
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [persons, setPersons] = useState<Person[]>(initialPersons);
  const [activities, setActivities] = useState<Activity[]>(initialActivities);

  const addParty = (party: Omit<Party, "id">) => {
    const newParty = { ...party, id: Math.random().toString(36).substr(2, 9) };
    setParties([...parties, newParty]);
  };

  const removeParty = (id: string) => {
    setParties(parties.filter(p => p.id !== id));
  };

  const addAgreement = (agreement: Omit<Agreement, "id">) => {
    const newAgreement = { ...agreement, id: Math.random().toString(36).substr(2, 9) };
    setAgreements([...agreements, newAgreement]);
  };

  const removeAgreement = (id: string) => {
    setAgreements(agreements.filter(a => a.id !== id));
  };

  const addDocument = (doc: Omit<Document, "id" | "dateUploaded">) => {
    const newDoc = { 
      ...doc, 
      id: Math.random().toString(36).substr(2, 9),
      dateUploaded: new Date().toISOString()
    };
    setDocuments([...documents, newDoc]);
  };

  const removeDocument = (id: string) => {
    setDocuments(documents.filter(d => d.id !== id));
  };

  const addPerson = (person: Omit<Person, "id">) => {
    const newPerson = { ...person, id: Math.random().toString(36).substr(2, 9) };
    setPersons([...persons, newPerson]);
  };

  return (
    <DataContext.Provider value={{
      parties, agreements, documents, persons, activities,
      addParty, removeParty,
      addAgreement, removeAgreement,
      addDocument, removeDocument,
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
