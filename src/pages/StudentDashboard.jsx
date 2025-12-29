import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import PaymentCard from '../components/PaymentCard';
import { Clock, Calendar, TrendingUp, Lock, DollarSign, FileText, CheckCircle } from 'lucide-react'; // Added icons

const StudentDashboard = ({ session }) => {
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState([]);
  const [classesThisMonth, setClassesThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasPendingPayment, setHasPendingPayment] = useState(false);
  const [hasPaidThisMonth, setHasPaidThisMonth] = useState(false);
  
  // NEW: State to track if they are active or waiting
  const [enrollmentStatus, setEnrollmentStatus] = useState('loading'); 
  const [schedule, setSchedule] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const userId = session.user.id;
    const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

    // 1. NEW: Check Enrollment Status FIRST
    const { data: enrollmentData } = await supabase
      .from('enrollments')
      .select('status, preferred_days, preferred_time, courses(name)')
      .eq('student_id', userId)
      .maybeSingle(); // Use maybeSingle() to prevent errors if no record exists

    // If we found an enrollment, check its status
    if (enrollmentData) {
        if (enrollmentData.status === 'pending') {
            setEnrollmentStatus('pending');
            setLoading(false);
            return; // STOP HERE! Don't fetch payment/credits if they are pending.
        } else {
            setEnrollmentStatus('active');
            setSchedule(enrollmentData);
        }
    } else {
        // Fallback if something went wrong and they have no enrollment row
        setEnrollmentStatus('unknown');
    }

    // 2. Only if ACTIVE, fetch the rest of the data (Ledger & Payments)
    const { data: ledgerData } = await supabase
      .from('credit_ledger')
      .select('*')
      .eq('student_id', userId)
      .order('created_at', { ascending: false });

    const { data: paymentData } = await supabase
      .from('payments')
      .select('id')
      .eq('student_id', userId)
      .eq('status', 'pending');

    const { data: monthlyPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('student_id', userId)
      .eq('status', 'approved')
      .eq('month_for', currentMonthName)
      .maybeSingle();

    if (ledgerData) {
      const currentBalance = ledgerData.reduce((acc, curr) => acc + curr.amount, 0);
      setBalance(currentBalance);
      const attendanceRecords = ledgerData.filter(item => item.amount < 0);
      setHistory(attendanceRecords);

      const now = new Date();
      const thisMonthCount = attendanceRecords.filter(record => {
        const recordDate = new Date(record.created_at);
        return recordDate.getMonth() === now.getMonth() && 
               recordDate.getFullYear() === now.getFullYear();
      }).length;
      setClassesThisMonth(thisMonthCount);
    }

    if (paymentData && paymentData.length > 0) setHasPendingPayment(true);
    setHasPaidThisMonth(!!monthlyPayment); 
    setLoading(false);
  };

  // --- 1. LOADING STATE ---
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-indigo-600 font-bold animate-pulse text-lg">Loading Dashboard...</div>
    </div>
  );

  // --- 2. NEW: PENDING / REVIEWING STATE ---
  if (enrollmentStatus === 'pending') {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
            <div className="bg-white max-w-lg w-full p-8 rounded-2xl shadow-xl text-center border border-gray-100">
                <div className="w-20 h-20 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileText size={40} className="text-yellow-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Application Under Review</h1>
                <p className="text-gray-500 mb-8 leading-relaxed">
                    Thanks for registering! Your teacher is currently reviewing your schedule request. 
                    Once they finalize your time slot, your dashboard will activate.
                </p>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-left text-sm text-gray-600 mb-6">
                    <p className="font-bold mb-2 flex items-center gap-2">
                        <Clock size={16} /> What happens next?
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Teacher reviews your preferred days.</li>
                        <li>Teacher approves or adjusts the time slot.</li>
                        <li>You will see the "Pay Fee" option here.</li>
                    </ul>
                </div>
                <button 
                    onClick={fetchDashboardData} 
                    className="text-indigo-600 font-bold hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors"
                >
                    Check Status Again
                </button>
            </div>
        </div>
    );
  }

  // --- 3. ACTIVE DASHBOARD (Existing Code) ---
  const isPaymentDue = balance <= 0 || !hasPaidThisMonth; 

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome, {session.user.email.split('@')[0]}! 👋
          </h1>
          <p className="text-gray-500">Track your progress and manage your classes.</p>
        </header>

        {/* SCHEDULE CARD */}
        {schedule && (
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-lg p-6 text-white mb-10 flex flex-col md:flex-row justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold opacity-90 flex items-center gap-2">
                        <Calendar size={20}/> Your Class Schedule
                    </h2>
                    <p className="text-2xl font-bold mt-1">
                        {schedule.preferred_days.join(" & ")} @ {new Date(`1970-01-01T${schedule.preferred_time}`).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}
                    </p>
                    <p className="opacity-75 text-sm mt-1">Course: {schedule.courses?.name}</p>
                </div>
                <div className="mt-4 md:mt-0 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                    <CheckCircle size={16} /> Active Student
                </div>
            </div>
        )}

        {/* STATS ROW */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <div className={`p-6 rounded-2xl shadow-sm border border-gray-100 text-white transition-colors ${balance <= 2 ? 'bg-orange-500' : 'bg-indigo-600'}`}>
            <div className="flex items-center gap-3 mb-2 opacity-90">
              <Clock size={20} /> <span className="font-medium">Credits Remaining</span>
            </div>
            <div className="text-4xl font-bold">{balance}</div>
            <p className="text-sm mt-2 opacity-80">{balance <= 0 ? "Please make a payment to continue." : "You are good to go!"}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
             <div className="flex items-center gap-3 mb-2 text-gray-500">
              <Calendar size={20} className="text-indigo-600" /> <span className="font-medium">Attended This Month</span>
            </div>
            <div className="text-4xl font-bold text-gray-900">{classesThisMonth}</div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
             <div className="flex items-center gap-3 mb-2 text-gray-500">
              <TrendingUp size={20} className="text-green-600" /> <span className="font-medium">Account Status</span>
            </div>
            <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${!isPaymentDue ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-xl font-bold text-gray-900">{!isPaymentDue ? 'Active' : 'Payment Due'}</span>
            </div>
            {isPaymentDue && balance > 0 && <p className="text-xs text-red-500 mt-1">Month fee pending.</p>}
          </div>
        </div>

        {/* MAIN CONTENT GRID */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* LEFT: PAYMENT WIDGET */}
          <div className="lg:col-span-1">
             <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-100 font-bold text-gray-700 flex items-center gap-2">
                    <DollarSign size={18} /> Fee Payment
                </div>
                <div className="p-6">
                    {hasPaidThisMonth ? (
                        <div className="text-center p-6 bg-green-50 border border-green-200 rounded-lg">
                            <CheckCircle className="mx-auto text-green-600 mb-3" size={40} />
                            <h3 className="font-bold text-green-800 text-lg">Fee Paid</h3>
                            <p className="text-sm text-green-700 mt-2">You have paid for {new Date().toLocaleString('default', { month: 'long' })}.</p>
                        </div>
                    ) : hasPendingPayment ? (
                        <div className="text-center p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <Lock className="mx-auto text-yellow-600 mb-3" size={40} />
                            <h3 className="font-bold text-yellow-800 text-lg">Payment in Review</h3>
                            <p className="text-sm text-yellow-700 mt-2">Your teacher is verifying your payment.</p>
                        </div>
                    ) : (
                        <PaymentCard studentId={session.user.id} studentName={session.user.email} onPaymentSuccess={fetchDashboardData} />
                    )}
                </div>
             </div>
          </div>

          {/* RIGHT: HISTORY TABLE */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="font-bold text-lg text-gray-800">Recent Attendance</h2>
                </div>
                {history.length === 0 ? (
                    <div className="p-10 text-center text-gray-400 italic">No classes attended yet.</div>
                ) : (
                    <div className="max-h-[500px] overflow-y-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase sticky top-0">
                                <tr><th className="p-4">Date</th><th className="p-4">Time</th><th className="p-4">Details</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {history.map((record) => (
                                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 text-gray-900 font-medium">{new Date(record.created_at).toLocaleDateString()}</td>
                                        <td className="p-4 text-gray-600">{new Date(record.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td className="p-4 text-sm text-indigo-600 font-medium">{record.reason}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;