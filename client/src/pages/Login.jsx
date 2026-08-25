import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { GoogleLogin } from '@react-oauth/google';
import api from '../api/axiosInstance';
import { getGoogleButtonWidth, getGoogleLoginError, isGoogleLoginConfigured } from '../utils/googleAuth';

const Login = ({ googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleError, setGoogleError] = useState(null);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [googleButtonWidth, setGoogleButtonWidth] = useState(() => (
    getGoogleButtonWidth(typeof window === 'undefined' ? undefined : window.innerWidth)
  ));
  const { login, loginWithToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";
  const isGoogleLoginEnabled = isGoogleLoginConfigured(googleClientId);
  useEffect(() => {
    const updateGoogleButtonWidth = () => setGoogleButtonWidth(getGoogleButtonWidth(window.innerWidth));
    window.addEventListener('resize', updateGoogleButtonWidth);
    return () => window.removeEventListener('resize', updateGoogleButtonWidth);
  }, []);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleGoogleSuccess = async ({ credential }) => {
    if (isGoogleSubmitting) return;
    setGoogleError(null);
    setIsGoogleSubmitting(true);
    try {
      const res = await api.post('/google/login', { credential }, { skipAuthRedirect: true });
      const { token, user } = res.data.data;
      loginWithToken(token, user);
      toast.success('Logged in with Google');
      navigate(from, { replace: true });
    } catch (err) {
      setGoogleError(getGoogleLoginError(err.response?.status));
    } finally {
      setIsGoogleSubmitting(false);
    }
  };
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-base relative overflow-hidden p-4 sm:p-8">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-accent/20 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent/20 blur-[120px]" />
      
      <div className="relative z-10 w-full max-w-md p-6 sm:p-8 bg-surface/80 backdrop-blur-xl border border-border rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 flex items-center justify-center mb-4">
            <img 
              src="/logo.png" 
              alt="Thinkvibes Logo" 
              className="w-full h-full object-contain pointer-events-none select-none"
              draggable="false"
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight mb-2 text-center">Welcome Back</h1>
          <p className="text-secondary text-sm text-center max-w-xs mx-auto leading-relaxed">
            Sign in to Thinkvibes management system
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-primary ml-1" htmlFor="email">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@company.com"
                className="w-full pl-10 pr-4 py-3 bg-base/50 border border-border rounded-xl text-primary placeholder:text-secondary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/50 transition-all duration-200"
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-primary ml-1" htmlFor="password">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 bg-base/50 border border-border rounded-xl text-primary placeholder:text-secondary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/50 transition-all duration-200"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold shadow-lg shadow-accent/25 hover:shadow-accent/40 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 mt-4"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
          </button>
        </form>
        {isGoogleLoginEnabled && (
        <div className="mt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-secondary font-medium px-2">OR</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          {googleError && (
            <div role="alert" className="mb-3 p-3 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger">
              {googleError}
            </div>
          )}
          <div
            className={`flex justify-center transition-opacity ${isGoogleSubmitting ? 'pointer-events-none opacity-60' : ''}`}
            aria-busy={isGoogleSubmitting}
          >
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => {
                setIsGoogleSubmitting(false);
                setGoogleError('Google sign-in failed. Please try again.');
              }}
              theme="outline"
              size="large"
              text="signin_with_google"
              shape="rectangular"
              width={googleButtonWidth}
            />
          </div>
          <p className="text-center text-sm text-secondary mt-3" aria-live="polite">
            {isGoogleSubmitting ? 'Signing in with Google…' : 'Use a Google account that your admin has approved.'}
          </p>
        </div>
        )}
      </div>
    </div>
  );
};
export default Login;
