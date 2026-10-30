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

/**
 * Signs in with email and password.
 */
export async function loginWithEmail(email: string, pass: string): Promise<UserProfile> {
  const userCredential = await signInWithEmailAndPassword(auth, email, pass);
  return await getOrCreateUserProfile(userCredential.user);
}

/**
 * Registers a new user and creates their profile in Firestore.
 * Strictly enforces that 'superadmin' cannot be chosen by self-registration.
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

  // Validate allowed roles for self-registration
  if (!['psychologist', 'clinic_manager', 'patient'].includes(role)) {
    throw new Error('Perfil de usuário inválido.');
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
        status: 'active'
      });
      await setDoc(doc(db, 'users', uid), { professionalId: profId }, { merge: true });
    } else if (role === 'clinic_manager' && extra?.clinicName) {
      const clinicId = `clinic_${uid}`;
      newProfile.clinicId = clinicId;
      await setDoc(doc(db, 'clinics', clinicId), {
        id: clinicId,
        name: extra.clinicName,
        ownerId: uid,
        phone: extra.phone || '',
        email,
        status: 'active'
      });
      await setDoc(doc(db, 'users', uid), { clinicId }, { merge: true });
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
 * Retrieves the user profile from Firestore or creates a safe default patient profile if first sign-in.
 * NEVER assigns superadmin or psychologist roles based on email pattern or seed data.
 */
export async function getOrCreateUserProfile(user: FirebaseUser): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      // Ensure required properties exist safely
      const validRole: UserRole = ['psychologist', 'clinic_manager', 'patient', 'superadmin'].includes(data.role)
        ? data.role
        : 'patient';

      return {
        uid: user.uid,
        email: data.email || user.email || '',
        displayName: data.displayName || user.displayName || 'Usuário',
        role: validRole,
        phone: data.phone,
        avatarUrl: data.avatarUrl || user.photoURL || undefined,
        clinicId: data.clinicId,
        professionalId: data.professionalId,
        status: data.status || 'active',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString()
      };
    }

    // New user signing in: strictly assign default 'patient' role with standard privileges
    const profile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'Novo Paciente',
      role: 'patient',
      avatarUrl: user.photoURL || undefined,
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

