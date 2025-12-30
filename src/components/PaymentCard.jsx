import React, { useState } from 'react';
import QRCode from 'react-qr-code';
import { supabase } from '../supabaseClient';
import { CheckCircle, Loader } from 'lucide-react';

const PaymentCard = ({ studentId, studentName, onPaymentSuccess }) => {
  const [showQR, setShowQR] = useState(false);
  const [loading, setLoading] = useState(false);

  // FIXED: Specific UPI ID for India (GPay/PhonePe)
  const uncleVPA = "harshini.5907-1@oksbi"; 
  const businessName = "MusicClass"; 
  const note = `Fee-${studentName.replace(/\s/g, '')}`; // Remove spaces for better compatibility

  // FIXED: Standard UPI String format
  // pa = Payee Address, pn = Payee Name, tn = Transaction Note
  const upiString = `upi://pay?pa=${uncleVPA}&pn=${businessName}&tn=${note}`;

  const handlePaymentSent = async () => {
    setLoading(true);
    const currentMonthYear = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

    const { error } = await supabase
      .from('payments')
      .insert([
        { 
          student_id: studentId, 
          amount_paid: 0, 
          status: 'pending', 
          month_for: currentMonthYear 
        }
      ]);

    if (error) {
      alert('Error logging payment: ' + error.message);
    } else {
      alert('Payment recorded! Waiting for approval.');
      if (onPaymentSuccess) onPaymentSuccess();
    }
    
    setLoading(false);
    setShowQR(false);
  };

  return (
    <div className="text-center">
      {!showQR ? (
        <>
          <p className="text-gray-500 mb-4">Scan QR to pay fees</p>
          <button 
            onClick={() => setShowQR(true)}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Pay Fees via UPI
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
          <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-sm mb-4">
            <QRCode value={upiString} size={160} />
          </div>
          <p className="text-sm text-gray-500 mb-4 px-4">
            1. Scan with GPay/PhonePe.<br/>
            2. Enter the agreed amount.<br/>
            3. Click the button below.
          </p>
          
          <div className="flex gap-2 w-full">
            <button 
                onClick={() => setShowQR(false)}
                className="flex-1 py-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            >
                Cancel
            </button>
            <button 
                onClick={handlePaymentSent}
                disabled={loading}
                className="flex-[2] bg-green-600 text-white font-bold py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
            >
                {loading ? <Loader className="animate-spin" size={18}/> : <CheckCircle size={18}/>}
                {loading ? "Processing..." : "I have Paid"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentCard;