import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { Music, ArrowRight } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      alert("⚠️ " + error.message);
      setLoading(false);
    } else {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();
      
      if (profileError || !profile) {
          setLoading(false);
          // Let App.jsx router handle the missing profile safely now
      } else {
          if (profile.role === 'admin') navigate('/teacher');
          else navigate('/student');
      }
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) return alert('Please enter your email first.');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      alert("⚠️ " + error.message);
    } else {
      alert("Password reset email sent! Please check your inbox.");
      setIsForgotPassword(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Side - The Brand */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-indigo-600 to-purple-700 items-center justify-center p-12 text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
           {/* Abstract Circles for decoration */}
           <div className="absolute top-10 left-10 w-64 h-64 rounded-full bg-white mix-blend-overlay blur-3xl"></div>
           <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-pink-500 mix-blend-overlay blur-3xl"></div>
        </div>
        <div className="z-10 max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <Music size={40} />
            </div>
            <h1 className="text-4xl font-bold">Music Portal</h1>
          </div>
          <p className="text-lg text-indigo-100 leading-relaxed">
            "Music gives a soul to the universe, wings to the mind, flight to the imagination and life to everything."
          </p>
        </div>
      </div>

      {/* Right Side - The Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {isForgotPassword ? 'Reset Password' : 'Welcome Back! 👋'}
          </h2>
          <p className="text-gray-500 mb-8">
            {isForgotPassword ? 'Enter your email to receive a reset link.' : 'Please enter your details to sign in.'}
          </p>

          <form onSubmit={isForgotPassword ? handleForgotPassword : handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
                placeholder="you@example.com"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            {!isForgotPassword && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
                  placeholder="••••••••"
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}

            <button 
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              {loading ? 'Please Wait...' : (isForgotPassword ? 'Send Reset Link' : 'Sign In')}
              {!loading && !isForgotPassword && <ArrowRight size={20} />}
            </button>

            {!isForgotPassword && (
              <div className="text-right mt-2">
                <button type="button" onClick={() => setIsForgotPassword(true)} className="text-sm text-indigo-600 font-bold hover:underline">Forgot Password?</button>
              </div>
            )}
            {isForgotPassword && (
              <div className="text-center mt-4">
                <button type="button" onClick={() => setIsForgotPassword(false)} className="text-sm text-gray-500 font-bold hover:text-gray-800">Back to Login</button>
              </div>
            )}
          </form>

          <p className="mt-8 text-center text-gray-600 text-sm">
            Don't have an account?{' '}
            <Link to="/register" className="text-indigo-600 font-semibold hover:underline">
              Register a Student
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;