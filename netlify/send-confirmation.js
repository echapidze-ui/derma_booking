// netlify/functions/send-confirmation.js
const { Resend } = require("resend");

function json(statusCode, bodyObj) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      // basic CORS
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
    },
    body: JSON.stringify(bodyObj),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Use POST" });

  let booking;
  try {
    booking = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, error: "Invalid JSON" });
  }

  const { service, date, time, patientName, patientEmail } = booking || {};
  if (!service || !date || !time || !patientEmail) {
    return json(400, { ok: false, error: "Missing booking fields (service/date/time/patientEmail)" });
  }

  if (!process.env.RESEND_API_KEY) {
    return json(500, { ok: false, error: "Missing RESEND_API_KEY env var" });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const text =
    `Appointment request received.\n\n` +
    `Service: ${service}\n` +
    `Date: ${date}\n` +
    `Time: ${time}\n` +
    `Name: ${patientName || ""}\n\n` +
    `If anything is incorrect, please contact the clinic.`;

  try {
    const from = process.env.FROM_EMAIL || "Clinic <onboarding@resend.dev>";
    const r = await resend.emails.send({
      from,
      to: patientEmail,
      subject: "Appointment request received",
      text,
    });

    return json(200, { ok: true, id: r?.data?.id || null });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
};

