import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileCheck,
  FilePlus,
  FileText,
  Filter,
  HeartPulse,
  Info,
  Layers,
  Megaphone,
  Pill,
  Phone,
  PhoneCall,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Stethoscope,
  Trash2,
  TrendingUp,
  User,
  UserCheck,
  Users,
  Volume2,
  X,
} from "lucide-react";

// Types
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

interface ClinicHubProps {
  onCallPatient?: (phone: string, name: string) => void;
}

export function ClinicHub({ onCallPatient }: ClinicHubProps) {
  const [activeTab, setActiveTab] = useState<"queue" | "doctor" | "pharmacy" | "billing" | "voice">("queue");
  const [loading, setLoading] = useState(false);

  // Clinic state
  const [appointments, setAppointments] = useState<ClinicAppointment[]>([]);
  const [patients, setPatients] = useState<ClinicPatient[]>([]);
  const [medicines, setMedicines] = useState<ClinicMedicine[]>([]);
  const [invoices, setInvoices] = useState<ClinicInvoice[]>([]);
  const [stats, setStats] = useState({
    totalTokensToday: 4,
    waitingCount: 3,
    consultingCount: 1,
    completedCount: 0,
    todayRevenue: 1417,
    lowStockCount: 1,
  });

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modals
  const [showBookModal, setShowBookModal] = useState(false);
  const [showAddMedModal, setShowAddMedModal] = useState(false);
  const [showDispenseModal, setShowDispenseModal] = useState<ClinicMedicine | null>(null);
  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false);
  const [selectedPatientForRx, setSelectedPatientForRx] = useState<ClinicPatient | null>(null);
  const [printRxModal, setPrintRxModal] = useState<{
    patient: ClinicPatient;
    diagnosis: string;
    medicines: Array<{ name: string; dosage: string; duration: string }>;
    notes: string;
    vitals: PatientVitals;
  } | null>(null);
  const [printInvoiceModal, setPrintInvoiceModal] = useState<ClinicInvoice | null>(null);

  // Doctor Consultation Form State
  const [rxDiagnosis, setRxDiagnosis] = useState("");
  const [rxMedicines, setRxMedicines] = useState<Array<{ name: string; dosage: string; duration: string }>>([
    { name: "Paracetamol 650mg", dosage: "1-0-1 (After Food)", duration: "3 days" },
  ]);
  const [rxNotes, setRxNotes] = useState("Rest adequately, drink plenty of fluids, and avoid cold drinks.");
  const [doctorVitals, setDoctorVitals] = useState<PatientVitals>({
    bp: "120/80",
    pulse: 74,
    spo2: 98,
    weight: 68,
    temperature: 98.6,
  });

  // Fetch initial data
  const loadClinicData = async () => {
    setLoading(true);
    try {
      const [resAppts, resPatients, resMeds, resInvoices, resStats] = await Promise.all([
        fetch("/api/clinic/appointments").then((r) => r.json()).catch(() => null),
        fetch("/api/clinic/patients").then((r) => r.json()).catch(() => null),
        fetch("/api/clinic/pharmacy").then((r) => r.json()).catch(() => null),
        fetch("/api/clinic/invoices").then((r) => r.json()).catch(() => null),
        fetch("/api/clinic/overview").then((r) => r.json()).catch(() => null),
      ]);

      if (resAppts?.appointments) setAppointments(resAppts.appointments);
      if (resPatients?.patients) {
        setPatients(resPatients.patients);
        if (resPatients.patients.length > 0 && !selectedPatientForRx) {
          setSelectedPatientForRx(resPatients.patients[0]);
          setDoctorVitals(resPatients.patients[0].vitals || doctorVitals);
        }
      }
      if (resMeds?.medicines) setMedicines(resMeds.medicines);
      if (resInvoices?.invoices) setInvoices(resInvoices.invoices);
      if (resStats?.stats) setStats(resStats.stats);
    } catch (err) {
      console.error("Failed to load clinic data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClinicData();
  }, []);

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

  // Audio Token Call Out (TTS Announcement)
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
        // speech synthesis fallback silent
      }
    }
  };

  // Action: Call Next Patient
  const handleCallNextPatient = async () => {
    if (!nextWaitingPatient) {
      toast.info("No patients waiting in queue!");
      return;
    }

    try {
      const res = await fetch(`/api/clinic/appointments/${nextWaitingPatient.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Consulting" }),
      });
      const data = await res.json();
      if (data.success) {
        announceTokenAudio(nextWaitingPatient.tokenNumber, nextWaitingPatient.patientName);
        toast.success(`Calling Token #${nextWaitingPatient.tokenNumber}: ${nextWaitingPatient.patientName}`);

        // Set in doctor tab
        const matched = patients.find((p) => p.phone === nextWaitingPatient.patientPhone);
        if (matched) {
          setSelectedPatientForRx(matched);
          setDoctorVitals(matched.vitals);
        }

        loadClinicData();
      }
    } catch {
      toast.error("Failed to update token status");
    }
  };

  // Action: Update Appointment Status
  const handleUpdateStatus = async (id: string, newStatus: ClinicAppointment["status"]) => {
    try {
      const res = await fetch(`/api/clinic/appointments/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Token status updated to ${newStatus}`);
        loadClinicData();
      }
    } catch {
      toast.error("Error updating appointment");
    }
  };

  // Action: Trigger AI Voice Reminder Call
  const handleTriggerVoiceReminder = async (apt: ClinicAppointment) => {
    try {
      const res = await fetch("/api/clinic/reminders/trigger-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: apt.patientName,
          patientPhone: apt.patientPhone,
          doctorName: apt.doctorName,
          slot: apt.slot,
          tokenNumber: apt.tokenNumber,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`AI Voice Call queued for ${apt.patientName} (${apt.patientPhone})`);
      } else {
        toast.error(data.error || "Failed to trigger call");
      }
    } catch {
      toast.error("Network error triggering AI voice call");
    }
  };

  // Action: Save Doctor Consultation & Rx
  const handleSaveConsultation = async () => {
    if (!selectedPatientForRx) {
      toast.error("Please select a patient first");
      return;
    }
    if (!rxDiagnosis.trim()) {
      toast.error("Please enter a clinical diagnosis");
      return;
    }

    try {
      // 1. Save Vitals
      await fetch(`/api/clinic/patients/${selectedPatientForRx.id}/vitals`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(doctorVitals),
      });

      // 2. Save Consultation Rx
      const res = await fetch(`/api/clinic/patients/${selectedPatientForRx.id}/consult`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnosis: rxDiagnosis,
          medicines: rxMedicines,
          notes: rxNotes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Also find active appointment and mark completed
        const apt = appointments.find(
          (a) => a.patientPhone === selectedPatientForRx.phone && a.status !== "Completed"
        );
        if (apt) {
          await handleUpdateStatus(apt.id, "Completed");
        }

        toast.success("Digital Prescription & Consultation saved successfully!");
        setPrintRxModal({
          patient: selectedPatientForRx,
          diagnosis: rxDiagnosis,
          medicines: rxMedicines,
          notes: rxNotes,
          vitals: doctorVitals,
        });
        loadClinicData();
      }
    } catch {
      toast.error("Failed to save digital prescription");
    }
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
            Live patient token queue, doctor EMR & prescription pad, pharmacy inventory, OPD billing, and AI automated voice reminders.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            className="soft-button flex items-center gap-2 hover:bg-zinc-800 transition text-xs font-semibold px-3 py-2 rounded-lg border border-zinc-700 text-zinc-300"
            onClick={loadClinicData}
            title="Refresh OPD Floor"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
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
          {/* Action Bar */}
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

          {/* Tokens Grid / Table */}
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
                        No appointments found matching filter. Click <strong>"Book Walk-in / Token"</strong> to register.
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
                            {/* Announce Token via Speaker */}
                            <button
                              onClick={() => announceTokenAudio(apt.tokenNumber, apt.patientName)}
                              title="Announce Token on Clinic Speaker"
                              className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition"
                            >
                              <Volume2 size={14} />
                            </button>

                            {/* Direct Softphone Dial */}
                            <button
                              onClick={() => {
                                if (onCallPatient) {
                                  onCallPatient(apt.patientPhone, apt.patientName);
                                } else {
                                  toast.info(`Dialing ${apt.patientName} (${apt.patientPhone}) on softphone`);
                                }
                              }}
                              title="Call Patient via CallForge Softphone"
                              className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition"
                            >
                              <PhoneCall size={14} />
                            </button>

                            {/* Outbound AI Automated Voice Reminder */}
                            <button
                              onClick={() => handleTriggerVoiceReminder(apt)}
                              title="Send Outbound AI Voice Reminder"
                              className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-violet-400 transition"
                            >
                              <Megaphone size={14} />
                            </button>

                            {/* Open in Doctor Cabin */}
                            <button
                              onClick={() => {
                                const matched = patients.find((p) => p.phone === apt.patientPhone);
                                if (matched) {
                                  setSelectedPatientForRx(matched);
                                  setDoctorVitals(matched.vitals);
                                }
                                setActiveTab("doctor");
                              }}
                              title="Open in Doctor Consultation Desk"
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
          {/* Left: Patient Directory & Selection */}
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

          {/* Right: Consultation Desk & Rx Pad */}
          <div className="lg:col-span-8 space-y-4">
            {selectedPatientForRx ? (
              <div className="panel border border-zinc-800/90 rounded-xl p-5 bg-zinc-900/30 space-y-5">
                {/* Header Profile Bar */}
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

                {/* Vitals Recording Strip */}
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

                {/* Clinical Diagnosis */}
                <div>
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FileText size={14} className="text-blue-400" /> Clinical Diagnosis & Findings
                  </h4>
                  <input
                    type="text"
                    value={rxDiagnosis}
                    onChange={(e) => setRxDiagnosis(e.target.value)}
                    placeholder="e.g. Acute Bronchitis, Allergic Rhinitis, Type 2 Diabetes..."
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                {/* Prescription Pad */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Pill size={14} className="text-emerald-400" /> Digital Rx Prescription Pad
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
                            placeholder="Medicine Name (e.g. Paracetamol 650mg, Pan-40)"
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

                {/* Advice Notes */}
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

                {/* Bottom Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                  <div className="text-xs text-zinc-400 flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    Auto-links with Pharmacy & Billing
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveConsultation}
                      className="primary-button bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition"
                    >
                      <FileCheck size={14} /> Save Rx & Complete Consultation
                    </button>
                  </div>
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
                Autonomous Clinic Voice Reminders & Follow-up Bot
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Powered directly by CallForge's dialer worker. Automatically places voice reminder calls for upcoming OPD tokens.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-950/40 text-emerald-300 border border-emerald-800/50 text-xs font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Engine Online (TRAI TCCCPR Compliant)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3">
              <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={14} className="text-amber-400" /> Voice Prompt (Hinglish / Hindi)
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
                Trigger an instantaneous AI voice call to test the reminder system on any mobile number.
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
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const formData = new FormData(form);

                try {
                  const res = await fetch("/api/clinic/appointments", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      patientName: formData.get("name"),
                      patientPhone: formData.get("phone"),
                      patientAge: Number(formData.get("age")),
                      gender: formData.get("gender"),
                      doctorName: "Dr. Arjun Mehta (MD Medicine)",
                      slot: formData.get("slot") || "Immediate",
                      chiefComplaint: formData.get("complaint"),
                      fee: Number(formData.get("fee")) || 500,
                      paid: formData.get("paid") === "true",
                    }),
                  });

                  const data = await res.json();
                  if (data.success) {
                    toast.success(`Token #${data.appointment.tokenNumber} issued to ${data.appointment.patientName}!`);
                    setShowBookModal(false);
                    loadClinicData();
                  } else {
                    toast.error(data.error || "Failed to book");
                  }
                } catch {
                  toast.error("Error booking appointment");
                }
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
                  placeholder="e.g. High fever, stomach ache since yesterday"
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
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const formData = new FormData(form);

                try {
                  const res = await fetch("/api/clinic/pharmacy", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: formData.get("name"),
                      category: formData.get("category"),
                      batchNo: formData.get("batchNo"),
                      stockQty: Number(formData.get("stockQty")),
                      unitPrice: Number(formData.get("unitPrice")),
                      expiryDate: formData.get("expiryDate"),
                      reorderLevel: Number(formData.get("reorderLevel")),
                    }),
                  });

                  const data = await res.json();
                  if (data.success) {
                    toast.success(`Medicine ${data.medicine.name} added to stock!`);
                    setShowAddMedModal(false);
                    loadClinicData();
                  } else {
                    toast.error(data.error || "Failed to add medicine");
                  }
                } catch {
                  toast.error("Error adding medicine");
                }
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
                    placeholder="BT-9021"
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
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const formData = new FormData(form);
                const qty = Number(formData.get("qty"));

                try {
                  const res = await fetch(`/api/clinic/pharmacy/${showDispenseModal.id}/dispense`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ qty }),
                  });

                  const data = await res.json();
                  if (data.success) {
                    toast.success(`Dispensed ${qty} units of ${showDispenseModal.name}`);
                    setShowDispenseModal(null);
                    loadClinicData();
                  } else {
                    toast.error(data.error || "Dispense failed");
                  }
                } catch {
                  toast.error("Error during dispensing");
                }
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
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const formData = new FormData(form);

                try {
                  const res = await fetch("/api/clinic/invoices", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      patientName: formData.get("patientName"),
                      patientPhone: formData.get("patientPhone"),
                      consultationFee: Number(formData.get("consultationFee")),
                      pharmacyAmount: Number(formData.get("pharmacyAmount")),
                      labAmount: Number(formData.get("labAmount")),
                      discount: Number(formData.get("discount")),
                      paymentMode: formData.get("paymentMode"),
                    }),
                  });

                  const data = await res.json();
                  if (data.success) {
                    toast.success(`Invoice ${data.invoice.invoiceNo} generated successfully!`);
                    setShowNewInvoiceModal(false);
                    setPrintInvoiceModal(data.invoice);
                    loadClinicData();
                  } else {
                    toast.error(data.error || "Failed to generate invoice");
                  }
                } catch {
                  toast.error("Error creating invoice");
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="text-zinc-300 font-semibold mb-1 block">Patient Name</label>
                <input
                  required
                  name="patientName"
                  type="text"
                  placeholder="Patient Name"
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
            {/* Clinic Letterhead */}
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

            {/* Patient Details & Vitals Strip */}
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

            {/* Diagnosis */}
            <div>
              <span className="text-xs uppercase tracking-wider font-bold text-zinc-500 block mb-1">
                Clinical Diagnosis
              </span>
              <p className="text-sm font-semibold text-emerald-900 bg-zinc-100 px-3 py-2 rounded-lg border border-zinc-200">
                {printRxModal.diagnosis}
              </p>
            </div>

            {/* Rx Symbol & Medicines Table */}
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

            {/* Advice */}
            <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200 text-xs">
              <span className="font-bold text-zinc-700 block mb-0.5">Special Advice / Instructions:</span>
              <p className="text-zinc-600">{printRxModal.notes}</p>
            </div>

            {/* Signature Block */}
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

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200">
              <button
                onClick={() => setPrintRxModal(null)}
                className="px-4 py-2 rounded-lg bg-zinc-200 text-zinc-800 hover:bg-zinc-300 font-semibold text-xs"
              >
                Close
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
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
            {/* Header */}
            <div className="border-b-2 border-emerald-600 pb-3 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-emerald-800">DR. ARJUN MEHTA CLINIC</h3>
                <p className="text-xs text-zinc-500">OPD Cash Receipt & Tax Invoice</p>
              </div>
              <button onClick={() => setPrintInvoiceModal(null)} className="text-zinc-400 hover:text-zinc-800">
                <X size={18} />
              </button>
            </div>

            {/* Meta */}
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

            {/* Line Items */}
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

            {/* Total */}
            <div className="flex justify-between items-center text-sm font-bold text-zinc-900 pt-1">
              <span>Total Amount Paid</span>
              <span className="text-xl text-emerald-700 font-mono">₹{printInvoiceModal.totalAmount}</span>
            </div>

            <div className="text-[11px] text-zinc-400 text-center pt-3 border-t border-zinc-200">
              Thank you for visiting Dr. Arjun Mehta Clinic. Wishing you good health!
            </div>

            {/* Buttons */}
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
