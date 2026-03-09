import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBSPEhgIG6wgb7kGlHJjHz2Eyb2MW7RCw0",
  authDomain: "chumon-kanri.firebaseapp.com",
  projectId: "chumon-kanri",
  storageBucket: "chumon-kanri.firebasestorage.app",
  messagingSenderId: "257303131550",
  appId: "1:257303131550:web:eda1e6294779db23dd128f"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);