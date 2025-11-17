

import { User, UserRole, PlatformSettings, Membership } from '../types';
import { auth, db, isFirebaseConfigured, RecaptchaVerifier, signInWithPhoneNumber } from './firebase';
import { apiService } from './apiService';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    onAuthStateChanged,
    User as FirebaseUser,
    ConfirmationResult,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail,
    updatePassword
} from 'firebase/auth';
// Fix: Corrected Firebase imports for 'doc', 'setDoc', 'getDoc', and 'Timestamp' to align with Firebase v9 modular syntax.
import { doc, setDoc, getDoc, Timestamp, updateDoc } from 'firebase/firestore';

const DEFAULT_AVATAR_URL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDEyYzIuMjEgMCA0LTEuNzkgNC00cy0xLjc5LTQtNC00LTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDRjMCAwIDAtMSAwLTJoMTJ2Mmg0di00YzAtMi42Ni01LjMzLTQtOC00eiIvPjwvc3ZnPg==';

const generatePiNumber = (): string => {
    // Generates a random 10-digit number
    const randomNumber = Math.floor(1000000000 + Math.random() * 9000000000);
    return `PI${randomNumber}`;
};

const getUserProfile = async (uid: string): Promise<Omit<User, 'id' | 'email'>> => {
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
        const data = userDoc.data();
        const now = Timestamp.now();
        const oneYearFromNow = new Date(now.toDate());
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

        const defaultMembership: Membership = {
            plan: 'free',
            isActive: false,
            startsAt: now,
            expiresAt: Timestamp.fromDate(oneYearFromNow),
            usage: {
                directCollaborations: 0,
                campaigns: 0,
                liveTvBookings: 0,
                bannerAdBookings: 0,
            }
        };

        return {
            name: data.name,
            piNumber: data.piNumber,
            companyName: data.companyName,
            role: data.role,
            mobileNumber: data.mobileNumber,
            avatar: data.avatar,
            location: data.location || '',
            membership: data.membership || defaultMembership,
            isBlocked: data.isBlocked || false,
            kycStatus: data.kycStatus || 'not_submitted',
            kycDetails: data.kycDetails || {},
            creatorVerificationStatus: data.creatorVerificationStatus || 'not_submitted',
            creatorVerificationDetails: data.creatorVerificationDetails || {},
            msmeRegistrationNumber: data.msmeRegistrationNumber || '',
            staffPermissions: data.staffPermissions || (data.role === 'staff' ? ['super_admin'] : []),
        };
    }
    throw new Error('User profile not found.');
};

