import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCk1ADiOIC438nEs_1UWNibqvOP4ltLvtI",
  authDomain: "crictracker-c3cbf.firebaseapp.com",
  projectId: "crictracker-c3cbf",
  storageBucket: "crictracker-c3cbf.firebasestorage.app",
  messagingSenderId: "967533604326", 
  appId: "1:967533604326:web:123456abcdef" 
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);