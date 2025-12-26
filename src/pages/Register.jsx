import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { User, Music, Lock, CheckCircle, Clock, Info } from 'lucide-react'; // Added Info icon

const Register = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '', password: '', fullName: '', phone: '', age: '',
    courseId: '1', 
    preferredDays: [],
    preferredTime: '17:00',
    demoAgreed: false
  });

  const daysOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // --- NEW: Syllabus Data from your Image ---
  const courseDetails = {
    // Western Instruments (No structure list, just duration)
    western: {
      duration: "Grade 1 to Grade 8",
      details: "To complete each grade, takes at least 6 to 8 months.",
      // structure: removed as requested
    },
    // Carnatic Vocal, Violin, Veena (Added Exams)
    carnatic_standard: {
      duration: "4 Years Course",
      details: "Comprehensive training from basics to advanced compositions.",
      structure: [
        "1st Year: Sarali Swaras, Janta Swaras, Alankaras, Geethams, Swarajathis, Swarapallavi",
        "2nd Year: Varnams / Krithis - Part 1",
        "3rd Year: Varnams / Krithis - Part 2",
        "4th Year: Varnams / Krithis - Part 2, Krithis, Ragaalapana, Swarakalpana, Thillana"
      ],
      exams: "Exams: (i) Certificate Course (ii) Sangeetha Visarada" // Added from image
    },
    // Carnatic Keyboard
    carnatic_keyboard: {
      duration: "18 Months Total",
      details: "Structured curriculum specifically for Carnatic on Keyboard.",
      structure: [
        "2 Months: Sarali Swaras",
        "4 Months: Janta Swaras & Dhatu Swaras",
        "2 Months: Alankaras",
        "3 Months: Geethams",
        "3 Months: Swarajathis",
        "4 Months: Varnams"
      ]
    }
  };

  // Helper to pick the right data based on ID
  const getCurrentCourseInfo = (id) => {
    // IDs: 1=Piano, 4=Guitar, 6=West Key
    if (['1', '4', '6'].includes(id)) return courseDetails.western;
    // IDs: 7=Carnatic Key
    if (id === '7') return courseDetails.carnatic_keyboard;
    // IDs: 2=Violin, 3=Vocal, 5=Veena
    return courseDetails.carnatic_standard;
  };

  const currentInfo = getCurrentCourseInfo(formData.courseId);

  // --- Time Slot Logic ---
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
  
  const formatTime = (time) => {
    const [hour, min] = time.split(':');
    const h = parseInt(hour);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 || 12; 
    return `${displayHour}:${min} ${ampm}`;
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleDayChange = (day) => {
    const currentDays = formData.preferredDays;
    if (currentDays.includes(day)) {
      setFormData({ ...formData, preferredDays: currentDays.filter(d => d !== day) });
    } else {
      setFormData({ ...formData, preferredDays: [...currentDays, day] });
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    // --- 1. STRICT VALIDATION: Check Days Count ---
    const dayCount = formData.preferredDays.length;
    if (dayCount < 2) {
        return alert("Please select at least 2 days.");
    }
    if (dayCount > 3) {
        return alert("You can only select a maximum of 3 days.");
    }
    
    if (formData.preferredDays.length < 2 || formData.preferredDays.length > 3) {
        return alert("Please select exactly 2 or 3 days for your classes.");
    }

    if (!formData.demoAgreed) return alert("Please agree to the Demo Class policy.");
    setLoading(true);
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email, password: formData.password,
    });
    if (authError) { alert(authError.message); setLoading(false); return; }
    const userId = authData.user.id;

    const { error: profileError } = await supabase.from('profiles').insert([{ 
      id: userId, full_name: formData.fullName, phone_number: formData.phone, age: formData.age, role: 'student' 
    }]);
    if (profileError) { alert(profileError.message); setLoading(false); return; }

    const { error: enrollError } = await supabase.from('enrollments').insert([{ 
      student_id: userId, 
      course_id: formData.courseId, 
      preferred_days: formData.preferredDays,
      preferred_time: formData.preferredTime,
      joining_date: new Date(), 
      demo_agreed: formData.demoAgreed,
      
      // --- UPDATE THIS LINE ---
      status: 'pending' 
      // -----------------------
    }]);

    if (enrollError) { alert(enrollError.message); setLoading(false); return; }

    await supabase.auth.signOut();
    alert('Registration Successful! Please Login.');
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      <div className="hidden lg:flex w-5/12 bg-gradient-to-br from-indigo-600 to-purple-700 items-center justify-center p-12 text-white fixed h-screen">
        <div className="z-10 max-w-md">
          <h1 className="text-4xl font-bold mb-4">Join the Music Family</h1>
          <p className="text-indigo-100 text-lg">Start your journey with us today.</p>
        </div>
      </div>

      <div className="w-full lg:w-7/12 flex items-center justify-center p-8 lg:p-16 ml-auto overflow-y-auto">
        <div className="max-w-xl w-full">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Create Student Account</h2>
          <form onSubmit={handleRegister} className="space-y-6 mt-8">
            
            {/* Personal Info */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <User size={16} /> Personal Details
              </h3>
              <div className="space-y-4">
                <input name="fullName" placeholder="Student Full Name" onChange={handleChange} className="w-full px-4 py-3 rounded-lg border border-gray-200 outline-none" required />
                <div className="flex gap-4">
                  <input name="age" type="number" placeholder="Age" onChange={handleChange} className="w-1/3 px-4 py-3 rounded-lg border border-gray-200 outline-none" required />
                  <input name="phone" placeholder="Phone Number" onChange={handleChange} className="w-2/3 px-4 py-3 rounded-lg border border-gray-200 outline-none" required />
                </div>
              </div>
            </div>

            {/* Course & Schedule */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Music size={16} /> Course & Schedule
              </h3>
              
              <label className="block text-sm font-medium text-gray-600 mb-1">Select Instrument</label>
              <select name="courseId" onChange={handleChange} className="w-full px-4 py-3 rounded-lg border border-gray-200 mb-4 outline-none bg-white focus:ring-2 focus:ring-indigo-100">
                <optgroup label="Western">
                    <option value="1">Piano</option>
                    <option value="4">Guitar</option>
                    <option value="6">Keyboard (Western)</option>
                </optgroup>
                <optgroup label="Carnatic">
                    <option value="2">Violin</option>
                    <option value="3">Vocal</option>
                    <option value="5">Veena</option>
                    <option value="7">Keyboard (Carnatic)</option>
                </optgroup>
              </select>

              {/* --- NEW: DYNAMIC INFO CARD --- */}
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="text-blue-600 mt-1 shrink-0" size={20} />
                  <div>
                    <h4 className="font-bold text-blue-800 text-sm uppercase mb-1">
                       Course Duration: {currentInfo.duration}
                    </h4>
                    <p className="text-blue-700 text-sm mb-2">{currentInfo.details}</p>
                    
                    {/* Only render structure list if it exists (Carnatic only) */}
                    {currentInfo.structure && (
                        <ul className="text-xs text-blue-600 space-y-1 list-disc pl-4 mb-2">
                        {currentInfo.structure.map((line, idx) => (
                            <li key={idx}>{line}</li>
                        ))}
                        </ul>
                    )}

                    {/* Only render Exams if they exist (Carnatic Standard only) */}
                    {currentInfo.exams && (
                        <p className="text-xs font-bold text-blue-800 mt-2 border-t border-blue-200 pt-2">
                            Name of examinations: {currentInfo.exams}
                        </p>
                    )}
                  </div>
                </div>
              </div>
              {/* ----------------------------- */}

              <label className="block text-sm font-medium text-gray-600 mb-1">Preferred Time Slot</label>
              <div className="relative mb-4">
                  <Clock className="absolute left-3 top-3 text-gray-400" size={18}/>
                  <select name="preferredTime" onChange={handleChange} className="w-full pl-10 px-4 py-3 rounded-lg border border-gray-200 outline-none bg-white appearance-none">
                    {timeSlots.map(time => (
                        <option key={time} value={time}>{formatTime(time)} (1 Hour Session)</option>
                    ))}
                  </select>
              </div>
              
              <label className="block text-sm font-medium text-gray-600 mb-2">Preferred Days</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {daysOptions.map(day => (
                  <div key={day} onClick={() => handleDayChange(day)}
                    className={`cursor-pointer text-sm py-2 px-1 text-center rounded border transition-all ${
                      formData.preferredDays.includes(day) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </div>
                ))}
              </div>
            </div>

            {/* Login & Agreement */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Lock size={16} /> Login Credentials
              </h3>
              <div className="space-y-4">
                <input name="email" type="email" placeholder="Email Address" onChange={handleChange} className="w-full px-4 py-3 rounded-lg border border-gray-200 outline-none" required />
                <input name="password" type="password" placeholder="Password" onChange={handleChange} className="w-full px-4 py-3 rounded-lg border border-gray-200 outline-none" required />
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <input type="checkbox" name="demoAgreed" id="demoAgreed" onChange={handleChange} className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"/>
                <label htmlFor="demoAgreed" className="text-sm text-yellow-800">
                    <span className="font-bold">Fee Policy:</span> I understand that the fee (Rs 1500) must be paid immediately after attending the demo class.
                </label>
            </div>

            <button disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
              {loading ? 'Creating Account...' : 'Complete Registration'}
              {!loading && <CheckCircle size={20} />}
            </button>
            <p className="text-center text-gray-500 text-sm">Already have an account? <Link to="/login" className="text-indigo-600 font-bold hover:underline">Login here</Link></p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;