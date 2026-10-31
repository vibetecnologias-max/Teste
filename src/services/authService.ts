import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase/config';
import { UserProfile, UserRole, Professional, ProfessionalPublic, Clinic } from '../types';

/**
 * Signs in with email and password.
 * Strictly verifies user account status; suspended users are rejected and signed out.
 */
export async function loginWithEmail(email: string, pass: string): Promise<UserProfile> {
  const userCredential = await signInWithEmailAndPassword(auth, email, pass);
  try {
    return await getOrCreateUserProfile(userCredential.user);
  } catch (err) {
    await signOut(auth);
    throw err;
  }
}

/**
 * Registers a new user and creates their profile in Firestore.
 * Strictly enforces:
 * - 'superadmin' cannot be chosen by self-registration.
 * - Psychologists have private and public profile created atomically.
 * - Clinic managers have clinic created atomically.
 * - Compensating rollback deletes partial records if an intermediate step fails.
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

  const profId = role === 'psychologist' ? `prof_${uid}` : undefined;
  const clinicId = (role === 'clinic_manager' && extra?.clinicName) ? `clinic_${uid}` : undefined;

  const newProfile: UserProfile = {
    uid,
    email,
    displayName,
    role,
    phone: extra?.phone,
    professionalId: profId,
    clinicId: clinicId,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const createdPaths: string[] = [];

  try {
    // 1. Create User Document
    await setDoc(doc(db, 'users', uid), newProfile);
    createdPaths.push(`users/${uid}`);

    // 2. If psychologist, provision private record AND public projection with pending_verification
    if (role === 'psychologist' && profId) {
      const privateProf: Professional = {
        id: profId,
        userId: uid,
        name: displayName,
        crp: extra?.crp?.trim() || 'Pendente de comprovação',
        email,
        phone: extra?.phone || '',
        bio: 'Perfil profissional em fase de cadastro e validação documental.',
        specialities: ['Psicologia Geral'],
        sessionDurationMinutes: 50,
        sessionPrice: 180,
        clinicIds: [],
        status: 'pending_verification',
        verificationDetails: {
          notes: 'Registro informado pelo profissional no auto-cadastro. Aguardando conferência documental e homologação.'
        }
      };
      await setDoc(doc(db, 'professionals', profId), privateProf);
      createdPaths.push(`professionals/${profId}`);

      const publicProf: ProfessionalPublic = {
        id: profId,
        userId: uid,
        name: displayName,
        crp: extra?.crp?.trim() || 'Pendente de comprovação',
        bio: 'Perfil profissional em fase de cadastro e validação documental.',
        specialities: ['Psicologia Geral'],
        sessionDurationMinutes: 50,
        sessionPrice: 180,
        clinicIds: [],
        status: 'pending_verification',
        verificationDetails: {
          notes: 'Registro informado pelo profissional no auto-cadastro. Aguardando conferência documental e homologação.'
        }
      };
      await setDoc(doc(db, 'professionals_public', profId), publicProf);
      createdPaths.push(`professionals_public/${profId}`);
    } else if (role === 'clinic_manager' && clinicId && extra?.clinicName) {
      // 3. If clinic manager, provision clinic document
      const newClinic: Clinic = {
        id: clinicId,
        name: extra.clinicName,
        ownerId: uid,
        phone: extra.phone || '',
        email,
        address: 'Consultório Principal',
        status: 'active',
        roomsCount: 2,
        professionalsCount: 5,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'clinics', clinicId), newClinic);
      createdPaths.push(`clinics/${clinicId}`);
    }

    return newProfile;
  } catch (error) {
    // Compensating rollback: delete all partially created documents
    console.error('Falha no provisionamento do cadastro. Executando rollback...', error);
    for (const path of createdPaths.reverse()) {
      try {
        const [coll, docId] = path.split('/');
        await deleteDoc(doc(db, coll, docId));
      } catch (rollbackErr) {
        console.warn(`Falha no rollback do documento ${path}:`, rollbackErr);
      }
    }

    try {
      await userCredential.user.delete();
    } catch (authDeleteErr) {
      console.warn('Falha ao remover usuário do Firebase Auth após erro de cadastro:', authDeleteErr);
    }

    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    throw error;
  }
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
  try {
    return await getOrCreateUserProfile(credential.user);
  } catch (err) {
    await signOut(auth);
    throw err;
  }
}

/**
 * Retrieves the user profile from Firestore or creates a safe default patient profile if first sign-in.
 * NEVER assigns superadmin or psychologist roles based on email pattern or seed data.
 * Rejects and blocks suspended users immediately.
 */
export async function getOrCreateUserProfile(user: FirebaseUser): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();

      // STRICT SUSPENSION CHECK: Block access immediately if status is 'suspended'
      if (data.status === 'suspended') {
        await signOut(auth);
        throw new Error('CONTA_SUSPENSA: Seu acesso está suspenso pela administração da plataforma.');
      }

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
        status: 'active',
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
    if (err instanceof Error && err.message.startsWith('CONTA_SUSPENSA')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    throw err;
  }
}
