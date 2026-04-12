/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc,
  updateDoc,
  getDocFromServer,
  deleteDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, UserRole, MenuItem, Order, OrderStatus } from './types';
import { INITIAL_MENU_ITEMS, VENDOR_ID } from './constants';
import { cn } from './lib/utils';
import { 
  Utensils, 
  ShoppingBag, 
  User as UserIcon, 
  Settings, 
  LogOut, 
  Plus, 
  Trash2, 
  CheckCircle, 
  Clock, 
  ChefHat, 
  LayoutDashboard,
  Menu as MenuIcon,
  X,
  ChevronRight,
  CreditCard,
  Phone,
  MapPin,
  Search,
  Camera,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'react-hot-toast';
import { usePaystackPayment } from 'react-paystack';

// --- Contexts ---
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInEmail: (email: string, pass: string) => Promise<void>;
  signUpEmail: (email: string, pass: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// --- Connection Test ---
async function testConnection() {
  try {
    const { getDocFromServer, doc } = await import('firebase/firestore');
    console.log("[DEBUG] Attempting Firestore connection test...");
    const testDoc = await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("[DEBUG] Firestore connection successful. Doc exists:", testDoc.exists());
  } catch (error) {
    console.error("[DEBUG] Firestore Connection Error Details:", error);
    if (error instanceof Error) {
      console.error("[DEBUG] Error Message:", error.message);
      if (error.message.includes('the client is offline')) {
        console.error("CRITICAL: Firestore client is offline. This usually means the Project ID or Database ID is incorrect.");
      }
    }
  }
}
testConnection();

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  toast.error(`Permission denied: ${operationType} on ${path}`);
  throw new Error(JSON.stringify(errInfo));
}

// --- Components ---

const OrderTracker = ({ status }: { status: OrderStatus }) => {
  const steps: { key: OrderStatus; label: string; icon: any }[] = [
    { key: 'pending', label: 'Placed', icon: Clock },
    { key: 'preparing', label: 'Preparing', icon: Utensils },
    { key: 'ready', label: 'Ready', icon: ShoppingBag },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle },
  ];

  if (status === 'cancelled') {
    return (
      <div className="bg-red-50 p-4 rounded-2xl flex items-center gap-3 text-red-600">
        <X className="h-5 w-5" />
        <span className="font-bold text-sm uppercase tracking-wider">Order Cancelled</span>
      </div>
    );
  }

  const currentStepIndex = steps.findIndex(s => s.key === status);

  return (
    <div className="relative pt-8 pb-4">
      <div className="absolute top-12 left-0 w-full h-1 bg-gray-100 rounded-full"></div>
      <div 
        className="absolute top-12 left-0 h-1 bg-orange-500 rounded-full transition-all duration-1000"
        style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
      ></div>
      
      <div className="relative flex justify-between">
        {steps.map((step, idx) => {
          const isCompleted = idx <= currentStepIndex;
          const isActive = idx === currentStepIndex;
          const Icon = step.icon;

          return (
            <div key={step.key} className="flex flex-col items-center gap-2">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 z-10",
                isCompleted ? "bg-orange-500 text-white shadow-lg shadow-orange-200" : "bg-white text-gray-300 border-2 border-gray-100",
                isActive && "ring-4 ring-orange-100 scale-110"
              )}>
                <Icon className="h-5 w-5" />
              </div>
              <span className={cn(
                "text-[10px] font-black uppercase tracking-tighter",
                isCompleted ? "text-orange-600" : "text-gray-300"
              )}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Navbar = () => {
  const { user, profile, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50">
      {!user && (
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-gradient-to-r from-orange-600 to-orange-500 text-white py-2.5 px-4 text-center text-[10px] sm:text-xs font-black tracking-widest uppercase shadow-sm relative overflow-hidden"
        >
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
          <span className="relative z-10 flex items-center justify-center gap-2">
            <span className="animate-pulse">✨</span>
            Welcome to Miracle Bite's! 
            <Link to="/login" className="bg-white/20 px-2 py-0.5 rounded hover:bg-white/30 transition-all">Sign in</Link> 
            or 
            <Link to="/signup" className="bg-white/20 px-2 py-0.5 rounded hover:bg-white/30 transition-all">Create account</Link> 
            to start ordering!
            <span className="animate-pulse">✨</span>
          </span>
        </motion.div>
      )}
      <nav className="bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <div className="bg-orange-500 p-2 rounded-lg">
                <Utensils className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 tracking-tight">Miracle Bite's</span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            {user ? (
              <>
                <Link to="/menu" className="text-gray-600 hover:text-orange-500 font-medium transition-colors">Menu</Link>
                <Link to="/orders" className="text-gray-600 hover:text-orange-500 font-medium transition-colors">My Orders</Link>
                {(profile?.role === 'vendor' || profile?.role === 'admin') && (
                  <Link to="/vendor" className="text-gray-600 hover:text-orange-500 font-medium transition-colors flex items-center gap-1">
                    <ChefHat className="h-4 w-4" /> Vendor Portal
                  </Link>
                )}
                {profile?.role === 'admin' && (
                  <Link to="/admin" className="text-gray-600 hover:text-orange-500 font-medium transition-colors flex items-center gap-1">
                    <Settings className="h-4 w-4" /> Admin
                  </Link>
                )}
                <div className="flex items-center space-x-4 border-l pl-8 ml-4 border-gray-100">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{profile?.displayName}</p>
                    <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
                  </div>
                  <button 
                    onClick={logout}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <Link 
                  to="/login" 
                  className="text-gray-600 hover:text-orange-500 font-semibold transition-colors"
                >
                  Sign In
                </Link>
                <Link 
                  to="/signup" 
                  className="bg-orange-500 text-white px-6 py-2 rounded-full font-semibold hover:bg-orange-600 transition-all shadow-lg shadow-orange-200"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-gray-600">
              {isMenuOpen ? <X className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-gray-100 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-2">
              {user ? (
                <>
                  <Link to="/menu" className="block px-3 py-2 text-gray-600 font-medium">Menu</Link>
                  <Link to="/orders" className="block px-3 py-2 text-gray-600 font-medium">My Orders</Link>
                  {(profile?.role === 'vendor' || profile?.role === 'admin') && <Link to="/vendor" className="block px-3 py-2 text-orange-600 font-medium">Vendor Portal</Link>}
                  {profile?.role === 'admin' && <Link to="/admin" className="block px-3 py-2 text-blue-600 font-medium">Admin Portal</Link>}
                  <button onClick={logout} className="w-full text-left px-3 py-2 text-red-600 font-medium">Sign Out</button>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link to="/login" className="block px-3 py-2 text-gray-600 font-bold text-center">Sign In</Link>
                  <Link to="/signup" className="block px-3 py-4 bg-orange-500 text-white rounded-xl font-bold text-center">Sign Up</Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
    </header>
  );
};

const LandingPage = () => {
  return (
    <div className="relative overflow-hidden">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-6xl font-black text-gray-900 leading-tight mb-6">
              Delicious Food <br />
              <span className="text-orange-500">Delivered Fast.</span>
            </h1>
            <p className="text-xl text-gray-600 mb-10 max-w-lg">
              Experience the best catering services in Oyarifa. From assorted fried rice to savory stir-fry noodles, we bring the miracle to your bite.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                to="/menu" 
                className="bg-orange-500 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-orange-600 transition-all shadow-xl shadow-orange-200 flex items-center justify-center gap-2"
              >
                Order Now <ChevronRight className="h-5 w-5" />
              </Link>
              <Link 
                to="/signup" 
                className="bg-white text-gray-900 border-2 border-gray-100 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
              >
                Create Account
              </Link>
            </div>
            
            <div className="mt-12 flex items-center gap-8">
              <div>
                <p className="text-3xl font-bold text-gray-900">15 min</p>
                <p className="text-sm text-gray-500">Avg. Prep Time</p>
              </div>
              <div className="w-px h-10 bg-gray-200"></div>
              <div>
                <p className="text-3xl font-bold text-gray-900">4.9/5</p>
                <p className="text-sm text-gray-500">Customer Rating</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-orange-100 rounded-full blur-3xl opacity-50"></div>
            <div className="absolute -bottom-10 -right-10 w-60 h-60 bg-yellow-100 rounded-full blur-3xl opacity-50"></div>
            <img 
              src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80" 
              alt="Miracle Bite's Restaurant Setting" 
              className="relative rounded-[3rem] shadow-2xl border-8 border-white aspect-square object-cover"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

const LoginPage = () => {
  const { signIn, signInEmail, user, profile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user && profile) {
      if (!profile.onboardingCompleted) {
        navigate('/onboarding');
      } else if (profile.role === 'admin') {
        navigate('/admin');
      } else if (profile.role === 'vendor') {
        navigate('/vendor');
      } else {
        navigate('/menu');
      }
    }
  }, [user, profile, navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      await signInEmail(email, password);
    } catch (error) {
      // Error handled in AuthProvider
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-2xl border border-gray-50"
      >
        <div className="text-center mb-8">
          <div className="bg-orange-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-200">
            <Utensils className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-2">Welcome Back</h2>
          <p className="text-gray-500">Choose your preferred login method</p>
        </div>

        {/* Primary Method: Google */}
        <button 
          onClick={signIn}
          className="w-full bg-white border-2 border-gray-100 py-4 rounded-2xl font-bold text-gray-700 hover:bg-gray-50 hover:border-orange-200 transition-all flex items-center justify-center gap-3 shadow-sm mb-6"
        >
          <div className="bg-white p-1 rounded-full border border-gray-100 flex items-center justify-center">
            <img src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png" className="h-5 w-5" alt="Google" />
          </div>
          Continue with Google
        </button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-widest"><span className="bg-white px-4 text-gray-400 font-bold">Or use email</span></div>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-4 mb-8">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Email Address</label>
            <input 
              required
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
              placeholder="name@example.com"
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-bold text-gray-700">Password</label>
              <Link to="/forgot-password" id="forgot-password-link" className="text-xs font-bold text-orange-500 hover:underline">Forgot Password?</Link>
            </div>
            <input 
              required
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
              placeholder="••••••••"
            />
          </div>
          <button 
            disabled={authLoading}
            type="submit"
            className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-xl shadow-orange-200 disabled:opacity-50"
          >
            {authLoading ? 'Signing in...' : 'Sign In with Email'}
          </button>
        </form>
        
        <div className="mt-8 pt-8 border-t border-gray-100 text-center space-y-4">
          <p className="text-sm text-gray-500">
            New to Miracle Bite's? <Link to="/signup" className="text-orange-500 font-bold hover:underline">Create an account</Link>
          </p>
          
          <div className="pt-4">
            <p className="text-xs text-gray-400 mb-3">Having trouble logging in?</p>
            <a 
              href="https://wa.me/233240084440" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-green-600 font-bold hover:text-green-700 transition-all text-sm"
            >
              <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" className="h-4 w-4" alt="WhatsApp" />
              Chat with Support
            </a>
          </div>
        </div>

        {/* Admin Debug Section */}
        {email === 'eotu907@gmail.com' && (
          <div className="mt-8 p-4 bg-gray-50 rounded-2xl border border-gray-100 text-[10px] font-mono text-gray-400 overflow-hidden">
            <p className="font-bold mb-1 text-gray-500 uppercase">Admin Debug Info</p>
            <p>Auth Domain: {auth.app.options.authDomain}</p>
            <p>API Key: {auth.app.options.apiKey ? 'Present' : 'Missing'}</p>
            <p>Origin: {window.location.origin}</p>
            <p>Hostname: {window.location.hostname}</p>
            <p>Ready: {auth.currentUser ? 'Auth Active' : 'No User'}</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const ForgotPasswordPage = () => {
  const { resetPassword, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[DEBUG] ForgotPasswordPage handleSubmit called for:', email);
    setLoading(true);
    setError(null);
    try {
      await resetPassword(email);
      console.log('[DEBUG] resetPassword call succeeded');
      setSent(true);
      toast.success('Reset link sent to your email');
    } catch (err: any) {
      console.error('[DEBUG] resetPassword call failed:', err);
      setError(err.code || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDefaultReset = async () => {
    setLoading(true);
    setError(null);
    try {
      // Direct call to Firebase without custom redirect settings
      await sendPasswordResetEmail(auth, email);
      setSent(true);
      toast.success('Reset link sent (Default Flow)');
    } catch (err: any) {
      setError(`Default flow failed: ${err.code}`);
      toast.error(`Failed: ${err.code}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-2xl border border-gray-50"
      >
        <div className="text-center mb-8">
          <div className="bg-orange-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-200">
            <Settings className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-2">Account Recovery</h2>
          <p className="text-gray-500">Choose the easiest way to get back in.</p>
        </div>

        {/* Option 1: Google Recovery (Most Reliable) */}
        <div className="mb-8 p-6 bg-orange-50 rounded-3xl border border-orange-100">
          <p className="text-orange-900 font-bold text-sm mb-4 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-orange-500" /> Recommended Method
          </p>
          <p className="text-orange-700 text-xs mb-4">
            If you have a Google account, you can skip passwords entirely.
          </p>
          <button 
            onClick={signIn}
            className="w-full bg-white border-2 border-orange-200 py-3 rounded-xl font-bold text-orange-600 hover:bg-orange-100 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <img src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png" className="h-4 w-4" alt="Google" />
            Sign in with Google
          </button>
        </div>

        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-widest"><span className="bg-white px-4 text-gray-400 font-bold">Or Email Reset</span></div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-medium">
            <p className="mb-2">Error: {error}</p>
            <button 
              onClick={handleDefaultReset}
              className="w-full bg-red-600 text-white py-2 rounded-xl hover:bg-red-700 transition-all font-bold"
            >
              Try Emergency Reset Link
            </button>
          </div>
        )}

        {sent ? (
          <div className="text-center space-y-6">
            <div className="bg-green-50 p-6 rounded-2xl border border-green-100">
              <p className="text-green-700 font-bold mb-2">Email Sent!</p>
              <p className="text-green-600 text-xs">
                Check your inbox for the reset link.
              </p>
            </div>
            
            <div className="pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-4">Link not working? Use the manual code.</p>
              <Link 
                to="/reset-password" 
                className="inline-flex items-center gap-2 text-sm font-bold text-orange-500 hover:text-orange-600 transition-all"
              >
                Enter Code Manually <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <button 
              onClick={() => setSent(false)}
              className="text-sm font-bold text-gray-500 hover:text-orange-500"
            >
              Try another email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Email Address</label>
              <input 
                required
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="name@example.com"
              />
            </div>
            <button 
              disabled={loading}
              type="submit"
              className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-xl shadow-orange-200 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <div className="text-center">
              <Link to="/login" className="text-sm font-bold text-gray-500 hover:text-orange-500">
                Wait, I remember my password!
              </Link>
            </div>
          </form>
        )}

        <div className="mt-8 pt-8 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-500 mb-4">Still having trouble?</p>
          <a 
            href="https://wa.me/233240084440" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-green-500 text-white px-6 py-3 rounded-2xl font-bold hover:bg-green-600 transition-all shadow-lg shadow-green-100 text-sm"
          >
            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" className="h-5 w-5 invert brightness-0" alt="WhatsApp" />
            Chat with Support
          </a>
        </div>
      </motion.div>
    </div>
  );
};

const ResetPasswordPage = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'verifying' | 'ready' | 'success' | 'error' | 'manual'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const queryParams = new URLSearchParams(location.search);
  const urlCode = queryParams.get('oobCode');
  const activeCode = urlCode || manualCode;

  useEffect(() => {
    if (!urlCode) {
      setStatus('manual');
      return;
    }

    const verifyCode = async () => {
      try {
        await verifyPasswordResetCode(auth, urlCode);
        setStatus('ready');
      } catch (error: any) {
        console.error('Verify Reset Code Error:', error);
        setStatus('error');
        setErrorMessage(error.message || 'The reset link is invalid or has expired.');
      }
    };

    verifyCode();
  }, [urlCode]);

  const handleManualVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode) return;
    
    setLoading(true);
    try {
      await verifyPasswordResetCode(auth, manualCode);
      setStatus('ready');
      toast.success('Code verified successfully');
    } catch (error: any) {
      console.error('Manual Verify Error:', error);
      toast.error(error.message || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(auth, activeCode, newPassword);
      setStatus('success');
      toast.success('Password reset successfully');
    } catch (error: any) {
      console.error('Confirm Reset Error:', error);
      toast.error(error.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-2xl border border-gray-50"
      >
        <div className="text-center mb-8">
          <div className="bg-orange-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-200">
            <Settings className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-2">New Password</h2>
          <p className="text-gray-500">Create a secure password for your account.</p>
          <p className="text-[10px] text-gray-300 mt-2">v1.2.5-manual-entry</p>
        </div>

        {status === 'verifying' && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-500">Verifying reset link...</p>
          </div>
        )}

        {status === 'manual' && (
          <form onSubmit={handleManualVerify} className="space-y-6">
            <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100 mb-6">
              <p className="text-orange-800 text-sm font-medium mb-2">
                If the email link didn't work, follow these steps:
              </p>
              <ol className="text-orange-700 text-xs space-y-1 list-decimal ml-4">
                <li>Right-click the "Reset Password" button in your email.</li>
                <li>Select "Copy Link Address".</li>
                <li>Look for the part that says <strong>oobCode=</strong> in that link.</li>
                <li>Copy the long string of characters after it and paste it below.</li>
              </ol>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Recovery Code</label>
              <input 
                required
                type="text" 
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none font-mono text-sm"
                placeholder="Paste code here..."
              />
            </div>
            <button 
              disabled={loading || !manualCode}
              type="submit"
              className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-xl shadow-orange-200 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
            <Link to="/forgot-password" className="block text-center text-sm font-bold text-gray-500 hover:text-orange-500">
              Request a new code
            </Link>
          </form>
        )}

        {status === 'error' && (
          <div className="text-center space-y-6">
            <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
              <p className="text-red-700 font-medium mb-2">{errorMessage}</p>
              <p className="text-red-600 text-xs">The code might be expired or already used.</p>
            </div>
            <button 
              onClick={() => setStatus('manual')}
              className="w-full bg-white border-2 border-gray-100 py-4 rounded-2xl font-bold text-gray-700 hover:bg-gray-50 transition-all"
            >
              Try entering code manually
            </button>
            <Link 
              to="/forgot-password" 
              className="block w-full bg-orange-500 text-white py-4 rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-xl shadow-orange-200 text-center"
            >
              Request New Link
            </Link>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center space-y-6">
            <div className="bg-green-50 p-6 rounded-2xl border border-green-100">
              <p className="text-green-700 font-medium">Your password has been reset successfully!</p>
            </div>
            <Link 
              to="/login" 
              className="block w-full bg-orange-500 text-white py-4 rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-xl shadow-orange-200 text-center"
            >
              Go to Login
            </Link>
          </div>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">New Password</label>
              <input 
                required
                type="password" 
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Confirm Password</label>
              <input 
                required
                type="password" 
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="••••••••"
              />
            </div>
            <button 
              disabled={loading}
              type="submit"
              className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-xl shadow-orange-200 disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

const SignUpPage = () => {
  const { signIn, signUpEmail, user, profile } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user && profile) {
      if (!profile.onboardingCompleted) {
        navigate('/onboarding');
      } else {
        navigate('/menu');
      }
    }
  }, [user, profile, navigate]);

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      await signUpEmail(email, password, name);
    } catch (error) {
      // Error handled in AuthProvider
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-2xl border border-gray-50"
      >
        <div className="text-center mb-8">
          <div className="bg-orange-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-200">
            <Utensils className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-2">Create Account</h2>
          <p className="text-gray-500">Join the Miracle Bite's community</p>
        </div>

        <form onSubmit={handleEmailSignUp} className="space-y-4 mb-8">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Full Name</label>
            <input 
              required
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
              placeholder="John Doe"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Email Address</label>
            <input 
              required
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
              placeholder="name@example.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Password</label>
            <input 
              required
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
              placeholder="••••••••"
            />
          </div>
          <button 
            disabled={authLoading}
            type="submit"
            className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-xl shadow-orange-200 disabled:opacity-50"
          >
            {authLoading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-4 text-gray-400 font-bold">Or continue with</span></div>
        </div>
        
        <button 
          onClick={signIn}
          className="w-full bg-white border-2 border-gray-100 py-4 rounded-2xl font-bold text-gray-700 hover:bg-gray-50 transition-all flex items-center justify-center gap-3 shadow-sm"
        >
          <div className="bg-white p-1 rounded-full border border-gray-100 flex items-center justify-center">
            <img src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png" className="h-5 w-5" alt="Google" />
          </div>
          Google
        </button>
        
        <div className="mt-8 pt-8 border-t border-gray-100 text-center space-y-4">
          <p className="text-sm text-gray-500">
            Already have an account? <Link to="/login" className="text-orange-500 font-bold hover:underline">Sign in</Link>
          </p>
          
          <div className="pt-4">
            <p className="text-xs text-gray-400 mb-3">Need help with your account?</p>
            <a 
              href="https://wa.me/233240084440" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-green-600 font-bold hover:text-green-700 transition-all text-sm"
            >
              <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" className="h-4 w-4" alt="WhatsApp" />
              Chat with Support
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const OnboardingPage = () => {
  const { user, profile } = useAuth();
  const [formData, setFormData] = useState({ phoneNumber: '', address: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (profile?.onboardingCompleted) {
      navigate('/menu');
    }
  }, [profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        ...formData,
        onboardingCompleted: true,
        updatedAt: new Date().toISOString()
      });
      toast.success('Registration complete!');
      navigate('/menu');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <Navigate to="/login" />;

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-2xl border border-gray-50"
      >
        <h2 className="text-3xl font-black text-gray-900 mb-2">Complete Profile</h2>
        <p className="text-gray-500 mb-8">We need a few more details to handle your catering orders.</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input 
                required
                type="tel" 
                value={formData.phoneNumber}
                onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="e.g. 024 000 0000"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Delivery Address</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-4 h-5 w-5 text-gray-400" />
              <textarea 
                required
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none h-32"
                placeholder="Your full delivery address in Accra..."
              />
            </div>
          </div>
          
          <button 
            disabled={loading}
            type="submit"
            className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-orange-600 transition-all shadow-xl shadow-orange-200 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Complete Registration'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const MenuPage = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<{item: MenuItem, quantity: number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'momo'>('momo');
  const [isProcessing, setIsProcessing] = useState(false);
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const totalAmount = cart.reduce((sum, i) => sum + (i.item.price * i.quantity), 0);

  const paystackConfig = React.useMemo(() => ({
    reference: (new Date()).getTime().toString(),
    email: user?.email || '',
    amount: Math.round(totalAmount * 100), // Amount in pesewas
    publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '',
    currency: 'GHS',
    metadata: {
      custom_fields: [
        {
          display_name: "Customer Name",
          variable_name: "customer_name",
          value: profile?.displayName || ""
        }
      ]
    }
  }), [user?.email, totalAmount, profile?.displayName]);

  const initializePayment = usePaystackPayment(paystackConfig);

  useEffect(() => {
    const q = query(collection(db, 'menuItems'), where('available', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
      setMenuItems(items);
      setLoading(false);
    }, (error) => {
      // Only log if it's not a permission error during initial load
      if (error.code !== 'permission-denied') {
        handleFirestoreError(error, OperationType.LIST, 'menuItems');
      }
    });

    return () => unsubscribe();
  }, []);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        return prev.map(i => i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { item, quantity: 1 }];
    });
    toast.success(`Added ${item.name} to cart`);
  };

  const placeOrder = async (isPaid: boolean = false) => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (cart.length === 0) return;

    setIsProcessing(true);
    try {
      const orderData = {
        customerId: user.uid,
        vendorId: VENDOR_ID,
        items: cart.map(i => ({
          menuItemId: i.item.id,
          name: i.item.name,
          price: i.item.price,
          quantity: i.quantity
        })),
        totalAmount,
        status: 'pending',
        deliveryMethod: 'delivery',
        paymentMethod,
        paymentStatus: isPaid ? 'paid' : 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'orders'), orderData);
      toast.success(isPaid ? 'Payment successful & Order placed!' : 'Order placed successfully!');
      setCart([]);
      navigate('/orders');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckout = () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (cart.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    if (paymentMethod === 'momo') {
      const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
      if (!publicKey) {
        toast.error('Paystack Public Key is missing. Please add VITE_PAYSTACK_PUBLIC_KEY to your environment variables in Settings.');
        console.error('MoMo Error: VITE_PAYSTACK_PUBLIC_KEY is not defined');
        return;
      }

      if (publicKey.startsWith('sk_')) {
        toast.error("You are using a SECRET key. Please use your PUBLIC key (starts with pk_). Check your Paystack settings.");
        console.error('MoMo Error: VITE_PAYSTACK_PUBLIC_KEY starts with sk_ (Secret Key)');
        return;
      }

      console.log('Initializing MoMo payment...', { 
        amount: paystackConfig.amount, 
        email: paystackConfig.email,
        ref: paystackConfig.reference 
      });

      const onSuccess = (reference: any) => {
        console.log('Payment successful. Reference:', reference);
        placeOrder(true);
      };

      const onClose = () => {
        console.log('Payment window closed by user');
        toast.error('Payment cancelled');
      };

      try {
        // Correct usage for this version of react-paystack
        initializePayment({ onSuccess, onClose });
      } catch (err) {
        console.error('Paystack Initialization Error:', err);
        toast.error('Could not open payment window. Please check your internet connection or try again.');
      }
    } else {
      placeOrder(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col lg:flex-row gap-12">
        {/* Menu Items */}
        <div className="flex-1">
          <h2 className="text-4xl font-black text-gray-900 mb-10">Our Menu</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {menuItems.map((item) => (
              <motion.div 
                key={item.id}
                whileHover={{ y: -5 }}
                className="bg-white p-6 rounded-[2rem] shadow-xl border border-gray-50 flex gap-6"
              >
                <img 
                  src={item.imageUrl || `https://picsum.photos/seed/${item.name}/200/200`} 
                  alt={item.name} 
                  className="w-32 h-32 rounded-2xl object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${item.name}/200/200`;
                  }}
                />
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-orange-500 uppercase tracking-wider">{item.category}</span>
                    <h3 className="text-xl font-bold text-gray-900 mt-1">{item.name}</h3>
                    <p className="text-sm text-gray-500 mt-2 line-clamp-2">{item.description}</p>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-2xl font-black text-gray-900">GH₵{(item.price ?? 0).toFixed(2)}</span>
                    <button 
                      onClick={() => addToCart(item)}
                      className="bg-orange-500 text-white p-3 rounded-xl hover:bg-orange-600 transition-all shadow-lg shadow-orange-100"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Cart Sidebar */}
        <div className="w-full lg:w-96">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-50 sticky top-24">
            <h3 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">
              <ShoppingBag className="h-6 w-6 text-orange-500" /> Your Cart
            </h3>
            
            {cart.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShoppingBag className="h-8 w-8 text-gray-300" />
                </div>
                <p className="text-gray-400 font-medium">Your cart is empty</p>
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-8 max-h-96 overflow-y-auto pr-2">
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl">
                      <div>
                        <p className="font-bold text-gray-900">{item.item.name}</p>
                        <p className="text-sm text-gray-500">x{item.quantity}</p>
                      </div>
                      <p className="font-bold text-gray-900">GH₵{((item.item.price ?? 0) * (item.quantity ?? 0)).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
                
                <div className="border-t border-gray-100 pt-6 space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 font-medium">Subtotal</span>
                      <span className="text-gray-900 font-bold">GH₵{(totalAmount ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                      <span className="text-xl font-black text-gray-900">Total</span>
                      <span className="text-2xl font-black text-orange-500">GH₵{(totalAmount ?? 0).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Payment Method</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setPaymentMethod('momo')}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all",
                          paymentMethod === 'momo' 
                            ? "border-orange-500 bg-orange-50 text-orange-600" 
                            : "border-gray-100 text-gray-400 hover:border-gray-200"
                        )}
                      >
                        <CreditCard className="h-4 w-4" />
                        <span className="text-[9px] font-black uppercase">Mobile Money</span>
                      </button>
                      <button
                        onClick={() => setPaymentMethod('cash')}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all",
                          paymentMethod === 'cash' 
                            ? "border-orange-500 bg-orange-50 text-orange-600" 
                            : "border-gray-100 text-gray-400 hover:border-gray-200"
                        )}
                      >
                        <Utensils className="h-4 w-4" />
                        <span className="text-[9px] font-black uppercase">Cash</span>
                      </button>
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleCheckout}
                    disabled={isProcessing}
                    className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-orange-600 transition-all shadow-xl shadow-orange-200 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        {paymentMethod === 'momo' ? 'Pay & Place Order' : 'Place Order'}
                        <ChevronRight className="h-5 w-5" />
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const OrdersPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const prevOrdersRef = React.useRef<Record<string, OrderStatus>>({});

  useEffect(() => {
    if (!user || authLoading) return;

    const q = query(
      collection(db, 'orders'), 
      where('customerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      
      // Notification Logic
      items.forEach(order => {
        const prevStatus = prevOrdersRef.current[order.id];
        if (prevStatus && prevStatus !== order.status) {
          const statusMessages: Record<string, string> = {
            preparing: "👨‍🍳 Your order is now being prepared!",
            ready: "🥡 Your order is ready for pickup/delivery!",
            delivered: "✅ Your order has been delivered! Enjoy your meal!",
            cancelled: "❌ Your order has been cancelled."
          };
          
          if (statusMessages[order.status]) {
            toast(statusMessages[order.status], {
              icon: '🔔',
              duration: 5000,
              style: {
                borderRadius: '1rem',
                background: '#333',
                color: '#fff',
                fontWeight: 'bold'
              }
            });
          }
        }
        prevOrdersRef.current[order.id] = order.status;
      });

      setOrders(items);
      setLoading(false);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        handleFirestoreError(error, OperationType.LIST, 'orders');
      }
    });

    return () => unsubscribe();
  }, [user, authLoading]);

  const cancelOrder = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { 
        status: 'cancelled', 
        updatedAt: new Date().toISOString() 
      });
      toast.success('Order cancelled successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const clearHistory = async () => {
    const ordersToClear = orders.filter(o => o.status === 'delivered' || o.status === 'cancelled');
    if (ordersToClear.length === 0) {
      toast.error('No completed or cancelled orders to clear');
      setShowClearConfirm(false);
      return;
    }

    try {
      const deletePromises = ordersToClear.map(order => deleteDoc(doc(db, 'orders', order.id)));
      await Promise.all(deletePromises);
      toast.success('Order history cleared');
      setShowClearConfirm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'orders');
    }
  };

  if (authLoading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>;
  if (!user) return <Navigate to="/login" />;
  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex justify-between items-center mb-10">
        <h2 className="text-4xl font-black text-gray-900">Order History</h2>
        {orders.some(o => o.status === 'delivered' || o.status === 'cancelled') && (
          <button 
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="h-4 w-4" /> Clear History
          </button>
        )}
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl text-center"
          >
            <div className="bg-red-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Trash2 className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">Clear History?</h3>
            <p className="text-gray-500 mb-8">This will permanently remove all delivered and cancelled orders from your history.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-3 rounded-xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={clearHistory}
                className="flex-1 py-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg shadow-red-100"
              >
                Clear All
              </button>
            </div>
          </motion.div>
        </div>
      )}
      
      <div className="space-y-6">
        {orders.length === 0 ? (
          <div className="bg-white p-12 rounded-[2.5rem] text-center shadow-xl border border-gray-50">
            <Clock className="h-16 w-16 text-gray-200 mx-auto mb-6" />
            <p className="text-xl text-gray-400 font-bold">No orders yet</p>
            <Link to="/menu" className="text-orange-500 font-bold mt-4 inline-block hover:underline">Start ordering now</Link>
          </div>
        ) : (
          orders.map((order) => (
            <motion.div 
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-50"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Order ID: {order.id.slice(0, 8)}</p>
                  <p className="text-sm text-gray-500 mt-1">{new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString()}</p>
                </div>
                <div className={cn(
                  "px-4 py-2 rounded-full text-sm font-bold capitalize",
                  order.status === 'pending' ? "bg-yellow-100 text-yellow-700" :
                  order.status === 'preparing' ? "bg-blue-100 text-blue-700" :
                  order.status === 'ready' ? "bg-green-100 text-green-700" :
                  order.status === 'delivered' ? "bg-gray-100 text-gray-700" :
                  "bg-red-100 text-red-700"
                )}>
                  {order.status}
                </div>
              </div>

              <div className="mb-8">
                <OrderTracker status={order.status} />
              </div>
              
              <div className="space-y-3 mb-6">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-gray-700">
                    <span>{item.name} x{item.quantity}</span>
                    <span className="font-medium">GH₵{((item.price ?? 0) * (item.quantity ?? 0)).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-between items-center pt-6 border-t border-gray-100">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <CreditCard className="h-4 w-4" />
                    <span>Paid via {order.paymentMethod.toUpperCase()}</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                      order.paymentStatus === 'paid' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    )}>
                      {order.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                    </span>
                  </div>
                  {order.status === 'pending' && (
                    <button 
                      onClick={() => cancelOrder(order.id)}
                      className="text-red-500 text-sm font-bold flex items-center gap-1 hover:text-red-600 transition-colors w-fit"
                    >
                      <X className="h-4 w-4" /> Cancel Order
                    </button>
                  )}
                </div>
                <p className="text-2xl font-black text-gray-900">Total: GH₵{(order.totalAmount ?? 0).toFixed(2)}</p>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

const VendorPortal = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'menu'>('orders');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState({ name: '', description: '', price: '', category: 'Main Meals', imageUrl: '' });
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { profile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!profile || (profile.role !== 'vendor' && profile.role !== 'admin') || authLoading) return;

    // Orders listener
    const qOrders = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    }, (error) => {
      if (error.code !== 'permission-denied') {
        handleFirestoreError(error, OperationType.LIST, 'orders');
      }
    });

    // Menu listener
    const qMenu = query(collection(db, 'menuItems'));
    const unsubMenu = onSnapshot(qMenu, (snapshot) => {
      setMenuItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem)));
    }, (error) => {
      if (error.code !== 'permission-denied') {
        handleFirestoreError(error, OperationType.LIST, 'menuItems');
      }
    });

    return () => { unsubOrders(); unsubMenu(); };
  }, [profile, authLoading]);

  if (authLoading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>;
  if (!profile || (profile.role !== 'vendor' && profile.role !== 'admin')) return <Navigate to="/" />;

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status, updatedAt: new Date().toISOString() });
      toast.success(`Order updated to ${status}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const toggleAvailability = async (itemId: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'menuItems', itemId), { available: !current });
      toast.success('Item availability updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `menuItems/${itemId}`);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'menuItems'), {
        ...itemForm,
        price: parseFloat(itemForm.price),
        available: true,
        vendorId: VENDOR_ID,
        imageUrl: itemForm.imageUrl || `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80`
      });
      toast.success('Menu item added');
      setIsAddingItem(false);
      setItemForm({ name: '', description: '', price: '', category: 'Main Meals', imageUrl: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'menuItems');
    }
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      await updateDoc(doc(db, 'menuItems', editingItem.id), {
        ...itemForm,
        price: parseFloat(itemForm.price),
        updatedAt: new Date().toISOString()
      });
      toast.success('Menu item updated');
      setEditingItem(null);
      setItemForm({ name: '', description: '', price: '', category: 'Main Meals', imageUrl: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `menuItems/${editingItem.id}`);
    }
  };

  const deleteItem = async (itemId: string) => {
    try {
      await deleteDoc(doc(db, 'menuItems', itemId));
      toast.success('Item deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `menuItems/${itemId}`);
    }
  };

  const startEditing = (item: MenuItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      description: item.description,
      price: item.price.toString(),
      category: item.category,
      imageUrl: item.imageUrl || ''
    });
    setIsAddingItem(false);
  };

  const startAdding = () => {
    setIsAddingItem(true);
    setEditingItem(null);
    setItemForm({ name: '', description: '', price: '', category: 'Main Meals', imageUrl: '' });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800000) { // ~800KB limit for Firestore
      toast.error('Image is too large. Please choose a smaller file (under 800KB).');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setItemForm(prev => ({ ...prev, imageUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-black text-gray-900">Vendor Dashboard</h2>
          <p className="text-gray-500 mt-2">Managing Miracle Bite's Catering Services</p>
        </div>
          <div className="flex bg-gray-100 p-1.5 rounded-2xl flex-wrap gap-2">
            <button 
              onClick={() => setActiveTab('orders')}
              className={cn(
                "px-6 py-3 rounded-xl font-bold transition-all",
                activeTab === 'orders' ? "bg-white text-orange-500 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              Orders ({orders.filter(o => o.status !== 'delivered').length})
            </button>
            <button 
              onClick={() => setActiveTab('menu')}
              className={cn(
                "px-6 py-3 rounded-xl font-bold transition-all",
                activeTab === 'menu' ? "bg-white text-orange-500 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              Menu Management
            </button>
            <button 
              onClick={async () => {
                const confirmed = window.confirm('This will add any missing default items and update existing ones. Continue?');
                if (confirmed) {
                  const { getDocs, query, collection, where } = await import('firebase/firestore');
                  for (const item of INITIAL_MENU_ITEMS) {
                    const q = query(collection(db, 'menuItems'), where('name', '==', item.name));
                    const querySnapshot = await getDocs(q);
                    if (!querySnapshot.empty) {
                      await updateDoc(querySnapshot.docs[0].ref, { ...item, vendorId: VENDOR_ID, updatedAt: new Date().toISOString() });
                    } else {
                      await addDoc(collection(db, 'menuItems'), { ...item, vendorId: VENDOR_ID, createdAt: new Date().toISOString() });
                    }
                  }
                  toast.success('Menu synced with defaults');
                }
              }}
              className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:text-orange-500 transition-all flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Sync Defaults
            </button>
          </div>
      </div>

      {activeTab === 'orders' ? (
        <div className="grid grid-cols-1 gap-6">
          {orders.length === 0 ? (
            <div className="bg-white p-12 rounded-[2.5rem] text-center shadow-xl border border-gray-50">
              <Clock className="h-16 w-16 text-gray-200 mx-auto mb-6" />
              <p className="text-xl text-gray-400 font-bold">No orders yet</p>
            </div>
          ) : (
            orders.map(order => (
              <div key={order.id} className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-50 flex flex-col lg:flex-row justify-between gap-8">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold uppercase",
                      order.status === 'pending' ? "bg-yellow-100 text-yellow-700" : 
                      order.status === 'cancelled' ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                    )}>
                      {order.status}
                    </span>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase",
                      order.paymentStatus === 'paid' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    )}>
                      {order.paymentStatus === 'paid' ? 'Paid via MoMo' : 'Unpaid (Cash)'}
                    </span>
                    <span className="text-gray-400 text-sm">#{order.id.slice(0, 8)}</span>
                  </div>
                  <div className="space-y-2">
                    {order.items.map((item, idx) => (
                      <p key={idx} className="text-gray-900 font-bold">{item.quantity}x {item.name}</p>
                    ))}
                  </div>
                  <div className="mt-6 flex items-center gap-6 text-sm text-gray-500">
                    <div className="flex items-center gap-1"><Phone className="h-4 w-4" /> 0240084440</div>
                    <div className="flex items-center gap-1"><MapPin className="h-4 w-4" /> Oyarifa</div>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  {order.status === 'pending' && (
                    <button onClick={() => updateOrderStatus(order.id, 'preparing')} className="bg-blue-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-600 transition-all">Accept & Prepare</button>
                  )}
                  {order.status === 'preparing' && (
                    <button onClick={() => updateOrderStatus(order.id, 'ready')} className="bg-green-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-600 transition-all">Ready for Delivery</button>
                  )}
                  {order.status === 'ready' && (
                    <button onClick={() => updateOrderStatus(order.id, 'delivered')} className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-black transition-all">Mark Delivered</button>
                  )}
                  {order.status !== 'cancelled' && order.status !== 'delivered' && (
                    <button onClick={() => updateOrderStatus(order.id, 'cancelled')} className="text-red-500 font-bold px-4 py-3 hover:bg-red-50 rounded-xl transition-all">Cancel</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-bold text-gray-900">Menu Items</h3>
            <button 
              onClick={startAdding}
              className="bg-orange-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-600 transition-all flex items-center gap-2"
            >
              <Plus className="h-5 w-5" /> Add New Item
            </button>
          </div>

          {(isAddingItem || editingItem) && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-50"
            >
              <h4 className="text-xl font-bold mb-6">{editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}</h4>
              <form onSubmit={editingItem ? handleUpdateItem : handleAddItem} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Item Name</label>
                  <input 
                    required
                    type="text" 
                    value={itemForm.name}
                    onChange={e => setItemForm({...itemForm, name: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                    placeholder="e.g. Jollof Rice"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Price (GH₵)</label>
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    value={itemForm.price}
                    onChange={e => setItemForm({...itemForm, price: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-bold text-gray-700">Item Image</label>
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="flex-1 w-full space-y-4">
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 bg-gray-100 text-gray-700 px-4 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2 border-2 border-dashed border-gray-300"
                        >
                          <Upload className="h-5 w-5" /> Upload from Device
                        </button>
                        <input 
                          type="file" 
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          accept="image/*"
                          className="hidden"
                        />
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Camera className="h-5 w-5 text-gray-400" />
                        </div>
                        <input 
                          type="url" 
                          value={itemForm.imageUrl}
                          onChange={e => setItemForm({...itemForm, imageUrl: e.target.value})}
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                          placeholder="Or paste image URL..."
                        />
                      </div>
                      <p className="text-[10px] text-gray-400">Recommended: Square image under 800KB</p>
                    </div>
                    {itemForm.imageUrl && (
                      <div className="w-32 h-32 rounded-2xl border border-gray-100 overflow-hidden bg-gray-50 flex-shrink-0 shadow-inner relative group">
                        <img 
                          src={itemForm.imageUrl} 
                          alt="Preview" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://picsum.photos/seed/error/200/200`;
                          }}
                        />
                        <button 
                          type="button"
                          onClick={() => setItemForm(prev => ({ ...prev, imageUrl: '' }))}
                          className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-bold text-gray-700">Description</label>
                  <textarea 
                    required
                    value={itemForm.description}
                    onChange={e => setItemForm({...itemForm, description: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none h-24"
                    placeholder="Describe the dish..."
                  />
                </div>
                <div className="flex gap-4 md:col-span-2">
                  <button type="submit" className="bg-orange-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-orange-600 transition-all">
                    {editingItem ? 'Update Item' : 'Save Item'}
                  </button>
                  <button type="button" onClick={() => { setIsAddingItem(false); setEditingItem(null); }} className="text-gray-500 font-bold px-8 py-3 hover:bg-gray-50 rounded-xl transition-all">Cancel</button>
                </div>
              </form>
            </motion.div>
          )}

          {menuItems.length === 0 ? (
            <div className="bg-white p-12 rounded-[2.5rem] text-center shadow-xl border border-gray-50">
              <Utensils className="h-16 w-16 text-gray-200 mx-auto mb-6" />
              <p className="text-xl text-gray-400 font-bold">No menu items yet</p>
              <p className="text-gray-500 mt-2">Add your first item to start selling!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {menuItems.map(item => (
                <div key={item.id} className="bg-white p-6 rounded-[2rem] shadow-xl border border-gray-50">
                  <img 
                    src={item.imageUrl || `https://picsum.photos/seed/${item.name}/400/300`} 
                    className="w-full h-48 rounded-2xl object-cover mb-6" 
                    alt={item.name} 
                    referrerPolicy="no-referrer" 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${item.name}/400/300`;
                    }}
                  />
                  <h3 className="text-xl font-bold text-gray-900">{item.name}</h3>
                  <p className="text-gray-500 text-sm mt-2 mb-6 h-10 line-clamp-2">{item.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black text-gray-900">GH₵{(item.price ?? 0).toFixed(2)}</span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => startEditing(item)}
                        className="p-2 text-gray-400 hover:text-orange-500 transition-colors"
                        title="Edit Item"
                      >
                        <Settings className="h-5 w-5" />
                      </button>
                      <button 
                        onClick={() => deleteItem(item.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete Item"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                      <button 
                        onClick={() => toggleAvailability(item.id, item.available)}
                        className={cn(
                          "px-4 py-2 rounded-xl font-bold text-sm transition-all",
                          item.available ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        )}
                      >
                        {item.available ? 'Available' : 'Sold Out'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const AdminPortal = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [stats, setStats] = useState({ totalOrders: 0, totalRevenue: 0 });
  const [activeTab, setActiveTab] = useState<'users' | 'settings'>('users');
  const { profile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!profile || profile.role !== 'admin' || authLoading) return;

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
    }, (error) => {
      if (error.code !== 'permission-denied') {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    });

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const orders = snapshot.docs.map(doc => doc.data() as Order);
      const revenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
      setStats({ totalOrders: orders.length, totalRevenue: revenue });
    }, (error) => {
      if (error.code !== 'permission-denied') {
        handleFirestoreError(error, OperationType.LIST, 'orders');
      }
    });

    return () => { unsubUsers(); unsubOrders(); };
  }, [profile, authLoading]);

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      toast.success(`User role updated to ${newRole}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const seedMenu = async () => {
    try {
      const { getDocs, query, collection, where } = await import('firebase/firestore');
      
      for (const item of INITIAL_MENU_ITEMS) {
        const q = query(collection(db, 'menuItems'), where('name', '==', item.name));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          // Update existing to ensure all fields are correct
          const docRef = querySnapshot.docs[0].ref;
          await updateDoc(docRef, { 
            ...item, 
            vendorId: VENDOR_ID,
            updatedAt: new Date().toISOString()
          });
        } else {
          // Create new if missing
          await addDoc(collection(db, 'menuItems'), { 
            ...item, 
            vendorId: VENDOR_ID,
            createdAt: new Date().toISOString()
          });
        }
      }
      toast.success('Menu seeded/updated successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'menuItems');
    }
  };

  if (authLoading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>;
  if (!profile || profile.role !== 'admin') return <Navigate to="/" />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-black text-gray-900">System Administration</h2>
          <p className="text-gray-500 mt-2">Manage users and system configuration</p>
        </div>
        <div className="flex bg-gray-100 p-1.5 rounded-2xl">
          <button 
            onClick={() => setActiveTab('users')}
            className={cn(
              "px-6 py-3 rounded-xl font-bold transition-all",
              activeTab === 'users' ? "bg-white text-orange-500 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            User Management
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "px-6 py-3 rounded-xl font-bold transition-all",
              activeTab === 'settings' ? "bg-white text-orange-500 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            System Settings
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-50">
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-2">Total Revenue</p>
          <p className="text-4xl font-black text-orange-500">GH₵{(stats.totalRevenue ?? 0).toFixed(2)}</p>
        </div>
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-50">
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-2">Total Orders</p>
          <p className="text-4xl font-black text-gray-900">{stats.totalOrders}</p>
        </div>
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-50">
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-2">Active Users</p>
          <p className="text-4xl font-black text-gray-900">{users.length}</p>
        </div>
      </div>

      {activeTab === 'users' ? (
        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-50 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-bold text-gray-900">User Management</h3>
              <p className="text-xs text-gray-500">Manage roles for {users.length} registered users</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-orange-500 outline-none w-full"
                />
              </div>
              <select 
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admins</option>
                <option value="vendor">Vendors</option>
                <option value="customer">Customers</option>
              </select>
              <button 
                onClick={seedMenu}
                className="bg-orange-500 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-orange-600 transition-all"
              >
                Seed/Reset Menu
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-widest">
                <tr>
                  <th className="px-8 py-4">User</th>
                  <th className="px-8 py-4">Current Role</th>
                  <th className="px-8 py-4">Joined</th>
                  <th className="px-8 py-4">Assign Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-12 text-center text-gray-400 font-medium">
                      No users found matching your criteria
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => (
                    <tr key={u.uid} className="hover:bg-gray-50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="bg-orange-100 p-2 rounded-lg"><UserIcon className="h-5 w-5 text-orange-500" /></div>
                        <div>
                          <p className="font-bold text-gray-900">{u.displayName}</p>
                          <p className="text-sm text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold uppercase",
                        u.role === 'admin' ? "bg-purple-100 text-purple-700" :
                        u.role === 'vendor' ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
                      )}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-sm text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-8 py-6">
                      <select 
                        value={u.role}
                        onChange={(e) => updateUserRole(u.uid, e.target.value as UserRole)}
                        disabled={u.email === 'eotu907@gmail.com'}
                        className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5"
                      >
                        <option value="customer">Customer</option>
                        <option value="vendor">Vendor</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl bg-white p-10 rounded-[2.5rem] shadow-xl border border-gray-50">
          <h3 className="text-2xl font-bold text-gray-900 mb-8">System Configuration</h3>
          <div className="space-y-8">
            <div className="p-6 bg-orange-50 rounded-2xl border border-orange-100">
              <div className="flex items-center gap-3 text-orange-800 font-bold mb-2">
                <CreditCard className="h-5 w-5" /> MoMo Integration (Paystack)
              </div>
              <p className="text-sm text-orange-700 mb-4">
                Payments are processed via Paystack. Ensure your Public Key is set in the environment variables.
              </p>
              <div className="bg-white p-4 rounded-xl border border-orange-200 flex items-center justify-between">
                <span className="text-xs font-mono text-gray-500">
                  {import.meta.env.VITE_PAYSTACK_PUBLIC_KEY 
                    ? `${import.meta.env.VITE_PAYSTACK_PUBLIC_KEY.slice(0, 8)}...` 
                    : 'NOT CONFIGURED'}
                </span>
                {import.meta.env.VITE_PAYSTACK_PUBLIC_KEY ? (
                  <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">ACTIVE</span>
                ) : (
                  <span className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded-full font-bold">MISSING</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Business Name</label>
                <div className="p-4 bg-gray-50 rounded-xl text-gray-900 font-medium">Miracle Bite's Catering</div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Vendor ID</label>
                <div className="p-4 bg-gray-50 rounded-xl text-gray-500 font-mono text-xs">{VENDOR_ID}</div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-gray-900">System Status</h4>
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-sm font-medium text-gray-700">Firebase Backend: Connected</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Auth Provider ---
const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        // Use real-time listener for profile to handle onboarding updates immediately
        unsubscribeProfile = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            const existingProfile = docSnap.data() as UserProfile;
            
            // Force admin role for the primary admin email
            if (firebaseUser.email === 'eotu907@gmail.com' && existingProfile.role !== 'admin') {
              await updateDoc(userRef, { role: 'admin' });
            } else {
              // Migration: If user already has data but no flag, set it
              if (!existingProfile.onboardingCompleted && existingProfile.phoneNumber && existingProfile.address) {
                await updateDoc(userRef, { onboardingCompleted: true });
              }
              setProfile(existingProfile);
              setLoading(false);
            }
          } else {
            // Create default profile for new users
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'New User',
              role: firebaseUser.email === 'eotu907@gmail.com' ? 'admin' : 'customer',
              createdAt: new Date().toISOString()
            };
            await setDoc(userRef, newProfile);
            // Snapshot listener will pick this up
          }
        }, (error) => {
          console.error("Profile listener error:", error);
          setLoading(false);
        });

        // Check if menu needs seeding (only once)
        const { getDocs, collection, limit, query } = await import('firebase/firestore');
        const menuSnap = await getDocs(query(collection(db, 'menuItems'), limit(1)));
        if (menuSnap.empty) {
          for (const item of INITIAL_MENU_ITEMS) {
            await addDoc(collection(db, 'menuItems'), { 
              ...item, 
              vendorId: VENDOR_ID,
              createdAt: new Date().toISOString()
            });
          }
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const signIn = async () => {
    if (loading) return;
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success('Signed in successfully');
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        console.log('Sign-in popup closed or cancelled');
      } else if (error.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname;
        console.error(`[AUTH ERROR] Domain "${domain}" is not authorized in Firebase Console.`);
        toast.error(`Domain not authorized. Please add "${domain}" to your Firebase Authorized Domains.`);
      } else {
        console.error('[AUTH ERROR]', error);
        toast.error(error.message || 'Failed to sign in');
      }
    }
  };

  const signInEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      toast.success('Signed in successfully');
    } catch (error: any) {
      console.error('[AUTH ERROR]', error);
      if (error.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname;
        toast.error(`Domain not authorized. Please add "${domain}" to your Firebase Authorized Domains.`);
      } else {
        toast.error(error.message || 'Failed to sign in');
      }
      throw error;
    }
  };

  const signUpEmail = async (email: string, pass: string, name: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
      toast.success('Account created successfully');
    } catch (error: any) {
      console.error('[AUTH ERROR]', error);
      if (error.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname;
        toast.error(`Domain not authorized. Please add "${domain}" to your Firebase Authorized Domains.`);
      } else {
        toast.error(error.message || 'Failed to create account');
      }
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      console.log(`[DEBUG] Attempting password reset for: ${email}`);
      const apiKey = auth.app.options.apiKey;
      console.log(`[DEBUG] API Key from Auth: ${apiKey ? 'PRESENT (' + apiKey.substring(0, 5) + '...)' : 'MISSING'}`);
      
      // Use dynamic origin to ensure it matches the current environment's allowlist
      const actionCodeSettings = {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: true,
      };
      
      console.log(`[DEBUG] Using redirect URL: ${actionCodeSettings.url}`);
      
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      console.log('[DEBUG] Password reset email request accepted by Firebase');
    } catch (error: any) {
      console.error('Firebase Password Reset Error:', error.code, error.message);
      
      let friendlyMessage = 'Failed to send reset email.';
      
      if (error.code === 'auth/user-not-found') {
        friendlyMessage = 'No account found with this email address.';
      } else if (error.code === 'auth/invalid-email') {
        friendlyMessage = 'Please enter a valid email address.';
      } else if (error.code === 'auth/too-many-requests') {
        friendlyMessage = 'Too many requests. Please wait a moment.';
      } else if (error.code === 'auth/unauthorized-continue-uri') {
        friendlyMessage = 'Domain not authorized. Please try the manual code method below.';
      }
      
      toast.error(`${friendlyMessage} (Error: ${error.code})`);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      toast.success('Signed out');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signInEmail, signUpEmail, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode, roles?: UserRole[] }> = ({ children, roles }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>;
  
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  
  if (!profile?.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  if (roles && !roles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// --- Main App ---
export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
          <Toaster position="top-right" />
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/onboarding" element={<OnboardingPage />} />
              
              <Route path="/menu" element={
                <ProtectedRoute>
                  <MenuPage />
                </ProtectedRoute>
              } />
              
              <Route path="/orders" element={
                <ProtectedRoute>
                  <OrdersPage />
                </ProtectedRoute>
              } />
              
              <Route path="/vendor" element={
                <ProtectedRoute roles={['vendor', 'admin']}>
                  <VendorPortal />
                </ProtectedRoute>
              } />
              
              <Route path="/admin" element={
                <ProtectedRoute roles={['admin']}>
                  <AdminPortal />
                </ProtectedRoute>
              } />
              
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
          
          <footer className="bg-white border-t border-gray-100 py-12 mt-20">
            <div className="max-w-7xl mx-auto px-4 text-center">
              <div className="flex items-center justify-center space-x-2 mb-6">
                <div className="bg-orange-500 p-1.5 rounded-lg">
                  <Utensils className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-bold text-gray-900">Miracle Bite's</span>
              </div>
              <p className="text-gray-400 text-sm">© 2026 Miracle Bite's Catering Services. All rights reserved.</p>
              <p className="text-gray-400 text-xs mt-2">Oyarifa Presbyterian School Area, Accra, Ghana | 0240084440</p>
            </div>
          </footer>
        </div>
      </Router>
    </AuthProvider>
  );
}
