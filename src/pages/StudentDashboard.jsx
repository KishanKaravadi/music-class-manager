import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import PaymentCard from '../components/PaymentCard';
import { Clock, Calendar, TrendingUp, Lock, DollarSign } from 'lucide-react';

const StudentDashboard = ({ session }) => {
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState([]);
  const [classesThisMonth, setClassesThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasPendingPayment, setHasPendingPayment] = useState(false);
  const [schedule, setSchedule] = useState(null); // NEW: Schedule State

  useEffect(() => {
    fetchCreditData();
  }, []);

  const fetchCreditData = async () => {
    const userId = session.user.id;

    // 1. Fetch Ledger
    const { data: ledgerData } = await supabase
      .from('credit_ledger')
      .select('*')
      .eq('student_id', userId)
      .order('created_at', { ascending: false });

    // 2. Fetch Pending Payments
    const { data: paymentData } = await supabase
      .from('payments')
      .select('id')
      .eq('student_id', userId)
      .eq('status', 'pending');

    // 3. NEW: Fetch Schedule (Enrollment)
    const { data: enrollmentData } = await supabase
      .from('enrollments')
      .select('preferred_days, preferred_time, courses(name)')
      .eq('student_id', userId)
      .eq('status', 'active') // Only show if active
      .single();

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
    if (enrollmentData) setSchedule(enrollmentData);

    setLoading(false);
  };

  if (loading) return <div className="p-10 text-center text-indigo-600 font-medium">Loading your profile...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome, {session.user.email.split('@')[0]}! 👋
          </h1>
          <p className="text-gray-500">Track your progress and manage your classes.</p>
        </header>

        {/* --- NEW: SCHEDULE CARD --- */}
        {schedule && (
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-lg p-6 text-white mb-10 flex flex-col md:flex-row justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold opacity-90 flex items-center gap-2">
                        <Calendar size={20}/> Your Class Schedule
                    </h2>
                    <p className="text-2xl font-bold mt-1">
                        {schedule.preferred_days.join(" & ")} @ {new Date(`1970-01-01T${schedule.preferred_time}`).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}
                    </p>
                    <p className="opacity-75 text-sm mt-1">Course: {schedule.courses.name}</p>
                </div>
                <div className="mt-4 md:mt-0 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg text-sm font-bold">
                    Active Student
                </div>
            </div>
        )}
        {/* --------------------------- */}

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
                <div className={`h-3 w-3 rounded-full ${balance > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-xl font-bold text-gray-900">{balance > 0 ? 'Active' : 'Payment Due'}</span>
            </div>
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
                    {hasPendingPayment ? (
                        <div className="text-center p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <Lock className="mx-auto text-yellow-600 mb-3" size={40} />
                            <h3 className="font-bold text-yellow-800 text-lg">Payment in Review</h3>
                            <p className="text-sm text-yellow-700 mt-2">Your teacher is verifying your payment.</p>
                        </div>
                    ) : (
                        <PaymentCard studentId={session.user.id} studentName={session.user.email} onPaymentSuccess={fetchCreditData} />
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