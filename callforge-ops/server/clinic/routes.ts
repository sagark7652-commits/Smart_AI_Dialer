import { Request, Response, Router } from "express";
import { persistentStore } from "../storage/persistentStore";
import { dialerWorker } from "../calling/queue";

export const clinicRouter = Router();

// GET /api/clinic/overview - Live dashboard KPI cards
clinicRouter.get("/overview", (_req: Request, res: Response) => {
  const stats = persistentStore.getClinicStats();
  res.json({ success: true, stats });
});

// GET /api/clinic/appointments - Token Queue list
clinicRouter.get("/appointments", (_req: Request, res: Response) => {
  const appointments = persistentStore.getClinicAppointments();
  res.json({ success: true, appointments });
});

// POST /api/clinic/appointments - Book walk-in or online token
clinicRouter.post("/appointments", (req: Request, res: Response) => {
  const { patientName, patientPhone, patientAge, gender, doctorName, slot, chiefComplaint, fee, paid } = req.body;

  if (!patientName || !patientPhone) {
    return res.status(400).json({ success: false, error: "Patient name and phone are required." });
  }

  const appointment = persistentStore.addClinicAppointment({
    patientName,
    patientPhone,
    patientAge: Number(patientAge) || 30,
    gender: gender || "Male",
    doctorName: doctorName || "Dr. Arjun Mehta (MD Medicine)",
    slot: slot || "Immediate",
    status: "Waiting",
    chiefComplaint: chiefComplaint || "General Consultation",
    fee: Number(fee) || 500,
    paid: Boolean(paid),
  });

  res.status(201).json({ success: true, appointment });
});

// PATCH /api/clinic/appointments/:id/status - Update queue status (Waiting -> Consulting -> Completed)
clinicRouter.patch("/appointments/:id/status", (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !["Waiting", "Consulting", "Completed", "Cancelled"].includes(status)) {
    return res.status(400).json({ success: false, error: "Invalid appointment status." });
  }

  const updated = persistentStore.updateAppointmentStatus(id, status);
  if (!updated) {
    return res.status(404).json({ success: false, error: "Appointment not found." });
  }

  res.json({ success: true, appointment: updated });
});

// DELETE /api/clinic/appointments/:id
clinicRouter.delete("/appointments/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = persistentStore.deleteClinicAppointment(id);
  res.json({ success: deleted });
});

// GET /api/clinic/patients - All patient EMR records
clinicRouter.get("/patients", (_req: Request, res: Response) => {
  const patients = persistentStore.getClinicPatients();
  res.json({ success: true, patients });
});

// POST /api/clinic/patients - Add or update patient profile
clinicRouter.post("/patients", (req: Request, res: Response) => {
  const { name, phone, age, gender, bloodGroup, allergies, vitals } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ success: false, error: "Name and phone are required." });
  }

  const patient = persistentStore.addOrUpdateClinicPatient({
    name,
    phone,
    age: Number(age) || 30,
    gender: gender || "Male",
    bloodGroup: bloodGroup || "B+",
    allergies: allergies || [],
    vitals: vitals || { bp: "120/80", pulse: 72, spo2: 98, weight: 65, temperature: 98.6 },
  });

  res.json({ success: true, patient });
});

// PATCH /api/clinic/patients/:id/vitals - Quick vitals update from consultation room
clinicRouter.patch("/patients/:id/vitals", (req: Request, res: Response) => {
  const { id } = req.params;
  const { bp, pulse, spo2, weight, temperature } = req.body;

  const patient = persistentStore.updatePatientVitals(id, {
    bp: bp || "120/80",
    pulse: Number(pulse) || 72,
    spo2: Number(spo2) || 98,
    weight: Number(weight) || 65,
    temperature: Number(temperature) || 98.6,
  });

  if (!patient) {
    return res.status(404).json({ success: false, error: "Patient record not found." });
  }

  res.json({ success: true, patient });
});

// POST /api/clinic/patients/:id/consult - Save doctor consultation note & prescription
clinicRouter.post("/patients/:id/consult", (req: Request, res: Response) => {
  const { id } = req.params;
  const { diagnosis, medicines, notes, date } = req.body;

  if (!diagnosis) {
    return res.status(400).json({ success: false, error: "Diagnosis is required." });
  }

  const patient = persistentStore.addConsultationRecord(id, {
    date: date || new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    diagnosis,
    medicines: Array.isArray(medicines) ? medicines : [],
    notes: notes || "Take medicines with warm water after meals.",
  });

  if (!patient) {
    return res.status(404).json({ success: false, error: "Patient not found." });
  }

  res.json({ success: true, patient });
});

