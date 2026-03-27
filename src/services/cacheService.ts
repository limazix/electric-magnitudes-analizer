import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

/**
 * Generates a SHA-256 hash of the provided text.
 */
export async function generateHash(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Checks if there's a cached result for the given hash.
 */
export async function getCachedAnalysis(hash: string): Promise<any | null> {
  try {
    const docRef = doc(db, 'analysis_cache', hash);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data().results;
    }
    return null;
  } catch (err) {
    console.error("Error fetching from cache:", err);
    return null;
  }
}

/**
 * Stores the analysis results in the cache.
 */
export async function setCachedAnalysis(hash: string, results: any) {
  try {
    const docRef = doc(db, 'analysis_cache', hash);
    const docSnap = await getDoc(docRef);
    
    // Check if it already exists to avoid duplicates/unnecessary writes
    if (docSnap.exists()) return;

    await setDoc(docRef, {
      hash,
      results,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error("Error saving to cache:", err);
  }
}
