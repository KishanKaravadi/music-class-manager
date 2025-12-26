import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Users, DollarSign, Calendar, CheckCircle, X, Bell, Trash2, History, Search } from 'lucide-react';

const TeacherDashboard = () => {
  const [activeRoster, setActiveRoster] = useState([]);
  const [pendingApplications, setPendingApplications] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [paidStudentIds, setPaidStudentIds] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  const [reviewingStudent, setReviewingStudent] = useState(null);
  
  // History Modal State
  const [showHistory, setShowHistory] = useState(false);
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]); 
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 9; hour <= 20; hour++) {
      const formattedHour = hour < 10 ? `0${hour}` : hour;
      slots.push(`${formattedHour}:00`);
      if (hour !== 20) slots.push(`${formattedHour}:30`);
    }
    return slots;
  };
  const timeSlots = generateTimeSlots();

  useEffect(() => {
    fetchData();
  }, []);

  // --- FIXED: History Fetching Logic ---
  const fetchHistory = async (dateString) => {
    setHistoryLoading(true);

    // 1. Manually construct Local Start/End times to avoid Timezone bugs
    const [year, month, day] = dateString.split('-');
    // Note: Month is 0-indexed in JS Date
    const startDate = new Date(year, month - 1, day, 0, 0, 0); 
    const endDate = new Date(year, month - 1, day, 23, 59, 59);

    // 2. Query Ledger
    const { data, error } = await supabase
        .from('credit_ledger')
        .select(`
            amount, created_at, reason,
            student:student_id (full_name, email)
        `)
        .lt('amount', 0) // Only look for deductions (attendance)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

    if (error) {
        console.error(error);
        alert("Error fetching history");
    } else {
        setHistoryRecords(data || []);
    }
    setHistoryLoading(false);
  };

  useEffect(() => {
    if (showHistory) {
        fetchHistory(historyDate);
    }
  }, [showHistory, historyDate]);
  // -------------------------------------

  const fetchData = async () => {
    setLoading(true);
    const currentMonthName = new Date().toLocaleString('default', { month: 'long' });

    // 1. Fetch Enrollments
    const { data: enrollmentData } = await supabase
      .from('enrollments')
      .select(`
        id, course_id, preferred_days, preferred_time, joining_date, status,
        courses (name, category),
        student:student_id (id, full_name, phone_number, email)
      `);

    // 2. Fetch Balances
    const { data: balanceData } = await supabase.from('student_balances_view').select('*');
    const safeBalanceData = balanceData || [];

    const fullRoster = enrollmentData?.map(enrollment => {
      const balanceInfo = safeBalanceData.find(b => b.student_id === enrollment.student.id);
      return {
        ...enrollment,
        current_balance: balanceInfo ? balanceInfo.current_balance : 0
      };
    }) || [];

    setActiveRoster(fullRoster.filter(r => r.status === 'active'));
    setPendingApplications(fullRoster.filter(r => r.status === 'pending'));

    // 3. Fetch Pending Payments
    const { data: paymentData } = await supabase
      .from('payments').select('*, profiles(full_name)').eq('status', 'pending');
    setPendingPayments(paymentData || []);

    // 4. Fetch APPROVED Payments for THIS Month
    const { data: approvedData } = await supabase
      .from('payments')
      .select('student_id')
      .eq('status', 'approved')
      .eq('month_for', currentMonthName); // STRICT CHECK: Must be "December" (or current)
    
    setPaidStudentIds(approvedData?.map(p => p.student_id) || []);
    
    setLoading(false);
  };

  // --- SMART REMINDERS ---
  const handleBulkReminders = () => {
    let targetStudents = activeRoster;

    // 1. Remove anyone pending approval (they tried to pay)
    targetStudents = targetStudents.filter(student => 
        !pendingPayments.some(p => p.student_id === student.student.id)
    );

    // 2. Remove anyone who has an APPROVED payment for THIS month
    targetStudents = targetStudents.filter(student => 
        !paidStudentIds.includes(student.student.id)
    );
    
    if (targetStudents.length === 0) return alert("Everyone is paid up or pending! No reminders needed.");

    const confirm = window.confirm(`Found ${targetStudents.length} students who haven't paid for ${new Date().toLocaleString('default', { month: 'long' })} yet.\n\nSend WhatsApp reminders?`);
    if (!confirm) return;

    targetStudents.forEach((s) => {
        const msg = `Hello ${s.student.full_name}, friendly reminder to pay your Music Class fees for ${new Date().toLocaleString('default', { month: 'long' })}.`;
        window.open(`https://wa.me/${s.student.phone_number}?text=${encodeURIComponent(msg)}`, '_blank');
    });
  };

  const handleApprovePayment = async (paymentId) => {
    await supabase.from('payments').update({ status: 'approved' }).eq('id', paymentId);
    alert("Payment Approved!");
    fetchData();
  };

  const handleMarkPresent = async (studentId, courseName, currentBalance) => {
    if (currentBalance <= 0) return alert(`⛔ STOP: Student has 0 credits.`);
    if (window.confirm(`Mark ${courseName} present?`)) {
      await supabase.from('credit_ledger').insert([{ student_id: studentId, amount: -1, reason: `Attended ${courseName}` }]);
      fetchData(); // This refreshes the view so History will see it
    }
  };

  const handleArchiveStudent = async (enrollmentId, studentName) => {
    if (!window.confirm(`Archive ${studentName}?`)) return;
    await supabase.from('enrollments').update({ status: 'archived' }).eq('id', enrollmentId);
    fetchData();
  };

  const handleAcceptApplication = async () => {
    if (!reviewingStudent) return;
    const { error } = await supabase.from('enrollments')
        .update({ status: 'active', preferred_time: reviewingStudent.preferred_time })
        .eq('id', reviewingStudent.id);
    if (!error) {
        alert("Enrolled Successfully!");
        setReviewingStudent(null);
        fetchData();
    }
  };

  const isSlotOccupied = (day, time) => {
    return activeRoster.find(s => 
        s.preferred_days?.includes(day) && 
        s.preferred_time?.slice(0,5) === time
    );
  };

  if (loading) return <div className="p-10 flex justify-center text-indigo-600">Loading Dashboard...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12 relative">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 flex flex-col md:flex-row justify-between items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-900">Teacher Dashboard</h1>
            
            <div className="flex gap-2">
                <button 
                    onClick={() => setShowHistory(true)}
                    className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-50 transition-colors"
                >
                    <History size={18} /> History
                </button>

                <button 
                    onClick={handleBulkReminders}
                    className="bg-orange-100 text-orange-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-orange-200 transition-colors"
                >
                    <Bell size={18} /> Reminders
                </button>
            </div>
        </header>

        {/* 1. NEW APPLICATIONS */}
        {pendingApplications.length > 0 && (
          <div className="mb-12 bg-blue-50 border border-blue-200 rounded-xl p-6">
             <h2 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
              <Users className="text-blue-600" /> New Enrollment Requests ({pendingApplications.length})
             </h2>
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
               {pendingApplications.map(app => (
                 <div key={app.id} className="bg-white p-5 rounded-lg shadow-sm">
                   <h3 className="font-bold text-lg">{app.student.full_name}</h3>
                   <div className="text-sm text-gray-500 mb-2">{app.courses.name} ({app.courses.category})</div>
                   <div className="text-sm font-medium text-gray-700 bg-gray-100 p-2 rounded mb-3">
                        Requested: {app.preferred_days?.join(", ")} <br/> @ {app.preferred_time}
                   </div>
                   <button onClick={() => setReviewingStudent(app)} className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700 flex items-center justify-center gap-2">
                     <Calendar size={16}/> Review Schedule
                   </button>
                 </div>
               ))}
             </div>
          </div>
        )}

        {/* 2. PENDING PAYMENTS */}
        {pendingPayments.length > 0 && (
          <div className="mb-12">
             <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <DollarSign className="text-yellow-600" /> Pending Fees
             </h2>
             <div className="grid gap-4 md:grid-cols-3">
               {pendingPayments.map(p => (
                 <div key={p.id} className="bg-white p-5 rounded-xl shadow-sm border border-yellow-200">
                   <h3 className="font-bold">{p.profiles?.full_name}</h3>
                   <p className="text-gray-500 text-sm">Paid ₹{p.amount_paid}</p>
                   <button onClick={() => handleApprovePayment(p.id)} className="mt-4 w-full bg-yellow-500 text-white font-bold py-2 rounded">Approve</button>
                 </div>
               ))}
             </div>
          </div>
        )}

        {/* 3. ACTIVE ROSTER */}
        <h2 className="text-xl font-bold text-gray-800 mb-4">Active Students</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-gray-600 text-sm uppercase">
              <tr><th className="p-4">Student</th><th className="p-4">Schedule</th><th className="p-4">Credits</th><th className="p-4 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activeRoster.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="p-4">
                      <div className="font-bold">{item.student.full_name}</div>
                      <div className="text-xs text-gray-500">{item.courses.name} ({item.courses.category})</div>
                  </td>
                  <td className="p-4">
                      <div className="text-sm font-medium">{item.preferred_days?.join(", ")}</div>
                      <div className="text-xs text-gray-500">{item.preferred_time}</div>
                  </td>
                  <td className="p-4 font-bold text-indigo-600">{item.current_balance}</td>
                  <td className="p-4 text-right flex justify-end items-center gap-3">
                    <button onClick={() => handleMarkPresent(item.student.id, item.courses.name, item.current_balance)} className="bg-indigo-600 text-white px-3 py-1 rounded text-sm">Present</button>
                    <button onClick={() => handleArchiveStudent(item.id, item.student.full_name)} className="text-gray-400 hover:text-red-600 p-2" title="Archive Student"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- HISTORY MODAL (FIXED) --- */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative">
                <button onClick={() => setShowHistory(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X size={28}/></button>
                
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                    <History className="text-indigo-600"/> Attendance History
                </h2>
                
                <div className="mb-6">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Select Date:</label>
                    <input 
                        type="date" 
                        value={historyDate} 
                        onChange={(e) => setHistoryDate(e.target.value)}
                        className="w-full p-3 border rounded-lg bg-gray-50 font-bold"
                    />
                </div>

                <div className="bg-gray-50 rounded-lg border border-gray-200 h-64 overflow-y-auto p-4">
                    {historyLoading ? (
                        <div className="text-center text-gray-400 mt-10">Loading...</div>
                    ) : historyRecords.length === 0 ? (
                        <div className="text-center text-gray-400 mt-10">No classes attended on this date.</div>
                    ) : (
                        <div className="space-y-3">
                            {historyRecords.map((rec, i) => (
                                <div key={i} className="bg-white p-3 rounded shadow-sm border border-gray-100 flex justify-between items-center">
                                    <div>
                                        <div className="font-bold">{rec.student.full_name}</div>
                                        <div className="text-xs text-gray-500">{rec.reason}</div>
                                    </div>
                                    <div className="text-sm font-mono text-gray-400">
                                        {new Date(rec.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* --- VISUAL CALENDAR MODAL (Review Schedule) --- */}
      {reviewingStudent && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col p-6 relative">
                <button onClick={() => setReviewingStudent(null)} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X size={28}/></button>
                <div className="mb-4">
                  <h2 className="text-2xl font-bold mb-1">Review Schedule</h2>
                  <p className="text-gray-500">Applicant: <span className="font-bold text-indigo-600">{reviewingStudent.student.full_name}</span> wants <span className="font-bold">{reviewingStudent.preferred_days.join(", ")} @ {reviewingStudent.preferred_time}</span></p>
                </div>
                <div className="overflow-auto border rounded-lg shadow-inner flex-1">
                    <table className="w-full text-xs border-collapse">
                        <thead className="sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="bg-gray-100 p-2 border border-gray-300 w-16">Time</th>
                                {daysOfWeek.map(day => (
                                    <th key={day} className={`p-2 border border-gray-300 w-32 ${reviewingStudent.preferred_days.includes(day) ? 'bg-yellow-100 text-yellow-900 font-bold border-yellow-300' : 'bg-gray-50'}`}>
                                        {day.slice(0,3)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {timeSlots.map(time => (
                                <tr key={time}>
                                    <td className="py-1 px-2 border border-gray-300 font-mono text-[10px] bg-gray-50 text-center text-gray-500">{time}</td>
                                    {daysOfWeek.map(day => {
                                        const occupiedBy = isSlotOccupied(day, time);
                                        const isRequested = reviewingStudent.preferred_days.includes(day) && reviewingStudent.preferred_time?.slice(0,5) === time;
                                        let cellClass = "bg-white"; let content = null;
                                        if (occupiedBy) { cellClass = isRequested ? "bg-red-500 text-white" : "bg-blue-100 text-blue-800"; content = occupiedBy.student.full_name.split(' ')[0]; } 
                                        else if (isRequested) { cellClass = "bg-green-500 text-white"; content = "REQUESTED"; }
                                        return (
                                            <td key={day + time} className={`border border-gray-300 p-1 text-center h-8 relative group ${cellClass}`}>
                                                <div className="truncate font-bold">{content}</div>
                                                {occupiedBy && (<div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 bg-black text-white text-xs p-2 rounded z-20 w-max shadow-lg pointer-events-none">{occupiedBy.student.full_name} ({occupiedBy.courses.name})</div>)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-4 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50 p-4 rounded-lg shrink-0">
                    <div className="text-xs text-gray-600 flex gap-4">
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-100 border border-blue-300"></div> Existing</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500"></div> New (Free)</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500"></div> Conflict</div>
                    </div>
                    <div className="flex gap-3">
                         <div className="flex items-center gap-2"><span className="text-sm font-bold">Time:</span><input type="time" value={reviewingStudent.preferred_time} onChange={(e) => setReviewingStudent({...reviewingStudent, preferred_time: e.target.value})} className="border rounded p-1 text-sm bg-white"/></div>
                         <button onClick={() => window.open(`https://wa.me/${reviewingStudent.student.phone_number}`)} className="bg-green-100 text-green-700 px-3 py-2 rounded font-bold hover:bg-green-200 text-sm">WhatsApp</button>
                         <button onClick={handleAcceptApplication} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold hover:bg-indigo-700 flex items-center gap-2 text-sm"><CheckCircle size={16} /> Enroll</button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;