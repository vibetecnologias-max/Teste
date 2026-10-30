import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase/config';
import { UserProfile, UserRole } from '../types';
import { SEED_USERS, SEED_PROFESSIONALS } from '../data/seedData';

/**
 * Signs in with email and password.
 */
export async function loginWithEmail(email: string, pass: string): Promise<UserProfile> {
  const userCredential = await signInWithEmailAndPassword(auth, email, pass);
  return await getOrCreateUserProfile(userCredential.user);
}

/**
 * Registers a new user and creates their profile in Firestore.
 */
export async function registerWithEmail(
  email: string,
  pass: string,
  displayName: string,
  role: UserRole,
  extra?: { phone?: string; crp?: string; clinicName?: string }
): Promise<UserProfile> {
  // Security guard: never allow self-registration as superadmin
  if (role === 'superadmin') {
    throw new Error('Operação negada: não é permitido auto-cadastro com perfil de superadministrador.');
  }

  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  const uid = userCredential.user.uid;

  const newProfile: UserProfile = {
    uid,
    email,
    displayName,
    role,
    phone: extra?.phone,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, 'users', uid), newProfile);

    // If psychologist, create professional registry
    if (role === 'psychologist') {
      const profId = `prof_${uid}`;
      newProfile.professionalId = profId;
      await setDoc(doc(db, 'professionals', profId), {
        id: profId,
        userId: uid,
        name: displayName,
        crp: extra?.crp || 'CRP Em Homologação',
        email,
        phone: extra?.phone || '',
        bio: 'Profissional da psicologia cadastrado na plataforma Projeto Psi.',
        specialities: ['Psicologia Clínica', 'Terapia Individual'],
        sessionDurationMinutes: 50,
        sessionPrice: 180,
        clinicIds: ['clinic_mente_viva'],
        status: 'active'
      });
      await setDoc(doc(db, 'users', uid), { professionalId: profId }, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }

  return newProfile;
}

/**
 * Sends a password reset email.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Signs out the current user.
 */
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Google Sign-in popup.
 */
export async function loginWithGoogle(): Promise<UserProfile> {
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  return await getOrCreateUserProfile(credential.user);
}

/**
 * Retrieves the user profile from Firestore or creates a default patient profile if first sign-in.
 */
export async function getOrCreateUserProfile(user: FirebaseUser): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }

    // Check if matching a pre-seeded account by email
    const matchSeed = SEED_USERS.find(u => u.email.toLowerCase() === (user.email || '').toLowerCase());
    const profile: UserProfile = {
      uid: user.uid,
      email: user.email || 'usuario@projetopsi.com.br',
      displayName: user.displayName || matchSeed?.displayName || 'Usuário Projeto Psi',
      role: matchSeed?.role || 'patient',
      avatarUrl: user.photoURL || matchSeed?.avatarUrl,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(userRef, profile);
    return profile;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    throw err;
  }
}
