import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getViteEnv } from './runtimeEnv';

const firebaseConfig = {
    apiKey: getViteEnv('VITE_FIREBASE_API_KEY', 'AIzaSyDa-eZ3YJP8UFkkZRRWtrwLqcFGFkcFoHo'),
    authDomain: getViteEnv('VITE_FIREBASE_AUTH_DOMAIN', 'fir-bestpg.firebaseapp.com'),
    projectId: getViteEnv('VITE_FIREBASE_PROJECT_ID', 'fir-bestpg'),
    storageBucket: getViteEnv('VITE_FIREBASE_STORAGE_BUCKET', 'fir-bestpg.firebasestorage.app'),
    messagingSenderId: getViteEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '1020918069137'),
    appId: getViteEnv('VITE_FIREBASE_APP_ID', '1:1020918069137:web:68d07d4ad67f955c228c30'),
};

const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(firebaseApp);
