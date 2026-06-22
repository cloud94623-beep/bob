import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBE4s5yaTrBJwLNvIelRpZxqdI7z-sY95w",
  authDomain: "bobmookza.firebaseapp.com",
  projectId: "bobmookza",
  storageBucket: "bobmookza.firebasestorage.app",
  messagingSenderId: "325504639664",
  appId: "1:325504639664:web:1602b99fcc596ac8675175",
  measurementId: "G-X5CCMSZT5L"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);