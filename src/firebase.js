// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAK7otf-wQ6kjjqMRrZYE3Smsqd-ajZ4sc",
  authDomain: "login-7758a.firebaseapp.com",
  databaseURL: "https://login-7758a-default-rtdb.firebaseio.com",
  projectId: "login-7758a",
  storageBucket: "login-7758a.firebasestorage.app",
  messagingSenderId: "617725845152",
  appId: "1:617725845152:web:e9942ead617a9a2cc3b3c5",
  measurementId: "G-D4WF4HRSB8",
};

const app = initializeApp(firebaseConfig);
export const db      = getFirestore(app);
export const auth    = getAuth(app);
export const storage = getStorage(app);
export default app;