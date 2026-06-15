import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 고운님의 밥묵자 웹앱 파이어베이스 열쇠
const firebaseConfig = {
  apiKey: "AIzaSyBE4s5yaTrBJwLNvIelRpZxqdI7z-sY95w",
  authDomain: "bobmookza.firebaseapp.com",
  projectId: "bobmookza",
  storageBucket: "bobmookza.firebasestorage.app",
  messagingSenderId: "325504639664",
  appId: "1:325504639664:web:1602b99fcc596ac8675175",
  measurementId: "G-X5CCMSZT5L"
};

// 파이어베이스 초기화 및 데이터베이스(db) 연결
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 다른 파일(App.jsx)에서 이 창고(db)를 쓸 수 있게 내보내기
export { db };