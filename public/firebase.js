// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDIeQx6EldshkaQiUZu95pUHLLZr6dVnJA",
  authDomain: "game2-55d0d.firebaseapp.com",
  projectId: "game2-55d0d",
  storageBucket: "game2-55d0d.appspot.com",
  messagingSenderId: "667929912085",
  appId: "1:667929912085:web:10745997492c09d4a63f1c"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
