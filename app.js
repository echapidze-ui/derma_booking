/* Application logic for Medical Facility Booking - Corrected Version */

(() => {
  // --- Configuration & Static Data ---
  const defaultConfig = {
    clinic_name: "Medical Facility",
    clinic_tagline: "Your health, our priority",
    booking_title: "Book Your Appointment",
    service_label: "Select Service",
    promo_title: "Special Offer!",
    promo_message:
      "20% off dermatology consultations this month! Book now and take care of your skin with our expert team.",
  };

  // WARNING: This is a highly insecure way to handle credentials, used here ONLY for a client-side DEMO.
  // In production, authentication MUST be handled server-side.
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
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
    "15:00", "15:30", "16:00", "16:30", "17:00",
  ];

  // --- Global State ---
  let currentBookings = [];
  let currentCustomers = [];
  let selectedTime = null; // Public booking time
  let customerSelectedTime = null; // Customer booking time
  let editingCustomerBookingId = null;
  let currentTab = "pending"; // 'pending' | 'confirmed' | 'all'
  let isLoggedIn = false; // Admin status
  let isCustomerLoggedIn = false;
  let currentCustomer = null;

  // --- Helper Functions ---
  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, val) {
    const el = byId(id);
    if (el) el.textContent = val;
  }

  function toggleSection(id, show) {
    const el = byId(id);
    if (!el) return;
    el.style.display = show ? "block" : "none";
  }

  function showSuccess(message, elementId = "successMessage") {
    const successMsg = byId(elementId);
    if (!successMsg) return;
    successMsg.textContent = message;
    successMsg.classList.add("active");
    setTimeout(() => successMsg.classList.remove("active"), 5000);
  }

  function showError(message, elementId = "errorMessage") {
    const errorMsg = byId(elementId);
    if (!errorMsg) return;
    errorMsg.textContent = message;
    errorMsg.classList.add("active");
    setTimeout(() => errorMsg.classList.remove("active"), 5000);
  }


  // --- SDK and Initialization ---

  const dataHandler = {
    onDataChanged(data) {
      currentBookings = data.filter((item) => item.type === "booking" || !item.type);
      currentCustomers = data.filter((item) => item.type === "customer");
      updateTimeSlots();
      updateCustomerTimeSlots();
      if (isLoggedIn) {
        renderBookingsList();
        updateAdminStats();
      }
      if (isCustomerLoggedIn) {
        renderCustomerBookings();
      }
    },
  };

  async function initializeApp() {
    if (!window.dataSdk || !window.elementSdk) {
      console.warn("SDKs not found. Running in demo mode.");
    }

    const initResult = window.dataSdk ? await window.dataSdk.init(dataHandler) : { isOk: false };
    if (!initResult.isOk) {
      console.error("Failed to initialize data SDK (running in demo mode).");
    }

    if (window.elementSdk) {
      await window.elementSdk.init({
        defaultConfig,
        onConfigChange: async (config) => {
          byId("clinicName").textContent = config.clinic_name || defaultConfig.clinic_name;
          byId("clinicTagline").textContent = config.clinic_tagline || defaultConfig.clinic_tagline;
          byId("bookingTitle").textContent = config.booking_title || defaultConfig.booking_title;
          byId("serviceLabel").textContent = config.service_label || defaultConfig.service_label;
          byId("promoTitle").textContent = config.promo_title || defaultConfig.promo_title;
          byId("promoMessage").textContent = config.promo_message || defaultConfig.promo_message;
        },
        mapToCapabilities: (config) => ({
          recolorables: [
            { get: () => config.background_color || "#667eea",
              set: (v) => { window.elementSdk.config.background_color = v; window.elementSdk.setConfig({ background_color: v }); } },
            { get: () => config.card_background || "#ffffff",
              set: (v) => { window.elementSdk.config.card_background = v; window.elementSdk.setConfig({ card_background: v }); } },
            { get: () => config.text_color || "#333333",
              set: (v) => { window.elementSdk.config.text_color = v; window.elementSdk.setConfig({ text_color: v }); } },
            { get: () => config.primary_button || "#667eea",
              set: (v) => { window.elementSdk.config.primary_button = v; window.elementSdk.setConfig({ primary_button: v }); } },
            { get: () => config.accent_color || "#764ba2",
              set: (v) => { window.elementSdk.config.accent_color = v; window.elementSdk.setConfig({ accent_color: v }); } },
          ],
          borderables: [],
          fontEditable: undefined,
          fontSizeable: undefined,
        }),
        mapToEditPanelValues: (config) =>
          new Map([
            ["clinic_name", config.clinic_name || defaultConfig.clinic_name],
            ["clinic_tagline", config.clinic_tagline || defaultConfig.clinic_tagline],
            ["booking_title", config.booking_title || defaultConfig.booking_title],
            ["service_label", config.service_label || defaultConfig.service_label],
            ["promo_title", config.promo_title || defaultConfig.promo_title],
            ["promo_message", config.promo_message || defaultConfig.promo_message],
          ]),
      });
    }

    setupEventListeners();
    setMinDate();

    setTimeout(showPromo, 3000);
  }

  function setupEventListeners() {
    const bookingForm = byId("bookingForm");
    if (bookingForm) bookingForm.addEventListener("submit", handleBookingSubmit);

    const loginForm = byId("loginForm");
    if (loginForm) loginForm.addEventListener("submit", handleLogin);

    const dateInput = byId("dateInput");
    if (dateInput) dateInput.addEventListener("change", updateTimeSlots);

    const serviceSelect = byId("serviceSelect");
    if (serviceSelect) {
      serviceSelect.addEventListener("change", () => {
        onPublicServiceChange();
        updateTimeSlots();
      });
    }

    const customerBookingFormEl = byId("customerBookingFormEl");
    if (customerBookingFormEl) {
      customerBookingFormEl.addEventListener("submit", handleCustomerBookingSubmit);
    }

    const customerLoginForm = byId("customerLoginForm");
    if (customerLoginForm) customerLoginForm.addEventListener("submit", handleCustomerLogin);

    const customerRegisterForm = byId("customerRegisterForm");
    if (customerRegisterForm) customerRegisterForm.addEventListener("submit", handleCustomerRegister);

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
      dateInput.value = today;
    }

    const customerDateInput = byId("customerDateInput");
    if (customerDateInput) {
      customerDateInput.setAttribute("min", today);
      customerDateInput.value = today;
    }

    // Call updates only if a date was just set/changed
    if (dateInput) updateTimeSlots();
    if (customerDateInput) updateCustomerTimeSlots();
  }


  // --- Public Booking Logic ---

  function updateTimeSlots() {
    const container = byId("timeSlots");
    if (!container) return;

    const selectedDate = (byId("dateInput") || {}).value;
    const selectedService = (byId("serviceSelect") || {}).value;

    if (!selectedDate || !selectedService) {
      container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">Please select a service and date first</p>';
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
    document.querySelectorAll("#timeSlots .time-slot").forEach((slot) => slot.classList.remove("selected"));
    element.classList.add("selected");
    selectedTime = time;
  }

  async function handleBookingSubmit(e) {
    e.preventDefault();

    if (!selectedTime) {
      showError("Please select a time slot");
      return;
    }

    const submitBtn = byId("submitBtn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Booking...";
    }

    const booking = {
      id: Date.now().toString(),
      type: "booking",
      service: byId("serviceSelect").value,
      procedure: (byId("procedureSelectPublic") || {}).value || "",
      date: byId("dateInput").value,
      time: selectedTime,
      patientName: byId("nameInput").value,
      patientEmail: byId("emailInput").value,
      patientPhone: byId("phoneInput").value,
      status: "pending",
      createdAt: new Date().toISOString(),
      customerId: "public", // Mark as a public (unregistered) booking
    };

    let result = { isOk: false };
    if (window.dataSdk?.create) {
      result = await window.dataSdk.create(booking);
    } else {
      // Demo mode
      currentBookings.push({ ...booking, __backendId: booking.id });
      result.isOk = true;
    }

    if (result.isOk) {
      showSuccess("Appointment booked successfully! You will receive a confirmation email shortly.");
      const form = byId("bookingForm");
      if (form) form.reset();
      selectedTime = null;
      setMinDate();
    } else {
      showError("Failed to book appointment. Please try again.");
    }

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Book Appointment";
    }
  }

  function onPublicServiceChange() {
    const svc = (byId("serviceSelect") || {}).value;
    const group = byId("procedureGroupPublic");
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


  // --- Promo Popup ---

  function showPromo() {
    const popup = byId("promoPopup");
    if (popup) popup.classList.add("active");
  }

  function closePromo() {
    const popup = byId("promoPopup");
    if (popup) popup.classList.remove("active");
  }


  // --- Admin Logic ---

  function showAdminLogin() {
    toggleSection("publicView", false);
    toggleSection("adminLogin", true);
    toggleSection("adminDashboard", false);
    toggleSection("customerAuth", false);
    toggleSection("customerDashboard", false);
  }

  function showPublicView() {
    toggleSection("publicView", true);
    toggleSection("adminLogin", false);
    toggleSection("adminDashboard", false);
    toggleSection("customerAuth", false);
    toggleSection("customerDashboard", false);
    toggleSection("customerBookingForm", false);
    isLoggedIn = false;
    isCustomerLoggedIn = false;
    currentCustomer = null;
    editingCustomerBookingId = null;
  }

  function handleLogin(e) {
    e.preventDefault();
    const username = byId("adminUsername").value.trim();
    const password = byId("adminPassword").value;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      isLoggedIn = true;
      toggleSection("publicView", false);
      toggleSection("adminLogin", false);
      toggleSection("adminDashboard", true);
      renderBookingsList();
      updateAdminStats();
    } else {
      const loginError = byId("loginError");
      if (loginError) {
        // Only give a generic error in a real app. Providing credentials is a demo-only shortcut.
        loginError.textContent = "Invalid credentials. (Demo hint: Mary.mary@clinic.com / Dermadent123)";
        loginError.classList.add("active");
        setTimeout(() => loginError.classList.remove("active"), 5000);
      }
    }
  }

  function logout() {
    showPublicView();
    const form = byId("loginForm");
    if (form) form.reset();
  }

  function switchTab(tab) {
    currentTab = tab;
    // Update tab button active state
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      const label = btn.textContent.trim().toLowerCase();
      const isActive =
        (tab === "pending" && label === "pending") ||
        (tab === "confirmed" && label === "approved") ||
        (tab === "all" && label.includes("all"));
      btn.classList.toggle("active", !!isActive);
    });
    renderBookingsList();
  }

  function renderBookingsList() {
    const container = byId("bookingsList");
    if (!container) return;

    let filteredBookings = currentBookings;
    if (currentTab === "pending") {
      filteredBookings = currentBookings.filter((b) => b.status === "pending");
    } else if (currentTab === "confirmed") {
      filteredBookings = currentBookings.filter((b) => b.status === "confirmed");
    }

    filteredBookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (filteredBookings.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No bookings found</p></div>';
      return;
    }

    container.innerHTML = "";
    filteredBookings.forEach((booking) => {
      const item = document.createElement("div");
      item.className = `booking-item ${booking.status}`;

      // Use the __backendId for all administrative actions
      const id = booking.__backendId || booking.id;

      item.innerHTML = `
        <div class="booking-header">
          <div class="booking-info">
            <h3>${booking.patientName || currentCustomers.find(c => c.id === booking.customerId)?.name || 'N/A'}</h3>
            <p><strong>Service:</strong> ${booking.service.charAt(0).toUpperCase() + booking.service.slice(1)}</p>
            ${booking.procedure ? `<p><strong>Procedure:</strong> ${booking.procedure}</p>` : ''}
            <p><strong>Date:</strong> ${booking.date} at ${booking.time}</p>
            <p><strong>Contact:</strong> ${booking.patientEmail || 'N/A'} | ${booking.patientPhone || 'N/A'}</p>
            <span class="status-badge ${booking.status}">${booking.status}</span>
          </div>
          <div class="booking-actions">
            ${
              booking.status === "pending"
                ? `
                  <button class="btn btn-success" onclick="updateBookingStatus('${id}', 'confirmed')">Confirm</button>
                  <button class="btn btn-danger" onclick="updateBookingStatus('${id}', 'rejected')">Reject</button>
                `
                : ""
            }
            <button class="btn btn-danger" onclick="deleteBooking('${id}')">Delete</button>
          </div>
        </div>
      `;

      container.appendChild(item);
    });
  }

  async function updateBookingStatus(backendId, newStatus) {
    const booking = currentBookings.find((b) => (b.__backendId || b.id) === backendId);
    if (!booking) return;

    const updatedBooking = { ...booking, status: newStatus };
    let result = { isOk: false };

    if (window.dataSdk?.update) {
      result = await window.dataSdk.update(updatedBooking);
    } else {
      // Demo mode
      const idx = currentBookings.findIndex((b) => (b.__backendId || b.id) === backendId);
      if (idx !== -1) currentBookings[idx] = updatedBooking;
      result.isOk = true;
    }

    if (result.isOk) {
      // Data SDK should call onDataChanged, but we manually refresh in demo/fallback mode
      if (!window.dataSdk) renderBookingsList();
    } else {
      showError("Failed to update booking status");
    }
  }

  async function deleteBooking(backendId) {
    const booking = currentBookings.find((b) => (b.__backendId || b.id) === backendId);
    if (!booking) return;

    if (!confirm("Are you sure you want to delete this booking permanently?")) return;

    let result = { isOk: false };

    if (window.dataSdk?.delete) {
      result = await window.dataSdk.delete(booking);
    } else {
      // Demo mode
      currentBookings = currentBookings.filter((b) => (b.__backendId || b.id) !== backendId);
      result.isOk = true;
    }

    if (result.isOk) {
      // Data SDK should call onDataChanged, but we manually refresh in demo/fallback mode
      if (!window.dataSdk) renderBookingsList();
    } else {
      showError("Failed to delete booking");
    }
  }

  function updateAdminStats() {
    const pending = currentBookings.filter((b) => b.status === "pending").length;
    const approved = currentBookings.filter((b) => b.status === "confirmed").length;
    const totalCustomers = currentCustomers.length;

    setText("pendingCount", String(pending));
    setText("approvedCount", String(approved));
    setText("totalCount", String(totalCustomers));
  }


  // --- Customer Flows ---

  window.showCustomerAuth = function showCustomerAuth() {
    toggleSection("publicView", false);
    toggleSection("adminLogin", false);
    toggleSection("customerAuth", true);
    // Ensure login is the default tab
    window.switchAuthTab("login");
  };

  window.switchAuthTab = function switchAuthTab(tab) {
    const login = byId("customerLogin");
    const reg = byId("customerRegister");
    const tabs = document.querySelectorAll("#customerAuth .nav-tab");
    tabs.forEach((t) => t.classList.remove("active"));
    if (tab === "login") {
      login && (login.style.display = "block");
      reg && (reg.style.display = "none");
      tabs[0] && tabs[0].classList.add("active");
    } else {
      login && (login.style.display = "none");
      reg && (reg.style.display = "block");
      tabs[1] && tabs[1].classList.add("active");
    }
  };

  window.showCustomerDashboard = function showCustomerDashboard() {
    toggleSection("customerAuth", false);
    toggleSection("customerBookingForm", false);
    toggleSection("customerDashboard", true);
    editingCustomerBookingId = null;
    customerSelectedTime = null;
    updateCustomerTimeSlots(); // ensure time slots are current
  };

  window.showBookingForm = function showBookingForm() {
    toggleSection("customerDashboard", false);
    toggleSection("customerBookingForm", true);
    editingCustomerBookingId = null; // Clear edit state for new booking
    customerSelectedTime = null;
    updateCustomerTimeSlots();
    // Clear form fields
    const form = byId("customerBookingFormEl");
    if (form) form.reset();
    onCustomerServiceChange(); // Reset procedure dropdown
  };

  window.customerLogout = function customerLogout() {
    showPublicView();
  };

  function renderCustomerBookings() {
    const list = byId("customerBookingsList");
    if (!list) return;

    if (!currentCustomer) {
      list.innerHTML = '<div class="empty-state"><p>Error: Customer not logged in.</p></div>';
      return;
    }

    const myBookings = currentBookings.filter(
      (b) => b.customerId === currentCustomer.id
    );

    if (myBookings.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>No bookings yet</p></div>';
      return;
    }

    list.innerHTML = "";
    myBookings.forEach((booking) => {
      const id = booking.__backendId || booking.id;
      const item = document.createElement("div");
      item.className = `booking-item ${booking.status}`;
      item.innerHTML = `
        <div class="booking-header">
          <div class="booking-info">
            <h3>${booking.service.charAt(0).toUpperCase() + booking.service.slice(1)}</h3>
            <p><strong>Date:</strong> ${booking.date} at ${booking.time}</p>
            ${
              booking.procedure
                ? `<p><strong>Procedure:</strong> ${booking.procedure}</p>`
                : ""
            }
            <span class="status-badge ${booking.status}">${booking.status}</span>
          </div>
          <div class="booking-actions">
            ${
              // Only allow editing/deleting pending or confirmed appointments
              (booking.status === "pending" || booking.status === "confirmed")
                ? `
                  <button class="btn btn-primary" onclick="editCustomerBooking('${id}')">Edit</button>
                  <button class="btn btn-secondary" onclick="deleteCustomerBookingForCustomer('${id}')">Delete</button>
                `
                : ''
            }
          </div>
        </div>
      `;
      list.appendChild(item);
    });
  }

  function editCustomerBooking(backendId) {
    const booking = currentBookings.find((b) => (b.__backendId || b.id) === backendId);
    if (!booking) return;

    editingCustomerBookingId = backendId;

    // Show booking form, hide dashboard
    toggleSection("customerDashboard", false);
    toggleSection("customerBookingForm", true);

    const serviceSelect = byId("customerServiceSelect");
    const procedureSelect = byId("customerProcedureSelect");
    const dateInput = byId("customerDateInput");

    if (serviceSelect) {
      serviceSelect.value = booking.service;
      onCustomerServiceChange(); // populate procedure options
    }

    if (procedureSelect && booking.procedure) {
      procedureSelect.value = booking.procedure;
    }

    if (dateInput) {
      dateInput.value = booking.date;
    }

    customerSelectedTime = booking.time;
    updateCustomerTimeSlots();

    // Update the button text to indicate editing
    const submitBtn = byId("customerSubmitBtn");
    if(submitBtn) submitBtn.textContent = "Update Appointment";
  }

  async function deleteCustomerBookingForCustomer(backendId) {
    const booking = currentBookings.find((b) => (b.__backendId || b.id) === backendId);
    if (!booking || !currentCustomer || booking.customerId !== currentCustomer.id) return;

    if (!confirm("Are you sure you want to delete this appointment?")) return;

    let result = { isOk: false };

    if (window.dataSdk?.delete) {
      result = await window.dataSdk.delete(booking);
    } else {
      // Demo mode
      currentBookings = currentBookings.filter((b) => (b.__backendId || b.id) !== backendId);
      result.isOk = true;
    }

    if (result.isOk) {
      // Data SDK should call onDataChanged, but we manually refresh in demo/fallback mode
      if (!window.dataSdk) renderCustomerBookings();
    } else {
      showError("Failed to delete booking", "customerErrorMessage");
    }
  }

  function onCustomerServiceChange() {
    const svc = (byId("customerServiceSelect") || {}).value;
    const group = byId("procedureGroup");
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

    const selectedDate = (byId("customerDateInput") || {}).value;
    const selectedService = (byId("customerServiceSelect") || {}).value;

    if (!selectedDate || !selectedService) {
      container.innerHTML =
        '<p style="color: #999; text-align: center; padding: 20px;">Please select a service and date first</p>';
      return;
    }

    container.innerHTML = "";

    const bookedSlots = currentBookings
      .filter(
        (b) =>
          b.date === selectedDate &&
          b.service === selectedService &&
          b.status !== "rejected" &&
          (b.__backendId || b.id) !== editingCustomerBookingId // ignore the one we are editing
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

  async function handleCustomerBookingSubmit(e) {
    e.preventDefault();

    const submitBtn = byId("customerSubmitBtn");
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;

    if (!customerSelectedTime) {
      showError("Please select a time slot", "customerErrorMessage");
      submitBtn.disabled = false;
      return;
    }

    const isEditing = !!editingCustomerBookingId;

    const base = {
      service: byId("customerServiceSelect").value,
      procedure: (byId("customerProcedureSelect") || {}).value || "",
      date: byId("customerDateInput").value,
      time: customerSelectedTime,
    };

    let result = { isOk: false };

    if (isEditing) {
      // Logic for UPDATING an existing booking
      const existingBooking = currentBookings.find(
        (b) => (b.__backendId || b.id) === editingCustomerBookingId
      );

      if (existingBooking) {
        const updatedBooking = {
          ...existingBooking,
          ...base,
          // When editing, status remains the same unless explicitly changed, but often resets to pending
          status: "pending",
        };

        if (window.dataSdk?.update) {
          result = await window.dataSdk.update(updatedBooking);
        } else {
          // Demo mode
          const idx = currentBookings.findIndex((b) => (b.__backendId || b.id) === editingCustomerBookingId);
          if (idx !== -1) currentBookings[idx] = updatedBooking;
          result.isOk = true;
        }
      }
    } else {
      // Logic for CREATING a new booking
      const newBooking = {
        id: Date.now().toString(),
        type: "booking",
        ...base,
        status: "pending",
        createdAt: new Date().toISOString(),
        customerId: currentCustomer ? currentCustomer.id : "guest",
        patientName: currentCustomer ? currentCustomer.name : "Customer",
        patientEmail: currentCustomer ? currentCustomer.email : "n/a",
        patientPhone: currentCustomer ? currentCustomer.phone : "n/a",
      };

      if (window.dataSdk?.create) {
        result = await window.dataSdk.create(newBooking);
      } else {
        // Demo mode
        currentBookings.push({ ...newBooking, __backendId: newBooking.id });
        result.isOk = true;
      }
    }

    // Handle result
    if (result.isOk) {
      editingCustomerBookingId = null;
      customerSelectedTime = null;

      showSuccess(
        isEditing
          ? "Appointment updated successfully. Awaiting admin approval."
          : "Appointment booked successfully! Awaiting admin approval.",
        "customerSuccessMessage"
      );

      // Reset form, button, and view
      const form = byId("customerBookingFormEl");
      if (form) form.reset();

      // Go back to dashboard and refresh list
      window.showCustomerDashboard();
    } else {
      showError("Something went wrong. Please try again.", "customerErrorMessage");
    }

    submitBtn.disabled = false;
    submitBtn.textContent = isEditing ? "Update Appointment" : originalText;
  }

  // NOTE: The previous code had a large block of duplicated logic for creating a new booking
  // after the main `if (isEditing) / else` block. This has been removed to fix the logic error.


  async function handleCustomerRegister(e) {
    e.preventDefault();

    const name = byId("registerName").value.trim();
    const email = byId("registerEmail").value.trim().toLowerCase();
    const phone = byId("registerPhone").value.trim();
    const password = byId("registerPassword").value; // WARNING: Unhashed

    if (!name || !email || !phone || !password) {
      showError("Please fill in all fields.", "customerRegisterError");
      return;
    }

    const exists = currentCustomers.some((c) => c.email === email);
    if (exists) {
      showError("An account with this email already exists.", "customerRegisterError");
      return;
    }

    const customer = {
      id: Date.now().toString(),
      type: "customer",
      name,
      email,
      phone,
      password, // demo only
    };

    let result = { isOk: false };
    if (window.dataSdk?.create) {
      result = await window.dataSdk.create(customer);
    } else {
      currentCustomers.push(customer);
      result.isOk = true;
    }

    if (result.isOk) {
      showSuccess("Account created! You can log in now.", "customerRegisterSuccess");

      // clear form
      const regForm = byId("customerRegisterForm");
      regForm && regForm.reset();

      // switch to login tab
      window.switchAuthTab("login");
    } else {
      showError("Failed to create account. Please try again.", "customerRegisterError");
    }
  }

  function handleCustomerLogin(e) {
    e.preventDefault();

    const email = byId("customerEmail").value.trim().toLowerCase();
    const password = byId("customerPassword").value;

    const customer = currentCustomers.find((c) => c.email === email && c.password === password);

    if (!customer) {
      showError("Invalid email or password.", "customerLoginError");
      return;
    }

    isCustomerLoggedIn = true;
    currentCustomer = customer;

    const welcome = byId("customerWelcome");
    if (welcome) welcome.textContent = `${customer.name}'s Appointments`;

    window.showCustomerDashboard();
    setMinDate();
  }


  // --- Global Exposures & App Start ---

  // Expose for inline onclick handlers in HTML
  window.closePromo = closePromo;
  window.showPromo = showPromo;
  window.showAdminLogin = showAdminLogin;
  window.showPublicView = showPublicView;
  window.updateBookingStatus = updateBookingStatus;
  window.deleteBooking = deleteBooking;
  window.switchTab = switchTab;
  window.logout = logout;
  window.editCustomerBooking = editCustomerBooking;
  window.deleteCustomerBookingForCustomer = deleteCustomerBookingForCustomer;

  // Kick off
  document.addEventListener("DOMContentLoaded", initializeApp);
})();