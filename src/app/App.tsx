import { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { Html5Qrcode } from 'html5-qrcode';
import { Settings, LogOut, DoorOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const firebaseConfig = {
  apiKey: "AIzaSyCLapVEVmZws78Qhz5TOge27II-FJ9_h-8",
  authDomain: "parentsdaypoints.firebaseapp.com",
  projectId: "parentsdaypoints",
  storageBucket: "parentsdaypoints.firebasestorage.app",
  messagingSenderId: "370962255540",
  appId: "1:370962255540:web:4ee1e08f9a150b412691e1",
  measurementId: "G-Z3X08RS4DP"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

type Screen = 'home' | 'scanning' | 'input' | 'settings';

interface ColorSettings {
  background: string;
  pointsText: string;
  button: string;
}

const defaultColors: ColorSettings = {
  background: '#0f172a',
  pointsText: '#ffffff',
  button: '#4f46e5'
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [points, setPoints] = useState(0);
  const [screen, setScreen] = useState<Screen>('home');
  const [inputValue, setInputValue] = useState('');
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const [colors, setColors] = useState<ColorSettings>(defaultColors);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const savedColors = localStorage.getItem('colorSettings');
    if (savedColors) {
      setColors(JSON.parse(savedColors));
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          setPoints(userDoc.exists() ? (userDoc.data().points || 0) : 0);
        } catch (e) {
          console.error("Firestore Error:", e);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handleColorChange = (key: keyof ColorSettings, value: string) => {
    const newColors = { ...colors, [key]: value };
    setColors(newColors);
    localStorage.setItem('colorSettings', JSON.stringify(newColors));
  };

  const handleLogout = async () => {
    setLoggingOut(true);

    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      await signOut(auth);
      setScreen('home');
      setLoggingOut(false);
    } catch (error) {
      console.error("Logout Error:", error);
      setLoggingOut(false);
    }
  };

  const handleLogin = async () => {
    if (window.location.protocol === 'blob:') {
      alert("התחברות גוגל אינה נתמכת ב-Preview. ברגע שתעלה לאתר אמיתי, החיבור יעבוד.");
      return;
    }

    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Popup Error:", error);
      alert("שגיאת התחברות: " + error.message);
    }
  };

  const handleScan = () => {
    setScreen('scanning');
  };

  useEffect(() => {
    if (screen === 'scanning') {
      const startScanner = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));

        const html5QrCode = new Html5Qrcode("reader");
        setScanner(html5QrCode);

        try {
          await html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: 250 },
            async (text) => {
              html5QrCode.stop().then(() => {
                setScreen('input');
                setInputValue('');
              });
            }
          );
        } catch (err) {
          console.error("QR Error:", err);
          alert("שגיאת מצלמה. וודא שנתת הרשאת גישה למצלמה.");
          setScreen('home');
        }
      };

      startScanner();
    }
  }, [screen]);

  const handleConfirm = async () => {
    const pointsToAdd = parseInt(inputValue) || 0;

    if (pointsToAdd <= 0) {
      alert("נא להזין מספר תקין");
      return;
    }

    const newPoints = points + pointsToAdd;
    setPoints(newPoints);

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid), { points: newPoints }, { merge: true });
      } catch (e) {
        console.error("Firestore Save Error:", e);
      }
    }

    setScreen('home');
    alert(`כל הכבוד! ${pointsToAdd} נקודות נוספו.`);
  };

  if (!user) {
    return (
      <div className="size-full text-white flex items-center justify-center p-6" style={{ backgroundColor: colors.background }} dir="rtl">
        <motion.div
          className="max-w-sm w-full text-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.h1
            className="text-2xl font-bold mb-6 text-indigo-400"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            ברוכים הבאים
          </motion.h1>
          <motion.button
            onClick={handleLogin}
            className="w-full bg-white text-black py-3 rounded-xl font-bold hover:bg-gray-200 transition"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            התחבר עם Google
          </motion.button>
        </motion.div>
      </div>
    );
  }

  if (screen === 'settings') {
    return (
      <div className="size-full text-white flex items-center justify-center p-6" style={{ backgroundColor: colors.background }} dir="rtl">
        <AnimatePresence>
          {loggingOut && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ backgroundColor: colors.background }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="relative w-full h-full flex items-center justify-center">
                <motion.div
                  className="absolute"
                  initial={{ x: '40vw', y: 0, scale: 0.5 }}
                  animate={{
                    x: [null, 0, -20, 0, -20, 0, '-40vw'],
                    y: [null, -30, -60, -30, -60, -30, 0],
                    scale: [null, 0.7, 0.9, 0.7, 0.9, 0.7, 1]
                  }}
                  transition={{
                    duration: 2,
                    times: [0, 0.3, 0.45, 0.6, 0.75, 0.85, 1],
                    ease: "easeInOut"
                  }}
                >
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl">
                    <svg viewBox="0 0 24 24" className="w-12 h-12">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                </motion.div>

                <motion.div
                  className="absolute flex flex-col items-center gap-2"
                  initial={{ x: '-40vw', opacity: 0.5 }}
                  animate={{ opacity: 1 }}
                >
                  <DoorOpen size={80} className="text-red-500" />
                  <div className="text-2xl font-bold">LOG OUT</div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className="max-w-sm w-full"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h2 className="text-2xl font-bold mb-6 text-center">הגדרות</h2>
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">

            <div className="mb-6">
              <label className="block text-slate-300 mb-2">צבע רקע</label>
              <motion.input
                type="color"
                value={colors.background}
                onChange={(e) => handleColorChange('background', e.target.value)}
                className="w-full h-12 rounded-xl cursor-pointer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              />
            </div>

            <div className="mb-6">
              <label className="block text-slate-300 mb-2">צבע טקסט נקודות</label>
              <motion.input
                type="color"
                value={colors.pointsText}
                onChange={(e) => handleColorChange('pointsText', e.target.value)}
                className="w-full h-12 rounded-xl cursor-pointer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              />
            </div>

            <div className="mb-6">
              <label className="block text-slate-300 mb-2">צבע כפתורים</label>
              <motion.input
                type="color"
                value={colors.button}
                onChange={(e) => handleColorChange('button', e.target.value)}
                className="w-full h-12 rounded-xl cursor-pointer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              />
            </div>

            <motion.button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full bg-red-600 hover:bg-red-500 py-3 rounded-xl font-bold transition mb-3 disabled:opacity-50 flex items-center justify-center gap-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <LogOut size={20} />
              התנתק
            </motion.button>

            <motion.button
              onClick={() => setScreen('home')}
              className="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-bold transition"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              חזור
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (screen === 'scanning') {
    return (
      <div className="size-full text-white flex items-center justify-center p-6" style={{ backgroundColor: colors.background }} dir="rtl">
        <motion.div
          className="max-w-sm w-full"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <motion.h2
            className="text-lg font-bold mb-3 text-center"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            סרוק את קוד ה-QR
          </motion.h2>
          <motion.div
            id="reader"
            className="rounded-xl border-2 border-slate-700 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          />
          <motion.button
            onClick={() => {
              scanner?.stop();
              setScreen('home');
            }}
            className="w-full mt-4 bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-bold transition"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            ביטול
          </motion.button>
        </motion.div>
      </div>
    );
  }

  if (screen === 'input') {
    return (
      <div className="size-full text-white flex items-center justify-center p-6" style={{ backgroundColor: colors.background }} dir="rtl">
        <motion.div
          className="max-w-sm w-full"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h2 className="text-lg font-bold mb-3 text-center">
            שלום, {user.displayName || "משתמש"}
          </h2>
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center shadow-lg">
            <p className="text-slate-400 text-xs mb-1">יתרת נקודות נוכחית</p>
            <motion.div
              className="text-3xl font-black mb-6"
              style={{ color: colors.pointsText }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {points}
            </motion.div>

            <p className="text-slate-300 mb-3">הזן כמות נקודות להוספה:</p>
            <input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full bg-slate-700 text-white text-center text-2xl py-3 px-4 rounded-xl mb-4 border border-slate-600 focus:outline-none focus:border-indigo-500"
              placeholder="0"
              autoFocus
            />

            <motion.button
              onClick={handleConfirm}
              className="w-full py-3 rounded-xl font-bold transition mb-3 hover:opacity-90"
              style={{ backgroundColor: colors.button, color: 'white' }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              אישור
            </motion.button>

            <motion.button
              onClick={() => setScreen('home')}
              className="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-bold transition"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              ביטול
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="size-full text-white flex items-center justify-center p-6" style={{ backgroundColor: colors.background }} dir="rtl">
      <motion.div
        className="max-w-sm w-full relative"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.button
          onClick={() => setScreen('settings')}
          className="absolute left-0 top-0 p-2 bg-slate-800 rounded-xl hover:bg-slate-700 transition"
          aria-label="הגדרות"
          whileHover={{ rotate: 180, scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          transition={{ duration: 0.3 }}
        >
          <Settings size={24} />
        </motion.button>

        <h2 className="text-lg font-bold mb-3 text-center">
          שלום, {user.displayName || "משתמש"}
        </h2>
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center shadow-lg">
          <p className="text-slate-400 text-xs mb-1">יתרת נקודות</p>
          <motion.div
            className="text-5xl font-black mb-6"
            style={{ color: colors.pointsText }}
            key={points}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {points}
          </motion.div>
          <motion.button
            onClick={handleScan}
            className="w-full py-3 rounded-xl font-bold transition hover:opacity-90"
            style={{ backgroundColor: colors.button, color: 'white' }}
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.95 }}
          >
            סריקת קוד QR
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}