import { initializeApp } from 'firebase/app';
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export function formatFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
  const host =
    typeof window !== 'undefined' && window.location?.hostname
      ? window.location.hostname
      : 'seu-dominio.vercel.app';

  switch (code) {
    case 'auth/unauthorized-domain':
      return `O domínio "${host}" ainda não está autorizado no Firebase Authentication. No Firebase Console (projeto ${FIREBASE_PROJECT_ID}), acesse Authentication → Settings → Domínios autorizados e adicione "${host}".`;
    case 'auth/operation-not-allowed':
      return `O login com Google não está ativado no Firebase Console (projeto ${FIREBASE_PROJECT_ID}). Acesse Authentication → Sign-in method e ative o provedor Google.`;
    case 'auth/popup-blocked':
      return 'O navegador bloqueou a janela de login do Google. Permita pop-ups para este site e tente novamente.';
    case 'auth/cancelled-popup-request':
      return 'Uma janela de login já está em andamento. Aguarde ou tente novamente.';
    case 'auth/network-request-failed':
      return 'Falha de conexão ao autenticar com o Google. Verifique sua internet e tente novamente.';
    case 'auth/internal-error':
      return `Erro interno ao autenticar no domínio "${host}". Verifique se "${host}" está em Domínios autorizados no Firebase Console (${FIREBASE_PROJECT_ID}) e se cookies/pop-ups de terceiros não estão bloqueados.`;
    default: {
      const msg =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Erro desconhecido';
      return code
        ? `Não foi possível concluir o login com Google (${code}).`
        : `Não foi possível concluir o login com Google: ${msg}`;
    }
  }
}

export async function signInWithGooglePopup() {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (err: any) {
    const code = String(err?.code || '');
    const isTopLevelWindow =
      typeof window !== 'undefined' && window.self === window.top;
    if (
      isTopLevelWindow &&
      (code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment')
    ) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw err;
  }
}

export async function completeGoogleRedirectSignIn() {
  try {
    return await getRedirectResult(auth);
  } catch (err) {
    throw err;
  }
}

export async function signOutFirebase() {
  return signOut(auth);
}
