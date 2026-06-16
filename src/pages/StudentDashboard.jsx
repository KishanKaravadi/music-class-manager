import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import PaymentCard from '../components/PaymentCard';
import { 
  Clock, Calendar, TrendingUp, Lock, DollarSign, Plus, X, Music, 
  CheckCircle, Trash2, ArrowRight, RefreshCw, AlertCircle, Settings, Key, LogOut
} from 'lucide-react';

const StudentDashboard = ({ session }) => {
  // Stats State
  const [balance, setBalance] = useState(0); 
  const [history, setHistory] = useState([]);
  const [classesThisMonth, setClassesThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Payment State
  const [hasPendingPayment, setHasPendingPayment] = useState(false);
  const [hasPaidThisMonth, setHasPaidThisMonth] = useState(false);
  
  // Course & Enrollment State
  const [enrollments, setEnrollments] = useState([]); 
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  
  // Scheduler State for Modal
  const [courseId, setCourseId] = useState(''); 
  const [currentSchedule, setCurrentSchedule] = useState([]);
  const [tempDay, setTempDay] = useState('Monday');
  const [tempTime, setTempTime] = useState('17:00');
  
  // State to track if we are rescheduling (locking the instrument)
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Settings & Profile State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileEmail, setProfileEmail] = useState('');

  const daysOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // --- HELPERS ---
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 9; hour <= 19; hour++) {
      const formattedHour = hour < 10 ? `0${hour}` : hour;
      slots.push(`${formattedHour}:00`);
      if (hour !== 19) slots.push(`${formattedHour}:30`);
    }
    return slots;
  };
  const timeSlots = generateTimeSlots();

  const formatTime = (time) => {
    if (!time) return "";
    const [hour, min] = time.split(':');
    const h = parseInt(hour);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 || 12; 
    return `${displayHour}:${min} ${ampm}`;
  };

  const getInstrumentName = (id) => {
      const map = {
          '1': 'Piano', '4': 'Guitar', '6': 'Keyboard (Western)',
          '2': 'Violin', '3': 'Vocal', '5': 'Veena', '7': 'Keyboard (Carnatic)'
      };
      return map[id] || 'Unknown';
  };

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    const userId = session.user.id;
    const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

    // 0. Get Profile Data
    const { data: profileData } = await supabase.from('profiles').select('full_name, phone_number, email').eq('id', userId).single();
    if (profileData) {
      setProfileName(profileData.full_name);
      setProfilePhone(profileData.phone_number);
      setProfileEmail(profileData.email || session.user.email);
    }

    // 1. Get Enrollments
    const { data: enrollmentData } = await supabase.from('enrollments').select('*, courses(name)').eq('student_id', userId);
    if (enrollmentData) setEnrollments(enrollmentData);

    // 2. Get Ledger History & Balance
    const { data: balanceData } = await supabase.from('student_balances').select('balance').eq('student_id', userId).maybeSingle();
    const { data: ledgerData } = await supabase.from('credit_ledger').select('*').eq('student_id', userId).lt('amount', 0).order('created_at', { ascending: false }).limit(50);
    
    // 3. Get Payment Status
    const { data: paymentData } = await supabase.from('payments').select('id').eq('student_id', userId).eq('status', 'pending');
    const { data: monthlyPayment } = await supabase.from('payments').select('id').eq('student_id', userId).eq('status', 'approved').eq('month_for', currentMonthName).maybeSingle();

    if (balanceData) {
      setBalance(balanceData.balance || 0);
    } else {
      setBalance(0);
    }

    if (ledgerData) {
      setHistory(ledgerData);
      
      const now = new Date();
      setClassesThisMonth(ledgerData.filter(r => { 
          const d = new Date(r.created_at); 
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); 
      }).length);
    }


    if (paymentData && paymentData.length > 0) setHasPendingPayment(true);
    setHasPaidThisMonth(!!monthlyPayment); 
    setLoading(false);
  };

  // --- ACTIONS ---

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/'; // Force redirect to login
  };

  // Drop Course with Confirmation
  const handleDropCourse = async (enrollmentId, courseName) => {
      const confirmed = window.confirm(`Are you sure you want to drop ${courseName}? \n\nYou will lose your current schedule slot immediately.`);
      if (!confirmed) return;

      const { error } = await supabase.from('enrollments').delete().eq('id', enrollmentId);
      
      if (error) {
          console.error("Drop Error:", error);
          alert("Error dropping course: " + error.message);
      } else {
          alert("Course dropped successfully.");
          fetchDashboardData();
      }
  };

  // Cancel PENDING Request
  const handleCancelRequest = async (enrollmentId) => {
      const confirmed = window.confirm("Do you want to cancel this pending request?");
      if (!confirmed) return;

      const { error } = await supabase.from('enrollments').delete().eq('id', enrollmentId);
      
      if (error) {
          console.error("Cancel Error:", error);
          alert("Error cancelling request: " + error.message);
      } else {
          fetchDashboardData();
      }
  };

  // Reschedule (Open Modal in "Locked" Mode)
  const handleRescheduleClick = (courseId) => {
      setCourseId(String(courseId)); // Lock to this ID
      setIsRescheduling(true);       // Set mode
      setCurrentSchedule([]);        // Clear previous entries
      setShowEnrollModal(true);
  };

  // Open Normal Add Modal (Unlocked)
  const handleAddClick = () => {
      setCourseId('');       // Reset to empty
      setIsRescheduling(false); // Normal mode
      setCurrentSchedule([]);
      setShowEnrollModal(true);
  };

  // Update Profile
  const handleUpdateProfile = async () => {
      setPasswordLoading(true);

      if (profileEmail !== session.user.email) {
          const { error: authError } = await supabase.auth.updateUser({ email: profileEmail });
          if (authError) {
              alert("Error updating login email: " + authError.message);
              setPasswordLoading(false);
              return;
          }
          alert("Email changed! Depending on your security settings, you may need to confirm the new email via an inbox link before you can log in again.");
      }

      const { error } = await supabase.from('profiles').update({
          full_name: profileName,
          phone_number: profilePhone,
          email: profileEmail
      }).eq('id', session.user.id);

      if (error) {
          alert("Error updating profile: " + error.message);
      } else {
          alert("Profile updated successfully!");
      }
      setPasswordLoading(false);
  };

  // Update Password
  const handleChangePassword = async () => {
      if (newPassword.length < 6) return alert("Password must be at least 6 characters.");
      setPasswordLoading(true);

      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
          alert("Error updating password: " + error.message);
      } else {
          alert("Password updated successfully!");
          setShowPasswordModal(false);
          setNewPassword('');
      }
      setPasswordLoading(false);
  };

  // Modal Handlers
  const handleAddSlot = () => {
      if (!courseId) return alert("Please select an instrument first.");
      if (currentSchedule.some(s => s.day === tempDay)) return alert(`You already have a slot on ${tempDay}.`);
      if (currentSchedule.length >= 3) return alert("You can select a maximum of 3 days.");
      
      setCurrentSchedule([...currentSchedule, { day: tempDay, time: tempTime }]);
  };

  const handleRemoveSlot = (index) => {
      const newSched = [...currentSchedule];
      newSched.splice(index, 1);
      setCurrentSchedule(newSched);
  };

  const handleSubmitApplication = async () => {
    if (!courseId) return alert("Please select an instrument.");
    if (currentSchedule.length < 1) return alert("Please select at least 1 class slot.");
    
    const formattedDays = currentSchedule.map(s => `${s.day} ${s.time}`);

    const { error } = await supabase.from('enrollments').insert([{ 
        student_id: session.user.id, 
        course_id: courseId, 
        preferred_days: formattedDays, 
        preferred_time: null, 
        status: 'pending', 
        joining_date: new Date()
    }]);

    if (error) {
        alert("Error: " + error.message);
    } else { 
        alert(isRescheduling 
            ? "Reschedule Request Sent! The teacher will review your new time." 
            : "Request Sent! Teacher will review it."
        ); 
        setShowEnrollModal(false); 
        fetchDashboardData(); 
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-indigo-600 font-bold">Loading...</div>;
  
  const isPaymentDue = balance <= 0 || !hasPaidThisMonth; 

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <header className="mb-10 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome, {profileName || session.user.email.split('@')[0]}! 👋</h1>
            <div className="flex items-center gap-2 text-gray-500">
                <p>Manage your classes.</p>
                <button onClick={() => setShowPasswordModal(true)} className="text-xs flex items-center gap-1 bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded text-gray-700 font-bold transition-colors">
                    <Settings size={12}/> Settings
                </button>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
                onClick={handleAddClick} 
                className="bg-black text-white px-4 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-800 transition-all shadow-lg"
            >
                <Plus size={20}/> <span className="hidden sm:inline">Enroll New Course</span>
            </button>
            {/* LOGOUT BUTTON RESTORED */}
            <button 
                onClick={handleLogout} 
                className="bg-white border border-gray-300 text-gray-700 px-4 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm"
                title="Log Out"
            >
                <LogOut size={20}/>
            </button>
          </div>
        </header>

        {/* ACTIVE COURSES GRID */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {enrollments.map((enrollment) => {
                const isActive = enrollment.status === 'active';
                const isRescheduleAttempt = !isActive && enrollments.some(e => e.course_id === enrollment.course_id && e.status === 'active' && e.id !== enrollment.id);

                return (
                    <div 
                        key={enrollment.id} 
                        className={`p-6 rounded-2xl shadow-sm border relative overflow-hidden transition-all hover:shadow-md flex flex-col h-full
                        ${isActive ? 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white border-transparent' : 'bg-white border-gray-200 text-gray-800'}`}
                    >
                        {/* Status Badge */}
                        <div className={`absolute top-4 right-4 text-[10px] font-bold px-2 py-1 rounded uppercase ${isActive ? 'bg-white/20 text-white' : 'bg-yellow-100 text-yellow-700'}`}>
                            {isRescheduleAttempt ? 'Reschedule Req.' : (isActive ? 'Active' : 'Pending')}
                        </div>
                        
                        <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                            <Music size={20} className={isActive ? 'text-indigo-200' : 'text-indigo-600'}/> 
                            {enrollment.courses?.name}
                        </h2>
                        
                        {/* Schedule Display */}
                        <div className="flex-1">
                            {isActive ? (
                                <>
                                    <div className="text-xs uppercase font-bold opacity-60 mb-2">Current Schedule</div>
                                    <div className="space-y-1 mb-6">
                                        {enrollment.preferred_days.map((dayStr, i) => (
                                            <div key={i} className="font-mono font-bold text-sm bg-white/10 px-2 py-1 rounded inline-block w-full">
                                                {dayStr.replace(' ', ' @ ')}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="text-xs uppercase font-bold text-gray-400 mb-2">Requested</div>
                                    <div className="space-y-1">
                                        {enrollment.preferred_days.map((dayStr, i) => (
                                            <div key={i} className="font-mono font-bold text-sm bg-gray-100 px-2 py-1 rounded inline-block w-full text-gray-600">
                                                {dayStr.replace(' ', ' @ ')}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 flex items-center gap-2 text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-100 mb-4">
                                        <Clock size={14}/> <span>Waiting for teacher approval.</span>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Action Buttons */}
                        {isActive ? (
                            <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
                                <button 
                                    onClick={() => handleRescheduleClick(enrollment.course_id)}
                                    className="flex-1 bg-white/20 hover:bg-white/30 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                                    title="Change Schedule"
                                >
                                    <RefreshCw size={14} /> Change Time
                                </button>
                                <button 
                                    onClick={() => handleDropCourse(enrollment.id, enrollment.courses?.name)}
                                    className="bg-red-500/80 hover:bg-red-500 text-white px-3 py-2 rounded-lg transition-colors flex items-center justify-center"
                                    title="Drop Course"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={() => handleCancelRequest(enrollment.id)}
                                className="mt-auto w-full border border-gray-200 text-gray-500 hover:text-red-600 hover:bg-red-50 py-2 rounded-lg text-xs font-bold transition-colors"
                            >
                                Cancel Request
                            </button>
                        )}
                    </div>
                );
            })}
        </div>

        {/* STATS ROW */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
             <div className="flex items-center gap-3 mb-2 text-gray-500">
                <Calendar size={20} /> <span className="font-bold uppercase text-xs">Classes This Month</span>
             </div>
             <div className="text-4xl font-bold text-gray-900">{classesThisMonth}</div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
             <div className="flex items-center gap-3 mb-2 text-gray-500">
                <TrendingUp size={20} /> <span className="font-bold uppercase text-xs">Account Status</span>
             </div>
             <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${!isPaymentDue ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-xl font-bold text-gray-900">{!isPaymentDue ? 'Active' : 'Payment Due'}</span>
             </div>
          </div>
        </div>

        {/* BOTTOM SECTION: PAYMENT & HISTORY */}
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
             <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-100 font-bold text-gray-700 flex items-center gap-2">
                    <DollarSign size={18} /> Fee Payment
                </div>
                <div className="p-6">
                    {hasPaidThisMonth ? (
                        <div className="text-center p-6 bg-green-50 border border-green-200 rounded-lg animate-in fade-in">
                            <CheckCircle className="mx-auto text-green-600 mb-3" size={40} />
                            <h3 className="font-bold text-green-800 text-lg">Fee Paid</h3>
                            <p className="text-sm text-green-700 mt-2">You have paid for {new Date().toLocaleString('default', { month: 'long' })}.</p>
                        </div>
                    ) : hasPendingPayment ? (
                        <div className="text-center p-6 bg-yellow-50 border border-yellow-200 rounded-lg animate-in fade-in">
                            <Lock className="mx-auto text-yellow-600 mb-3" size={40} />
                            <h3 className="font-bold text-yellow-800 text-lg">Payment in Review</h3>
                            <p className="text-sm text-yellow-700 mt-2">Teacher is verifying your payment.</p>
                        </div>
                    ) : (
                        <PaymentCard 
                            studentId={session.user.id} 
                            studentName={session.user.email} 
                            onPaymentSuccess={fetchDashboardData} 
                        />
                    )}
                </div>
             </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="font-bold text-lg text-gray-800">History</h2>
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase sticky top-0">
                            <tr>
                                <th className="p-4">Date</th>
                                <th className="p-4">Time</th>
                                <th className="p-4">Activity</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {history.map((record) => {
                                const parts = record.reason.split(':');
                                const mainReason = parts[0]; 
                                const instrument = parts[1] ? parts[1].trim() : null;

                                return (
                                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 text-gray-900 font-medium">
                                            {new Date(record.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="p-4 text-gray-600">
                                            {new Date(record.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="p-4">
                                            {instrument ? (
                                                <>
                                                    <span className="font-bold text-indigo-700 block">{instrument}</span>
                                                    <span className="text-xs text-gray-400">{mainReason}</span>
                                                </>
                                            ) : (
                                                <span className="text-sm text-gray-700 font-medium">{mainReason}</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- ADD COURSE MODAL (REUSED FOR NEW & RESCHEDULE) --- */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
                <button onClick={() => setShowEnrollModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X size={24}/></button>
                
                <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
                    {isRescheduling ? <RefreshCw className="text-indigo-600"/> : <Plus className="text-indigo-600"/>}
                    {isRescheduling ? 'Reschedule Class' : 'Add Course'}
                </h2>
                {isRescheduling && <p className="text-sm text-gray-500 mb-4">Request a new time slot for <span className="font-bold">{getInstrumentName(courseId)}</span>.</p>}
                
                <div className="space-y-4 mt-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Instrument</label>
                        <select 
                            value={courseId} 
                            onChange={(e) => setCourseId(e.target.value)} 
                            disabled={isRescheduling} 
                            className={`w-full px-4 py-2 rounded-lg border border-gray-200 outline-none bg-white focus:border-indigo-500 ${isRescheduling ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                        >
                            <option value="" disabled>Select Instrument</option>
                            <option value="1">Piano</option>
                            <option value="4">Guitar</option>
                            <option value="6">Keyboard (Western)</option>
                            <option value="2">Violin</option>
                            <option value="3">Vocal</option>
                            <option value="5">Veena</option>
                            <option value="7">Keyboard (Carnatic)</option>
                        </select>
                    </div>

                    <div className="bg-gray-50 p-3 rounded border border-gray-200">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Select your dates</label>
                        <div className="flex gap-2 mb-2">
                            <select value={tempDay} onChange={(e) => setTempDay(e.target.value)} className="border p-2 rounded text-sm flex-1 font-bold text-gray-700 outline-none">
                                {daysOptions.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <select value={tempTime} onChange={(e) => setTempTime(e.target.value)} className="border p-2 rounded text-sm flex-1 font-bold text-gray-700 outline-none">
                                {timeSlots.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}
                            </select>
                            <button onClick={handleAddSlot} className="bg-indigo-600 text-white px-3 rounded text-sm font-bold hover:bg-indigo-700">Add</button>
                        </div>

                        <div className="space-y-1">
                            {currentSchedule.map((s, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white border border-gray-200 p-2 rounded text-sm animate-in fade-in">
                                    <span className="font-bold text-gray-800">{s.day} @ {formatTime(s.time)}</span>
                                    <button onClick={() => handleRemoveSlot(idx)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                                </div>
                            ))}
                            {currentSchedule.length === 0 && (
                                <div className="text-center text-xs text-gray-400 italic py-2">No slots added. Add at least 1.</div>
                            )}
                        </div>
                    </div>

                    <button 
                        onClick={handleSubmitApplication} 
                        className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg mt-4 shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                    >
                        {isRescheduling ? 'Submit Reschedule Request' : 'Send Enrollment Request'} <ArrowRight size={18}/>
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- SETTINGS MODAL --- */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 relative">
                <button onClick={() => setShowPasswordModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X size={24}/></button>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Settings className="text-indigo-600"/> Account Settings</h2>
                
                <div className="space-y-4 mb-6 pb-6 border-b border-gray-100">
                    <h3 className="font-bold text-gray-700 text-sm uppercase">Profile</h3>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Full Name</label>
                        <input 
                            type="text" 
                            value={profileName} 
                            onChange={(e) => setProfileName(e.target.value)} 
                            className="w-full border p-2 rounded outline-none focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Email Address</label>
                        <input 
                            type="email" 
                            value={profileEmail} 
                            onChange={(e) => setProfileEmail(e.target.value)} 
                            className="w-full border p-2 rounded outline-none focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Phone Number</label>
                        <input 
                            type="text" 
                            value={profilePhone} 
                            onChange={(e) => setProfilePhone(e.target.value)} 
                            className="w-full border p-2 rounded outline-none focus:border-indigo-500"
                        />
                    </div>
                    <button 
                        onClick={handleUpdateProfile} 
                        disabled={passwordLoading}
                        className="w-full bg-black text-white font-bold py-2 rounded hover:bg-gray-800 transition-colors"
                    >
                        {passwordLoading ? 'Updating...' : 'Save Profile'}
                    </button>
                </div>

                <div className="space-y-4">
                    <h3 className="font-bold text-gray-700 text-sm uppercase">Security</h3>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">New Password</label>
                        <input 
                            type="password" 
                            value={newPassword} 
                            onChange={(e) => setNewPassword(e.target.value)} 
                            className="w-full border p-2 rounded outline-none focus:border-indigo-500"
                            placeholder="Min 6 chars"
                        />
                    </div>
                    <button 
                        onClick={handleChangePassword} 
                        disabled={passwordLoading}
                        className="w-full bg-indigo-600 text-white font-bold py-2 rounded hover:bg-indigo-700 transition-colors"
                    >
                        {passwordLoading ? 'Updating...' : 'Update Password'}
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default StudentDashboard;