import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  FileCheck,
  FileText,
  Filter,
  HeartPulse,
  Info,
  Megaphone,
  Pill,
  Phone,
  PhoneCall,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  Stethoscope,
  Trash2,
  TrendingUp,
  User,
  Users,
  Volume2,
  X,
} from "lucide-react";

// Interfaces for UI Data
export interface ClinicAppointment {
  id: string;
  tokenNumber: number;
  patientName: string;
  patientPhone: string;
  patientAge: number;
  gender: "Male" | "Female" | "Other";
  doctorName: string;
  slot: string;
  status: "Waiting" | "Consulting" | "Completed" | "Cancelled";
  chiefComplaint: string;
  fee: number;
  paid: boolean;
  createdAt: string;
}

export interface PatientVitals {
  bp: string;
  pulse: number;
  spo2: number;
  weight: number;
  temperature: number;
}

export interface ClinicPatient {
  id: string;
  name: string;
  phone: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  bloodGroup: string;
  allergies?: string[];
  vitals: PatientVitals;
  history: Array<{
    date: string;
    diagnosis: string;
    medicines: Array<{ name: string; dosage: string; duration: string }>;
    notes: string;
  }>;
}

export interface ClinicMedicine {
  id: string;
  name: string;
  category: "Tablet" | "Syrup" | "Capsule" | "Injection" | "Ointment";
  batchNo: string;
  stockQty: number;
  unitPrice: number;
  expiryDate: string;
  reorderLevel: number;
}

export interface ClinicInvoice {
  id: string;
  invoiceNo: string;
  patientName: string;
  patientPhone: string;
  consultationFee: number;
  pharmacyAmount: number;
  labAmount: number;
  discount: number;
  totalAmount: number;
  paymentMode: "Cash" | "UPI" | "Card";
  createdAt: string;
}

// Initial Mock Datasets (Pure UI State)
const INITIAL_APPOINTMENTS: ClinicAppointment[] = [
  {
    id: "apt-01",
    tokenNumber: 1,
    patientName: "Amit Patel",
    patientPhone: "+91 98201 44520",
    patientAge: 38,
    gender: "Male",
    doctorName: "Dr. Arjun Mehta (MD Medicine)",
    slot: "10:00 AM",
    status: "Consulting",
    chiefComplaint: "Persistent dry cough, mild fever since 3 days",
    fee: 500,
    paid: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "apt-02",
    tokenNumber: 2,
    patientName: "Sunita Deshmukh",
    patientPhone: "+91 98450 11982",
    patientAge: 52,
    gender: "Female",
    doctorName: "Dr. Arjun Mehta (MD Medicine)",
    slot: "10:20 AM",
    status: "Waiting",
    chiefComplaint: "Routine hypertension & diabetes follow-up",
    fee: 500,
    paid: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "apt-03",
    tokenNumber: 3,
    patientName: "Rahul Joshi",
    patientPhone: "+91 97110 88231",
    patientAge: 29,
    gender: "Male",
    doctorName: "Dr. Arjun Mehta (MD Medicine)",
    slot: "10:40 AM",
    status: "Waiting",
    chiefComplaint: "Severe migraine and neck stiffness",
    fee: 500,
    paid: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "apt-04",
    tokenNumber: 4,
    patientName: "Pooja Sharma",
    patientPhone: "+91 98990 33412",
    patientAge: 34,
    gender: "Female",
    doctorName: "Dr. Arjun Mehta (MD Medicine)",
    slot: "11:00 AM",
    status: "Waiting",
    chiefComplaint: "Seasonal allergy and throat irritation",
    fee: 500,
    paid: true,
    createdAt: new Date().toISOString(),
  },
];

const INITIAL_PATIENTS: ClinicPatient[] = [
  {
    id: "pat-01",
    name: "Amit Patel",
    phone: "+91 98201 44520",
    age: 38,
    gender: "Male",
    bloodGroup: "B+",
    allergies: ["Sulfa drugs"],
    vitals: { bp: "124/82", pulse: 78, spo2: 98, weight: 72, temperature: 99.1 },
    history: [
      {
        date: "12 Aug 2026",
        diagnosis: "Upper Respiratory Tract Infection",
        medicines: [
          { name: "Amoxicillin 500mg", dosage: "1-0-1", duration: "5 days" },
          { name: "Paracetamol 650mg", dosage: "1-0-1", duration: "3 days" },
        ],
        notes: "Advised warm saline gargles and steam inhalation.",
      },
    ],
  },
  {
    id: "pat-02",
    name: "Sunita Deshmukh",
    phone: "+91 98450 11982",
    age: 52,
    gender: "Female",
    bloodGroup: "O+",
    allergies: [],
    vitals: { bp: "138/88", pulse: 74, spo2: 99, weight: 65, temperature: 98.4 },
    history: [
      {
        date: "01 Sep 2026",
        diagnosis: "Essential Hypertension Stage 1",
        medicines: [{ name: "Telmisartan 40mg", dosage: "1-0-0", duration: "30 days" }],
        notes: "BP under control. Advised low sodium diet.",
      },
    ],
  },
];

const INITIAL_MEDICINES: ClinicMedicine[] = [
  {
    id: "med-01",
    name: "Paracetamol 650mg (Dolo)",
    category: "Tablet",
    batchNo: "DL-8841",
    stockQty: 480,
    unitPrice: 32,
    expiryDate: "12/2027",
    reorderLevel: 50,
  },
  {
    id: "med-02",
    name: "Amoxicillin 500mg (Mox)",
    category: "Capsule",
    batchNo: "MX-2091",
    stockQty: 240,
    unitPrice: 85,
    expiryDate: "08/2027",
    reorderLevel: 30,
  },
  {
    id: "med-03",
    name: "Pantoprazole 40mg (Pan-40)",
    category: "Tablet",
    batchNo: "PN-4019",
    stockQty: 320,
    unitPrice: 95,
    expiryDate: "05/2028",
    reorderLevel: 40,
  },
  {
    id: "med-04",
    name: "Cough Syrup (Ascoril-D 100ml)",
    category: "Syrup",
    batchNo: "AS-1102",
    stockQty: 18,
    unitPrice: 125,
    expiryDate: "03/2027",
    reorderLevel: 25,
  },
  {
    id: "med-05",
    name: "Cetirizine 10mg (Cetzine)",
    category: "Tablet",
    batchNo: "CZ-9081",
    stockQty: 500,
    unitPrice: 28,
    expiryDate: "11/2027",
    reorderLevel: 50,
  },
];

