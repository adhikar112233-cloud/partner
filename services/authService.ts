
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
    updatePassword,
    updateEmail
} from 'firebase/auth';
// Fix: Corrected Firebase imports for 'doc', 'setDoc', 'getDoc', and 'Timestamp' to align with Firebase v9 modular syntax.
import { doc, setDoc, getDoc, Timestamp, updateDoc } from 'firebase/firestore';

const DEFAULT_AVATAR_URL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDEyYzIuMjEgMCA0LTEuNzkgNC00cy0xLjc5LTQtNC00LTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDRjMCAwIDAtMSAwLTJoMTJ2Mmg0di00YzAtMi42Ni01LjMzLTQtOC00eiIvPjwvc3ZnPg==';

const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const isValidIndianMobile = (mobile: string): boolean => {
    const mobileRegex = /^[6-9]\d{9}$/;
    return mobileRegex.test(mobile);
};

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
            referralCode: data.referralCode,
            referredBy: data.referredBy,
            coins: data.coins || 0,
            followers: data.followers || [],
            following: data.following || [],
            savedBankDetails: data.savedBankDetails,
            savedUpiId: data.savedUpiId,
            isUpiVerified: data.isUpiVerified,
            fcmToken: data.fcmToken,
        };
    }
    throw new Error('User profile not found.');
};

export const authService = {
    register: async (email: string, password: string, role: UserRole, name: string, companyName: string, mobileNumber: string, referralCode?: string): Promise<User> => {
        if (!isFirebaseConfigured) throw new Error("Firebase is not configured.");
        
        if (!isValidEmail(email)) {
            throw new Error("Invalid email format provided.");
        }
        if (!isValidIndianMobile(mobileNumber)) {
            throw new Error("Invalid mobile number. Must be 10 digits and start with 6, 7, 8, or 9.");
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;

        return await authService.createUserProfile(firebaseUser.uid, email, role, name, companyName, mobileNumber, referralCode);
    },

    // New method to handle registration after phone is already verified
    registerAfterPhoneAuth: async (email: string, password: string, role: UserRole, name: string, companyName: string, mobileNumber: string, referralCode?: string): Promise<User> => {
        if (!isFirebaseConfigured) throw new Error("Firebase is not configured.");
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("No authenticated user found. Please verify OTP first.");

        // Link Email/Password to the existing Phone Auth user
        try {
            await updateEmail(currentUser, email);
            await updatePassword(currentUser, password);
        } catch (error: any) {
            if (error.code === 'auth/email-already-in-use') {
                throw new Error("This email is already associated with another account.");
            }
            if (error.code === 'auth/requires-recent-login') {
                throw new Error("Session expired. Please verify OTP again.");
            }
            throw error;
        }

        return await authService.createUserProfile(currentUser.uid, email, role, name, companyName, mobileNumber, referralCode);
    },

    createUserProfile: async (uid: string, email: string, role: UserRole, name: string, companyName: string, mobileNumber: string, referralCode?: string): Promise<User> => {
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
            email,
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
            coins: 0,
            followers: [],
            following: [],
        };

        if (role === 'staff') {
            userProfileData.staffPermissions = ['super_admin'];
        }

        await setDoc(doc(db, 'users', uid), userProfileData);

        if (referralCode) {
            try {
                await apiService.applyReferralCode(uid, referralCode);
                userProfileData.coins = 20; 
                userProfileData.referredBy = referralCode;
            } catch (error) {
                console.error("Failed to apply referral code:", error);
            }
        }

        if (role === 'influencer') {
            const influencerProfileData = {
                name,
                handle: email.split('@')[0],
                avatar: DEFAULT_AVATAR_URL,
                bio: 'A passionate creator ready to collaborate!',
                followers: 0,
                niche: 'Lifestyle',
                engagementRate: 0,
                socialMediaLinks: '',
                location: '',
                membershipActive: false,
            };
            await setDoc(doc(db, 'influencers', uid), influencerProfileData);
        }
        
        if (role === 'livetv') {
            const channelProfileData = {
                name: companyName || name,
                logo: `https://placehold.co/100x100/3f51b5/ffffff?text=${(companyName || name).charAt(0)}`,
                description: `A new channel on BIGYAPON, ready for advertisers.`,
                audienceSize: 0,
                niche: 'General',
                ownerId: uid,
            };
            await setDoc(doc(db, 'livetv_channels', uid), channelProfileData);
        }

        return {
            id: uid,
            email: email,
            ...userProfileData
        } as User;
    },

    login: async (identifier: string, password_input: string): Promise<User> => {
        if (!isFirebaseConfigured) throw new Error("Firebase is not configured.");
        let emailToLogin = identifier;

        if (!identifier.includes('@')) {
            const userProfile = await apiService.getUserByMobile(identifier);
            if (userProfile && userProfile.email) {
                emailToLogin = userProfile.email;
            } else {
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
                await authService.createUserProfile(firebaseUser.uid, firebaseUser.email!, role, firebaseUser.displayName || 'New User', '', firebaseUser.phoneNumber || '');
            } else {
                const profile = userDoc.data();
                if (profile.isBlocked) {
                    await signOut(auth);
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
        if (!isFirebaseConfigured) {
            callback(null);
            return () => {};
        }
        return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
            if (firebaseUser) {
                try {
                    const creationTimestamp = firebaseUser.metadata.creationTime ? new Date(firebaseUser.metadata.creationTime).getTime() : 0;
                    const now = new Date().getTime();
                    const isNewUser = (now - creationTimestamp) < 10000; 
                    
                    const attempts = isNewUser ? 6 : 3;
                    const delay = 500;

                    let profile: Omit<User, 'id' | 'email'> | null = null;
                    for (let i = 0; i < attempts; i++) {
                        try {
                            profile = await getUserProfile(firebaseUser.uid);
                            break; 
                        } catch (error) {
                            if (error instanceof Error && error.message.includes('User profile not found')) {
                                if (i < attempts - 1) { 
                                    await new Promise(res => setTimeout(res, delay)); 
                                } else {
                                    throw error; 
                                }
                            } else {
                                throw error; 
                            }
                        }
                    }

                    if (!profile) {
                        throw new Error('User profile could not be fetched after multiple attempts.');
                    }
                    
                    if (profile.isBlocked) {
                        await signOut(auth);
                        callback(null);
                        return;
                    }
                    
                    if (!profile.piNumber) {
                        profile.piNumber = generatePiNumber();
                        const userDocRef = doc(db, 'users', firebaseUser.uid);
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
        await signOut(auth);
    },
};
