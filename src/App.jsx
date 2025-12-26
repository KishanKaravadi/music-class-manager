import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { SpeedInsights } from "@vercel/speed-insights/next"

import Login from './pages/Login';
import Register from './pages/Register';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
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

  const fetchRole = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (data) setUserRole(data.role);
    } catch (error) {
      console.error('Error fetching role:', error);
    } finally {
      setLoading(false);
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
          <div className="font-bold text-xl">🎹 Uncle's Music School</div>
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
                 userRole === 'admin' ? <Navigate to="/teacher" /> : <Navigate to="/student" />
               ) : (
                 <Navigate to="/login" />
               )
            } />
        </Routes>

        <SpeedInsights />
        
      </div>
    </Router>
  );
}

export default App;