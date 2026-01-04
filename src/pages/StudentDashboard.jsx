import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import PaymentCard from '../components/PaymentCard';
import { Clock, Calendar, TrendingUp, Lock, DollarSign, Plus, X, Music, CheckCircle, Trash2 } from 'lucide-react';

const StudentDashboard = ({ session }) => {
  // Stats State
  const [balance, setBalance] = useState(0); // Kept for internal status logic, not displayed
  const [history, setHistory] = useState([]);
  const [classesThisMonth, setClassesThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Payment State
  const [hasPendingPayment, setHasPendingPayment] = useState(false);
  const [hasPaidThisMonth, setHasPaidThisMonth] = useState(false);
  
  // Course & Enrollment State
  const [enrollments, setEnrollments] = useState([]); 
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  
  // NEW: Scheduler State for "Add Course" Modal
  const [courseId, setCourseId] = useState('1'); // Default to Piano
  const [currentSchedule, setCurrentSchedule] = useState([]);
  const [tempDay, setTempDay] = useState('Monday');
  const [tempTime, setTempTime] = useState('17:00');

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

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    const userId = session.user.id;
    const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

    // 1. Get Enrollments
    const { data: enrollmentData } = await supabase.from('enrollments').select('*, courses(name)').eq('student_id', userId);
    if (enrollmentData) setEnrollments(enrollmentData);

    // 2. Get Ledger & Balance
    const { data: ledgerData } = await supabase.from('credit_ledger').select('*').eq('student_id', userId).order('created_at', { ascending: false });
    
    // 3. Get Payment Status
    const { data: paymentData } = await supabase.from('payments').select('id').eq('student_id', userId).eq('status', 'pending');
    const { data: monthlyPayment } = await supabase.from('payments').select('id').eq('student_id', userId).eq('status', 'approved').eq('month_for', currentMonthName).maybeSingle();

    if (ledgerData) {
      const currentBalance = ledgerData.reduce((acc, curr) => acc + curr.amount, 0);
      setBalance(currentBalance); // Stored but hidden from view
      
      const attendanceRecords = ledgerData.filter(item => item.amount < 0);
      setHistory(attendanceRecords);
      
      const now = new Date();
      setClassesThisMonth(attendanceRecords.filter(r => { 
          const d = new Date(r.created_at); 
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); 
      }).length);
    }

    if (paymentData && paymentData.length > 0) setHasPendingPayment(true);
    setHasPaidThisMonth(!!monthlyPayment); 
    setLoading(false);
  };

  // --- HANDLERS ---

  // Add Slot to temporary schedule builder
  const handleAddSlot = () => {
      // Check for duplicate day
      if (currentSchedule.some(s => s.day === tempDay)) {
          return alert(`You already have a slot on ${tempDay}.`);
      }
      // Max 3 days constraint
      if (currentSchedule.length >= 3) {
          return alert("You can select a maximum of 3 days.");
      }
      setCurrentSchedule([...currentSchedule, { day: tempDay, time: tempTime }]);
  };

  const handleRemoveSlot = (index) => {
      const newSched = [...currentSchedule];
      newSched.splice(index, 1);
      setCurrentSchedule(newSched);
  };

  // Submit new course request
  const handleAddNewCourse = async () => {
    // Validation
    if (currentSchedule.length < 2) return alert("Please select at least 2 class slots.");
    
    // Format for DB: ["Monday 17:00", "Tuesday 14:00"]
    const formattedDays = currentSchedule.map(s => `${s.day} ${s.time}`);

    const { error } = await supabase.from('enrollments').insert([{ 
        student_id: session.user.id, 
        course_id: courseId, 
        preferred_days: formattedDays, 
        preferred_time: null, // Legacy field ignored
        status: 'pending', 
        joining_date: new Date()
    }]);

    if (error) {
        alert("Error: " + error.message);
    } else { 
        alert("Request Sent! Teacher will review it."); 
        setShowEnrollModal(false); 
        setCurrentSchedule([]); 
        fetchDashboardData(); 
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-indigo-600 font-bold">Loading...</div>;
  
  // Logic: Payment is due if balance is 0 OR they haven't paid specifically for this month
  const isPaymentDue = balance <= 0 || !hasPaidThisMonth; 

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <header className="mb-10 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome, {session.user.email.split('@')[0]}! 👋</h1>
            <p className="text-gray-500">Manage your classes.</p>
          </div>
          <button 
            onClick={() => setShowEnrollModal(true)} 
            className="bg-black text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-800 transition-all shadow-lg"
          >
            <Plus size={20}/> Enroll New Course
          </button>
        </header>

        {/* ACTIVE COURSES GRID */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {enrollments.map((enrollment) => (
                <div 
                    key={enrollment.id} 
                    className={`p-6 rounded-2xl shadow-sm border relative overflow-hidden transition-all hover:shadow-md
                    ${enrollment.status === 'active' ? 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white border-transparent' : 'bg-white border-gray-200 text-gray-800'}`}
                >
                    <div className={`absolute top-4 right-4 text-[10px] font-bold px-2 py-1 rounded uppercase ${enrollment.status === 'active' ? 'bg-white/20 text-white' : 'bg-yellow-100 text-yellow-700'}`}>
                        {enrollment.status === 'active' ? 'Active' : 'Pending'}
                    </div>
                    
                    <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                        <Music size={20} className={enrollment.status === 'active' ? 'text-indigo-200' : 'text-indigo-600'}/> 
                        {enrollment.courses?.name}
                    </h2>
                    
                    {enrollment.status === 'active' ? (
                        <>
                            <div className="text-xs uppercase font-bold opacity-60 mb-2">My Schedule</div>
                            <div className="space-y-1">
                                {enrollment.preferred_days.map((dayStr, i) => (
                                    <div key={i} className="font-mono font-bold text-sm bg-white/10 px-2 py-1 rounded inline-block w-full">
                                        {dayStr.replace(' ', ' @ ')}
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-gray-500 mt-2">
                            Request sent.<br/>Waiting for teacher approval.
                        </p>
                    )}
                </div>
            ))}
        </div>

        {/* STATS ROW (Credits Card Removed) */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {/* Card 1: Classes This Month */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
             <div className="flex items-center gap-3 mb-2 text-gray-500">
                <Calendar size={20} /> <span className="font-bold uppercase text-xs">Classes This Month</span>
             </div>
             <div className="text-4xl font-bold text-gray-900">{classesThisMonth}</div>
          </div>

          {/* Card 2: Status */}
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
          
          {/* Payment Column */}
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

          {/* History Column */}
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
                                // Parse Reason String: "Class Attended: Piano" -> ["Class Attended", "Piano"]
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

      {/* --- ADD COURSE MODAL (UPDATED SCHEDULER) --- */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
                <button onClick={() => setShowEnrollModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X size={24}/></button>
                
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Plus className="text-indigo-600"/> Add Course
                </h2>
                
                <div className="space-y-4">
                    {/* Instrument Selector */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Instrument</label>
                        <select 
                            value={courseId} 
                            onChange={(e) => setCourseId(e.target.value)} 
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none bg-white focus:border-indigo-500"
                        >
                            <option value="1">Piano</option>
                            <option value="4">Guitar</option>
                            <option value="6">Keyboard (Western)</option>
                            <option value="2">Violin</option>
                            <option value="3">Vocal</option>
                            <option value="5">Veena</option>
                            <option value="7">Keyboard (Carnatic)</option>
                        </select>
                    </div>

                    {/* NEW: Day+Time Scheduler */}
                    <div className="bg-gray-50 p-3 rounded border border-gray-200">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Select your dates</label>
                        <div className="flex gap-2 mb-2">
                            <select value={tempDay} onChange={(e) => setTempDay(e.target.value)} className="border p-2 rounded text-sm flex-1 font-bold text-gray-700">
                                {daysOptions.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <select value={tempTime} onChange={(e) => setTempTime(e.target.value)} className="border p-2 rounded text-sm flex-1 font-bold text-gray-700">
                                {timeSlots.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}
                            </select>
                            <button onClick={handleAddSlot} className="bg-indigo-600 text-white px-3 rounded text-sm font-bold hover:bg-indigo-700">Add</button>
                        </div>

                        {/* List of Added Slots */}
                        <div className="space-y-1">
                            {currentSchedule.map((s, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white border border-gray-200 p-2 rounded text-sm">
                                    <span className="font-bold text-gray-800">{s.day} @ {formatTime(s.time)}</span>
                                    <button onClick={() => handleRemoveSlot(idx)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                                </div>
                            ))}
                            {currentSchedule.length === 0 && (
                                <div className="text-center text-xs text-gray-400 italic py-2">No slots added. Add at least 2.</div>
                            )}
                        </div>
                    </div>

                    <button 
                        onClick={handleAddNewCourse} 
                        className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg mt-4 shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                    >
                        Send Request <ArrowRight size={18}/>
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;