const INITIAL_INVOICES: ClinicInvoice[] = [
  {
    id: "inv-101",
    invoiceNo: "INV-2026-0891",
    patientName: "Amit Patel",
    patientPhone: "+91 98201 44520",
    consultationFee: 500,
    pharmacyAmount: 117,
    labAmount: 0,
    discount: 0,
    totalAmount: 617,
    paymentMode: "UPI",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "inv-102",
    invoiceNo: "INV-2026-0892",
    patientName: "Sunita Deshmukh",
    patientPhone: "+91 98450 11982",
    consultationFee: 500,
    pharmacyAmount: 95,
    labAmount: 250,
    discount: 45,
    totalAmount: 800,
    paymentMode: "Cash",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
];

interface ClinicHubProps {
  onCallPatient?: (phone: string, name: string) => void;
}

export function ClinicHub({ onCallPatient }: ClinicHubProps) {
  const [activeTab, setActiveTab] = useState<"queue" | "doctor" | "pharmacy" | "billing" | "voice">("queue");

  // Pure UI Reactive States
  const [appointments, setAppointments] = useState<ClinicAppointment[]>(INITIAL_APPOINTMENTS);
  const [patients, setPatients] = useState<ClinicPatient[]>(INITIAL_PATIENTS);
  const [medicines, setMedicines] = useState<ClinicMedicine[]>(INITIAL_MEDICINES);
  const [invoices, setInvoices] = useState<ClinicInvoice[]>(INITIAL_INVOICES);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modals
  const [showBookModal, setShowBookModal] = useState(false);
  const [showAddMedModal, setShowAddMedModal] = useState(false);
  const [showDispenseModal, setShowDispenseModal] = useState<ClinicMedicine | null>(null);
  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false);
  const [selectedPatientForRx, setSelectedPatientForRx] = useState<ClinicPatient | null>(INITIAL_PATIENTS[0]);
  const [printRxModal, setPrintRxModal] = useState<{
    patient: ClinicPatient;
    diagnosis: string;
    medicines: Array<{ name: string; dosage: string; duration: string }>;
    notes: string;
    vitals: PatientVitals;
  } | null>(null);
  const [printInvoiceModal, setPrintInvoiceModal] = useState<ClinicInvoice | null>(null);

  // Doctor Consultation Form State
  const [rxDiagnosis, setRxDiagnosis] = useState("Acute Bronchial Infection");
  const [rxMedicines, setRxMedicines] = useState<Array<{ name: string; dosage: string; duration: string }>>([
    { name: "Paracetamol 650mg (Dolo)", dosage: "1-0-1 (After Food)", duration: "3 days" },
    { name: "Pantoprazole 40mg (Pan-40)", dosage: "1-0-0 (Morning Empty Stomach)", duration: "5 days" },
  ]);
  const [rxNotes, setRxNotes] = useState("Take warm saline gargles, steam inhalation, and complete the full antibiotic course.");
  const [doctorVitals, setDoctorVitals] = useState<PatientVitals>({
    bp: "124/82",
    pulse: 78,
    spo2: 98,
    weight: 72,
    temperature: 99.1,
  });

  // Dynamic Metrics Calculation
  const stats = useMemo(() => {
    const totalTokensToday = appointments.length;
    const waitingCount = appointments.filter((a) => a.status === "Waiting").length;
    const consultingCount = appointments.filter((a) => a.status === "Consulting").length;
    const completedCount = appointments.filter((a) => a.status === "Completed").length;
    const todayRevenue = invoices.reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);
    const lowStockCount = medicines.filter((m) => m.stockQty <= m.reorderLevel).length;

    return {
      totalTokensToday,
      waitingCount,
      consultingCount,
      completedCount,
      todayRevenue,
      lowStockCount,
    };
  }, [appointments, invoices, medicines]);

  // Filtered appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      const matchSearch =
        apt.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.patientPhone.includes(searchQuery) ||
        apt.tokenNumber.toString().includes(searchQuery);
      const matchStatus = statusFilter === "all" || apt.status.toLowerCase() === statusFilter.toLowerCase();
      return matchSearch && matchStatus;
    });
  }, [appointments, searchQuery, statusFilter]);

  // Next Waiting Patient
  const nextWaitingPatient = useMemo(() => {
    return appointments.find((a) => a.status === "Waiting");
  }, [appointments]);

  // Audio Token Announcement
  const announceTokenAudio = (tokenNum: number, name: string) => {
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        const text = `Attention please. Token number ${tokenNum}, ${name}, please proceed to doctor consultation cabin.`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        utterance.lang = "en-IN";
        window.speechSynthesis.speak(utterance);
      } catch {
        // speech synthesis fallback
      }
    }
  };

  // UI Action: Call Next Patient
  const handleCallNextPatient = () => {
    if (!nextWaitingPatient) {
      toast.info("No patients waiting in queue!");
      return;
    }

    setAppointments((prev) =>
      prev.map((apt) => (apt.id === nextWaitingPatient.id ? { ...apt, status: "Consulting" } : apt))
    );

    announceTokenAudio(nextWaitingPatient.tokenNumber, nextWaitingPatient.patientName);
    toast.success(`Calling Token #${nextWaitingPatient.tokenNumber}: ${nextWaitingPatient.patientName}`);

    const matched = patients.find((p) => p.phone === nextWaitingPatient.patientPhone);
    if (matched) {
      setSelectedPatientForRx(matched);
      setDoctorVitals(matched.vitals);
    }
  };

  // UI Action: Update Appointment Status
  const handleUpdateStatus = (id: string, newStatus: ClinicAppointment["status"]) => {
    setAppointments((prev) =>
      prev.map((apt) => (apt.id === id ? { ...apt, status: newStatus } : apt))
    );
    toast.success(`Token status updated to ${newStatus}`);
  };

  // UI Action: Trigger Voice Reminder Call
  const handleTriggerVoiceReminder = (apt: ClinicAppointment) => {
    toast.success(`AI Voice Reminder Call queued for ${apt.patientName} (${apt.patientPhone})`);
  };

  // UI Action: Save Doctor Consultation & Rx
  const handleSaveConsultation = () => {
    if (!selectedPatientForRx) {
      toast.error("Please select a patient first");
      return;
    }
    if (!rxDiagnosis.trim()) {
      toast.error("Please enter a clinical diagnosis");
      return;
    }

    // Update patient vitals & add history
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === selectedPatientForRx.id) {
          return {
            ...p,
            vitals: doctorVitals,
            history: [
              {
                date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
                diagnosis: rxDiagnosis,
                medicines: rxMedicines,
                notes: rxNotes,
              },
              ...p.history,
            ],
          };
        }
        return p;
      })
    );

    // Auto mark appointment completed
    setAppointments((prev) =>
      prev.map((apt) =>
        apt.patientPhone === selectedPatientForRx.phone && apt.status !== "Completed"
          ? { ...apt, status: "Completed" }
          : apt
      )
    );

    toast.success("Digital Prescription & Consultation saved successfully!");
    setPrintRxModal({
      patient: selectedPatientForRx,
      diagnosis: rxDiagnosis,
      medicines: rxMedicines,
      notes: rxNotes,
      vitals: doctorVitals,
    });
  };

  return (
    <div className="page-enter space-y-5 pb-12">
      {/* Top Banner & Title */}
      <div className="hero-row">
        <div>
          <p className="eyebrow emerald-text flex items-center gap-2">
            <span className="live-dot bg-emerald-500 animate-pulse" />
            GO-CLINIC BOX 2026 · SMART OPD & EMR SUITE
          </p>
          <h1 className="page-title text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Stethoscope className="text-emerald-400" size={28} />
            Clinic Management & OPD Floor
          </h1>
          <p className="page-subtitle text-zinc-400 text-sm">
            Live patient token queue, doctor EMR & prescription pad, pharmacy inventory, OPD billing, and patient softphone dialing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            className="soft-button flex items-center gap-2 hover:bg-zinc-800 transition text-xs font-semibold px-3 py-2 rounded-lg border border-zinc-700 text-zinc-300"
            onClick={() => toast.success("OPD Floor refreshed")}
            title="Refresh OPD Floor"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            className="primary-button bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition"
            onClick={() => setShowBookModal(true)}
          >
            <Plus size={15} /> Book Walk-in / Token
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
            <span>Today's Tokens</span>
            <Users size={16} className="text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">{stats.totalTokensToday}</span>
            <span className="text-[11px] text-blue-400 font-mono">OPD 1</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40 backdrop-blur-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-300 text-xs font-medium">
            <span>Waiting in Lobby</span>
            <Clock size={16} className="text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-200">{stats.waitingCount}</span>
            <span className="text-[11px] text-amber-400 font-mono">Queue</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 backdrop-blur-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-300 text-xs font-medium">
            <span>In Doctor Cabin</span>
            <Stethoscope size={16} className="text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-200">{stats.consultingCount}</span>
            <span className="text-[11px] text-emerald-400 font-mono">Active</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/40 backdrop-blur-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-purple-300 text-xs font-medium">
            <span>Consulted</span>
            <CheckCircle2 size={16} className="text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-purple-200">{stats.completedCount}</span>
            <span className="text-[11px] text-purple-400 font-mono">Done</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
            <span>Today's Billing</span>
            <TrendingUp size={16} className="text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-300">₹{stats.todayRevenue}</span>
            <span className="text-[11px] text-zinc-500 font-mono">Cash + UPI</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
            <span>Pharmacy Stock</span>
            <Pill size={16} className="text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">{medicines.length}</span>
            {stats.lowStockCount > 0 ? (
              <span className="text-[11px] text-rose-400 font-semibold">{stats.lowStockCount} Low</span>
            ) : (
              <span className="text-[11px] text-emerald-400">Normal</span>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2 overflow-x-auto gap-2">
        <div className="flex items-center gap-1.5 min-w-max">
          <button
            onClick={() => setActiveTab("queue")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === "queue"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Users size={14} /> Live Reception & Token Queue ({appointments.length})
          </button>
          <button
            onClick={() => setActiveTab("doctor")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === "doctor"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Stethoscope size={14} /> Doctor Cabin & Digital Rx
          </button>
          <button
            onClick={() => setActiveTab("pharmacy")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === "pharmacy"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Pill size={14} /> Pharmacy & Stock Inventory
          </button>
          <button
            onClick={() => setActiveTab("billing")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === "billing"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <CreditCard size={14} /> OPD Billing & Invoices
          </button>
          <button
            onClick={() => setActiveTab("voice")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === "voice"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <PhoneCall size={14} /> AI Voice Reminders & Telephony
          </button>
        </div>

        {activeTab === "queue" && nextWaitingPatient && (
          <button
            onClick={handleCallNextPatient}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-900/40 transition shrink-0 animate-pulse"
          >
            <Volume2 size={14} /> Call Next: Token #{nextWaitingPatient.tokenNumber} ({nextWaitingPatient.patientName})
          </button>
        )}
      </div>

      {/* =========================================================================
          TAB 1: LIVE RECEPTION & TOKEN QUEUE
      ========================================================================== */}
      {activeTab === "queue" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/80">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 text-zinc-500" size={15} />
              <input
                type="text"
                placeholder="Search token, patient name, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-200 focus:outline-hidden focus:border-emerald-500/60"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-xs text-zinc-400 flex items-center gap-1">
                <Filter size={13} /> Filter:
              </span>
              {["all", "waiting", "consulting", "completed"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`text-xs px-2.5 py-1 rounded-md capitalize font-medium transition ${
                    statusFilter === st
                      ? "bg-zinc-800 text-emerald-400 border border-zinc-700"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="panel border border-zinc-800/90 rounded-xl overflow-hidden bg-zinc-900/30">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 font-semibold">
                    <th className="py-3 px-4 w-16">Token</th>
                    <th className="py-3 px-4">Patient Details</th>
                    <th className="py-3 px-4">Doctor & Slot</th>
                    <th className="py-3 px-4">Chief Complaint</th>
                    <th className="py-3 px-4">OPD Fee</th>
                    <th className="py-3 px-4">Queue Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredAppointments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-zinc-500">
                        No appointments found. Click <strong>"Book Walk-in / Token"</strong> to register a patient.
                      </td>
                    </tr>
                  ) : (
                    filteredAppointments.map((apt) => (
                      <tr
                        key={apt.id}
                        className={`hover:bg-zinc-800/40 transition ${
                          apt.status === "Consulting" ? "bg-emerald-950/15" : ""
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm border ${
                              apt.status === "Consulting"
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 animate-pulse"
                                : apt.status === "Completed"
                                ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                                : "bg-blue-500/15 text-blue-300 border-blue-500/40"
                            }`}
                          >
                            #{apt.tokenNumber}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                            {apt.patientName}
                            <span className="text-[10px] text-zinc-500 font-normal">
                              ({apt.patientAge}y · {apt.gender})
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-400 font-mono flex items-center gap-1 mt-0.5">
                            <Phone size={11} className="text-zinc-500" />
                            {apt.patientPhone}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-zinc-200 font-medium">{apt.doctorName}</div>
                          <div className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                            <Clock size={11} className="text-zinc-500" />
                            {apt.slot}
                          </div>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <span className="text-zinc-300 line-clamp-1">{apt.chiefComplaint}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-zinc-200">₹{apt.fee}</div>
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 ${
                              apt.paid
                                ? "bg-emerald-950/40 text-emerald-400 border border-emerald-800/40"
                                : "bg-amber-950/40 text-amber-400 border border-amber-800/40"
                            }`}
                          >
                            {apt.paid ? "Paid" : "Due"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={apt.status}
                            onChange={(e) =>
                              handleUpdateStatus(apt.id, e.target.value as ClinicAppointment["status"])
                            }
                            className={`px-2 py-1 rounded text-xs font-semibold border cursor-pointer ${
                              apt.status === "Consulting"
                                ? "bg-emerald-950/50 text-emerald-300 border-emerald-700/60"
                                : apt.status === "Completed"
                                ? "bg-purple-950/50 text-purple-300 border-purple-700/60"
                                : apt.status === "Cancelled"
                                ? "bg-rose-950/50 text-rose-300 border-rose-700/60"
                                : "bg-amber-950/50 text-amber-300 border-amber-700/60"
                            }`}
                          >
                            <option value="Waiting">Waiting</option>
                            <option value="Consulting">Consulting</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => announceTokenAudio(apt.tokenNumber, apt.patientName)}
                              title="Announce Token on Speaker"
                              className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition"
                            >
                              <Volume2 size={14} />
                            </button>

                            <button
                              onClick={() => {
                                if (onCallPatient) {
                                  onCallPatient(apt.patientPhone, apt.patientName);
                                } else {
                                  toast.info(`Dialing ${apt.patientName} (${apt.patientPhone})`);
                                }
                              }}
                              title="Call Patient on Softphone"
                              className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition"
                            >
                              <PhoneCall size={14} />
                            </button>

                            <button
                              onClick={() => handleTriggerVoiceReminder(apt)}
                              title="Send Voice Reminder"
                              className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-violet-400 transition"
                            >
                              <Megaphone size={14} />
                            </button>

                            <button
                              onClick={() => {
                                const matched = patients.find((p) => p.phone === apt.patientPhone);
                                if (matched) {
                                  setSelectedPatientForRx(matched);
                                  setDoctorVitals(matched.vitals);
                                }
                                setActiveTab("doctor");
                              }}
                              title="Open in Doctor Cabin"
                              className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-blue-400 transition"
                            >
                              <Stethoscope size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: DOCTOR CABIN & DIGITAL RX (EMR)
      ========================================================================== */}
      {activeTab === "doctor" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 space-y-3">
            <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800/80">
              <div className="text-xs font-semibold text-zinc-200 mb-2 flex items-center justify-between">
                <span>Select Patient</span>
                <span className="text-[10px] text-zinc-500">{patients.length} records</span>
              </div>
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                {patients.map((pat) => (
                  <div
                    key={pat.id}
                    onClick={() => {
                      setSelectedPatientForRx(pat);
                      setDoctorVitals(pat.vitals);
                    }}
                    className={`p-2.5 rounded-lg border cursor-pointer transition text-xs ${
                      selectedPatientForRx?.id === pat.id
                        ? "bg-emerald-950/30 border-emerald-600/50 text-emerald-200"
                        : "bg-zinc-900/60 border-zinc-800/70 text-zinc-300 hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-100">{pat.name}</span>
                      <span className="text-[10px] text-zinc-400">{pat.gender}, {pat.age}y</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono mt-0.5">{pat.phone}</div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-500">
                      <span>Blood: <strong className="text-zinc-300">{pat.bloodGroup}</strong></span>
                      <span>BP: <strong className="text-zinc-300">{pat.vitals.bp}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-4">
            {selectedPatientForRx ? (
              <div className="panel border border-zinc-800/90 rounded-xl p-5 bg-zinc-900/30 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white">{selectedPatientForRx.name}</h3>
                      <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-xs font-mono">
                        {selectedPatientForRx.age} yrs · {selectedPatientForRx.gender}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-rose-950/40 text-rose-300 border border-rose-800/40 text-xs font-semibold">
                        {selectedPatientForRx.bloodGroup}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 font-mono">{selectedPatientForRx.phone}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (onCallPatient) {
                          onCallPatient(selectedPatientForRx.phone, selectedPatientForRx.name);
                        } else {
                          toast.info(`Dialing ${selectedPatientForRx.phone}`);
                        }
                      }}
                      className="soft-button flex items-center gap-1.5 text-xs text-emerald-400 border-emerald-800/40 hover:bg-emerald-950/30 px-3 py-1.5 rounded-lg border"
                    >
                      <PhoneCall size={13} /> Call Softphone
                    </button>
                    <button
                      onClick={() => {
                        setPrintRxModal({
                          patient: selectedPatientForRx,
                          diagnosis: rxDiagnosis || "Regular Follow-up",
                          medicines: rxMedicines,
                          notes: rxNotes,
                          vitals: doctorVitals,
                        });
                      }}
                      className="soft-button flex items-center gap-1.5 text-xs text-zinc-300 hover:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700"
                    >
                      <Printer size={13} /> Print Rx
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <HeartPulse size={14} className="text-rose-400" /> Patient Vitals (EMR)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    <div className="bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 font-medium">BP (mmHg)</span>
                      <input
                        type="text"
                        value={doctorVitals.bp}
                        onChange={(e) => setDoctorVitals({ ...doctorVitals, bp: e.target.value })}
                        className="w-full bg-transparent font-mono text-sm text-white font-bold focus:outline-hidden mt-0.5"
                        placeholder="120/80"
                      />
                    </div>
                    <div className="bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 font-medium">Pulse (bpm)</span>
                      <input
                        type="number"
                        value={doctorVitals.pulse}
                        onChange={(e) => setDoctorVitals({ ...doctorVitals, pulse: Number(e.target.value) })}
                        className="w-full bg-transparent font-mono text-sm text-white font-bold focus:outline-hidden mt-0.5"
                        placeholder="72"
                      />
                    </div>
                    <div className="bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 font-medium">SpO2 (%)</span>
                      <input
                        type="number"
                        value={doctorVitals.spo2}
                        onChange={(e) => setDoctorVitals({ ...doctorVitals, spo2: Number(e.target.value) })}
                        className="w-full bg-transparent font-mono text-sm text-white font-bold focus:outline-hidden mt-0.5"
                        placeholder="98"
                      />
                    </div>
                    <div className="bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 font-medium">Weight (kg)</span>
                      <input
                        type="number"
                        value={doctorVitals.weight}
                        onChange={(e) => setDoctorVitals({ ...doctorVitals, weight: Number(e.target.value) })}
                        className="w-full bg-transparent font-mono text-sm text-white font-bold focus:outline-hidden mt-0.5"
                        placeholder="65"
                      />
                    </div>
                    <div className="bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 font-medium">Temp (°F)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={doctorVitals.temperature}
                        onChange={(e) =>
                          setDoctorVitals({ ...doctorVitals, temperature: Number(e.target.value) })
                        }
                        className="w-full bg-transparent font-mono text-sm text-white font-bold focus:outline-hidden mt-0.5"
                        placeholder="98.6"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FileText size={14} className="text-blue-400" /> Clinical Diagnosis
                  </h4>
                  <input
                    type="text"
                    value={rxDiagnosis}
                    onChange={(e) => setRxDiagnosis(e.target.value)}
                    placeholder="e.g. Acute Bronchitis, Seasonal Allergy..."
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Pill size={14} className="text-emerald-400" /> Prescription Pad
                    </h4>
                    <button
                      onClick={() =>
                        setRxMedicines([
                          ...rxMedicines,
                          { name: "", dosage: "1-0-1 (After Food)", duration: "5 days" },
                        ])
                      }
                      className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
                    >
                      <Plus size={13} /> Add Medicine
                    </button>
                  </div>

                  <div className="space-y-2">
                    {rxMedicines.map((med, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 bg-zinc-950/70 p-2 rounded-lg border border-zinc-800"
                      >
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="Medicine Name (e.g. Paracetamol 650mg)"
                            value={med.name}
                            onChange={(e) => {
                              const updated = [...rxMedicines];
                              updated[idx].name = e.target.value;
                              setRxMedicines(updated);
                            }}
                            className="w-full bg-transparent text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden"
                          />
                        </div>
                        <div className="w-40">
                          <select
                            value={med.dosage}
                            onChange={(e) => {
                              const updated = [...rxMedicines];
                              updated[idx].dosage = e.target.value;
                              setRxMedicines(updated);
                            }}
                            className="w-full bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 rounded px-2 py-1 focus:outline-hidden"
                          >
                            <option value="1-0-1 (After Food)">1-0-1 (Morning & Night)</option>
                            <option value="1-0-0 (Morning Empty Stomach)">1-0-0 (Morning Empty Stomach)</option>
                            <option value="0-0-1 (Before Bed)">0-0-1 (Night Before Bed)</option>
                            <option value="1-1-1 (Thrice Daily)">1-1-1 (Thrice Daily)</option>
                            <option value="SOS (As needed)">SOS (As needed for pain)</option>
                          </select>
                        </div>
                        <div className="w-24">
                          <input
                            type="text"
                            placeholder="5 days"
                            value={med.duration}
                            onChange={(e) => {
                              const updated = [...rxMedicines];
                              updated[idx].duration = e.target.value;
                              setRxMedicines(updated);
                            }}
                            className="w-full bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 rounded px-2 py-1 focus:outline-hidden"
                          />
                        </div>
                        <button
                          onClick={() => {
                            if (rxMedicines.length > 1) {
                              setRxMedicines(rxMedicines.filter((_, i) => i !== idx));
                            }
                          }}
                          className="p-1 text-zinc-500 hover:text-rose-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Info size={14} className="text-amber-400" /> Advice & Dietary Notes
                  </h4>
                  <textarea
                    rows={2}
                    value={rxNotes}
                    onChange={(e) => setRxNotes(e.target.value)}
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                    placeholder="Dietary instructions, precautions, test follow-up..."
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                  <div className="text-xs text-zinc-400 flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    Interactive Rx Pad
                  </div>

                  <button
                    onClick={handleSaveConsultation}
                    className="primary-button bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition"
                  >
                    <FileCheck size={14} /> Save Rx & Complete Consultation
                  </button>
                </div>
              </div>
            ) : (
              <div className="panel border border-zinc-800/90 rounded-xl p-12 text-center text-zinc-500">
                Please select a patient from the left column to begin consultation.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: PHARMACY & INVENTORY
      ========================================================================== */}
      {activeTab === "pharmacy" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/80">
            <div>
              <h3 className="text-sm font-bold text-white">Medicine Stock & Dispensary</h3>
              <p className="text-xs text-zinc-400">Track batch numbers, expiry dates, unit prices, and dispense stock.</p>
            </div>
            <button
              onClick={() => setShowAddMedModal(true)}
              className="primary-button bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition"
            >
              <Plus size={14} /> Add Medicine to Stock
            </button>
          </div>

          <div className="panel border border-zinc-800/90 rounded-xl overflow-hidden bg-zinc-900/30">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 font-semibold">
                    <th className="py-3 px-4">Medicine Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Batch No</th>
                    <th className="py-3 px-4">Expiry</th>
                    <th className="py-3 px-4">Unit Price</th>
                    <th className="py-3 px-4">Stock Level</th>
                    <th className="py-3 px-4 text-right">Dispensary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {medicines.map((med) => (
                    <tr key={med.id} className="hover:bg-zinc-800/40 transition">
                      <td className="py-3 px-4 font-semibold text-zinc-100">{med.name}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300 font-medium">
                          {med.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-400">{med.batchNo}</td>
                      <td className="py-3 px-4 text-zinc-300">{med.expiryDate}</td>
                      <td className="py-3 px-4 font-semibold text-emerald-400">₹{med.unitPrice}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold ${
                              med.stockQty <= med.reorderLevel ? "text-rose-400" : "text-zinc-200"
                            }`}
                          >
                            {med.stockQty} units
                          </span>
                          {med.stockQty <= med.reorderLevel && (
                            <span className="text-[10px] bg-rose-950/60 text-rose-300 border border-rose-800/50 px-1.5 py-0.2 rounded font-semibold">
                              Reorder
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setShowDispenseModal(med)}
                          className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded text-xs font-semibold transition"
                        >
                          Dispense
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: BILLING & ACCOUNTS
      ========================================================================== */}
      {activeTab === "billing" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/80">
            <div>
              <h3 className="text-sm font-bold text-white">OPD Billing & Invoice Ledger</h3>
              <p className="text-xs text-zinc-400">Track Cash, UPI, and Card collections with printable clinic receipts.</p>
            </div>
            <button
              onClick={() => setShowNewInvoiceModal(true)}
              className="primary-button bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition"
            >
              <Plus size={14} /> Generate New Invoice
            </button>
          </div>

          <div className="panel border border-zinc-800/90 rounded-xl overflow-hidden bg-zinc-900/30">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 font-semibold">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Patient Name</th>
                    <th className="py-3 px-4">Consultation</th>
                    <th className="py-3 px-4">Pharmacy</th>
                    <th className="py-3 px-4">Lab</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4 text-right">Print</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-zinc-800/40 transition">
                      <td className="py-3 px-4 font-mono font-semibold text-zinc-300">{inv.invoiceNo}</td>
                      <td className="py-3 px-4 font-semibold text-zinc-100">
                        {inv.patientName}
                        <div className="text-[11px] text-zinc-500 font-normal font-mono">{inv.patientPhone}</div>
                      </td>
                      <td className="py-3 px-4 text-zinc-300">₹{inv.consultationFee}</td>
                      <td className="py-3 px-4 text-zinc-300">₹{inv.pharmacyAmount}</td>
                      <td className="py-3 px-4 text-zinc-300">₹{inv.labAmount}</td>
                      <td className="py-3 px-4 font-bold text-emerald-400">₹{inv.totalAmount}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                          {inv.paymentMode}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setPrintInvoiceModal(inv)}
                          className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
                          title="Print Patient Bill"
                        >
                          <Printer size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: AI VOICE REMINDERS & TELEPHONY
      ========================================================================== */}
      {activeTab === "voice" && (
        <div className="panel border border-zinc-800/90 rounded-xl p-6 bg-zinc-900/30 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Megaphone size={18} className="text-violet-400" />
                Clinic Voice Reminders & Follow-up Bot UI
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Preview automated outbound reminders for upcoming OPD appointments and tokens.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-950/40 text-emerald-300 border border-emerald-800/50 text-xs font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Telephony Voice Studio
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3">
              <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={14} className="text-amber-400" /> Voice Script Template (Hinglish / Hindi)
              </h4>
              <p className="text-xs text-zinc-300 leading-relaxed font-mono bg-zinc-900/80 p-3 rounded-lg border border-zinc-800">
                "Namaste {'{patient_name}'} ji. Yeh Dr. Arjun Mehta ke clinic se automated reminder call hai. Aapka OPD token number #{'{token_number}'} scheduled hai. Kripya samay se 10 minute pehle clinic padharein. Dhanyawad!"
              </p>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span>Voice: <strong>Kavya (Indian Hindi Neural)</strong></span>
                <span>·</span>
                <span>Speed: <strong>0.95x</strong></span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3">
              <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <PhoneCall size={14} className="text-emerald-400" /> Quick Dispatch Single Patient
              </h4>
              <p className="text-xs text-zinc-400">
                Trigger an automated voice reminder simulation to test the calling cadence.
              </p>
              <div className="space-y-2">
                {appointments.slice(0, 3).map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between p-2 rounded bg-zinc-900 text-xs">
                    <div>
                      <span className="font-semibold text-zinc-200">{apt.patientName}</span>
                      <span className="text-zinc-500 font-mono text-[11px] ml-2">{apt.patientPhone}</span>
                    </div>
                    <button
                      onClick={() => handleTriggerVoiceReminder(apt)}
                      className="px-2.5 py-1 rounded bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/40 text-[11px] font-semibold transition"
                    >
                      Trigger Call
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: BOOK WALK-IN / APPOINTMENT TOKEN
      ========================================================================== */}
      {showBookModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Stethoscope size={18} className="text-emerald-400" />
                Book Walk-in Patient / Token
              </h3>
              <button onClick={() => setShowBookModal(false)} className="text-zinc-500 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const formData = new FormData(form);
                const pName = String(formData.get("name") || "Walk-in Patient");
                const pPhone = String(formData.get("phone") || "+91 98000 00000");
                const pAge = Number(formData.get("age")) || 30;
                const pGender = (formData.get("gender") as any) || "Male";
                const pFee = Number(formData.get("fee")) || 500;
                const pComplaint = String(formData.get("complaint") || "Consultation");
                const pPaid = formData.get("paid") === "true";

                const newTokenNum = appointments.reduce((max, a) => Math.max(max, a.tokenNumber), 0) + 1;
                const newApt: ClinicAppointment = {
                  id: `apt-${Date.now()}`,
                  tokenNumber: newTokenNum,
                  patientName: pName,
                  patientPhone: pPhone,
                  patientAge: pAge,
                  gender: pGender,
                  doctorName: "Dr. Arjun Mehta (MD Medicine)",
                  slot: "Immediate",
                  status: "Waiting",
                  chiefComplaint: pComplaint,
                  fee: pFee,
                  paid: pPaid,
                  createdAt: new Date().toISOString(),
                };

                setAppointments([newApt, ...appointments]);

                // Auto register patient if new
                if (!patients.some((p) => p.phone === pPhone)) {
                  setPatients([
                    ...patients,
                    {
                      id: `pat-${Date.now()}`,
                      name: pName,
                      phone: pPhone,
                      age: pAge,
                      gender: pGender,
                      bloodGroup: "B+",
                      vitals: { bp: "120/80", pulse: 72, spo2: 98, weight: 65, temperature: 98.6 },
                      history: [],
                    },
                  ]);
                }

                toast.success(`Token #${newTokenNum} issued to ${pName}!`);
                setShowBookModal(false);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="text-zinc-300 font-semibold mb-1 block">Patient Full Name</label>
                <input
                  required
                  name="name"
                  type="text"
                  placeholder="e.g. Ramesh Kulkarni"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-zinc-300 font-semibold mb-1 block">Mobile Number</label>
                  <input
                    required
                    name="phone"
                    type="text"
                    defaultValue="+91 "
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 font-mono focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-zinc-300 font-semibold mb-1 block">Age & Gender</label>
                  <div className="flex gap-1.5">
                    <input
                      name="age"
                      type="number"
                      placeholder="Age"
                      defaultValue={32}
                      className="w-16 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 focus:outline-hidden"
                    />
                    <select
                      name="gender"
                      defaultValue="Male"
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 focus:outline-hidden"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-zinc-300 font-semibold mb-1 block">Chief Complaint / Symptoms</label>
                <input
                  name="complaint"
                  type="text"
                  placeholder="e.g. High fever, stomach ache"
                  defaultValue="General Checkup & Fever"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-zinc-300 font-semibold mb-1 block">Consultation Fee (₹)</label>
                  <input
                    name="fee"
                    type="number"
                    defaultValue={500}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 font-mono focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-zinc-300 font-semibold mb-1 block">Payment Status</label>
                  <select
                    name="paid"
                    defaultValue="true"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 focus:outline-hidden"
                  >
                    <option value="true">Paid (Cash / UPI)</option>
                    <option value="false">Due (Collect Later)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-950/40"
                >
                  Generate Token
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: ADD MEDICINE TO PHARMACY
      ========================================================================== */}
      {showAddMedModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Pill size={18} className="text-emerald-400" />
                Add Medicine to Inventory
              </h3>
              <button onClick={() => setShowAddMedModal(false)} className="text-zinc-500 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const formData = new FormData(form);
                const medName = String(formData.get("name") || "Medicine");
                const newMed: ClinicMedicine = {
                  id: `med-${Date.now()}`,
                  name: medName,
                  category: (formData.get("category") as any) || "Tablet",
                  batchNo: String(formData.get("batchNo") || "BT-100"),
                  stockQty: Number(formData.get("stockQty")) || 100,
                  unitPrice: Number(formData.get("unitPrice")) || 50,
                  expiryDate: String(formData.get("expiryDate") || "12/2027"),
                  reorderLevel: Number(formData.get("reorderLevel")) || 30,
                };

                setMedicines([...medicines, newMed]);
                toast.success(`Medicine ${medName} added to stock!`);
                setShowAddMedModal(false);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="text-zinc-300 font-semibold mb-1 block">Medicine Name</label>
                <input
                  required
                  name="name"
                  type="text"
                  placeholder="e.g. Azithromycin 500mg (Azee)"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-zinc-300 font-semibold mb-1 block">Category</label>
                  <select
                    name="category"
                    defaultValue="Tablet"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 focus:outline-hidden"
                  >
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Injection">Injection</option>
                    <option value="Ointment">Ointment</option>
                  </select>
                </div>
                <div>
                  <label className="text-zinc-300 font-semibold mb-1 block">Batch Number</label>
                  <input
                    required
                    name="batchNo"
                    type="text"
                    defaultValue="BT-5541"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 font-mono focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-zinc-300 font-semibold mb-1 block">Stock Qty</label>
                  <input
                    name="stockQty"
                    type="number"
                    defaultValue={100}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 font-mono focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-zinc-300 font-semibold mb-1 block">Price (₹)</label>
                  <input
                    name="unitPrice"
                    type="number"
                    defaultValue={65}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 font-mono focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-zinc-300 font-semibold mb-1 block">Expiry</label>
                  <input
                    name="expiryDate"
                    type="text"
                    defaultValue="10/2027"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddMedModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-950/40"
                >
                  Save to Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: DISPENSE MEDICINE
      ========================================================================== */}
      {showDispenseModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Pill size={18} className="text-emerald-400" />
                Dispense Medicine
              </h3>
              <button onClick={() => setShowDispenseModal(null)} className="text-zinc-500 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="text-xs space-y-1">
              <div className="font-semibold text-zinc-100 text-sm">{showDispenseModal.name}</div>
              <div className="text-zinc-400">Available Stock: <strong>{showDispenseModal.stockQty} units</strong></div>
              <div className="text-zinc-400">Price per unit: <strong>₹{showDispenseModal.unitPrice}</strong></div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const formData = new FormData(form);
                const qty = Number(formData.get("qty")) || 1;

                if (qty > showDispenseModal.stockQty) {
                  toast.error(`Only ${showDispenseModal.stockQty} units available in stock!`);
                  return;
                }

                setMedicines((prev) =>
                  prev.map((m) => (m.id === showDispenseModal.id ? { ...m, stockQty: m.stockQty - qty } : m))
                );

                toast.success(`Dispensed ${qty} units of ${showDispenseModal.name}`);
                setShowDispenseModal(null);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="text-zinc-300 font-semibold mb-1 block">Quantity to Dispense</label>
                <input
                  required
                  name="qty"
                  type="number"
                  min={1}
                  max={showDispenseModal.stockQty}
                  defaultValue={10}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 font-mono text-sm focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDispenseModal(null)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md"
                >
                  Confirm Dispense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: GENERATE BILL / INVOICE
      ========================================================================== */}
      {showNewInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard size={18} className="text-emerald-400" />
                Generate Patient Invoice
              </h3>
              <button onClick={() => setShowNewInvoiceModal(false)} className="text-zinc-500 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const formData = new FormData(form);

                const cFee = Number(formData.get("consultationFee")) || 0;
                const pAmount = Number(formData.get("pharmacyAmount")) || 0;
                const lAmount = Number(formData.get("labAmount")) || 0;
                const disc = Number(formData.get("discount")) || 0;
                const total = Math.max(0, cFee + pAmount + lAmount - disc);

                const newInv: ClinicInvoice = {
                  id: `inv-${Date.now()}`,
                  invoiceNo: `INV-2026-${(invoices.length + 893).toString().padStart(4, "0")}`,
                  patientName: String(formData.get("patientName") || "Patient"),
                  patientPhone: String(formData.get("patientPhone") || "+91 98000 00000"),
                  consultationFee: cFee,
                  pharmacyAmount: pAmount,
                  labAmount: lAmount,
                  discount: disc,
                  totalAmount: total,
                  paymentMode: (formData.get("paymentMode") as any) || "UPI",
                  createdAt: new Date().toISOString(),
                };

                setInvoices([newInv, ...invoices]);
                toast.success(`Invoice ${newInv.invoiceNo} generated successfully!`);
                setShowNewInvoiceModal(false);
                setPrintInvoiceModal(newInv);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="text-zinc-300 font-semibold mb-1 block">Patient Name</label>
                <input
                  required
                  name="patientName"
                  type="text"
                  defaultValue={selectedPatientForRx?.name || "Amit Patel"}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-zinc-300 font-semibold mb-1 block">Phone Number</label>
                <input
                  required
                  name="patientPhone"
                  type="text"
                  defaultValue={selectedPatientForRx?.phone || "+91 98201 44520"}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 font-mono focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-zinc-300 font-semibold mb-1 block">Doctor Fee (₹)</label>
                  <input
                    name="consultationFee"
                    type="number"
                    defaultValue={500}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-100 font-mono focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-zinc-300 font-semibold mb-1 block">Pharmacy (₹)</label>
                  <input
                    name="pharmacyAmount"
                    type="number"
                    defaultValue={120}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-100 font-mono focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-zinc-300 font-semibold mb-1 block">Lab / Tests (₹)</label>
                  <input
                    name="labAmount"
                    type="number"
                    defaultValue={0}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-100 font-mono focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-zinc-300 font-semibold mb-1 block">Discount (₹)</label>
                  <input
                    name="discount"
                    type="number"
                    defaultValue={0}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-100 font-mono focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-zinc-300 font-semibold mb-1 block">Payment Mode</label>
                  <select
                    name="paymentMode"
                    defaultValue="UPI"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-100 focus:outline-hidden"
                  >
                    <option value="UPI">UPI / QR Code</option>
                    <option value="Cash">Cash at Counter</option>
                    <option value="Card">Debit / Credit Card</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewInvoiceModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-950/40"
                >
                  Create & Print Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 5: PRINT DIGITAL PRESCRIPTION (Rx)
      ========================================================================== */}
      {printRxModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-zinc-900 rounded-2xl w-full max-w-2xl p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="border-b-2 border-emerald-600 pb-4 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-emerald-800 flex items-center gap-2">
                  <Stethoscope className="text-emerald-600" size={24} />
                  DR. ARJUN MEHTA CLINIC & HEALTHCARE
                </h2>
                <p className="text-xs text-zinc-600 mt-0.5">
                  M.B.B.S, M.D. (Internal Medicine) · Reg. No: MCI-2018-88412
                </p>
                <p className="text-[11px] text-zinc-500">
                  Shop 4, Ground Floor, Sai Plaza, Senapati Bapat Marg, Mumbai - 400013 · Tel: +91 22 4911 0022
                </p>
              </div>
              <button
                onClick={() => setPrintRxModal(null)}
                className="text-zinc-400 hover:text-zinc-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-zinc-500 font-medium block">Patient Name</span>
                <strong className="text-zinc-900 text-sm">{printRxModal.patient.name}</strong>
              </div>
              <div>
                <span className="text-zinc-500 font-medium block">Age / Gender / Blood</span>
                <strong className="text-zinc-900">
                  {printRxModal.patient.age} Y / {printRxModal.patient.gender} / {printRxModal.patient.bloodGroup}
                </strong>
              </div>
              <div>
                <span className="text-zinc-500 font-medium block">Mobile</span>
                <strong className="text-zinc-900 font-mono">{printRxModal.patient.phone}</strong>
              </div>
              <div>
                <span className="text-zinc-500 font-medium block">Date & Time</span>
                <strong className="text-zinc-900">
                  {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </strong>
              </div>

              <div className="col-span-2 sm:col-span-4 pt-2 border-t border-emerald-200/60 flex items-center gap-4 text-emerald-950 font-mono text-[11px]">
                <span>BP: <strong>{printRxModal.vitals.bp} mmHg</strong></span>
                <span>Pulse: <strong>{printRxModal.vitals.pulse} bpm</strong></span>
                <span>SpO2: <strong>{printRxModal.vitals.spo2}%</strong></span>
                <span>Weight: <strong>{printRxModal.vitals.weight} kg</strong></span>
                <span>Temp: <strong>{printRxModal.vitals.temperature}°F</strong></span>
              </div>
            </div>

            <div>
              <span className="text-xs uppercase tracking-wider font-bold text-zinc-500 block mb-1">
                Clinical Diagnosis
              </span>
              <p className="text-sm font-semibold text-emerald-900 bg-zinc-100 px-3 py-2 rounded-lg border border-zinc-200">
                {printRxModal.diagnosis}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl font-serif font-black text-emerald-800">℞</span>
                <span className="text-xs uppercase tracking-wider font-bold text-zinc-600">Prescription Details</span>
              </div>

              <table className="w-full text-left text-xs border border-zinc-200 rounded-lg overflow-hidden">
                <thead className="bg-zinc-100 text-zinc-700 font-semibold border-b border-zinc-200">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Medicine Name</th>
                    <th className="py-2.5 px-3">Dosage & Timing</th>
                    <th className="py-2.5 px-3">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {printRxModal.medicines.map((m, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3 text-zinc-500">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-zinc-900">{m.name}</td>
                      <td className="py-2.5 px-3 text-zinc-700">{m.dosage}</td>
                      <td className="py-2.5 px-3 text-zinc-700 font-semibold">{m.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200 text-xs">
              <span className="font-bold text-zinc-700 block mb-0.5">Special Advice / Instructions:</span>
              <p className="text-zinc-600">{printRxModal.notes}</p>
            </div>

            <div className="pt-6 flex justify-between items-end">
              <div className="text-[11px] text-zinc-500">
                Generated via CallForge Clinic Suite 2026<br />
                Follow-up after 5 days if symptoms persist.
              </div>
              <div className="text-center">
                <div className="w-36 border-b border-zinc-400 mb-1" />
                <span className="text-xs font-bold text-zinc-800">Dr. Arjun Mehta</span>
                <span className="text-[10px] text-zinc-500 block">Authorized Signature</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200">
              <button
                onClick={() => setPrintRxModal(null)}
                className="px-4 py-2 rounded-lg bg-zinc-200 text-zinc-800 hover:bg-zinc-300 font-semibold text-xs"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow"
              >
                <Printer size={14} /> Print Prescription (Ctrl + P)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 6: PRINT PATIENT BILL / INVOICE
      ========================================================================== */}
      {printInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-zinc-900 rounded-2xl w-full max-w-lg p-8 space-y-5 shadow-2xl">
            <div className="border-b-2 border-emerald-600 pb-3 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-emerald-800">DR. ARJUN MEHTA CLINIC</h3>
                <p className="text-xs text-zinc-500">OPD Cash Receipt & Tax Invoice</p>
              </div>
              <button onClick={() => setPrintInvoiceModal(null)} className="text-zinc-400 hover:text-zinc-800">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-zinc-500 block">Invoice No:</span>
                <strong className="font-mono text-zinc-900">{printInvoiceModal.invoiceNo}</strong>
              </div>
              <div className="text-right">
                <span className="text-zinc-500 block">Date:</span>
                <strong className="text-zinc-900">
                  {new Date(printInvoiceModal.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </strong>
              </div>
              <div className="mt-2">
                <span className="text-zinc-500 block">Billed To:</span>
                <strong className="text-zinc-900 text-sm">{printInvoiceModal.patientName}</strong>
                <span className="block text-zinc-500 font-mono">{printInvoiceModal.patientPhone}</span>
              </div>
              <div className="mt-2 text-right">
                <span className="text-zinc-500 block">Payment Mode:</span>
                <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                  {printInvoiceModal.paymentMode}
                </span>
              </div>
            </div>

            <div className="border-t border-b border-zinc-200 py-3 space-y-2 text-xs">
              <div className="flex justify-between text-zinc-700">
                <span>Doctor Consultation Charges</span>
                <span className="font-semibold font-mono">₹{printInvoiceModal.consultationFee}</span>
              </div>
              <div className="flex justify-between text-zinc-700">
                <span>Pharmacy / Dispensary Charges</span>
                <span className="font-semibold font-mono">₹{printInvoiceModal.pharmacyAmount}</span>
              </div>
              <div className="flex justify-between text-zinc-700">
                <span>Pathology / Lab Tests</span>
                <span className="font-semibold font-mono">₹{printInvoiceModal.labAmount}</span>
              </div>
              {printInvoiceModal.discount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount Applied</span>
                  <span className="font-semibold font-mono">- ₹{printInvoiceModal.discount}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center text-sm font-bold text-zinc-900 pt-1">
              <span>Total Amount Paid</span>
              <span className="text-xl text-emerald-700 font-mono">₹{printInvoiceModal.totalAmount}</span>
            </div>

            <div className="text-[11px] text-zinc-400 text-center pt-3 border-t border-zinc-200">
              Thank you for visiting Dr. Arjun Mehta Clinic. Wishing you good health!
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                onClick={() => setPrintInvoiceModal(null)}
                className="px-4 py-2 rounded-lg bg-zinc-200 text-zinc-800 hover:bg-zinc-300 font-semibold text-xs"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow"
              >
                <Printer size={14} /> Print Receipt (Ctrl + P)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
