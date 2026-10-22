import { IPortalStorage } from "./types";
import { FirestoreStorageAdapter } from "./firestoreAdapter";

export * from "./types";
export { AtomicTransactionalStorage } from "./atomicStore";
export { FirestoreStorageAdapter } from "./firestoreAdapter";

// Singleton storage instance for the portal backend
const portalStorage: IPortalStorage = new FirestoreStorageAdapter();

// Initialize datastore
portalStorage.init().catch(err => {
  console.error("Portal storage initialization error:", err);
});

export { portalStorage };
