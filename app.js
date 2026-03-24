/* Application logic for Medical Facility Booking — Option B
   - index.html: Customer login/register + Admin login
   - redirects to customer.html / admin.html after login
   - persists customers/bookings in localStorage (demo mode)
   - guards customer/admin pages
   - keeps Netlify email confirmation call
*/

(() => {
  // ---------------------------
  // Configuration & Static Data
  // ---------------------------
  const defaultConfig = {
    clinic_name: "Medical Facility",
    clinic_tagline: "Your health, our priority",
    booking_title: "Book Your Appointment",
    service_label: "Select Service",
    promo_title: "Special Offer!",
    promo_message:
      "20% off dermatology consultations this month! Book now and take care of your skin with our expert team.",
  };

  // DEMO ONLY (client-side credentials are insecure)
  const ADMIN_USERNAME = "Mary.mary@clinic.com";
  const ADMIN_PASSWORD = "Dermadent123";

  const procedures = {
    dermatology: [
      "Classic facial",
      "Anti-aging facial",
      "Acne treatment facial",
      "Botox",
      "Filler",
      "Lip filler",
      "Biorevitalization",
      "Exfoliating brow lift",
      "Chemical peel",
    ],
    stomatology: [
      "Teeth cleaning",
      "Teeth whitening",
      "Restoration of teeth",
      "Soft prothesis",
      "Braces",
      "Treatment of pulpits",
      "Cosmetic fillings",
      "Dental bonds",
      "Dental crowns",
    ],
    solarium: [
      "Basic tanning session",
      "Premium tanning session",
      "Spray tan",
      "Monthly tanning package",
      "Red light therapy",
      "Hybrid UV+ red light",
    ],
  };

  const timeSlots = [
    "09:00","09:30","10:00","10:30","11:00","11:30",
    "12:00","12:30","13:00","13:30","14:00","14:30",
    "15:00","15:30","16:00","16:30","17:00",
  ];

  // ---------------------------
  // LocalStorage (DEMO persistence)
  // ---------------------------
  const STORAGE = {
    CUSTOMERS: "derma_booking_customers_v1",
    BOOKINGS:  "derma_booking_bookings_v1",
    SESSION:   "derma_booking_session_v1",
  };

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getSession()            { return readJSON(STORAGE.SESSION, null); }
  function setSession(sessionObj)  { writeJSON(STORAGE.SESSION, sessionObj); }
  function clearSession()          { localStorage.removeItem(STORAGE.SESSION); }

  // ---------------------------
  // Global State
  // ---------------------------
  let currentBookings  = [];
  let currentCustomers = [];

  let selectedTime             = null;
  let customerSelectedTime     = null;
  let editingCustomerBookingId = null;

  let currentTab          = "pending";
  let isLoggedIn          = false;
  let isCustomerLoggedIn  = false;
  let currentCustomer     = null;

  // ---------------------------
  // Helpers
  // ---------------------------
  function byId(id) { return document.getElementById(id); }

  function setText(id, val) {
    const el = byId(id);
    if (el) el.textContent = val;
  }

  function showSuccess(message, elementId = "successMessage") {
    const el = byId(elementId);
    if (!el) return;
    el.textContent = message;
    el.classList.add("active");
    setTimeout(() => el.classList.remove("active"), 5000);
  }

  function showError(message, elementId = "errorMessage") {
    const el = byId(elementId);
    if (!el) return;
    el.textContent = message;
    el.classList.add("active");
    setTimeout(() => el.classList.remove("active"), 5000);
  }

  function safeValue(id) {
    const el = byId(id);
    return el ? el.value : "";
  }

  function getBackendId(item) { return item.__backendId || item.id; }

  function isCustomerPage() {
    return !!byId("customerDashboard") || !!byId("customerBookingsList") || !!byId("customerBookingFormEl");
  }

  function isAdminPage() {
    return !!byId("adminDashboard") || !!byId("bookingsList") || !!byId("pendingCount");
  }

  function goTo(path) { window.location.href = path; }

  // ---------------------------
  // Email confirmation (Netlify)
  // ---------------------------
  async function sendBookingConfirmationEmail(booking) {
    if (!booking?.patientEmail) return;
    try {
      await fetch("/.netlify/functions/send-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(booking),
      });
    } catch (e) {
      console.warn("Email confirmation failed:", e);
    }
  }

  // ---------------------------
  // Demo-mode CRUD (localStorage)
  // ---------------------------
  function loadDemoData() {
    currentCustomers = readJSON(STORAGE.CUSTOMERS, []);
    currentBookings  = readJSON(STORAGE.BOOKINGS,  []);
  }

  function saveDemoCustomers() { writeJSON(STORAGE.CUSTOMERS, currentCustomers); }
  function saveDemoBookings()  { writeJSON(STORAGE.BOOKINGS,  currentBookings);  }

  function demoCreate(item) {
    if (item.type === "customer") {
      currentCustomers.push(item);
      saveDemoCustomers();
    } else {
      currentBookings.push({ ...item, __backendId: item.id });
      saveDemoBookings();
    }
  }

  function demoUpdate(updated) {
    if (updated.type === "customer") {
      const idx = currentCustomers.findIndex((c) => c.id === updated.id);
      if (idx !== -1) currentCustomers[idx] = updated;
      saveDemoCustomers();
    } else {
      const id  = getBackendId(updated);
      const idx = currentBookings.findIndex((b) => getBackendId(b) === id);
      if (idx !== -1) currentBookings[idx] = updated;
      saveDemoBookings();
    }
  }

  function demoDelete(item) {
    if (item.type === "customer") {
      currentCustomers = currentCustomers.filter((c) => c.id !== item.id);
      saveDemoCustomers();
    } else {
      const id = getBackendId(item);
      currentBookings = currentBookings.filter((b) => getBackendId(b) !== id);
      saveDemoBookings();
    }
  }

  // ---------------------------
  // Initialization  ← ONE clean version, nothing after it
  // ---------------------------
  async function initializeApp() {
    if (!window.dataSdk) loadDemoData();

    const session = getSession();

    setupEventListeners();
    setMinDate();

    if (byId("promoPopup")) setTimeout(showPromo, 3000);

    // ── Customer page guard ──────────────────────────────
    if (isCustomerPage()) {
      if (!session || session.role !== "customer" || !session.customerId) {
        clearSession();
        return goTo("./index.html");
      }

      currentCustomer = currentCustomers.find((c) => c.id === session.customerId) || null;

      if (!currentCustomer) {
        clearSession();
        return goTo("./index.html");
      }

      isCustomerLoggedIn = true;

      const welcome = byId("customerWelcome");
      if (welcome) welcome.textContent = `${currentCustomer.name}'s Appointments`;

      // Show dashboard, hide auth panel
      const customerAuth      = byId("customerAuth");
      const customerDashboard = byId("customerDashboard");
      if (customerAuth)      customerAuth.style.display      = "none";
      if (customerDashboard) customerDashboard.style.display = "block";

      renderCustomerBookings();
      updateCustomerTimeSlots();
      return;
    }

    // ── Admin page guard ─────────────────────────────────
    if (isAdminPage()) {
      if (!session || session.role !== "admin") {
        clearSession();
        return goTo("./index.html");
      }

      isLoggedIn = true;

      const adminLogin     = byId("adminLogin");
      const adminDashboard = byId("adminDashboard");
      if (adminLogin)     adminLogin.style.display     = "none";
      if (adminDashboard) adminDashboard.style.display = "block";

      renderBookingsList();
      updateAdminStats();
    }
  }

  // ---------------------------
  // Event Listeners
  // ---------------------------
  function setupEventListeners() {
    // Public booking form
    const bookingForm = byId("bookingForm");
    if (bookingForm) bookingForm.addEventListener("submit", handleBookingSubmit);

    const dateInput = byId("dateInput");
    if (dateInput) dateInput.addEventListener("change", updateTimeSlots);

    const serviceSelect = byId("serviceSelect");
    if (serviceSelect) {
      serviceSelect.addEventListener("change", () => {
        onPublicServiceChange();
        updateTimeSlots();
      });
    }

    // Admin login
    const loginForm = byId("loginForm");
    if (loginForm) loginForm.addEventListener("submit", handleAdminLogin);

    // Customer auth
    const customerLoginForm = byId("customerLoginForm");
    if (customerLoginForm) customerLoginForm.addEventListener("submit", handleCustomerLogin);

    const customerRegisterForm = byId("customerRegisterForm");
    if (customerRegisterForm) customerRegisterForm.addEventListener("submit", handleCustomerRegister);

    // Customer booking form
    const customerBookingFormEl = byId("customerBookingFormEl");
    if (customerBookingFormEl) customerBookingFormEl.addEventListener("submit", handleCustomerBookingSubmit);

    const customerServiceSelect = byId("customerServiceSelect");
    if (customerServiceSelect) {
      customerServiceSelect.addEventListener("change", () => {
        onCustomerServiceChange();
        updateCustomerTimeSlots();
      });
    }

    const customerDateInput = byId("customerDateInput");
    if (customerDateInput) customerDateInput.addEventListener("change", updateCustomerTimeSlots);
  }

  function setMinDate() {
    const today = new Date().toISOString().split("T")[0];

    const dateInput = byId("dateInput");
    if (dateInput) {
      dateInput.setAttribute("min", today);
      if (!dateInput.value) dateInput.value = today;
    }

    const customerDateInput = byId("customerDateInput");
    if (customerDateInput) {
      customerDateInput.setAttribute("min", today);
      if (!customerDateInput.value) customerDateInput.value = today;
    }

    updateTimeSlots();
    updateCustomerTimeSlots();
  }

  // ---------------------------
  // Public Booking
  // ---------------------------
  function updateTimeSlots() {
    const container = byId("timeSlots");
    if (!container) return;

    const selectedDate    = safeValue("dateInput");
    const selectedService = safeValue("serviceSelect");

    if (!selectedDate || !selectedService) {
      container.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">Please select a service and date first</p>';
      return;
    }

    container.innerHTML = "";

    const bookedSlots = currentBookings
      .filter((b) => b.date === selectedDate && b.service === selectedService && b.status !== "rejected")
      .map((b) => b.time);

    timeSlots.forEach((time) => {
      const slot = document.createElement("div");
      slot.className = "time-slot";
      slot.textContent = time;

      if (bookedSlots.includes(time)) {
        slot.classList.add("booked");
      } else {
        slot.addEventListener("click", () => selectTimeSlot(time, slot));
      }

      if (selectedTime === time && !bookedSlots.includes(time)) {
        slot.classList.add("selected");
      }

      container.appendChild(slot);
    });
  }

  function selectTimeSlot(time, element) {
    document.querySelectorAll("#timeSlots .time-slot").forEach((s) => s.classList.remove("selected"));
    element.classList.add("selected");
    selectedTime = time;
  }

  async function handleBookingSubmit(e) {
    e.preventDefault();

    if (!selectedTime) { showError("Please select a time slot"); return; }

    const submitBtn = byId("submitBtn");
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Booking..."; }

    const booking = {
      id: Date.now().toString(),
      type: "booking",
      service:      safeValue("serviceSelect"),
      procedure:    safeValue("procedureSelectPublic") || "",
      date:         safeValue("dateInput"),
      time:         selectedTime,
      patientName:  safeValue("nameInput"),
      patientEmail: safeValue("emailInput"),
      patientPhone: safeValue("phoneInput"),
      status:       "pending",
      createdAt:    new Date().toISOString(),
      customerId:   "public",
    };

    if (window.dataSdk?.create) {
      const result = await window.dataSdk.create(booking);
      if (!result.isOk) {
        showError("Failed to book appointment. Please try again.");
      } else {
        await sendBookingConfirmationEmail(booking);
        showSuccess("Appointment booked successfully! You will receive a confirmation email shortly.");
      }
    } else {
      demoCreate(booking);
      await sendBookingConfirmationEmail(booking);
      showSuccess("Appointment booked successfully! You will receive a confirmation email shortly.");
      updateTimeSlots();
    }

    const form = byId("bookingForm");
    if (form) form.reset();
    selectedTime = null;

    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Book Appointment"; }

    setMinDate();
  }

  function onPublicServiceChange() {
    const svc    = safeValue("serviceSelect");
    const group  = byId("procedureGroupPublic");
    const select = byId("procedureSelectPublic");

    if (!group || !select) return;

    if (!svc) {
      group.style.display = "none";
      select.innerHTML = '<option value="">Choose a procedure...</option>';
      return;
    }

    const list = procedures[svc] || [];
    select.innerHTML = ['<option value="">Choose a procedure...</option>']
      .concat(list.map((p) => `<option value="${p}">${p}</option>`))
      .join("");
    group.style.display = "block";
  }

  // ---------------------------
  // Promo popup
  // ---------------------------
  function showPromo() {
    const popup = byId("promoPopup");
    if (popup) popup.classList.add("active");
  }

  function closePromo() {
    const popup = byId("promoPopup");
    if (popup) popup.classList.remove("active");
  }

  // ---------------------------
  // Admin dashboard
  // ---------------------------
  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      const label = btn.textContent.trim().toLowerCase();
      const isActive =
        (tab === "pending"   && label === "pending") ||
        (tab === "confirmed" && (label === "approved" || label === "confirmed")) ||
        (tab === "all"       && label.includes("all"));
      btn.classList.toggle("active", !!isActive);
    });
    renderBookingsList();
  }

  function renderBookingsList() {
    const container = byId("bookingsList");
    if (!container) return;

    let list = currentBookings.slice();
    if (currentTab === "pending")   list = list.filter((b) => b.status === "pending");
    if (currentTab === "confirmed") list = list.filter((b) => b.status === "confirmed");
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (list.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No bookings found</p></div>';
      return;
    }

    container.innerHTML = "";

    list.forEach((booking) => {
      const item = document.createElement("div");
      item.className = `booking-item ${booking.status}`;

      const id           = getBackendId(booking);
      const customerName = booking.patientName ||
        currentCustomers.find((c) => c.id === booking.customerId)?.name || "N/A";

      item.innerHTML = `
        <div class="booking-header">
          <div class="booking-info">
            <h3>${customerName}</h3>
            <p><strong>Service:</strong> ${booking.service ? booking.service.charAt(0).toUpperCase() + booking.service.slice(1) : "N/A"}</p>
            ${booking.procedure ? `<p><strong>Procedure:</strong> ${booking.procedure}</p>` : ""}
            <p><strong>Date:</strong> ${booking.date} at ${booking.time}</p>
            <p><strong>Contact:</strong> ${booking.patientEmail || "N/A"} | ${booking.patientPhone || "N/A"}</p>
            <span class="status-badge ${booking.status}">${booking.status}</span>
          </div>
          <div class="booking-actions">
            ${booking.status === "pending" ? `
              <button class="btn btn-success" onclick="updateBookingStatus('${id}', 'confirmed')">Confirm</button>
              <button class="btn btn-danger"  onclick="updateBookingStatus('${id}', 'rejected')">Reject</button>
            ` : ""}
            <button class="btn btn-danger" onclick="deleteBooking('${id}')">Delete</button>
          </div>
        </div>`;

      container.appendChild(item);
    });
  }

  async function updateBookingStatus(backendId, newStatus) {
    const booking = currentBookings.find((b) => getBackendId(b) === backendId);
    if (!booking) return;

    const updatedBooking = { ...booking, status: newStatus };

    if (window.dataSdk?.update) {
      const result = await window.dataSdk.update(updatedBooking);
      if (!result.isOk) return showError("Failed to update booking status");
    } else {
      demoUpdate(updatedBooking);
    }

    renderBookingsList();
    updateAdminStats();
    updateTimeSlots();
    updateCustomerTimeSlots();
  }

  async function deleteBooking(backendId) {
    const booking = currentBookings.find((b) => getBackendId(b) === backendId);
    if (!booking) return;
    if (!confirm("Are you sure you want to delete this booking permanently?")) return;

    if (window.dataSdk?.delete) {
      const result = await window.dataSdk.delete(booking);
      if (!result.isOk) return showError("Failed to delete booking");
    } else {
      demoDelete(booking);
    }

    renderBookingsList();
    updateAdminStats();
    updateTimeSlots();
    updateCustomerTimeSlots();
  }

  function updateAdminStats() {
    const pending        = currentBookings.filter((b) => b.status === "pending").length;
    const approved       = currentBookings.filter((b) => b.status === "confirmed").length;
    const totalCustomers = currentCustomers.length;

    setText("pendingCount", String(pending));
    setText("approvedCount", String(approved));
    setText("totalCount", String(totalCustomers));
  }

  // ---------------------------
  // Customer dashboard
  // ---------------------------
  function showBookingForm() {
    const dashboard   = byId("customerDashboard");
    const bookingForm = byId("customerBookingForm");
    if (dashboard)   dashboard.style.display   = "none";
    if (bookingForm) bookingForm.style.display = "block";

    // Reset form state
    editingCustomerBookingId = null;
    customerSelectedTime     = null;
    const form = byId("customerBookingFormEl");
    if (form) form.reset();
    const submitBtn = byId("customerSubmitBtn");
    if (submitBtn) submitBtn.textContent = "Book Appointment";
    updateCustomerTimeSlots();
  }

  function showCustomerDashboard() {
    const dashboard   = byId("customerDashboard");
    const bookingForm = byId("customerBookingForm");
    if (bookingForm) bookingForm.style.display = "none";
    if (dashboard)   dashboard.style.display   = "block";

    editingCustomerBookingId = null;
    customerSelectedTime     = null;
    renderCustomerBookings();
  }

  function renderCustomerBookings() {
    const list = byId("customerBookingsList");
    if (!list) return;

    if (!currentCustomer) {
      list.innerHTML = '<div class="empty-state"><p>Error: Customer not logged in.</p></div>';
      return;
    }

    const myBookings = currentBookings
      .filter((b) => b.customerId === currentCustomer.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (myBookings.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>No bookings yet. Click "Book New Appointment" to get started.</p></div>';
      return;
    }

    list.innerHTML = "";
    myBookings.forEach((booking) => {
      const id             = getBackendId(booking);
      const canEditOrDelete = booking.status === "pending" || booking.status === "confirmed";

      const item = document.createElement("div");
      item.className = `booking-item ${booking.status}`;
      item.innerHTML = `
        <div class="booking-header">
          <div class="booking-info">
            <h3>${booking.service ? booking.service.charAt(0).toUpperCase() + booking.service.slice(1) : "Service"}</h3>
            <p><strong>Date:</strong> ${booking.date} at ${booking.time}</p>
            ${booking.procedure ? `<p><strong>Procedure:</strong> ${booking.procedure}</p>` : ""}
            <span class="status-badge ${booking.status}">${booking.status}</span>
          </div>
          <div class="booking-actions">
            ${canEditOrDelete ? `
              <button class="btn btn-primary"   onclick="editCustomerBooking('${id}')">Edit</button>
              <button class="btn btn-secondary" onclick="deleteCustomerBookingForCustomer('${id}')">Delete</button>
            ` : ""}
          </div>
        </div>`;

      list.appendChild(item);
    });
  }

  function onCustomerServiceChange() {
    const svc    = safeValue("customerServiceSelect");
    const group  = byId("procedureGroup");
    const select = byId("customerProcedureSelect");

    if (!group || !select) return;

    if (!svc) {
      group.style.display = "none";
      select.innerHTML = '<option value="">Choose a procedure...</option>';
      return;
    }

    const list = procedures[svc] || [];
    select.innerHTML = ['<option value="">Choose a procedure...</option>']
      .concat(list.map((p) => `<option value="${p}">${p}</option>`))
      .join("");
    group.style.display = "block";
  }

  function updateCustomerTimeSlots() {
    const container = byId("customerTimeSlots");
    if (!container) return;

    const selectedDate    = safeValue("customerDateInput");
    const selectedService = safeValue("customerServiceSelect");

    if (!selectedDate || !selectedService) {
      container.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">Please select a service and date first</p>';
      return;
    }

    container.innerHTML = "";

    const bookedSlots = currentBookings
      .filter((b) =>
        b.date === selectedDate &&
        b.service === selectedService &&
        b.status !== "rejected" &&
        getBackendId(b) !== editingCustomerBookingId
      )
      .map((b) => b.time);

    timeSlots.forEach((time) => {
      const slot = document.createElement("div");
      slot.className = "time-slot";
      slot.textContent = time;

      if (bookedSlots.includes(time)) {
        slot.classList.add("booked");
      } else {
        slot.addEventListener("click", () => {
          document.querySelectorAll("#customerTimeSlots .time-slot").forEach((s) => s.classList.remove("selected"));
          slot.classList.add("selected");
          customerSelectedTime = time;
        });
      }

      if (customerSelectedTime === time && !bookedSlots.includes(time)) {
        slot.classList.add("selected");
      }

      container.appendChild(slot);
    });
  }

  function editCustomerBooking(backendId) {
    const booking = currentBookings.find((b) => getBackendId(b) === backendId);
    if (!booking) return;

    editingCustomerBookingId = backendId;
    showBookingForm();

    const serviceSelect   = byId("customerServiceSelect");
    const procedureSelect = byId("customerProcedureSelect");
    const dateInput       = byId("customerDateInput");

    if (serviceSelect) { serviceSelect.value = booking.service || ""; onCustomerServiceChange(); }
    if (procedureSelect) procedureSelect.value = booking.procedure || "";
    if (dateInput) dateInput.value = booking.date || "";

    customerSelectedTime = booking.time || null;
    updateCustomerTimeSlots();

    const submitBtn = byId("customerSubmitBtn");
    if (submitBtn) submitBtn.textContent = "Update Appointment";
  }

  async function deleteCustomerBookingForCustomer(backendId) {
    const booking = currentBookings.find((b) => getBackendId(b) === backendId);
    if (!booking || !currentCustomer || booking.customerId !== currentCustomer.id) return;
    if (!confirm("Are you sure you want to delete this appointment?")) return;

    if (window.dataSdk?.delete) {
      const result = await window.dataSdk.delete(booking);
      if (!result.isOk) return showError("Failed to delete booking", "customerErrorMessage");
    } else {
      demoDelete(booking);
    }

    renderCustomerBookings();
    updateCustomerTimeSlots();
  }

  async function handleCustomerBookingSubmit(e) {
    e.preventDefault();

    const submitBtn    = byId("customerSubmitBtn");
    const originalText = submitBtn ? submitBtn.textContent : "Book Appointment";

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Saving..."; }

    if (!customerSelectedTime) {
      showError("Please select a time slot", "customerErrorMessage");
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
      return;
    }

    const base = {
      service:   safeValue("customerServiceSelect"),
      procedure: safeValue("customerProcedureSelect") || "",
      date:      safeValue("customerDateInput"),
      time:      customerSelectedTime,
    };

    if (editingCustomerBookingId) {
      const existing = currentBookings.find((b) => getBackendId(b) === editingCustomerBookingId);
      if (!existing) {
        showError("Could not find booking to edit.", "customerErrorMessage");
      } else {
        const updatedBooking = { ...existing, ...base, status: "pending" };
        if (window.dataSdk?.update) {
          const result = await window.dataSdk.update(updatedBooking);
          if (!result.isOk) showError("Failed to update appointment.", "customerErrorMessage");
        } else {
          demoUpdate(updatedBooking);
        }
        showSuccess("Appointment updated! Awaiting admin approval.", "customerSuccessMessage");
      }
    } else {
      const newBooking = {
        id:          Date.now().toString(),
        type:        "booking",
        ...base,
        status:      "pending",
        createdAt:   new Date().toISOString(),
        customerId:  currentCustomer.id,
        patientName: currentCustomer.name,
        patientEmail: currentCustomer.email,
        patientPhone: currentCustomer.phone || "",
      };

      if (window.dataSdk?.create) {
        const result = await window.dataSdk.create(newBooking);
        if (!result.isOk) showError("Failed to book appointment.", "customerErrorMessage");
      } else {
        demoCreate(newBooking);
      }

      await sendBookingConfirmationEmail(newBooking);
      showSuccess("Appointment booked! Awaiting admin approval.", "customerSuccessMessage");
    }

    editingCustomerBookingId = null;
    customerSelectedTime     = null;

    const form = byId("customerBookingFormEl");
    if (form) form.reset();

    // Go back to dashboard after a short delay so user sees the success message
    setTimeout(showCustomerDashboard, 1500);

    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Book Appointment"; }
  }

  // ---------------------------
  // Auth
  // ---------------------------
  function switchAuthTab(tab) {
    const login = byId("customerLogin");
    const reg   = byId("customerRegister");
    const tabs  = document.querySelectorAll("#customerAuth .nav-tab");

    tabs.forEach((t) => t.classList.remove("active"));

    if (tab === "login") {
      if (login) login.style.display = "block";
      if (reg)   reg.style.display   = "none";
      if (tabs[0]) tabs[0].classList.add("active");
    } else {
      if (login) login.style.display = "none";
      if (reg)   reg.style.display   = "block";
      if (tabs[1]) tabs[1].classList.add("active");
    }
  }

  async function handleCustomerRegister(e) {
    e.preventDefault();

    const name     = safeValue("registerName").trim();
    const email    = safeValue("registerEmail").trim().toLowerCase();
    const phone    = safeValue("registerPhone").trim();
    const password = safeValue("registerPassword");

    if (!name || !email || !password) {
      showError("Please fill in name, email, and password.", "customerRegisterError");
      return;
    }

    if (currentCustomers.some((c) => (c.email || "").toLowerCase() === email)) {
      showError("An account with this email already exists.", "customerRegisterError");
      return;
    }

    const customer = {
      id: Date.now().toString(),
      type: "customer",
      name, email, phone, password,
    };

    if (window.dataSdk?.create) {
      const result = await window.dataSdk.create(customer);
      if (!result.isOk) {
        showError("Failed to create account. Please try again.", "customerRegisterError");
        return;
      }
    } else {
      demoCreate(customer);
    }

    showSuccess("Account created! You can log in now.", "customerRegisterSuccess");
    const regForm = byId("customerRegisterForm");
    if (regForm) regForm.reset();
    switchAuthTab("login");
  }

  function handleCustomerLogin(e) {
    e.preventDefault();

    const email    = safeValue("customerEmail").trim().toLowerCase();
    const password = safeValue("customerPassword");

    const customer = currentCustomers.find(
      (c) => (c.email || "").toLowerCase() === email && c.password === password
    );

    if (!customer) {
      showError("Invalid email or password.", "customerLoginError");
      return;
    }

    setSession({ role: "customer", customerId: customer.id, createdAt: Date.now() });
    goTo("./customer.html");
  }

  // ONE handleAdminLogin — no duplicate
  function handleAdminLogin(e) {
    e.preventDefault();

    const username = safeValue("adminUsername").trim();
    const password = safeValue("adminPassword");

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      setSession({ role: "admin", createdAt: Date.now() });
      goTo("./admin.html");
      return;
    }

    const loginError = byId("loginError");
    if (loginError) {
      loginError.textContent = "Invalid credentials.";
      loginError.classList.add("active");
      setTimeout(() => loginError.classList.remove("active"), 5000);
    }
  }

  function logoutToIndex() {
    clearSession();
    goTo("./index.html");
  }

  // ---------------------------
  // Expose to HTML inline handlers
  // ---------------------------
  window.closePromo  = closePromo;
  window.showPromo   = showPromo;

  window.switchAuthTab = switchAuthTab;

  window.switchTab            = switchTab;
  window.updateBookingStatus  = updateBookingStatus;
  window.deleteBooking        = deleteBooking;

  window.showBookingForm        = showBookingForm;
  window.showCustomerDashboard  = showCustomerDashboard;
  window.editCustomerBooking               = editCustomerBooking;
  window.deleteCustomerBookingForCustomer  = deleteCustomerBookingForCustomer;

  window.logout         = logoutToIndex;
  window.customerLogout = logoutToIndex;

  document.addEventListener("DOMContentLoaded", initializeApp);
})();
