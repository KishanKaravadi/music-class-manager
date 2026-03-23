import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { User, Lock, CheckCircle, Clock, Info, Plus, Trash2, ArrowRight, ArrowLeft } from 'lucide-react';

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
    const [currentSchedule, setCurrentSchedule] = useState([]);

    // Temporary state for the "Add Slot" builder
    const [tempDay, setTempDay] = useState('Monday');
    const [tempTime, setTempTime] = useState('17:00');

    // TASK 1: Default is empty string so "Select Instrument" shows first
    const [currentCourseId, setCurrentCourseId] = useState('');
    const [demoAgreed, setDemoAgreed] = useState(false);

    const daysOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // --- HELPER: Generate Time Slots (00 and 30 only) ---
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
        if (!time) return "";
        const [hour, min] = time.split(':');
        const h = parseInt(hour);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayHour = h % 12 || 12;
        return `${displayHour}:${min} ${ampm}`;
    };

    // --- COURSE DETAILS CONTENT ---
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
        if (!id) return null;
        if (['1', '4', '6'].includes(id)) return courseDetails.western;
        if (id === '7') return courseDetails.carnatic_keyboard;
        return courseDetails.carnatic_standard;
    };

    const currentInfo = getCurrentCourseInfo(currentCourseId);

    // Filter out courses already in queue so user can't select them twice
    const availableCourses = COURSES_LIST.filter(c => !courseQueue.some(q => q.courseId === c.id));

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

    const handleAddSlot = () => {
        // TASK 1: Validation - Must pick instrument first
        if (!currentCourseId) return alert("Please select an instrument first.");

        // Prevent duplicate days
        if (currentSchedule.some(s => s.day === tempDay)) {
            return alert(`You already have a slot on ${tempDay}. Remove it first to change time.`);
        }
        // Max 3 days constraint
        if (currentSchedule.length >= 3) {
            return alert("You can select a maximum of 3 days.");
        }
        setCurrentSchedule([...currentSchedule, { day: tempDay, time: tempTime }]);
    };

    const handleRemoveSlot = (idx) => {
        const newSched = [...currentSchedule];
        newSched.splice(idx, 1);
        setCurrentSchedule(newSched);
    };

    const handleAddCourseToQueue = () => {
        // Validate
        if (!currentCourseId) return alert("Please select an instrument.");
        if (currentSchedule.length < 2) return alert("Please select at least 2 class slots.");
        if (!demoAgreed) return alert("Please agree to the Demo Class policy.");

        // Format schedule for DB
        const formattedDays = currentSchedule.map(s => `${s.day} ${s.time}`);

        const newCourse = {
            courseId: currentCourseId,
            preferredDays: formattedDays,
            preferredTime: null, // Legacy field ignored
            demoAgreed: demoAgreed
        };

        const newQueue = [...courseQueue, newCourse];
        setCourseQueue(newQueue);

        // TASK 1: Reset to empty string so user is forced to select again
        setCurrentCourseId('');
        setCurrentSchedule([]);
        setDemoAgreed(false);

        alert("Course Added! You can select another instrument or finish registration.");
    };

    const removeCourseFromQueue = (index) => {
        const newQueue = [...courseQueue];
        newQueue.splice(index, 1);
        setCourseQueue(newQueue);
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
            email: personalData.email,
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
            preferred_time: null,
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
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Full Name</label>
                                        <input name="fullName" value={personalData.fullName} placeholder="Student Full Name" onChange={handlePersonalChange} className="w-full px-4 py-3 rounded-lg border border-gray-200 outline-none focus:border-indigo-500 transition-colors" required />
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="w-1/3 space-y-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Age</label>
                                            <input name="age" type="number" value={personalData.age} placeholder="Age" onChange={handlePersonalChange} className="w-full px-4 py-3 rounded-lg border border-gray-200 outline-none focus:border-indigo-500" required />
                                        </div>
                                        <div className="w-2/3 space-y-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Phone</label>
                                            <input name="phone" value={personalData.phone} placeholder="Phone Number" onChange={handlePersonalChange} className="w-full px-4 py-3 rounded-lg border border-gray-200 outline-none focus:border-indigo-500" required />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Email Address</label>
                                        <input name="email" type="email" value={personalData.email} placeholder="Email" onChange={handlePersonalChange} className="w-full px-4 py-3 rounded-lg border border-gray-200 outline-none focus:border-indigo-500" required />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Password</label>
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
                                <button onClick={() => setStep(1)} className="p-2 rounded-full hover:bg-gray-200 text-gray-600"><ArrowLeft size={20} /></button>
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
                                                <div className="text-sm text-indigo-700">
                                                    {/* Display formatted list of days+times */}
                                                    {course.preferredDays.map(d => d.replace(' ', ' @ ')).join(', ')}
                                                </div>
                                            </div>
                                            <button onClick={() => removeCourseFromQueue(idx)} className="text-red-500 hover:bg-red-100 p-2 rounded-lg transition-colors"><Trash2 size={18} /></button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* ADD COURSE FORM */}
                            <div className="bg-white p-6 rounded-xl shadow-lg border border-indigo-100 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Plus className="text-indigo-600" /> Add Course</h3>

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
                                                value={currentCourseId}
                                                onChange={(e) => setCurrentCourseId(e.target.value)}
                                                className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none bg-white focus:border-indigo-500"
                                            >
                                                {/* TASK 1: Default Option */}
                                                <option value="" disabled>Select an Instrument</option>

                                                {/* Dynamically Map Available Western Category */}
                                                {availableCourses.some(c => c.category === 'Western') && (
                                                    <optgroup label="Western">
                                                        {availableCourses.filter(c => c.category === 'Western').map(c => (
                                                            <option key={c.id} value={c.id}>{c.name}</option>
                                                        ))}
                                                    </optgroup>
                                                )}

                                                {/* Dynamically Map Available Carnatic Category */}
                                                {availableCourses.some(c => c.category === 'Carnatic') && (
                                                    <optgroup label="Carnatic">
                                                        {availableCourses.filter(c => c.category === 'Carnatic').map(c => (
                                                            <option key={c.id} value={c.id}>{c.name}</option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                            </select>
                                        </div>

                                        {/* Info Card (Condition: Only show if an ID is selected) */}
                                        {currentInfo && (
                                            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 animate-in fade-in">
                                                <div className="flex items-start gap-3">
                                                    <Info className="text-blue-600 mt-1 shrink-0" size={20} />
                                                    <div>
                                                        <h4 className="font-bold text-blue-800 text-sm uppercase mb-1">Course Duration: {currentInfo.duration}</h4>
                                                        {currentInfo.details && <p className="text-blue-700 text-sm mb-2">{currentInfo.details}</p>}

                                                        {currentInfo.structure && (
                                                            <ul className="text-xs text-blue-600 space-y-1 list-disc pl-4 mb-2">
                                                                {currentInfo.structure.map((line, idx) => <li key={idx}>{line}</li>)}
                                                            </ul>
                                                        )}

                                                        {currentInfo.exams && (
                                                            <p className="text-xs font-bold text-blue-800 mt-2 border-t border-blue-200 pt-2">
                                                                {currentInfo.exams}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* SCHEDULE BUILDER */}
                                        {/* Only show schedule builder if an instrument is picked */}
                                        <div className={`transition-all ${currentCourseId ? 'opacity-100' : 'opacity-50 pointer-events-none grayscale'}`}>
                                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Select your dates</label>

                                                <div className="flex gap-2 mb-3">
                                                    {/* Day Select */}
                                                    <select
                                                        value={tempDay}
                                                        onChange={(e) => setTempDay(e.target.value)}
                                                        className="flex-1 px-3 py-2 rounded border border-gray-300 text-sm font-bold text-gray-700 focus:border-indigo-500 outline-none"
                                                    >
                                                        {daysOptions.map(d => <option key={d} value={d}>{d}</option>)}
                                                    </select>

                                                    {/* Time Select */}
                                                    <select
                                                        value={tempTime}
                                                        onChange={(e) => setTempTime(e.target.value)}
                                                        className="flex-1 px-3 py-2 rounded border border-gray-300 text-sm font-bold text-gray-700 focus:border-indigo-500 outline-none"
                                                    >
                                                        {timeSlots.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}
                                                    </select>

                                                    <button
                                                        onClick={handleAddSlot}
                                                        type="button"
                                                        className="bg-indigo-600 text-white px-4 rounded font-bold hover:bg-indigo-700 transition-colors"
                                                    >
                                                        Add
                                                    </button>
                                                </div>

                                                {/* List of selected slots */}
                                                {currentSchedule.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {currentSchedule.map((slot, idx) => (
                                                            <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border border-gray-200 shadow-sm text-sm animate-in fade-in slide-in-from-left-2">
                                                                <span className="font-bold text-gray-800">{slot.day} @ {formatTime(slot.time)}</span>
                                                                <button onClick={() => handleRemoveSlot(idx)} type="button" className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"><Trash2 size={16} /></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-gray-400 text-center italic py-2">No slots added yet. Select your dates.</div>
                                                )}
                                            </div>

                                            {/* Fee Checkbox */}
                                            <div className="flex items-start gap-2 bg-yellow-50 p-3 rounded border border-yellow-200 mt-4">
                                                <input
                                                    type="checkbox"
                                                    checked={demoAgreed}
                                                    onChange={(e) => setDemoAgreed(e.target.checked)}
                                                    className="mt-1 h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                                />
                                                <label className="text-xs text-yellow-800">
                                                    <span className="font-bold">Fee Policy:</span> I understand that the fee must be paid immediately after attending the demo class.
                                                </label>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={handleAddCourseToQueue}
                                                className="w-full bg-black text-white font-bold py-3 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 mt-4"
                                            >
                                                <Plus size={18} /> Add Course to List
                                            </button>
                                        </div>
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