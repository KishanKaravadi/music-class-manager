import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Users, DollarSign, Calendar, CheckCircle, X, Bell, Trash2, History, Check, XCircle } from 'lucide-react'; // Added XCircle

const TeacherDashboard = () => {
  const [activeRoster, setActiveRoster] = useState([]);
  const [pendingApplications, setPendingApplications] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [paidStudentIds, setPaidStudentIds] = useState([]); 
  const [attendanceToday, setAttendanceToday] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  const [reviewingStudent, setReviewingStudent] = useState(null);
  
  // History Modal State
  const [showHistory, setShowHistory] = useState(false);
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]); 
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [reminderTargets, setReminderTargets] = useState([]);
  const [showReminderModal, setShowReminderModal] = useState(false);

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

  // Helper to find what time it was 30 mins ago
  const getPreviousSlot = (timeString) => {
    if (!timeString) return "";
    const [hStr, mStr] = timeString.split(':');
    let h = parseInt(hStr);
    let m = parseInt(mStr);

    // If currently 30 (e.g., 10:30), previous was 10:00
    if (m === 30) return `${hStr}:00`;

    // If currently 00 (e.g., 10:00), previous was 09:30
    let prevH = h - 1;
    let prevHStr = prevH < 10 ? `0${prevH}` : `${prevH}`;
    return `${prevHStr}:30`;
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchHistory = async (dateString) => {
    setHistoryLoading(true);
    const [year, month, day] = dateString.split('-');
    const startDate = new Date(year, month - 1, day, 0, 0, 0); 
    const endDate = new Date(year, month - 1, day, 23, 59, 59);

    const { data, error } = await supabase
        .from('credit_ledger')
        .select(`amount, created_at, reason, student:student_id (full_name, email)`)
        .lt('amount', 0)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

    if (error) console.error(error);
    else setHistoryRecords(data || []);
    setHistoryLoading(false);
  };

  useEffect(() => {
    if (showHistory) fetchHistory(historyDate);
  }, [showHistory, historyDate]);

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

    // 3. Fetch Pending Payments (Make sure to get Phone/Email for rejection notices)
    const { data: paymentData } = await supabase
      .from('payments')
      .select('*, profiles(full_name, phone_number, email)')
      .eq('status', 'pending');
    setPendingPayments(paymentData || []);

    // 4. Fetch APPROVED Payments
    const { data: approvedData } = await supabase
      .from('payments').select('student_id').eq('status', 'approved').eq('month_for', currentMonthName);
    setPaidStudentIds(approvedData?.map(p => p.student_id) || []);

    // 5. Fetch Today's Attendance
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
    
    const { data: todayLedger } = await supabase
        .from('credit_ledger')
        .select('student_id')
        .lt('amount', 0)
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', todayEnd.toISOString());
    
    const presentIds = todayLedger?.map(l => l.student_id) || [];
    setAttendanceToday(presentIds);
    
    setLoading(false);
  };

  const handleSendReminder = (index, student) => {
    // 1. Open WhatsApp
    const msg = `Hello ${student.student.full_name}, friendly reminder to pay your Music Class fees for ${new Date().toLocaleString('default', { month: 'long' })}.`;
    window.open(`https://wa.me/${student.student.phone_number}?text=${encodeURIComponent(msg)}`, '_blank');

    // 2. Mark this specific student as 'sent' in the list
    setReminderTargets(prev => {
        const newList = [...prev];
        newList[index] = { ...newList[index], sent: true };
        return newList;
    });
  };

  const handleBulkReminders = () => {
    let targetStudents = activeRoster;
    
    // Filter out paid or pending
    targetStudents = targetStudents.filter(student => !pendingPayments.some(p => p.student_id === student.student.id));
    targetStudents = targetStudents.filter(student => !paidStudentIds.includes(student.student.id));
    
    if (targetStudents.length === 0) return alert("Everyone is paid up or pending! No reminders needed.");

    // Create a clean list with a 'sent' flag for the modal
    const preparedList = targetStudents.map(s => ({ ...s, sent: false }));

    setReminderTargets(preparedList);
    setShowReminderModal(true);
  };

  const handleApprovePayment = async (paymentId) => {
    await supabase.from('payments').update({ status: 'approved' }).eq('id', paymentId);
    alert("Payment Approved!");
    fetchData();
  };

  // --- RESTORED: Reject Payment Function ---
  const handleRejectPayment = async (paymentId, studentProfile, amount) => {
    const confirm = window.confirm("Are you sure you want to REJECT this payment?\n\nThis will notify the student to try again.");
    if (!confirm) return;

    // 1. Update DB to 'rejected'
    const { error } = await supabase.from('payments').update({ status: 'rejected' }).eq('id', paymentId);
    if (error) return alert("Error rejecting payment");

    // 2. Prepare Message
    const message = `Hello ${studentProfile.full_name}, we have NOT received your payment of ₹${amount}. Your transaction has been rejected on the portal. Please check your bank and try paying again.`;

    // 3. Open WhatsApp & Email
    window.open(`https://wa.me/${studentProfile.phone_number}?text=${encodeURIComponent(message)}`, '_blank');
    setTimeout(() => {
        window.open(`mailto:${studentProfile.email}?subject=Payment Rejected&body=${encodeURIComponent(message)}`, '_blank');
    }, 1000);

    fetchData();
  };
  // -----------------------------------------

  const handleMarkPresent = async (studentId, studentName, courseName, currentBalance) => {
    if (currentBalance <= 0) return alert(`⛔ STOP: ${studentName} has 0 credits remaining.`);
    const alreadyMarked = attendanceToday.includes(studentId);
    let message = `Mark ${studentName} present? (-1 Credit)`;
    if (alreadyMarked) message = `⚠️ WARNING: ${studentName} is ALREADY marked present today.\n\nDo you want to mark them present AGAIN? (-1 Credit)`;
    if (!window.confirm(message)) return;
    await supabase.from('credit_ledger').insert([{ student_id: studentId, amount: -1, reason: `Attended ${courseName}` }]);
    fetchData();
  };

  const handleArchiveStudent = async (enrollmentId, studentName) => {
    if (!window.confirm(`Archive ${studentName}?`)) return;
    await supabase.from('enrollments').update({ status: 'archived' }).eq('id', enrollmentId);
    fetchData();
  };

  const toggleReviewDay = (day) => {
    setReviewingStudent(prev => {
      const currentDays = prev.preferred_days || [];
      // If day exists, remove it. If not, add it.
      const newDays = currentDays.includes(day) 
        ? currentDays.filter(d => d !== day) 
        : [...currentDays, day];
      
      return { ...prev, preferred_days: newDays };
    });
  };

  const handleAcceptApplication = async () => {
    if (!reviewingStudent) return;

    // --- NEW VALIDATION ---
    if (reviewingStudent.preferred_days.length < 2) {
        alert("Error: A student must have at least 2 days selected.");
        return;
    }
    // ----------------------

    const { error } = await supabase.from('enrollments')
        .update({ status: 'active', preferred_time: reviewingStudent.preferred_time, preferred_days: reviewingStudent.preferred_days }) // Ensure days are updated too
        .eq('id', reviewingStudent.id);

    if (!error) {
        alert("Enrolled Successfully!");
        setReviewingStudent(null);
        fetchData();
    }
  };

  const isSlotOccupied = (day, time) => {
    // 1. Check if a student STARTS at this time
    const exactMatch = activeRoster.find(s => s.preferred_days?.includes(day) && s.preferred_time?.slice(0,5) === time);
    if (exactMatch) return exactMatch;

    // 2. Check if a student started 30 mins ago (so they are still here)
    const prevTime = getPreviousSlot(time);
    const overlapMatch = activeRoster.find(s => s.preferred_days?.includes(day) && s.preferred_time?.slice(0,5) === prevTime);
    
    return overlapMatch;
  };

  if (loading) return <div className="p-10 flex justify-center text-indigo-600">Loading Dashboard...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12 relative">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 flex flex-col md:flex-row justify-between items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-900">Teacher Dashboard</h1>
            <div className="flex gap-2">
                <button onClick={() => setShowHistory(true)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-50 transition-colors">
                    <History size={18} /> History
                </button>
                <button onClick={handleBulkReminders} className="bg-orange-100 text-orange-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-orange-200 transition-colors">
                    <Bell size={18} /> Reminders
                </button>
            </div>
        </header>

        {/* 1. NEW APPLICATIONS */}
        {pendingApplications.length > 0 && (
          <div className="mb-12 bg-blue-50 border border-blue-200 rounded-xl p-6">
             <h2 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2"><Users className="text-blue-600" /> New Requests ({pendingApplications.length})</h2>
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
               {pendingApplications.map(app => (
                 <div key={app.id} className="bg-white p-5 rounded-lg shadow-sm">
                   <h3 className="font-bold text-lg">{app.student.full_name}</h3>
                   <div className="text-sm text-gray-500 mb-2">{app.courses.name} ({app.courses.category})</div>
                   <div className="text-sm font-medium text-gray-700 bg-gray-100 p-2 rounded mb-3">Requested: {app.preferred_days?.join(", ")} <br/> @ {app.preferred_time}</div>
                   <button onClick={() => setReviewingStudent(app)} className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700 flex items-center justify-center gap-2">
                     <Calendar size={16}/> Review Schedule
                   </button>
                 </div>
               ))}
             </div>
          </div>
        )}

        {/* 2. PENDING PAYMENTS (RESTORED REJECT BUTTON) */}
        {pendingPayments.length > 0 && (
          <div className="mb-12">
             <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><DollarSign className="text-yellow-600" /> Pending Fees</h2>
             <div className="grid gap-4 md:grid-cols-3">
               {pendingPayments.map(p => (
                 <div key={p.id} className="bg-white p-5 rounded-xl shadow-sm border border-yellow-200 flex flex-col justify-between">
                   <div>
                       <h3 className="font-bold text-lg">{p.profiles?.full_name}</h3>
                       <p className="text-gray-500 text-sm mb-4">Reported Paid: ₹{p.amount_paid}</p>
                   </div>
                   <div className="flex gap-2">
                       {/* REJECT */}
                       <button 
                         onClick={() => handleRejectPayment(p.id, p.profiles, p.amount_paid)} 
                         className="flex-1 bg-red-100 text-red-700 font-bold py-2 rounded hover:bg-red-200 flex items-center justify-center gap-1"
                         title="Reject & Notify"
                       >
                         <XCircle size={18} /> Reject
                       </button>

                       {/* APPROVE */}
                       <button 
                         onClick={() => handleApprovePayment(p.id)} 
                         className="flex-1 bg-green-600 text-white font-bold py-2 rounded hover:bg-green-700 flex items-center justify-center gap-1"
                       >
                         <CheckCircle size={18} /> Approve
                       </button>
                   </div>
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
              {activeRoster.map((item) => {
                const isMarkedToday = attendanceToday.includes(item.student.id);
                return (
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
                        <button 
                            onClick={() => handleMarkPresent(item.student.id, item.student.full_name, item.courses.name, item.current_balance)} 
                            className={`px-3 py-1 rounded text-sm font-bold flex items-center gap-1 transition-colors ${
                                isMarkedToday ? 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}
                        >
                            {isMarkedToday && <Check size={14} strokeWidth={3} />} {isMarkedToday ? "Done" : "Present"}
                        </button>
                        <button onClick={() => handleArchiveStudent(item.id, item.student.full_name)} className="text-gray-400 hover:text-red-600 p-2" title="Archive Student">
                            <Trash2 size={18} />
                        </button>
                    </td>
                    </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- HISTORY MODAL --- */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative">
                <button onClick={() => setShowHistory(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X size={28}/></button>
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><History className="text-indigo-600"/> Attendance History</h2>
                <div className="mb-6">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Select Date:</label>
                    <input type="date" value={historyDate} onChange={(e) => setHistoryDate(e.target.value)} className="w-full p-3 border rounded-lg bg-gray-50 font-bold"/>
                </div>
                <div className="bg-gray-50 rounded-lg border border-gray-200 h-64 overflow-y-auto p-4">
                    {historyLoading ? <div className="text-center text-gray-400 mt-10">Loading...</div> : historyRecords.length === 0 ? <div className="text-center text-gray-400 mt-10">No classes attended on this date.</div> : (
                        <div className="space-y-3">
                            {historyRecords.map((rec, i) => (
                                <div key={i} className="bg-white p-3 rounded shadow-sm border border-gray-100 flex justify-between items-center">
                                    <div><div className="font-bold">{rec.student.full_name}</div><div className="text-xs text-gray-500">{rec.reason}</div></div>
                                    <div className="text-sm font-mono text-gray-400">{new Date(rec.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* --- REVIEW MODAL (Calendar) --- */}
      {reviewingStudent && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col p-6 relative">
                <button onClick={() => setReviewingStudent(null)} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X size={28}/></button>
                <div className="mb-4"><h2 className="text-2xl font-bold mb-1">Review Schedule</h2><p className="text-gray-500">Applicant: <span className="font-bold text-indigo-600">{reviewingStudent.student.full_name}</span> wants <span className="font-bold">{reviewingStudent.preferred_days.join(", ")} @ {reviewingStudent.preferred_time}</span></p></div>
                <div className="overflow-auto border rounded-lg shadow-inner flex-1">
                    <table className="w-full text-xs border-collapse">
                        <thead className="sticky top-0 z-10 shadow-sm">
                            <tr><th className="bg-gray-100 p-2 border border-gray-300 w-16">Time</th>{daysOfWeek.map(day => (<th key={day} className={`p-2 border border-gray-300 w-32 ${reviewingStudent.preferred_days.includes(day) ? 'bg-yellow-100 text-yellow-900 font-bold border-yellow-300' : 'bg-gray-50'}`}>{day.slice(0,3)}</th>))}</tr>
                        </thead>
                        <tbody>
                          {timeSlots.map(time => (
                              <tr key={time}>
                                  {/* Time Column */}
                                  <td className="py-1 px-2 border border-gray-300 font-mono text-[10px] bg-gray-50 text-center text-gray-500">
                                      {time}
                                  </td>

                                  {/* Days Columns */}
                                  {daysOfWeek.map(day => {
                                      // 1. Check for Existing Student (using your new helper)
                                      const occupiedBy = isSlotOccupied(day, time);
                                      
                                      // 2. Check for New Request (Logic updated to span 2 blocks too)
                                      const reqStartTime = reviewingStudent.preferred_time?.slice(0,5);
                                      const isReqStart = reviewingStudent.preferred_days.includes(day) && reqStartTime === time;
                                      // Check if this slot is the "2nd half" of a request
                                      const isReqOverlap = reviewingStudent.preferred_days.includes(day) && reqStartTime === getPreviousSlot(time);
                                      const isRequested = isReqStart || isReqOverlap;

                                      let cellClass = "bg-white"; 
                                      let content = null;
                                      // Default: Border on all sides
                                      let borderClass = "border border-gray-300"; 

                                      // --- LOGIC START ---
                                      if (occupiedBy) {
                                          // It is an Existing Student
                                          const isStart = occupiedBy.preferred_time?.slice(0,5) === time;
                                          
                                          // Color: Red if conflict, Blue if existing
                                          cellClass = isRequested ? "bg-red-500 text-white" : "bg-blue-100 text-blue-800";
                                          
                                          if (isStart) {
                                              // FIRST HALF: Show Name, Remove Bottom Border
                                              content = occupiedBy.student.full_name.split(' ')[0];
                                              borderClass = "border-t border-l border-r border-gray-300 border-b-0"; 
                                          } else {
                                              // SECOND HALF: Hide Name, Remove Top Border
                                              content = ""; 
                                              borderClass = "border-b border-l border-r border-gray-300 border-t-0";
                                          }
                                      } 
                                      else if (isRequested) {
                                          // It is a New Request (Green)
                                          cellClass = "bg-green-500 text-white";
                                          
                                          if (isReqStart) {
                                              content = "REQUESTED";
                                              borderClass = "border-t border-l border-r border-gray-300 border-b-0";
                                          } else {
                                              content = "";
                                              borderClass = "border-b border-l border-r border-gray-300 border-t-0";
                                          }
                                      }
                                      // -------------------

                                      return (
                                          <td key={day + time} className={`${borderClass} p-1 text-center h-8 relative group ${cellClass}`}>
                                              <div className="truncate font-bold">{content}</div>
                                              
                                              {/* Tooltip on Hover (Only needed for occupied slots) */}
                                              {occupiedBy && (
                                                  <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 bg-black text-white text-xs p-2 rounded z-20 w-max shadow-lg pointer-events-none">
                                                      {occupiedBy.student.full_name} ({occupiedBy.courses.name})
                                                  </div>
                                              )}
                                          </td>
                                      );
                                  })}
                              </tr>
                          ))}
                      </tbody>
                    </table>
                </div>
                {/* Modal Footer Controls */}
                <div className="mt-4 flex flex-col xl:flex-row justify-between items-center gap-4 bg-gray-50 p-4 rounded-lg shrink-0 border-t border-gray-200">
                    
                    {/* Legend (Left Side) */}
                    <div className="text-xs text-gray-600 flex gap-4">
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-100 border border-blue-300"></div> Existing</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500"></div> Requesting</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500"></div> Conflict</div>
                    </div>

                    {/* Controls (Right Side) */}
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        
                        {/* NEW: Day Toggles with Limit Logic */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-700">Days:</span>
                            <div className="flex gap-1">
                                {daysOfWeek.map(day => {
                                    const isSelected = reviewingStudent.preferred_days.includes(day);
                                    
                                    // DISABLE if: We have 3 days AND this one is not currently selected
                                    const isDisabled = reviewingStudent.preferred_days.length >= 3 && !isSelected;

                                    return (
                                        <button 
                                            key={day} 
                                            onClick={() => !isDisabled && toggleReviewDay(day)}
                                            disabled={isDisabled}
                                            className={`
                                                px-2 py-1 text-xs font-bold rounded border transition-all
                                                ${isSelected 
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                                                    : isDisabled
                                                        ? 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed' // Grayed out style
                                                        : 'bg-white text-gray-500 border-gray-300 hover:border-indigo-400 hover:text-indigo-600 cursor-pointer'
                                                }
                                            `}
                                        >
                                            {day.slice(0, 3)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Time Picker */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-700">Time:</span>
                            <input 
                                type="time" 
                                value={reviewingStudent.preferred_time} 
                                onChange={(e) => setReviewingStudent({...reviewingStudent, preferred_time: e.target.value})} 
                                className="border border-gray-300 rounded px-2 py-1 text-sm bg-white focus:border-indigo-500 outline-none font-bold text-gray-700"
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 border-l pl-4 border-gray-300">
                            <button 
                                onClick={() => window.open(`https://wa.me/${reviewingStudent.student.phone_number}`)} 
                                className="bg-green-100 text-green-700 px-3 py-2 rounded-lg font-bold hover:bg-green-200 text-sm transition-colors"
                                title="Discuss with Student"
                            >
                                WhatsApp
                            </button>
                            <button 
                                onClick={handleAcceptApplication} 
                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2 text-sm shadow-md transition-colors"
                            >
                                <CheckCircle size={16} /> Enroll
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* --- REMINDERS MODAL --- */}
      {showReminderModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative">
                <button onClick={() => setShowReminderModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X size={28}/></button>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Bell className="text-orange-600"/> Send Reminders</h2>
                <p className="text-gray-600 mb-4">Found <b>{reminderTargets.length}</b> students with unpaid fees.</p>

                <div className="bg-gray-50 rounded-lg border border-gray-200 max-h-96 overflow-y-auto p-2">
                    {reminderTargets.map((student, index) => (
                        <div key={student.id} className="flex justify-between items-center bg-white p-3 mb-2 rounded border border-gray-100 shadow-sm">
                            <div>
                                <div className="font-bold">{student.student.full_name}</div>
                                <div className="text-xs text-gray-500">{student.student.phone_number}</div>
                            </div>
                            
                            {/* THE SMART BUTTON */}
                            {student.sent ? (
                                <button disabled className="bg-gray-200 text-gray-500 text-sm font-bold px-4 py-2 rounded flex items-center gap-1 cursor-not-allowed">
                                    Done <CheckCircle size={14} />
                                </button>
                            ) : (
                                <button 
                                    onClick={() => handleSendReminder(index, student)} 
                                    className="bg-green-500 text-white text-sm font-bold px-4 py-2 rounded hover:bg-green-600 flex items-center gap-1 shadow-sm transition-all"
                                >
                                    Send <Bell size={14} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                
                <div className="mt-4 text-right">
                    <button onClick={() => setShowReminderModal(false)} className="text-gray-500 font-bold hover:text-gray-800">Close</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;