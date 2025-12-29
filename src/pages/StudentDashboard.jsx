import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import PaymentCard from '../components/PaymentCard';
import { Clock, Calendar, TrendingUp, Lock, DollarSign, Plus, X, Music, CheckCircle } from 'lucide-react';

const StudentDashboard = ({ session }) => {
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState([]);
  const [classesThisMonth, setClassesThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasPendingPayment, setHasPendingPayment] = useState(false);
  const [hasPaidThisMonth, setHasPaidThisMonth] = useState(false);
  const [enrollments, setEnrollments] = useState([]); 
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [newCourse, setNewCourse] = useState({ courseId: '1', preferredDays: [], preferredTime: '17:00' });
  const daysOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    const userId = session.user.id;
    const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

    const { data: enrollmentData } = await supabase.from('enrollments').select('*, courses(name)').eq('student_id', userId);
    if (enrollmentData) setEnrollments(enrollmentData);

    const { data: ledgerData } = await supabase.from('credit_ledger').select('*').eq('student_id', userId).order('created_at', { ascending: false });
    const { data: paymentData } = await supabase.from('payments').select('id').eq('student_id', userId).eq('status', 'pending');
    const { data: monthlyPayment } = await supabase.from('payments').select('id').eq('student_id', userId).eq('status', 'approved').eq('month_for', currentMonthName).maybeSingle();

    if (ledgerData) {
      const currentBalance = ledgerData.reduce((acc, curr) => acc + curr.amount, 0);
      setBalance(currentBalance);
      const attendanceRecords = ledgerData.filter(item => item.amount < 0);
      setHistory(attendanceRecords);
      const now = new Date();
      setClassesThisMonth(attendanceRecords.filter(r => { const d = new Date(r.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length);
    }
    if (paymentData && paymentData.length > 0) setHasPendingPayment(true);
    setHasPaidThisMonth(!!monthlyPayment); 
    setLoading(false);
  };

  const handleAddNewCourse = async () => {
    if (newCourse.preferredDays.length < 2) return alert("Please select at least 2 days.");
    const { error } = await supabase.from('enrollments').insert([{ 
        student_id: session.user.id, course_id: newCourse.courseId, preferred_days: newCourse.preferredDays, preferred_time: newCourse.preferredTime, status: 'pending', joining_date: new Date()
    }]);
    if (error) alert("Error: " + error.message);
    else { alert("Request Sent!"); setShowEnrollModal(false); fetchDashboardData(); }
  };

  const handleDayChange = (day) => {
    const current = newCourse.preferredDays;
    if (current.includes(day)) setNewCourse({ ...newCourse, preferredDays: current.filter(d => d !== day) });
    else if (current.length < 3) setNewCourse({ ...newCourse, preferredDays: [...current, day] });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-indigo-600 font-bold">Loading...</div>;
  const isPaymentDue = balance <= 0 || !hasPaidThisMonth; 

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10 flex flex-col md:flex-row justify-between items-center gap-4">
          <div><h1 className="text-3xl font-bold text-gray-900">Welcome, {session.user.email.split('@')[0]}! 👋</h1><p className="text-gray-500">Manage your classes.</p></div>
          <button onClick={() => setShowEnrollModal(true)} className="bg-black text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-800 transition-all shadow-lg"><Plus size={20}/> Enroll New Course</button>
        </header>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {enrollments.map((enrollment) => (
                <div key={enrollment.id} className={`p-6 rounded-2xl shadow-sm border relative overflow-hidden ${enrollment.status === 'active' ? 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white border-transparent' : 'bg-white border-gray-200 text-gray-800'}`}>
                    <div className={`absolute top-4 right-4 text-[10px] font-bold px-2 py-1 rounded uppercase ${enrollment.status === 'active' ? 'bg-white/20 text-white' : 'bg-yellow-100 text-yellow-700'}`}>{enrollment.status === 'active' ? 'Active' : 'Pending'}</div>
                    <h2 className="text-lg font-bold flex items-center gap-2 mb-2"><Music size={20} className={enrollment.status === 'active' ? 'text-indigo-200' : 'text-indigo-600'}/> {enrollment.courses?.name}</h2>
                    {enrollment.status === 'active' ? (<><div className="text-2xl font-bold mb-1">{new Date(`1970-01-01T${enrollment.preferred_time}`).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}</div><p className="opacity-80 text-sm">{enrollment.preferred_days.join(" & ")}</p></>) : (<p className="text-sm text-gray-500 mt-2">Waiting for approval.<br/>Requested: {enrollment.preferred_days.join(", ")}</p>)}
                </div>
            ))}
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <div className={`p-6 rounded-2xl shadow-sm border border-gray-100 transition-colors ${balance <= 2 ? 'bg-orange-50 text-orange-800 border-orange-200' : 'bg-white text-gray-800'}`}>
            <div className="flex items-center gap-3 mb-2 opacity-70"><Clock size={20} /> <span className="font-bold uppercase text-xs">Credits</span></div>
            <div className="text-4xl font-bold">{balance}</div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
             <div className="flex items-center gap-3 mb-2 text-gray-500"><Calendar size={20} /> <span className="font-bold uppercase text-xs">This Month</span></div>
             <div className="text-4xl font-bold text-gray-900">{classesThisMonth}</div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
             <div className="flex items-center gap-3 mb-2 text-gray-500"><TrendingUp size={20} /> <span className="font-bold uppercase text-xs">Status</span></div>
             <div className="flex items-center gap-2"><div className={`h-3 w-3 rounded-full ${!isPaymentDue ? 'bg-green-500' : 'bg-red-500'}`}></div><span className="text-xl font-bold text-gray-900">{!isPaymentDue ? 'Active' : 'Payment Due'}</span></div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
             <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-100 font-bold text-gray-700 flex items-center gap-2"><DollarSign size={18} /> Fee Payment</div>
                <div className="p-6">
                    {hasPaidThisMonth ? (
                        <div className="text-center p-6 bg-green-50 border border-green-200 rounded-lg"><CheckCircle className="mx-auto text-green-600 mb-3" size={40} /><h3 className="font-bold text-green-800 text-lg">Fee Paid</h3><p className="text-sm text-green-700 mt-2">You have paid for {new Date().toLocaleString('default', { month: 'long' })}.</p></div>
                    ) : hasPendingPayment ? (
                        <div className="text-center p-6 bg-yellow-50 border border-yellow-200 rounded-lg"><Lock className="mx-auto text-yellow-600 mb-3" size={40} /><h3 className="font-bold text-yellow-800 text-lg">Payment in Review</h3></div>
                    ) : (
                        <PaymentCard studentId={session.user.id} studentName={session.user.email} onPaymentSuccess={fetchDashboardData} />
                    )}
                </div>
             </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100"><h2 className="font-bold text-lg text-gray-800">History</h2></div>
                <div className="max-h-[500px] overflow-y-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase sticky top-0"><tr><th className="p-4">Date</th><th className="p-4">Time</th><th className="p-4">Activity</th></tr></thead>
                        <tbody className="divide-y divide-gray-100">
                            {history.map((record) => {
                                // NEW: Parse the reason string to highlight the Instrument name
                                const parts = record.reason.split(':');
                                const mainReason = parts[0]; 
                                const instrument = parts[1] ? parts[1].trim() : null;

                                return (
                                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 text-gray-900 font-medium">{new Date(record.created_at).toLocaleDateString()}</td>
                                        <td className="p-4 text-gray-600">{new Date(record.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
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

      {showEnrollModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
                <button onClick={() => setShowEnrollModal(false)} className="absolute top-4 right-4 text-gray-400"><X size={24}/></button>
                <h2 className="text-2xl font-bold mb-4">Add Course</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Instrument</label>
                        <select value={newCourse.courseId} onChange={(e) => setNewCourse({...newCourse, courseId: e.target.value})} className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none bg-white">
                            <option value="1">Piano</option><option value="4">Guitar</option><option value="6">Keyboard (Western)</option>
                            <option value="2">Violin</option><option value="3">Vocal</option><option value="5">Veena</option><option value="7">Keyboard (Carnatic)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Preferred Days</label>
                        <div className="grid grid-cols-4 gap-2">
                            {daysOptions.map(day => (<button key={day} onClick={() => handleDayChange(day)} className={`text-xs py-2 rounded border font-bold ${newCourse.preferredDays.includes(day) ? 'bg-indigo-600 text-white' : 'bg-white'}`}>{day.slice(0, 3)}</button>))}
                        </div>
                    </div>
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Time</label><input type="time" value={newCourse.preferredTime} onChange={(e) => setNewCourse({...newCourse, preferredTime: e.target.value})} className="w-full px-4 py-2 border rounded-lg"/></div>
                    <button onClick={handleAddNewCourse} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg mt-4">Send Request</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;