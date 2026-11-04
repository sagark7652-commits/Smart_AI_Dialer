import { AgentSession, ToolDefinition } from "../types";
import { persistentStore } from "../../../storage/persistentStore";

export const BUILTIN_DENTAL_TOOLS: ToolDefinition[] = [
  {
    name: "check_availability",
    description: "Check doctor consultation availability and open appointment slots for a given date at Aarogya Dental Care.",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date to query availability for (e.g. today, tomorrow, kal, YYYY-MM-DD)" },
      },
      required: ["date"],
    },
    execute: async (args: Record<string, any>, context: AgentSession) => {
      const date = args.date || "tomorrow";
      const openSlots = ["10:30 AM", "12:00 PM", "3:30 PM", "6:00 PM", "7:30 PM"];

      return {
        success: true,
        clinic: "Aarogya Dental Care",
        doctor: "Dr. Sharma",
        date,
        available_slots: openSlots,
        message: `On ${date}, Dr. Sharma has open slots at: ${openSlots.join(", ")}.`,
      };
    },
  },
  {
    name: "book_appointment",
    description: "Book a confirmed dental consultation or treatment appointment for a patient at Aarogya Dental Care.",
    parameters: {
      type: "object",
      properties: {
        caller_name: { type: "string", description: "Full name of the patient" },
        phone_number: { type: "string", description: "Patient 10-digit phone number" },
        date: { type: "string", description: "Appointment date (e.g. tomorrow, kal, YYYY-MM-DD)" },
        time_slot: { type: "string", description: "Preferred time slot (e.g. 10:30 AM, 4:00 PM)" },
        service: { type: "string", description: "Requested dental procedure (Consultation, Root Canal, Cleaning, Implants)" },
      },
      required: ["caller_name", "time_slot", "service"],
    },
    execute: async (args: Record<string, any>, context: AgentSession) => {
      const callerName = args.caller_name || context.memory.customerName || "Patient";
      const phone = args.phone_number || context.customerPhone;
      const date = args.date || "tomorrow";
      const timeSlot = args.time_slot || "11:00 AM";
      const service = args.service || "General Dental Consultation";
      const appointmentId = `APT-ADC-${Date.now().toString().slice(-6)}`;

      // Save note to persistent store lead if matching
      const cleanPhone = phone.replace(/\D/g, "").slice(-10);
      const lead = persistentStore.getLeads().find((l) => l.phone.replace(/\D/g, "").slice(-10) === cleanPhone);
      if (lead) {
        lead.notes.push(`[Priya - Aarogya Dental] Confirmed Appointment: ${service} on ${date} at ${timeSlot} (ID: ${appointmentId})`);
      }

      // Dispatch WhatsApp confirmation
      persistentStore.sendWhatsAppMessage({
        recipientPhone: phone,
        recipientName: callerName,
        templateName: "Aarogya Dental Appointment Confirmation",
        body: `Namaste ${callerName}! Your appointment at Aarogya Dental Care for ${service} is confirmed for ${date} at ${timeSlot}. Doctor: Dr. Sharma. Location: FC Road, Shivaji Nagar, Pune.`,
      });

      return {
        success: true,
        appointment_id: appointmentId,
        caller_name: callerName,
        phone_number: phone,
        date,
        time_slot: timeSlot,
        service,
        message: `Appointment booked successfully for ${callerName} on ${date} at ${timeSlot}.`,
        confirmation_readback: `Main aapka ${service} appointment ${date} ko ${timeSlot} baje Aarogya Dental Care me Dr. Sharma ke paas confirm kar rahi hoon.`,
      };
    },
  },
  {
    name: "get_clinic_services",
    description: "Get prices, treatment procedures, and timings for Aarogya Dental Care & Implant Center.",
    parameters: {
      type: "object",
      properties: {
        procedure: { type: "string", description: "Specific procedure name (e.g. root canal, cleaning, implants)" },
      },
      required: [],
    },
    execute: async (args: Record<string, any>) => {
      return {
        success: true,
        clinic: "Aarogya Dental Care & Implant Center",
        location: "FC Road, Shivaji Nagar, Pune",
        fees: {
          general_consultation: "₹400",
          teeth_cleaning_polishing: "₹1,200",
          root_canal_treatment: "₹3,500 onwards (approx 45 mins)",
          dental_implants: "₹25,000 onwards",
          teeth_whitening: "₹5,000",
        },
        timings: "Monday to Saturday 9:00 AM to 8:30 PM",
        doctor: "Dr. Sharma (BDS MDS, 15+ years experience)",
      };
    },
  },
];