// GET /api/clinic/pharmacy - Medicines catalog and stock levels
clinicRouter.get("/pharmacy", (_req: Request, res: Response) => {
  const medicines = persistentStore.getClinicMedicines();
  res.json({ success: true, medicines });
});

// POST /api/clinic/pharmacy - Add medicine to inventory
clinicRouter.post("/pharmacy", (req: Request, res: Response) => {
  const { name, category, batchNo, stockQty, unitPrice, expiryDate, reorderLevel } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, error: "Medicine name is required." });
  }

  const medicine = persistentStore.addClinicMedicine({
    name,
    category: category || "Tablet",
    batchNo: batchNo || `BT-${Math.floor(1000 + Math.random() * 9000)}`,
    stockQty: Number(stockQty) || 100,
    unitPrice: Number(unitPrice) || 50,
    expiryDate: expiryDate || "12/2027",
    reorderLevel: Number(reorderLevel) || 30,
  });

  res.status(201).json({ success: true, medicine });
});

// POST /api/clinic/pharmacy/:id/dispense - Quick dispense from pharmacy counter
clinicRouter.post("/pharmacy/:id/dispense", (req: Request, res: Response) => {
  const { id } = req.params;
  const { qty } = req.body;

  const result = persistentStore.dispenseMedicine(id, Number(qty) || 1);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }

  res.json({ success: true, medicine: result.medicine });
});

// GET /api/clinic/invoices - Billing records
clinicRouter.get("/invoices", (_req: Request, res: Response) => {
  const invoices = persistentStore.getClinicInvoices();
  res.json({ success: true, invoices });
});

// POST /api/clinic/invoices - Create new invoice
clinicRouter.post("/invoices", (req: Request, res: Response) => {
  const {
    patientName,
    patientPhone,
    consultationFee,
    pharmacyAmount,
    labAmount,
    discount,
    paymentMode,
  } = req.body;

  if (!patientName) {
    return res.status(400).json({ success: false, error: "Patient name is required." });
  }

  const cFee = Number(consultationFee) || 0;
  const pAmount = Number(pharmacyAmount) || 0;
  const lAmount = Number(labAmount) || 0;
  const disc = Number(discount) || 0;
  const total = Math.max(0, cFee + pAmount + lAmount - disc);

  const invoice = persistentStore.createClinicInvoice({
    patientName,
    patientPhone: patientPhone || "+91 98000 00000",
    consultationFee: cFee,
    pharmacyAmount: pAmount,
    labAmount: lAmount,
    discount: disc,
    totalAmount: total,
    paymentMode: paymentMode || "UPI",
  });

  res.status(201).json({ success: true, invoice });
});

// POST /api/clinic/reminders/trigger-call - AI Telephony Reminder
clinicRouter.post("/reminders/trigger-call", (req: Request, res: Response) => {
  const { patientName, patientPhone, doctorName, slot, tokenNumber } = req.body;

  if (!patientPhone) {
    return res.status(400).json({ success: false, error: "Patient phone is required." });
  }

  // Enqueue single automated call into dialerWorker
  try {
    dialerWorker.enqueueCampaign({
      name: `Clinic Reminder - Token #${tokenNumber || 1} ${patientName || "Patient"}`,
      dialerMode: "progressive",
      callerId: "+91-140-CLINIC",
      script: `Namaste ${patientName || "Patient"} ji. This is an automated reminder from Dr. ${doctorName || "Arjun Mehta"}'s clinic. Your appointment token number is ${tokenNumber || 1} scheduled for ${slot || "today"}. Please arrive 10 minutes prior to your consultation. Dhanyawad.`,
      leads: [
        {
          id: `lead-clinic-${Date.now()}`,
          name: patientName || "Patient",
          phone: patientPhone,
          company: "Clinic Outpatient",
        },
      ],
    });

    res.json({
      success: true,
      message: `AI Voice reminder queued successfully for ${patientName} (${patientPhone}).`,
      phone: patientPhone,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to trigger call." });
  }
});
