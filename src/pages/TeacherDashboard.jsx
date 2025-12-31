import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Users, DollarSign, Calendar, CheckCircle, X, Bell, Trash2,
  History, MessageCircle, User, Search, LayoutDashboard, CreditCard, UserPlus, Music
} from 'lucide-react';

const TeacherDashboard = () => {
  const [activeRoster, setActiveRoster] = useState([]);
  const [pendingApplications, setPendingApplications] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [paidStudentIds, setPaidStudentIds] = useState([]); 
  const [attendanceRecordsToday, setAttendanceRecordsToday] = useState([]); 
  const [studentBalances, setStudentBalances] = useState({}); 
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [reviewingStudent, setReviewingStudent] = useState(null);
  const [viewingStudent, setViewingStudent] = useState(null);
  const [showMasterSchedule, setShowMasterSchedule] = useState(false); // NEW
  const [reminderTargets, setReminderTargets] = useState([]);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]); 
  const [historyRecords, setHistoryRecords] = useState([]);
  
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

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

  const getPreviousSlot = (timeString) => {
    if (!timeString) return "";
    const [hStr, mStr] = timeString.split(':');
    let h = parseInt(hStr);
    let m = parseInt(mStr);
    if (m === 30) return `${hStr}:00`;
    let prevH = h - 1;
    let prevHStr = prevH < 10 ? `0${prevH}` : `${prevH}`;
    return `${prevHStr}:30`;
  };

  const isSlotOccupied = (day, time) => {
    const exactMatch = activeRoster.find(s => s.preferred_days?.includes(day) && s.preferred_time?.slice(0,5) === time);
    if (exactMatch) return exactMatch;
    const prevTime = getPreviousSlot(time);
    const overlapMatch = activeRoster.find(s => s.preferred_days?.includes(day) && s.preferred_time?.slice(0,5) === prevTime);
    return overlapMatch;
  };

  const getCourseCategory = (courseId) => {
    const westernIds = [1, 4, 6];
    if (westernIds.includes(courseId)) return "Western";
    return "Carnatic";
  };

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    const todayStr = new Date().toISOString().split('T')[0];

    const { data: roster } = await supabase.from('enrollments').select('*, student:profiles(*), courses(*)').eq('status', 'active');
    if (roster) setActiveRoster(roster);

    const { data: applications } = await supabase.from('enrollments').select('*, student:profiles(*), courses(*)').eq('status', 'pending');
    if (applications) setPendingApplications(applications);

    const { data: payments } = await supabase.from('payments').select('*, student:profiles(*)').eq('status', 'pending');
    if (payments) setPendingPayments(payments);

    const { data: paid } = await supabase.from('payments').select('student_id').eq('status', 'approved').eq('month_for', currentMonthName);
    if (paid) setPaidStudentIds(paid.map(p => p.student_id));

    const { data: attendance } = await supabase.from('credit_ledger')
        .select('student_id, reason')
        .gte('created_at', `${todayStr}T00:00:00`)
        .lte('created_at', `${todayStr}T23:59:59`);
        
    if (attendance) setAttendanceRecordsToday(attendance);

    const { data: allLedger } = await supabase.from('credit_ledger').select('student_id, amount');
    if (allLedger) {
        const balances = {};
        allLedger.forEach(entry => {
            if (!balances[entry.student_id]) balances[entry.student_id] = 0;
            balances[entry.student_id] += entry.amount;
        });
        setStudentBalances(balances);
    }

    setLoading(false);
  };

  // --- ACTIONS ---
  const handleApprovePayment = async (paymentId, studentId) => {
    const { error: paymentError } = await supabase.from('payments').update({ status: 'approved' }).eq('id', paymentId);
    if (paymentError) return alert("Error approving payment");

    const activeCourseCount = activeRoster.filter(r => r.student_id === studentId).length;
    const creditsNeeded = activeCourseCount * 12;
    const creditsFromTrigger = 12; 
    const creditsToManualAdd = Math.max(0, creditsNeeded - creditsFromTrigger);

    if (creditsToManualAdd > 0) {
         await supabase.from('credit_ledger').insert([{ 
             student_id: studentId, 
             amount: creditsToManualAdd, 
             reason: 'Bonus Credits (Multi-Instrument)' 
         }]);
    }
    alert("Payment Approved!");
    fetchData();
  };

  const handleRejectPayment = async (paymentId) => {
    if(!window.confirm("Reject this payment?")) return;
    const { error } = await supabase.from('payments').delete().eq('id', paymentId);
    if (!error) { alert("Deleted."); fetchData(); }
  };

  const handleRejectApplication = async (id) => {
    if(window.confirm("Reject application?")) {
        await supabase.from('enrollments').delete().eq('id', id);
        fetchData();
    }
  };

  // NEW: DELETE STUDENT (Unenroll)
  const handleDeleteStudent = async (enrollmentId, studentName, courseName) => {
      const confirmMsg = `Are you sure you want to remove ${studentName} from ${courseName}?\n\nThis will delete this specific enrollment but keep their profile and history.`;
      if (!window.confirm(confirmMsg)) return;

      const { error } = await supabase.from('enrollments').delete().eq('id', enrollmentId);
      if (error) alert("Error deleting: " + error.message);
      else {
          alert("Student removed from course.");
          fetchData();
      }
  };

  const toggleReviewDay = (day) => {
    setReviewingStudent(prev => {
      const currentDays = prev.preferred_days || [];
      const newDays = currentDays.includes(day) ? currentDays.filter(d => d !== day) : [...currentDays, day];
      return { ...prev, preferred_days: newDays };
    });
  };

  const handleAcceptApplication = async () => {
    if (!reviewingStudent) return;
    if (reviewingStudent.preferred_days.length < 2) return alert("Select at least 2 days.");

    const time = reviewingStudent.preferred_time.slice(0, 5);
    const hasConflict = reviewingStudent.preferred_days.some(day => isSlotOccupied(day, time));

    if (hasConflict) {
        return alert("Cannot Enroll: Scheduling conflict detected.");
    }

    const { error } = await supabase.from('enrollments')
        .update({ status: 'active', preferred_time: reviewingStudent.preferred_time, preferred_days: reviewingStudent.preferred_days })
        .eq('id', reviewingStudent.id);

    if (!error) {
        alert("Enrolled Successfully!");
        setReviewingStudent(null);
        fetchData();
    }
  };

  const handleMarkAttendance = async (enrollment) => {
    const courseName = enrollment.courses?.name || "Unknown";
    const alreadyMarked = attendanceRecordsToday.some(r => r.student_id === enrollment.student_id && r.reason.includes(courseName));
    if (alreadyMarked) return alert(`Already marked present for ${courseName} today.`);
    
    const currentBalance = studentBalances[enrollment.student_id] || 0;
    if (currentBalance <= 0) {
        if (!window.confirm(`Balance is ${currentBalance}. Mark anyway?`)) return;
    }

    const { error } = await supabase.from('credit_ledger').insert([{ 
        student_id: enrollment.student_id, 
        amount: -1, 
        reason: `Class Attended: ${courseName}` 
    }]);

    if (!error) {
        setAttendanceRecordsToday([...attendanceRecordsToday, { student_id: enrollment.student_id, reason: `Class Attended: ${courseName}` }]);
        setStudentBalances(prev => ({...prev, [enrollment.student_id]: (prev[enrollment.student_id] || 0) - 1}));
        alert(`Marked Present for ${courseName}!`);
    }
  };

  // --- HELPERS FOR VIEW ---
  const handleBulkReminders = () => {
    let targetStudents = activeRoster.filter(s => !pendingPayments.some(p => p.student_id === s.student.id) && !paidStudentIds.includes(s.student.id));
    const uniqueStudents = []; const seenIds = new Set();
    targetStudents.forEach(s => { if(!seenIds.has(s.student_id)) { uniqueStudents.push(s); seenIds.add(s.student_id); } });
    if (uniqueStudents.length === 0) return alert("No reminders needed.");
    setReminderTargets(uniqueStudents.map(s => ({ ...s, sent: false })));
    setShowReminderModal(true);
  };

  const handleSendReminder = (index, student) => {
    const msg = `Hello ${student.student.full_name}, friendly reminder to pay your Music Class fees.`;
    window.open(`https://wa.me/${student.student.phone_number}?text=${encodeURIComponent(msg)}`, '_blank');
    setReminderTargets(prev => { const n = [...prev]; n[index] = { ...n[index], sent: true }; return n; });
  };

  const fetchHistory = async () => {
    const start = `${historyDate}T00:00:00`;
    const end = `${historyDate}T23:59:59`;
    const { data } = await supabase.from('credit_ledger').select('*, student:profiles(full_name)').lt('amount', 0).gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false });
    setHistoryRecords(data || []);
  };
  useEffect(() => { if (showHistory) fetchHistory(); }, [historyDate, showHistory]);

  const todaysStudents = activeRoster.filter(s => s.preferred_days.includes(todayName));
  const filteredDirectory = activeRoster.filter(s => {
    const q = searchQuery.toLowerCase();
    return s.student.full_name.toLowerCase().includes(q) || s.courses.name.toLowerCase().includes(q) || getCourseCategory(s.courses.id).toLowerCase().includes(q) || s.preferred_days.some(d => d.toLowerCase().includes(q));
  });

  if (loading) return <div className="p-10 text-center font-bold text-indigo-600">Loading Dashboard...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8 font-sans text-gray-800">
      
      {/* NAVIGATION TABS */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4">
            <div className="flex justify-between items-center h-16">
                <div className="font-bold text-xl text-indigo-600 hidden md:block">Teacher Dashboard</div>
                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-full md:w-auto">
                    <button onClick={() => setActiveTab('dashboard')} className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'dashboard' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
                        <LayoutDashboard size={18}/> Dashboard
                    </button>
                    <button onClick={() => setActiveTab('payments')} className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all relative ${activeTab === 'payments' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
                        <CreditCard size={18}/> Payments
                        {pendingPayments.length > 0 && <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full"></span>}
                    </button>
                    <button onClick={() => setActiveTab('applications')} className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all relative ${activeTab === 'applications' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
                        <UserPlus size={18}/> New
                        {pendingApplications.length > 0 && <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full"></span>}
                    </button>
                </div>
            </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-8 mt-4">
        
        {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in">
                {/* Header Actions */}
                <div className="flex flex-col md:flex-row gap-4 justify-between">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-3 text-gray-400" size={20}/>
                        <input type="text" placeholder="Search name, day, or instrument..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-indigo-500 transition-all bg-white shadow-sm" />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {/* NEW: Master Schedule Button */}
                        <button onClick={() => setShowMasterSchedule(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-sm">
                            <Calendar size={18} /> Schedule
                        </button>
                        <button onClick={() => setShowHistory(true)} className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-50 flex items-center gap-2 shadow-sm">
                            <History size={18} /> History
                        </button>
                        <button onClick={handleBulkReminders} className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-50 flex items-center gap-2 shadow-sm">
                            <Bell size={18} /> Reminders
                        </button>
                    </div>
                </div>

                {/* Section 1: TODAY'S CLASSES */}
                {!searchQuery && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50">
                            <div>
                                <h2 className="font-bold text-xl text-indigo-900 flex items-center gap-2"><Calendar className="text-indigo-600"/> Today's Classes ({todayName})</h2>
                                <p className="text-indigo-600/70 text-sm mt-1">{todaysStudents.length} students scheduled.</p>
                            </div>
                        </div>
                        {todaysStudents.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">No classes scheduled for today.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-indigo-50/50 text-indigo-900/50 font-bold uppercase text-xs">
                                        <tr><th className="p-4">Time</th><th className="p-4">Student</th><th className="p-4">Course</th><th className="p-4 text-center">Credits</th><th className="p-4 text-center">Status</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {todaysStudents.sort((a,b) => a.preferred_time.localeCompare(b.preferred_time)).map(student => {
                                            const isPresent = attendanceRecordsToday.some(r => r.student_id === student.student_id && r.reason.includes(student.courses.name));
                                            const balance = studentBalances[student.student_id] || 0;
                                            return (
                                                <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="p-4 font-mono font-bold text-indigo-600">{student.preferred_time}</td>
                                                    <td onClick={() => setViewingStudent(student)} className="p-4 font-bold text-gray-900 cursor-pointer hover:text-indigo-600 hover:underline">{student.student.full_name}</td>
                                                    <td className="p-4 text-gray-500">{student.courses?.name} <span className="text-xs bg-gray-100 px-1 rounded border border-gray-200">{getCourseCategory(student.courses?.id)}</span></td>
                                                    <td className="p-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-bold ${balance <= 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{balance}</span></td>
                                                    <td className="p-4 text-center">
                                                        <button onClick={() => handleMarkAttendance(student)} disabled={isPresent} className={`px-3 py-1 rounded-lg font-bold text-xs shadow-sm transition-all ${isPresent ? 'bg-green-100 text-green-700 cursor-not-allowed' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-500 hover:text-indigo-600'}`}>{isPresent ? 'Present ✓' : 'Mark Present'}</button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Section 2: FULL DIRECTORY */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100"><h2 className="font-bold text-lg flex items-center gap-2 text-gray-700"><Users size={20}/> {searchQuery ? 'Search Results' : 'Full Directory'}</h2></div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs">
                                <tr><th className="p-4">Name</th><th className="p-4">Course</th><th className="p-4">Credits</th><th className="p-4 text-center">Action</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredDirectory.map(student => {
                                    const balance = studentBalances[student.student_id] || 0;
                                    return (
                                        <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                                            <td onClick={() => setViewingStudent(student)} className="p-4 font-bold text-gray-900 cursor-pointer hover:text-indigo-600 hover:underline">{student.student.full_name}</td>
                                            <td className="p-4 text-gray-500">{student.courses?.name} <span className="text-xs text-gray-400">({getCourseCategory(student.courses?.id)})</span></td>
                                            <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${balance <= 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{balance} Cr</span></td>
                                            <td className="p-4 text-center flex justify-center gap-2">
                                                <button onClick={() => setViewingStudent(student)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded text-xs font-bold">View</button>
                                                {/* NEW: Delete Button */}
                                                <button onClick={() => handleDeleteStudent(student.id, student.student.full_name, student.courses.name)} className="bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded text-xs"><Trash2 size={16}/></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* PAYMENTS & APPLICATIONS TABS (Same as before) */}
        {activeTab === 'payments' && (
            <div className="animate-in fade-in">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden max-w-3xl mx-auto">
                    <div className="p-6 bg-orange-50 border-b border-orange-100"><h2 className="font-bold text-xl text-orange-800 flex items-center gap-2">Payment Approvals</h2></div>
                    {pendingPayments.length === 0 ? <div className="p-12 text-center text-gray-400">No pending payments.</div> : (
                        <div className="divide-y divide-gray-100">
                            {pendingPayments.map(p => (
                                <div key={p.id} className="p-6 flex items-center justify-between hover:bg-gray-50">
                                    <div><div className="font-bold text-lg text-gray-900">{p.student?.full_name}</div><div className="text-sm text-gray-500">Fee Payment Submitted for {p.month_for}</div><div className="text-xs text-gray-400 mt-1">Ref: {String(p.id)}</div></div>
                                    <div className="flex gap-3"><button onClick={() => handleApprovePayment(p.id, p.student_id)} className="bg-green-100 hover:bg-green-200 text-green-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2"><CheckCircle size={18}/> Approve</button><button onClick={() => handleRejectPayment(p.id)} className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg font-bold"><X size={18}/></button></div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

        {activeTab === 'applications' && (
             <div className="animate-in fade-in">
                 <h2 className="font-bold text-2xl mb-6 text-gray-800">New Applications</h2>
                 {pendingApplications.length === 0 ? <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center text-gray-400">No new student applications.</div> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pendingApplications.map(app => (
                            <div key={app.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative">
                                <div className="absolute top-4 right-4 bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded uppercase">New</div>
                                <div className="mb-4"><div className="font-bold text-xl text-gray-900">{app.student.full_name}</div><div className="text-sm text-gray-500">{app.courses.name} ({getCourseCategory(app.courses.id)}) • Age {app.student.age}</div></div>
                                <div className="bg-gray-50 p-3 rounded border border-gray-100 text-sm mb-6"><span className="font-bold text-gray-600 block mb-1">Requested:</span> {app.preferred_days.join(", ")} <br/> @ {app.preferred_time}</div>
                                <div className="flex gap-2"><button onClick={() => setReviewingStudent(app)} className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-sm">Review Schedule</button><button onClick={() => handleRejectApplication(app.id)} className="px-4 border border-gray-300 text-gray-500 rounded-lg font-bold hover:bg-white hover:text-red-600"><X size={20}/></button></div>
                            </div>
                        ))}
                    </div>
                 )}
             </div>
        )}
      </div>

      {/* --- NEW: MASTER SCHEDULE MODAL --- */}
      {showMasterSchedule && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col p-6 overflow-hidden">
                <div className="flex justify-between items-center mb-4 shrink-0">
                    <h2 className="text-2xl font-bold flex items-center gap-2"><Calendar className="text-indigo-600"/> Master Schedule</h2>
                    <button onClick={() => setShowMasterSchedule(false)} className="text-gray-400 hover:text-black"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
                    <table className="w-full border-collapse">
                        <thead className="sticky top-0 bg-gray-100 text-gray-600 text-xs uppercase z-10">
                            <tr><th className="p-2 border border-gray-300 w-16">Time</th>{daysOfWeek.map(day => <th key={day} className="p-2 border border-gray-300 min-w-[100px]">{day}</th>)}</tr>
                        </thead>
                        <tbody>
                            {timeSlots.map(time => (
                                <tr key={time}>
                                    <td className="py-1 px-2 border border-gray-300 font-mono text-[10px] bg-gray-50 text-center text-gray-500">{time}</td>
                                    {daysOfWeek.map(day => {
                                        const occupiedBy = isSlotOccupied(day, time);
                                        let borderClass = "border border-gray-300"; 
                                        let content = null;
                                        let cellClass = "bg-white hover:bg-gray-50";
                                        
                                        if (occupiedBy) {
                                            const isStart = occupiedBy.preferred_time?.slice(0,5) === time;
                                            cellClass = "bg-indigo-100 text-indigo-800 cursor-pointer hover:bg-indigo-200 transition-colors";
                                            if (isStart) { 
                                                content = <div className="font-bold text-xs truncate px-1">{occupiedBy.student.full_name}</div>; 
                                                borderClass = "border-t border-l border-r border-gray-300 border-b-0"; 
                                            } else { 
                                                borderClass = "border-b border-l border-r border-gray-300 border-t-0"; 
                                            }
                                        }
                                        return (
                                            <td 
                                                key={day + time} 
                                                onClick={() => occupiedBy && setViewingStudent(occupiedBy)} 
                                                className={`${borderClass} p-1 text-center h-8 relative ${cellClass}`}
                                            >
                                                {content}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

      {/* --- OTHER MODALS (Review, History, Reminders, Profile) SAME AS BEFORE --- */}
      {/* 1. Review Modal */}
      {reviewingStudent && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col p-6 overflow-hidden">
                <div className="flex justify-between items-center mb-4 shrink-0">
                    <h2 className="text-2xl font-bold">Scheduling: <span className="text-indigo-600">{reviewingStudent.student.full_name}</span></h2>
                    <button onClick={() => setReviewingStudent(null)} className="text-gray-400 hover:text-black"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
                    <table className="w-full border-collapse">
                        <thead className="sticky top-0 bg-gray-100 text-gray-600 text-xs uppercase z-10">
                            <tr><th className="p-2 border border-gray-300 w-16">Time</th>{daysOfWeek.map(day => <th key={day} className="p-2 border border-gray-300 min-w-[100px]">{day}</th>)}</tr>
                        </thead>
                        <tbody>
                            {timeSlots.map(time => (
                                <tr key={time}>
                                    <td className="py-1 px-2 border border-gray-300 font-mono text-[10px] bg-gray-50 text-center text-gray-500">{time}</td>
                                    {daysOfWeek.map(day => {
                                        const occupiedBy = isSlotOccupied(day, time);
                                        const reqStartTime = reviewingStudent.preferred_time?.slice(0,5);
                                        const isReqStart = reviewingStudent.preferred_days.includes(day) && reqStartTime === time;
                                        const isReqOverlap = reviewingStudent.preferred_days.includes(day) && reqStartTime === getPreviousSlot(time);
                                        const isRequested = isReqStart || isReqOverlap;
                                        let cellClass = "bg-white"; let content = null; let borderClass = "border border-gray-300"; 
                                        if (occupiedBy) {
                                            const isStart = occupiedBy.preferred_time?.slice(0,5) === time;
                                            cellClass = isRequested ? "bg-red-500 text-white" : "bg-blue-100 text-blue-800";
                                            if (isStart) { content = occupiedBy.student.full_name.split(' ')[0]; borderClass = "border-t border-l border-r border-gray-300 border-b-0"; } 
                                            else { content = ""; borderClass = "border-b border-l border-r border-gray-300 border-t-0"; }
                                        } else if (isRequested) {
                                            cellClass = "bg-green-500 text-white";
                                            if (isReqStart) { content = "REQUESTED"; borderClass = "border-t border-l border-r border-gray-300 border-b-0"; } 
                                            else { content = ""; borderClass = "border-b border-l border-r border-gray-300 border-t-0"; }
                                        }
                                        return (
                                            <td key={day + time} onClick={() => occupiedBy && setViewingStudent(occupiedBy)} className={`${borderClass} p-1 text-center h-8 relative group ${cellClass} ${occupiedBy ? 'cursor-pointer hover:opacity-90' : ''}`}>
                                                <div className="truncate font-bold text-xs">{content}</div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-4 flex flex-col xl:flex-row justify-between items-center gap-4 bg-gray-50 p-4 rounded-lg shrink-0 border-t border-gray-200">
                    <div className="flex gap-2">
                         {daysOfWeek.map(day => (
                            <button key={day} onClick={() => (!reviewingStudent.preferred_days.length >= 3 || reviewingStudent.preferred_days.includes(day)) && toggleReviewDay(day)} disabled={reviewingStudent.preferred_days.length >= 3 && !reviewingStudent.preferred_days.includes(day)} className={`px-2 py-1 text-xs font-bold rounded border ${reviewingStudent.preferred_days.includes(day) ? 'bg-indigo-600 text-white' : 'bg-white'}`}>{day.slice(0,3)}</button>
                         ))}
                    </div>
                    <div className="flex gap-2">
                        <select value={reviewingStudent.preferred_time} onChange={(e) => setReviewingStudent({...reviewingStudent, preferred_time: e.target.value})} className="border rounded px-4 py-2 font-bold bg-white text-gray-800">
                            {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button onClick={handleAcceptApplication} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold">Enroll</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
                <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">History</h2><button onClick={() => setShowHistory(false)}><X/></button></div>
                <input type="date" value={historyDate} onChange={(e) => setHistoryDate(e.target.value)} className="w-full border p-2 rounded mb-4"/>
                <div className="max-h-64 overflow-y-auto space-y-2">
                    {historyRecords.length === 0 ? <div className="text-center text-gray-400 p-4">No classes recorded.</div> : historyRecords.map(r => {
                        const parts = r.reason.split(':'); const instrument = parts[1] ? parts[1].trim() : null;
                        return (<div key={r.id} className="p-3 bg-gray-50 border-l-4 border-indigo-500 flex justify-between items-center"><div><span className="font-bold block">{r.student.full_name}</span>{instrument && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase">{instrument}</span>}</div><span className="text-sm text-gray-500">{new Date(r.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div>)
                    })}
                </div>
            </div>
        </div>
      )}

      {showReminderModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative">
                <button onClick={() => setShowReminderModal(false)} className="absolute top-4 right-4 text-gray-400"><X size={28}/></button>
                <h2 className="text-2xl font-bold mb-4">Send Reminders</h2>
                <div className="bg-gray-50 rounded-lg border border-gray-200 max-h-96 overflow-y-auto p-2">
                    {reminderTargets.map((student, index) => (
                        <div key={student.id} className="flex justify-between items-center bg-white p-3 mb-2 rounded border border-gray-100 shadow-sm">
                            <div className="font-bold">{student.student.full_name}</div>
                            {student.sent ? <span className="text-gray-400 font-bold text-sm">Done</span> : <button onClick={() => handleSendReminder(index, student)} className="bg-green-500 text-white px-3 py-1 rounded text-sm font-bold">Send</button>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {viewingStudent && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
            <div className="bg-indigo-600 p-6 text-white relative">
                <button onClick={() => setViewingStudent(null)} className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 p-1 rounded-full text-white transition-colors"><X size={20} /></button>
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white text-indigo-600 rounded-full flex items-center justify-center font-bold text-2xl shadow-inner">{viewingStudent.student.full_name.charAt(0)}</div>
                    <div>
                        <h2 className="text-2xl font-bold">{viewingStudent.student.full_name}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-indigo-100 text-sm flex items-center gap-1"><User size={14}/> Student Profile</p>
                            <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                                {activeRoster.filter(r => r.student_id === viewingStudent.student_id).length} Active Courses
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="p-6 space-y-4">
                <div className={`${(studentBalances[viewingStudent.student_id] || 0) <= 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'} p-4 rounded-xl border flex justify-between items-center`}>
                    <div><div className="text-xs uppercase font-bold opacity-70">Current Balance</div><div className="text-2xl font-bold">{studentBalances[viewingStudent.student_id] || 0} Credits</div></div>
                    <div className={`w-4 h-4 rounded-full ${(studentBalances[viewingStudent.student_id] || 0) <= 0 ? 'bg-red-500' : 'bg-green-500'}`}></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100"><label className="text-xs text-gray-500 uppercase font-bold">Phone</label><div className="font-medium text-gray-900 flex items-center gap-2">{viewingStudent.student.phone_number}<button onClick={() => window.open(`https://wa.me/${viewingStudent.student.phone_number}`)} className="text-green-600 hover:text-green-700"><MessageCircle size={16}/></button></div></div>
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100"><label className="text-xs text-gray-500 uppercase font-bold">Age</label><div className="font-medium text-gray-900">{viewingStudent.student.age} Years</div></div>
                </div>
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                    <h3 className="font-bold text-indigo-900 mb-2 flex items-center gap-2"><Calendar size={18}/> Course Details</h3>
                    <div className="space-y-1 text-sm text-indigo-800">
                        <p><span className="font-semibold">Instrument:</span> {viewingStudent.courses?.name}</p>
                        <p><span className="font-semibold">Type:</span> {getCourseCategory(viewingStudent.courses?.id)}</p>
                        <p><span className="font-semibold">Schedule:</span> {viewingStudent.preferred_days?.join(" & ")}</p>
                        <p><span className="font-semibold">Time:</span> {viewingStudent.preferred_time}</p>
                    </div>
                </div>
                <div className="pt-2 flex flex-col gap-3">
                    <button onClick={() => handleMarkAttendance(viewingStudent)} disabled={attendanceRecordsToday.some(r => r.student_id === viewingStudent.student_id && r.reason.includes(viewingStudent.courses.name))} className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-colors shadow-sm ${attendanceRecordsToday.some(r => r.student_id === viewingStudent.student_id && r.reason.includes(viewingStudent.courses.name)) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}><CheckCircle size={18}/> {attendanceRecordsToday.some(r => r.student_id === viewingStudent.student_id && r.reason.includes(viewingStudent.courses.name)) ? 'Marked Present Today' : 'Mark Present (-1 Credit)'}</button>
                    <button onClick={() => window.open(`https://wa.me/${viewingStudent.student.phone_number}`, '_blank')} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"><MessageCircle size={18} /> WhatsApp</button>
                </div>
            </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default TeacherDashboard;