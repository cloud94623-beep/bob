// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 고운님의 실제 Firebase 설정 정보
const firebaseConfig = {
  apiKey: "AIzaSyBE4s5yaTrBJwLNvIelRpZxqdI7z-sY95w",
  authDomain: "bobmookza.firebaseapp.com",
  projectId: "bobmookza",
  storageBucket: "bobmookza.firebasestorage.app",
  messagingSenderId: "325504639664",
  appId: "1:325504639664:web:1602b99fcc596ac8675175",
  measurementId: "G-X5CCMSZT5L"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// 데이터베이스(Firestore) 내보내기
export const db = getFirestore(app);