export const authService = {
    register: async (email: string, password: string, role: UserRole, name: string, companyName: string, mobileNumber: string): Promise<User> => {
        if (!isFirebaseConfigured) throw new Error("Firebase is not configured.");
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;

        const now = Timestamp.now();
        const oneYearFromNow = new Date(now.toDate());
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

        const defaultMembership: Membership = {
            plan: 'free',
            isActive: false,
            startsAt: now,
            expiresAt: Timestamp.fromDate(oneYearFromNow),
            usage: {
                directCollaborations: 0,
                campaigns: 0,
                liveTvBookings: 0,
                bannerAdBookings: 0,
            }
        };

        const userProfileData: Partial<User> = {
            role,
            name,
            piNumber: generatePiNumber(),
            companyName,
            email, // Storing email in profile for convenience
            mobileNumber,
            avatar: DEFAULT_AVATAR_URL,
            location: '',
            membership: defaultMembership,
            isBlocked: false,
            kycStatus: 'not_submitted' as const,
            kycDetails: {},
            creatorVerificationStatus: 'not_submitted' as const,
            creatorVerificationDetails: {},
            msmeRegistrationNumber: '',
        };

        // Assign default 'super_admin' role to the first staff member
        if (role === 'staff') {
            userProfileData.staffPermissions = ['super_admin'];
        }

        // Create a document in Firestore for the user's profile
        await setDoc(doc(db, 'users', firebaseUser.uid), userProfileData);

        // If the new user is an influencer, create a default public profile for them
        if (role === 'influencer') {
            const influencerProfileData = {
                name,
                handle: email.split('@')[0], // a default handle
                avatar: DEFAULT_AVATAR_URL,
                bio: 'A passionate creator ready to collaborate!',
                followers: 0,
                niche: 'Lifestyle', // default
                engagementRate: 0,
                socialMediaLinks: '',
                location: '',
                membershipActive: false,
            };
            await setDoc(doc(db, 'influencers', firebaseUser.uid), influencerProfileData);
        }
        
        // If the new user is a Live TV Channel, create a default channel profile
        if (role === 'livetv') {
            const channelProfileData = {
                name: companyName || name,
                logo: `https://placehold.co/100x100/3f51b5/ffffff?text=${(companyName || name).charAt(0)}`,
                description: `A new channel on BIGYAPON, ready for advertisers.`,
                audienceSize: 0,
                niche: 'General',
                ownerId: firebaseUser.uid,
            };
            // Use the user UID as the document ID for easy mapping
            await setDoc(doc(db, 'livetv_channels', firebaseUser.uid), channelProfileData);
        }


        return {
            id: firebaseUser.uid,
            email: firebaseUser.email!,
            ...userProfileData
        } as User;
    },

    login: async (identifier: string, password_input: string): Promise<User> => {
        if (!isFirebaseConfigured) throw new Error("Firebase is not configured.");
        let emailToLogin = identifier;

        // If the identifier doesn't look like an email, assume it's a mobile number
        if (!identifier.includes('@')) {
            const userProfile = await apiService.getUserByMobile(identifier);
            if (userProfile && userProfile.email) {
                emailToLogin = userProfile.email;
            } else {
                // If mobile number not found, use a non-existent email to trigger
                // a standard 'auth/invalid-credential' error from Firebase.
                // This provides a consistent error experience on the frontend.
                emailToLogin = `invalid-user-${Date.now()}@bigyapon.com`;
            }
        }

        const userCredential = await signInWithEmailAndPassword(auth, emailToLogin, password_input);
        const firebaseUser = userCredential.user;

        const profile = await getUserProfile(firebaseUser.uid);

        if (profile.isBlocked) {
            await signOut(auth);
            throw new Error('Your account has been blocked by an administrator.');
        }
        
        return {
            id: firebaseUser.uid,
            email: firebaseUser.email!,
            ...profile
        };
    },
    
    sendLoginOtp: (phoneNumber: string, appVerifier: RecaptchaVerifier): Promise<ConfirmationResult> => {
        if (!isFirebaseConfigured) throw new Error("Firebase is not configured.");
        return signInWithPhoneNumber(auth, phoneNumber, appVerifier);
    },
    
    verifyLoginOtp: async (confirmationResult: ConfirmationResult, otp: string): Promise<User> => {
        if (!isFirebaseConfigured) throw new Error("Firebase is not configured.");
        const userCredential = await confirmationResult.confirm(otp);
        const firebaseUser = userCredential.user;
        
        try {
            const profile = await getUserProfile(firebaseUser.uid);

            if (profile.isBlocked) {
                await signOut(auth);
                throw new Error('Your account has been blocked by an administrator.');
            }

            // Phone auth users might not have an email, but our app structure needs one.
            const email = firebaseUser.email || `${firebaseUser.phoneNumber}@collabzz.phone`;

            return {
                id: firebaseUser.uid,
                email: email,
                ...profile,
            };
        } catch (error) {
            console.error("Failed to fetch user profile during OTP verification, logging out.", error);
            await signOut(auth);
            throw error;
        }
    },

    signInWithGoogle: async (role: UserRole): Promise<void> => {
        if (!isFirebaseConfigured) throw new Error("Firebase is not configured.");
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            const firebaseUser = result.user;
            
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                // This is a new user (signup), create their profile
                const now = Timestamp.now();
                const oneYearFromNow = new Date(now.toDate());
                oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

                const defaultMembership: Membership = {
                    plan: 'free',
                    isActive: false,
                    startsAt: now,
                    expiresAt: Timestamp.fromDate(oneYearFromNow),
                    usage: {
                        directCollaborations: 0,
                        campaigns: 0,
                        liveTvBookings: 0,
                        bannerAdBookings: 0,
                    }
                };

                const newUserProfile = {
                    name: firebaseUser.displayName || 'New User',
                    email: firebaseUser.email!,
                    piNumber: generatePiNumber(),
                    companyName: '', // User can fill this in later
                    mobileNumber: firebaseUser.phoneNumber || '',
                    role: role, // Use the role from the signup form
                    avatar: firebaseUser.photoURL || DEFAULT_AVATAR_URL,
                    location: '',
                    membership: defaultMembership,
                    isBlocked: false,
                    kycStatus: 'not_submitted' as const,
                    kycDetails: {},
                    creatorVerificationStatus: 'not_submitted' as const,
                    creatorVerificationDetails: {},
                    msmeRegistrationNumber: '',
                };
                await setDoc(userDocRef, newUserProfile);

                if (role === 'influencer') {
                    const influencerProfileData = {
                        name: firebaseUser.displayName || 'New User',
                        handle: firebaseUser.email!.split('@')[0],
                        avatar: firebaseUser.photoURL || DEFAULT_AVATAR_URL,
                        bio: 'A passionate creator ready to collaborate!',
                        followers: 0,
                        niche: 'Lifestyle',
                        engagementRate: 0,
                        socialMediaLinks: '',
                        location: '',
                        membershipActive: false,
                    };
                    await setDoc(doc(db, 'influencers', firebaseUser.uid), influencerProfileData);
                }
                
                if (role === 'livetv') {
                    const channelProfileData = {
                        name: firebaseUser.displayName || 'New Channel',
                        logo: `https://placehold.co/100x100/3f51b5/ffffff?text=${(firebaseUser.displayName || 'N').charAt(0)}`,
                        description: `A new channel on BIGYAPON, ready for advertisers.`,
                        audienceSize: 0,
                        niche: 'General',
                        ownerId: firebaseUser.uid,
                    };
                    await setDoc(doc(db, 'livetv_channels', firebaseUser.uid), channelProfileData);
                }

            }
            // If userDoc exists, it's a login, so we check if they are blocked.
            else {
                const profile = userDoc.data();
                if (profile.isBlocked) {
                    await signOut(auth);
                    // Throw an error to be caught by the UI and display a message.
                    throw new Error('This account has been blocked by an administrator.');
                }
            }
        } catch (error) {
            console.error("Google sign-in error:", error);
            throw error;
        }
    },

    logout: (): Promise<void> => {
        if (!isFirebaseConfigured) return Promise.resolve();
        return signOut(auth);
    },

    onAuthChange: (callback: (user: User | null) => void) => {
        // Fix: Add a guard to prevent crash if Firebase initialization failed.
        if (!isFirebaseConfigured) {
            callback(null);
            return () => {}; // Return a no-op unsubscribe function
        }
        return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
            if (firebaseUser) {
                try {
                    // Check if the user was just created to apply a more patient retry strategy for the signup race condition.
                    const creationTimestamp = firebaseUser.metadata.creationTime ? new Date(firebaseUser.metadata.creationTime).getTime() : 0;
                    const now = new Date().getTime();
                    const isNewUser = (now - creationTimestamp) < 10000; // User created in the last 10 seconds.
                    
                    const attempts = isNewUser ? 6 : 3; // 6 attempts for new users (~3s), 3 for existing (~1.5s)
                    const delay = 500;

                    let profile: Omit<User, 'id' | 'email'> | null = null;
                    for (let i = 0; i < attempts; i++) {
                        try {
                            profile = await getUserProfile(firebaseUser.uid);
                            break; // Success, profile found.
                        } catch (error) {
                            if (error instanceof Error && error.message.includes('User profile not found')) {
                                if (i < attempts - 1) { // If it's not the last attempt
                                    await new Promise(res => setTimeout(res, delay)); // Wait and retry
                                } else {
                                    throw error; // Rethrow on the last attempt
                                }
                            } else {
                                throw error; // Rethrow other critical errors immediately
                            }
                        }
                    }

                    if (!profile) {
                         // This should now be even less likely to be hit.
                        throw new Error('User profile could not be fetched after multiple attempts.');
                    }
                    
                    // Security check: if user is blocked, sign them out.
                    if (profile.isBlocked) {
                        await signOut(auth);
                        callback(null);
                        return;
                    }
                    
                    // Backfill PI Number for existing users
                    if (!profile.piNumber) {
                        profile.piNumber = generatePiNumber();
                        const userDocRef = doc(db, 'users', firebaseUser.uid);
                        // Asynchronously update the document in the background, don't wait for it
                        updateDoc(userDocRef, { piNumber: profile.piNumber }).catch(err => {
                            console.error("Failed to backfill PI number for user:", firebaseUser.uid, err);
                        });
                    }

                    callback({
                        id: firebaseUser.uid,
                        email: firebaseUser.email || `${firebaseUser.phoneNumber}@collabzz.phone`,
                        ...profile
                    });
                } catch (error) {
                    console.error("Failed to fetch user profile, logging out.", error);
                     if (error instanceof Error && error.message.includes('User profile not found')) {
                        console.log("User authenticated but profile does not exist after retries. This might indicate an incomplete signup or auth without profile.");
                     }
                    // If we are not already signed out, do so.
                    if (auth.currentUser) {
                        await signOut(auth);
                    }
                    callback(null);
                }
            } else {
                callback(null);
            }
        });
    },
    
    sendPasswordResetEmail: (email: string): Promise<void> => {
        if (!isFirebaseConfigured) throw new Error("Firebase is not configured.");
        return sendPasswordResetEmail(auth, email);
    },

    updateUserPassword: async (newPassword: string): Promise<void> => {
        if (!isFirebaseConfigured) throw new Error("Firebase is not configured.");
        const user = auth.currentUser;
        if (!user) {
            throw new Error("No authenticated user found. Please verify OTP again.");
        }
        await updatePassword(user, newPassword);
        // Sign out after password update for a clean flow
        await signOut(auth);
    },
};