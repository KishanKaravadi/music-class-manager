import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { User, Lock, CheckCircle, Clock, Info, Plus, Trash2, ArrowRight, ArrowLeft, X } from 'lucide-react';

// --- DATA CONSTANTS ---
const COURSES_LIST = [
    { id: '1', name: 'Piano', category: 'Western' },
    { id: '4', name: 'Guitar', category: 'Western' },
    { id: '6', name: 'Keyboard (Western)', category: 'Western' },
    { id: '2', name: 'Violin', category: 'Carnatic' },
    { id: '3', name: 'Vocal', category: 'Carnatic' },
    { id: '5', name: 'Veena', category: 'Carnatic' },
    { id: '7', name: 'Keyboard (Carnatic)', category: 'Carnatic' },
];

const Register = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1 = Personal, 2 = Courses

  // --- FORM STATE ---
  const [personalData, setPersonalData] = useState({
    email: '', password: '', fullName: '', phone: '', age: ''
  });

  // The list of courses the student wants to join
  const [courseQueue, setCourseQueue] = useState([]);

  // The "Current" course being configured in Step 2
  const [currentCourse, setCurrentCourse] = useState({
    courseId: '1',
    preferredDays: [],
    preferredTime: '17:00',
    demoAgreed: false
  });
  const [showTimePicker, setShowTimePicker] = useState(false);

  const daysOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // --- UPDATED COURSE DETAILS (FROM YOUR REQUEST) ---
  const courseDetails = {
    western: {
      duration: "Initial Grade to Grade 8",
      details: "Structured progression through Trinity/ABRSM grades.", 
    },
    carnatic_standard: {
      duration: "4 Years Course",
      details: "Comprehensive training from basics to advanced compositions.",
      structure: [
        "1st Year: Sarali Swaras, Janta Swaras, Alankaras, Geethams, Swarajathis, Swarapallavi",
        "2nd Year: Varnams / Krithis - Part 1",
        "3rd Year: Varnams / Krithis - Part 2",
        "4th Year: Varnams / Krithis - Part 2, Krithis, Tillanas and Manodharma sangeetham"
      ],
      exams: "Exams: (i) Certificate Course (ii) Sangeetha Visarada"
    },
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

  const courseNames = COURSES_LIST.reduce((acc, curr) => ({ ...acc, [curr.id]: curr.name }), {});

  const getCurrentCourseInfo = (id) => {
    if (['1', '4', '6'].includes(id)) return courseDetails.western;
    if (id === '7') return courseDetails.carnatic_keyboard;
    return courseDetails.carnatic_standard;
  };
  
  const currentInfo = getCurrentCourseInfo(currentCourse.courseId);

  // --- LOGIC: FILTER AVAILABLE COURSES ---
  const getAvailableCourses = () => {
    // Return only courses that are NOT in the queue
    return COURSES_LIST.filter(c => !courseQueue.some(q => q.courseId === c.id));
  };
  const availableCourses = getAvailableCourses();

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
    if (!time) return "Select Time";
    const [hour, min] = time.split(':');
    const h = parseInt(hour);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 || 12; 
    return `${displayHour}:${min} ${ampm}`;
  };

  // --- HANDLERS ---
  const handlePersonalChange = (e) => {
    setPersonalData({ ...personalData, [e.target.name]: e.target.value });
  };

  const handleNextStep = (e) => {
    e.preventDefault();
    if (!personalData.fullName || !personalData.email || !personalData.password || !personalData.phone || !personalData.age) {
        return alert("Please fill in all personal details.");
    }
    setStep(2);
  };

  const handleDayChange = (day) => {
    const currentDays = currentCourse.preferredDays;
    if (currentDays.includes(day)) {
        setCurrentCourse({ ...currentCourse, preferredDays: currentDays.filter(d => d !== day) });
    } else {
      if (currentDays.length < 3) {
        setCurrentCourse({ ...currentCourse, preferredDays: [...currentDays, day] });
      }
    }
  };

  const handleAddCourse = () => {
    // Validation
    if (currentCourse.preferredDays.length < 2) return alert("Please select at least 2 days.");
    if (!currentCourse.demoAgreed) return alert("Please agree to the Demo Class policy.");

    // Add to Queue
    const newQueue = [...courseQueue, { ...currentCourse }];
    setCourseQueue(newQueue);
    
    // Determine the next available ID to default to
    const remaining = COURSES_LIST.filter(c => !newQueue.some(q => q.courseId === c.id));
    const nextId = remaining.length > 0 ? remaining[0].id : '';

    // Reset Form for next entry
    setCurrentCourse({
        courseId: nextId,
        preferredDays: [],
        preferredTime: '17:00',
        demoAgreed: false
    });
    
    if (!nextId) {
        alert("You have selected all available courses!");
    } else {
        alert("Course Added! Select your next instrument.");
    }
  };

  const removeCourse = (index) => {
    // When removing, we put that course back into the available pool
    // We just need to remove it from queue, the render logic handles the dropdown
    const newQueue = [...courseQueue];
    newQueue.splice(index, 1);
    setCourseQueue(newQueue);
    
    // Optional: If we currently have no ID selected (because list was full), reset to this freed one
    if (currentCourse.courseId === '') {
        // We can't easily grab the ID here without passing it, but user can just select from dropdown now
         setCurrentCourse(prev => ({ ...prev, courseId: '1' })); // Fallback, render will fix
    }
  };

  const handleFinalRegister = async () => {
    if (courseQueue.length === 0) return alert("Please add at least one course.");
    setLoading(true);

    // 1. Create Auth User
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: personalData.email, password: personalData.password,
    });
    if (authError) { alert(authError.message); setLoading(false); return; }
    
    const userId = authData.user.id;

    // 2. Create Profile
    const { error: profileError } = await supabase.from('profiles').insert([{ 
      id: userId, 
      full_name: personalData.fullName, 
      phone_number: personalData.phone, 
      age: personalData.age, 
      role: 'student' 
    }]);
    if (profileError) { alert("Profile Error: " + profileError.message); setLoading(false); return; }

    // 3. Create ALL Enrollments
    const enrollmentsToInsert = courseQueue.map(c => ({
        student_id: userId,
        course_id: c.courseId,
        preferred_days: c.preferredDays,
        preferred_time: c.preferredTime,
        joining_date: new Date(),
        demo_agreed: c.demoAgreed,
        status: 'pending'
    }));

    const { error: enrollError } = await supabase.from('enrollments').insert(enrollmentsToInsert);

    if (enrollError) { alert("Enrollment Error: " + enrollError.message); setLoading(false); return; }

    // 4. Success
    await supabase.auth.signOut();
    alert('Registration Successful! Please Login.');
    navigate('/login');
  };


  return (
    <div className="min-h-screen flex bg-gray-50 relative">
      
      {/* TIME PICKER MODAL */}
      {showTimePicker && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
                <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2"><Clock size={20}/> Select Time</h3>
                    <button onClick={() => setShowTimePicker(false)} className="hover:bg-indigo-700 p-1 rounded-full"><X size={24}/></button>
                </div>
                <div className="p-4 grid grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
                    {timeSlots.map(time => (
                        <button
                            key={time}
                            type="button"
                            onClick={() => { setCurrentCourse({...currentCourse, preferredTime: time}); setShowTimePicker(false); }}
                            className={`py-3 px-2 rounded-lg text-sm font-bold border transition-all ${currentCourse.preferredTime === time ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105' : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50'}`}
                        >
                            {formatTime(time)}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* LEFT BANNER */}
      <div className="hidden lg:flex w-5/12 bg-gradient-to-br from-indigo-600 to-purple-700 items-center justify-center p-12 text-white fixed h-screen top-0 left-0">
        <div className="z-10 max-w-md">
          <h1 className="text-4xl font-bold mb-4">Join the Music Family</h1>
          <p className="text-indigo-100 text-lg">Master multiple instruments with our expert teachers.</p>
          
          {/* Progress Indicator */}
          <div className="mt-12 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 ${step >= 1 ? 'bg-white text-indigo-600 border-white' : 'border-white/30 text-white/50'}`}>1</div>
            <div className={`flex-1 h-1 rounded ${step >= 2 ? 'bg-white' : 'bg-white/30'}`}></div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 ${step >= 2 ? 'bg-white text-indigo-600 border-white' : 'border-white/30 text-white/50'}`}>2</div>
          </div>
          <div className="flex justify-between mt-2 text-sm font-medium text-indigo-200">
            <span>Personal Info</span>
            <span>Courses</span>
          </div>
        </div>
      </div>

      {/* RIGHT CONTENT */}
      <div className="w-full lg:w-7/12 flex items-center justify-center p-8 lg:p-16 ml-auto overflow-y-auto">
        <div className="max-w-xl w-full">
          
          {/* --- STEP 1: PERSONAL INFO --- */}
          {step === 1 && (
              <div className="animate-in slide-in-from-right fade-in duration-300">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Create Student Account</h2>
                  <p className="text-gray-500 mb-8">Step 1 of 2: Personal Details</p>
                  
                  <form onSubmit={handleNextStep} className="space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><User size={16} /> Basic Info</h3>
                        <div className="space-y-4">
                            <input name="fullName" value={personalData.fullName} placeholder="Student Full Name" onChange={handlePersonalChange} className="w-full px-4 py-3 rounded-lg border border-gray-200 outline-none focus:border-indigo-500 transition-colors" required />
                            <div className="flex gap-4">
                                <input name="age" type="number" value={personalData.age} placeholder="Age" onChange={handlePersonalChange} className="w-1/3 px-4 py-3 rounded-lg border border-gray-200 outline-none focus:border-indigo-500" required />
                                <input name="phone" value={personalData.phone} placeholder="Phone Number" onChange={handlePersonalChange} className="w-2/3 px-4 py-3 rounded-lg border border-gray-200 outline-none focus:border-indigo-500" required />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Lock size={16} /> Login Credentials</h3>
                        <div className="space-y-4">
                            <input name="email" type="email" value={personalData.email} placeholder="Email Address" onChange={handlePersonalChange} className="w-full px-4 py-3 rounded-lg border border-gray-200 outline-none focus:border-indigo-500" required />
                            <input name="password" type="password" value={personalData.password} placeholder="Password" onChange={handlePersonalChange} className="w-full px-4 py-3 rounded-lg border border-gray-200 outline-none focus:border-indigo-500" required />
                        </div>
                    </div>

                    <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                        Next Step <ArrowRight size={20} />
                    </button>
                    <p className="text-center text-gray-500 text-sm">Already have an account? <Link to="/login" className="text-indigo-600 font-bold hover:underline">Login here</Link></p>
                  </form>
              </div>
          )}

          {/* --- STEP 2: COURSE SELECTION --- */}
          {step === 2 && (
              <div className="animate-in slide-in-from-right fade-in duration-300">
                  <div className="flex items-center gap-2 mb-6">
                    <button onClick={() => setStep(1)} className="p-2 rounded-full hover:bg-gray-200 text-gray-600"><ArrowLeft size={20}/></button>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Select Courses</h2>
                        <p className="text-gray-500 text-sm">Add one or more instruments to your profile.</p>
                    </div>
                  </div>

                  {/* QUEUE LIST */}
                  {courseQueue.length > 0 && (
                      <div className="mb-8 space-y-3">
                          {courseQueue.map((course, idx) => (
                              <div key={idx} className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex justify-between items-center">
                                  <div>
                                      <div className="font-bold text-indigo-900">{courseNames[course.courseId]}</div>
                                      <div className="text-sm text-indigo-700">{course.preferredDays.join(", ")} @ {formatTime(course.preferredTime)}</div>
                                  </div>
                                  <button onClick={() => removeCourse(idx)} className="text-red-500 hover:bg-red-100 p-2 rounded-lg transition-colors"><Trash2 size={18}/></button>
                              </div>
                          ))}
                      </div>
                  )}

                  {/* ADD COURSE FORM */}
                  <div className="bg-white p-6 rounded-xl shadow-lg border border-indigo-100 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Plus className="text-indigo-600"/> Add Course</h3>
                      
                      {availableCourses.length === 0 ? (
                          <div className="text-center py-6 text-gray-500">
                              You have selected all available courses!
                          </div>
                      ) : (
                          <div className="space-y-4">
                              {/* Instrument Select */}
                              <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Instrument</label>
                                <select 
                                    value={currentCourse.courseId}
                                    onChange={(e) => setCurrentCourse({...currentCourse, courseId: e.target.value})}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none bg-white focus:border-indigo-500"
                                >
                                    {/* Dynamically Map Western Category */}
                                    {availableCourses.some(c => c.category === 'Western') && (
                                        <optgroup label="Western">
                                            {availableCourses.filter(c => c.category === 'Western').map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </optgroup>
                                    )}
                                    
                                    {/* Dynamically Map Carnatic Category */}
                                    {availableCourses.some(c => c.category === 'Carnatic') && (
                                        <optgroup label="Carnatic">
                                            {availableCourses.filter(c => c.category === 'Carnatic').map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                              </div>

                              {/* Info Card with FULL details */}
                              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                  <Info className="text-blue-600 mt-1 shrink-0" size={20} />
                                  <div>
                                    <h4 className="font-bold text-blue-800 text-sm uppercase mb-1">Course Duration: {currentInfo.duration}</h4>
                                    {currentInfo.details && <p className="text-blue-700 text-sm mb-2">{currentInfo.details}</p>}
                                    
                                    {/* Structure List */}
                                    {currentInfo.structure && (
                                        <ul className="text-xs text-blue-600 space-y-1 list-disc pl-4 mb-2">
                                        {currentInfo.structure.map((line, idx) => <li key={idx}>{line}</li>)}
                                        </ul>
                                    )}
                                    
                                    {/* Exams Info */}
                                    {currentInfo.exams && (
                                        <p className="text-xs font-bold text-blue-800 mt-2 border-t border-blue-200 pt-2">
                                            {currentInfo.exams}
                                        </p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Days */}
                              <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Preferred Days <span className="font-normal normal-case">(Select 2-3)</span></label>
                                <div className="grid grid-cols-4 gap-2">
                                    {daysOptions.map(day => {
                                        const isSelected = currentCourse.preferredDays.includes(day);
                                        const isDisabled = currentCourse.preferredDays.length >= 3 && !isSelected;
                                        return (
                                            <button
                                                key={day}
                                                type="button"
                                                onClick={() => !isDisabled && handleDayChange(day)}
                                                disabled={isDisabled}
                                                className={`text-xs py-2 rounded border font-bold transition-all ${isSelected ? 'bg-indigo-600 text-white border-indigo-600' : isDisabled ? 'bg-gray-100 text-gray-300' : 'bg-white text-gray-500 hover:border-indigo-400'}`}
                                            >
                                                {day.slice(0, 3)}
                                            </button>
                                        );
                                    })}
                                </div>
                              </div>

                              {/* Time */}
                              <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Time Slot</label>
                                <div 
                                    onClick={() => setShowTimePicker(true)}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-white cursor-pointer hover:border-indigo-400 flex justify-between items-center group"
                                >
                                    <div className="flex items-center gap-2">
                                        <Clock size={16} className="text-indigo-600 group-hover:scale-110 transition-transform"/>
                                        <span className="font-bold text-gray-700">{formatTime(currentCourse.preferredTime)}</span>
                                    </div>
                                    <span className="text-xs font-bold text-indigo-600 uppercase">Change</span>
                                </div>
                              </div>

                              {/* Checkbox */}
                              <div className="flex items-start gap-2 bg-yellow-50 p-3 rounded border border-yellow-200">
                                <input 
                                    type="checkbox" 
                                    checked={currentCourse.demoAgreed}
                                    onChange={(e) => setCurrentCourse({...currentCourse, demoAgreed: e.target.checked})}
                                    className="mt-1 h-4 w-4 text-indigo-600"
                                />
                                <label className="text-xs text-yellow-800">
                                    <span className="font-bold">Fee Policy:</span> I understand that the fee (Rs 1500) must be paid immediately after attending the demo class.
                                </label>
                              </div>
                              
                              <button 
                                type="button"
                                onClick={handleAddCourse}
                                className="w-full bg-black text-white font-bold py-3 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                              >
                                <Plus size={18}/> Add Course to List
                              </button>
                          </div>
                      )}
                  </div>

                  {/* FINAL SUBMIT */}
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <button 
                        onClick={handleFinalRegister}
                        disabled={courseQueue.length === 0 || loading}
                        className={`w-full py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 font-bold text-lg
                            ${courseQueue.length > 0 ? 'bg-green-600 hover:bg-green-700 text-white transform hover:scale-[1.02]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
                        `}
                    >
                        {loading ? 'Registering...' : `Complete Registration (${courseQueue.length} Courses)`}
                        {!loading && <CheckCircle size={24} />}
                    </button>
                  </div>

              </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Register;