import React, { useState } from 'react';
import QRCode from 'react-qr-code';
import { supabase } from '../supabaseClient';
import { CheckCircle, Loader } from 'lucide-react';

// NEW: Accept 'onPaymentSuccess' as a prop
const PaymentCard = ({ studentId, studentName, onPaymentSuccess }) => {
  const [showQR, setShowQR] = useState(false);
  const [loading, setLoading] = useState(false);

  // Inside PaymentCard.jsx

// 1. Put the REAL UPI ID here (e.g., 9876543210@ybl, businessname@oksbi)
const uncleVPA = "unclesphone@ybl"; 

// 2. (Optional) Change the Business Name displayed in the app when they scan
const businessName = "MusicClass"; 

const amount = "1500";
const note = `Fee-${studentName}`;

// This line builds the link that the QR code uses
const upiString = `upi://pay?pa=${uncleVPA}&pn=${businessName}&am=${amount}&tn=${note}`;

  const handlePaymentSent = async () => {
    setLoading(true);
    
    // 1. Log the payment
    const { error } = await supabase
      .from('payments')
      .insert([
        { 
          student_id: studentId, 
          amount_paid: 1500, 
          status: 'pending', 
          month_for: new Date().toLocaleString('default', { month: 'long' }) 
        }
      ]);

    if (error) {
      alert('Error logging payment: ' + error.message);
    } else {
      alert('Payment recorded! Waiting for approval.');
      
      // 2. CRITICAL FIX: Tell the parent component to lock the screen
      if (onPaymentSuccess) {
        onPaymentSuccess();
      }
    }
    
    setLoading(false);
    setShowQR(false);
  };

  return (
    <div className="text-center">
      {!showQR ? (
        <>
          <p className="text-gray-500 mb-4">Scan QR to pay via PhonePe/GPay</p>
          <button 
            onClick={() => setShowQR(true)}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Pay ₹1500 Now
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
          <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-sm mb-4">
            <QRCode value={upiString} size={160} />
          </div>
          <p className="text-sm text-gray-500 mb-4 px-4">
            1. Scan this code with any UPI app.<br/>
            2. Complete the payment.<br/>
            3. Click the button below to confirm.
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