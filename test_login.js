import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import fs from 'fs';

const firebaseConfigStr = fs.readFileSync('src/firebase.js', 'utf8');
// This is a bit hacky to parse, let's just run it dynamically or copy the config.
