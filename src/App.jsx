import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { SpeedInsights } from "@vercel/speed-insights/react"

import Login from './pages/Login';
import Register from './pages/Register';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
import ResetPassword from './pages/ResetPassword';
import PaymentCard from './components/PaymentCard';

function App() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Initial Session Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchRole(session.user.id);
      else setLoading(false);
    });

    // 2. Listen for Auth Changes (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        // If we have a session, we MUST fetch the role before stopping loading
        fetchRole(session.user.id); 
      } else {
        setUserRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchRole = async (userId, retryCount = 0) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (data && data.role) {
          setUserRole(data.role);
          setLoading(false);
      } else if (retryCount < 3) {
          // Profile might still be inserting. Retry in 1 second.
          setTimeout(() => fetchRole(userId, retryCount + 1), 1000);
      } else {
          setUserRole('missing');
          setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching role:', error);
      if (retryCount < 3) {
          setTimeout(() => fetchRole(userId, retryCount + 1), 1000);
      } else {
          setUserRole('missing');
          setLoading(false);
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserRole(null);
    setSession(null);
  };

  // --- CRITICAL FIX: THE SAFETY BRAKE ---
  // If we have a session but NO role yet, we must keep loading.
  // Otherwise, the router will try to redirect you before it knows who you are.
  if (loading || (session && !userRole)) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="text-xl font-semibold text-gray-600">
          Loading your profile...
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
        <nav className="bg-white shadow p-4 mb-8 flex justify-between">
          <div className="font-bold text-xl">🎹 A Journey Through Carnatic and Western</div>
          {session ? (
            <button onClick={handleLogout} className="text-red-600 hover:underline">Logout</button>
          ) : (
             <Link to="/login" className="text-blue-600">Login</Link>
          )}
        </nav>

        <Routes>
            {/* LOGIN & REGISTER: Only accessible if NOT logged in */}
            <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
            <Route path="/register" element={!session ? <Register /> : <Navigate to="/" />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* TEACHER ROUTE - Protected */}
            <Route path="/teacher" element={
              session && userRole === 'admin' ? <TeacherDashboard /> : <Navigate to="/" />
            } />

            {/* STUDENT ROUTE - Protected */}
            <Route path="/student" element={
              session && userRole === 'student' ? (
                <StudentDashboard session={session} />
              ) : (
                <Navigate to="/" />
              )
            } />

            {/* HOME ROUTE - Redirects based on Role */}
            <Route path="/" element={
               session ? (
                 userRole === 'admin' ? <Navigate to="/teacher" /> : 
                 userRole === 'student' ? <Navigate to="/student" /> :
                 <Navigate to="/profile-error" />
               ) : (
                 <Navigate to="/login" />
               )
            } />
            
            {/* ERROR ROUTE */}
            <Route path="/profile-error" element={
               <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-4 font-sans text-center">
                   <h1 className="text-2xl font-bold text-red-600 mb-2">Profile Missing</h1>
                   <p className="text-gray-600 mb-6">Your registration didn't finish correctly (profile data is missing). Please delete your account from the Supabase dashboard and register again.</p>
                   <button onClick={handleLogout} className="bg-black text-white px-6 py-2 rounded-lg font-bold">Log out</button>
               </div>
            } />
        </Routes>

        <SpeedInsights />

      </div>
    </Router>
  );
}

export default App;