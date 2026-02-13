/* Medical Facility Booking — Multi-page (index/customer/admin) with localStorage persistence + email confirmation */

(() => {
  // ---------------------------
  // Config
  // ---------------------------
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
  // Helpers
  // ---------------------------
  const byId = (id) => document.getElementById(id);
  const exists = (id) => !!byId(id);

  function showMessage(type, msg, elementId) {
    const el = byId(elementId);
    if (!el) return;
    el.textContent = msg;
    el.classList.add("active");
    setTimeout(() => el.classList.remove("active"), 5000);
  }

  const showError = (msg, id) => showMessage("error", msg, id);
  const showSuccess = (msg, id) => showMessage("success", msg, id);

  function pageName() {
    const p = (location.pathname || "").toLowerCase();
    if (p.endsWith("/admin.html")) return "admin";
    if (p.endsWith("/customer.html")) return "customer";
    return "index";
  }

  function todayISO() {
    return new Date().toISOString().split("T")[0];
  }

  function uid() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  // ---------------------------
  // localStorage "DB"
  // ---------------------------
  const LS_KEYS = {
    customers: "derma_customers_v1",
    bookings: "derma_bookings_v1",
    sessionCustomerId: "derma_session_customer_id_v1",
    sessionAdmin: "derma_session_admin_v1",
  };

  function loadCustomers() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEYS.customers) || "[]");
    } catch {
      return [];
    }
  }

  function loadBookings() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEYS.bookings) || "[]");
    } catch {
      return [];
    }
  }

  function saveCustomers(customers) {
    localStorage.setItem(LS_KEYS.customers, JSON.stringify(customers));
  }

  function saveBookings(bookings) {
    localStorage.setItem(LS_KEYS.bookings, JSON.stringify(bookings));
  }

  function getCustomerSessionId() {
    return localStorage.getItem(LS_KEYS.sessionCustomerId);
  }

  function setCustomerSessionId(id) {
    localStorage.setItem(LS_KEYS.sessionCustomerId, id);
  }

  function clearCustomerSession() {
    localStorage.removeItem(LS_KEYS.sessionCustomerId);
  }

  function isAdminLoggedIn() {
    return localStorage.getItem(LS_KEYS.sessionAdmin) === "true";
  }

  function setAdminLoggedIn(val) {
    localStorage.setItem(LS_KEYS.sessionAdmin, val ? "true" : "false");
  }

  function clearAdminSession() {
    localStorage.removeItem(LS_KEYS.sessionAdmin);
  }

  // ---------------------------
  // Email confirmation via Netlify function
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
  // Booking conflict logic
  // ---------------------------
  function isSlotTaken(bookings, { date, service, time }, ignoreBookingId = null) {
    return bookings.some((b) => {
      const sameSlot =
        b.date === date &&
        b.service === service &&
        b.time === time &&
        b.status !== "rejected";

      const notIgnored = ignoreBookingId ? b.id !== ignoreBookingId : true;
      return sameSlot && notIgnored;
    });
  }

  // ---------------------------
  // INDEX page (Landing: customer auth + admin auth + guest booking)
  // ---------------------------
  function initIndexPage() {
    // Customer auth tab switcher
    window.switchAuthTab = function switchAuthTab(tab) {
      const login = byId("customerLogin");
      const reg = byId("customerRegister");
      const tabs = document.querySelectorAll("#customerAuth .nav-tab");
      tabs.forEach((t) => t.classList.remove("active"));

      if (tab === "register") {
        if (login) login.style.display = "none";
        if (reg) reg.style.display = "block";
        if (tabs[1]) tabs[1].classList.add("active");
      } else {
        if (login) login.style.display = "block";
        if (reg) reg.style.display = "none";
        if (tabs[0]) tabs[0].classList.add("active");
      }
    };

    // Promo popup handlers (optional)
    window.closePromo = function closePromo() {
      const popup = byId("promoPopup");
      if (popup) popup.classList.remove("active");
    };
    window.showPromo = function showPromo() {
      const popup = byId("promoPopup");
      if (popup) popup.classList.add("active");
    };
    setTimeout(() => window.showPromo && window.showPromo(), 3000);

    // Customer Register
    const regForm = byId("customerRegisterForm");
    if (regForm) {
      regForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const customers = loadCustomers();

        const name = (byId("registerName")?.value || "").trim();
        const email = (byId("registerEmail")?.value || "").trim().toLowerCase();
        const phone = (byId("registerPhone")?.value || "").trim();
        const password = byId("registerPassword")?.value || "";

        if (!name || !email || !password) {
          showError("Please fill in name, email, and password.", "customerRegisterError");
          return;
        }

        const exists = customers.some((c) => (c.email || "").toLowerCase() === email);
        if (exists) {
          showError("An account with this email already exists.", "customerRegisterError");
          return;
        }

        const customer = {
          id: uid(),
          name,
          email,
          phone,
          password, // demo only
          createdAt: new Date().toISOString(),
        };

        customers.push(customer);
        saveCustomers(customers);

        showSuccess("Account created! You can log in now.", "customerRegisterSuccess");
        regForm.reset();
        window.switchAuthTab("login");
      });
    }

    // Customer Login
    const loginForm = byId("customerLoginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const customers = loadCustomers();
        const email = (byId("customerEmail")?.value || "").trim().toLowerCase();
        const password = byId("customerPassword")?.value || "";

        const customer = customers.find(
          (c) => (c.email || "").toLowerCase() === email && c.password === password
        );

        if (!customer) {
          showError("Invalid email or password.", "customerLoginError");
          return;
        }

        setCustomerSessionId(customer.id);
        // redirect to dashboard page
        location.href = "./customer.html";
      });
    }

    // Admin Login (THIS fixes “button does nothing” by attaching listener on index page)
    const adminForm = byId("loginForm");
    if (adminForm) {
      adminForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const username = (byId("adminUsername")?.value || "").trim();
        const password = byId("adminPassword")?.value || "";

        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
          setAdminLoggedIn(true);
          location.href = "./admin.html";
          return;
        }

        showError("Invalid credentials. (Demo: Mary.mary@clinic.com / Dermadent123)", "loginError");
      });
    }

    // Guest booking toggle
    window.toggleGuestBooking = function toggleGuestBooking() {
      const sec = byId("guestBookingSection");
      if (!sec) return;
      const isHidden = sec.style.display === "none" || !sec.style.display;
      sec.style.display = isHidden ? "block" : "none";
    };

    // Guest booking logic
    let selectedTime = null;

    function setMinDate() {
      const dateInput = byId("dateInput");
      if (dateInput) {
        dateInput.min = todayISO();
        if (!dateInput.value) dateInput.value = todayISO();
      }
    }

    function onPublicServiceChange() {
      const svc = byId("serviceSelect")?.value || "";
      const group = byId("procedureGroupPublic");
      const select = byId("procedureSelectPublic");
      if (!group || !select) return;

      if (!svc) {
        group.style.display = "none";
        select.innerHTML = '<option value="">Choose a procedure...</option>';
        return;
      }

      const list = procedures[svc] || [];
      select.innerHTML =
        ['<option value="">Choose a procedure...</option>']
          .concat(list.map((p) => `<option value="${p}">${p}</option>`))
          .join("");

      group.style.display = "block";
    }

    function renderTimeSlots() {
      const container = byId("timeSlots");
      if (!container) return;

      const bookings = loadBookings();
      const date = byId("dateInput")?.value || "";
      const service = byId("serviceSelect")?.value || "";

      if (!date || !service) {
        container.innerHTML =
          '<p style="color:#999;text-align:center;padding:20px;">Please select a service and date first</p>';
        return;
      }

      container.innerHTML = "";
      const booked = bookings
        .filter((b) => b.date === date && b.service === service && b.status !== "rejected")
        .map((b) => b.time);

      timeSlots.forEach((t) => {
        const slot = document.createElement("div");
        slot.className = "time-slot";
        slot.textContent = t;

        if (booked.includes(t)) {
          slot.classList.add("booked");
        } else {
          slot.addEventListener("click", () => {
            document.querySelectorAll("#timeSlots .time-slot").forEach((s) => s.classList.remove("selected"));
            slot.classList.add("selected");
            selectedTime = t;
          });
        }

        if (selectedTime === t && !booked.includes(t)) slot.classList.add("selected");

        container.appendChild(slot);
      });
    }

    // Wire guest booking inputs if present
    setMinDate();

    if (exists("serviceSelect")) {
      byId("serviceSelect").addEventListener("change", () => {
        onPublicServiceChange();
        renderTimeSlots();
      });
    }
    if (exists("dateInput")) {
      byId("dateInput").addEventListener("change", renderTimeSlots);
    }

    // Guest booking submit
    const bookingForm = byId("bookingForm");
    if (bookingForm) {
      bookingForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!selectedTime) {
          showError("Please select a time slot", "errorMessage");
          return;
        }

        const bookings = loadBookings();
        const customers = loadCustomers(); // not required but fine

        const booking = {
          id: uid(),
          service: byId("serviceSelect")?.value || "",
          procedure: byId("procedureSelectPublic")?.value || "",
          date: byId("dateInput")?.value || "",
          time: selectedTime,
          patientName: (byId("nameInput")?.value || "").trim(),
          patientEmail: (byId("emailInput")?.value || "").trim(),
          patientPhone: (byId("phoneInput")?.value || "").trim(),
          status: "pending",
          createdAt: new Date().toISOString(),
          customerId: "public",
        };

        if (!booking.service || !booking.date || !booking.patientName || !booking.patientEmail) {
          showError("Please fill in service, date, name, and email.", "errorMessage");
          return;
        }

        if (isSlotTaken(bookings, booking)) {
          showError("That time slot is already booked. Please choose another.", "errorMessage");
          renderTimeSlots();
          return;
        }

        bookings.push(booking);
        saveBookings(bookings);

        // send email confirmation
        await sendBookingConfirmationEmail(booking);

        showSuccess("Booked! Confirmation email sent.", "successMessage");
        bookingForm.reset();
        selectedTime = null;
        setMinDate();
        onPublicServiceChange();
        renderTimeSlots();
      });
    }

    // initial render if guest section visible
    onPublicServiceChange();
    renderTimeSlots();
  }

  // ---------------------------
  // CUSTOMER page (Dashboard + booking form only)
  // ---------------------------
  function initCustomerPage() {
    // Guard
    const customerId = getCustomerSessionId();
    if (!customerId) {
      location.href = "./index.html";
      return;
    }

    const customers = loadCustomers();
    const currentCustomer = customers.find((c) => c.id === customerId);
    if (!currentCustomer) {
      clearCustomerSession();
      location.href = "./index.html";
      return;
    }

    // UI helpers
    function showDashboard() {
      if (exists("customerDashboard")) byId("customerDashboard").style.display = "block";
      if (exists("customerBookingForm")) byId("customerBookingForm").style.display = "none";
      renderCustomerBookings();
    }

    function showBookingForm() {
      if (exists("customerDashboard")) byId("customerDashboard").style.display = "none";
      if (exists("customerBookingForm")) byId("customerBookingForm").style.display = "block";
      resetBookingForm();
      renderCustomerTimeSlots();
    }

    // Expose buttons
    window.customerLogout = function customerLogout() {
      clearCustomerSession();
      location.href = "./index.html";
    };
    window.showCustomerDashboard = showDashboard;
    window.showBookingForm = showBookingForm;

    // Welcome
    if (exists("customerWelcome")) {
      byId("customerWelcome").textContent = `${currentCustomer.name}'s Appointments`;
    }

    // Booking state
    let customerSelectedTime = null;
    let editingBookingId = null;

    function setMinDate() {
      const di = byId("customerDateInput");
      if (di) {
        di.min = todayISO();
        if (!di.value) di.value = todayISO();
      }
    }

    function onCustomerServiceChange() {
      const svc = byId("customerServiceSelect")?.value || "";
      const group = byId("procedureGroup");
      const select = byId("customerProcedureSelect");

      if (!group || !select) return;

      if (!svc) {
        group.style.display = "none";
        select.innerHTML = '<option value="">Choose a procedure...</option>';
        return;
      }

      const list = procedures[svc] || [];
      select.innerHTML =
        ['<option value="">Choose a procedure...</option>']
          .concat(list.map((p) => `<option value="${p}">${p}</option>`))
          .join("");

      group.style.display = "block";
    }

    function renderCustomerTimeSlots() {
      const container = byId("customerTimeSlots");
      if (!container) return;

      const bookings = loadBookings();
      const date = byId("customerDateInput")?.value || "";
      const service = byId("customerServiceSelect")?.value || "";

      if (!date || !service) {
        container.innerHTML =
          '<p style="color:#999;text-align:center;padding:20px;">Please select a service and date first</p>';
        return;
      }

      container.innerHTML = "";
      const booked = bookings
        .filter(
          (b) =>
            b.date === date &&
            b.service === service &&
            b.status !== "rejected" &&
            (editingBookingId ? b.id !== editingBookingId : true)
        )
        .map((b) => b.time);

      timeSlots.forEach((t) => {
        const slot = document.createElement("div");
        slot.className = "time-slot";
        slot.textContent = t;

        if (booked.includes(t)) {
          slot.classList.add("booked");
        } else {
          slot.addEventListener("click", () => {
            document.querySelectorAll("#customerTimeSlots .time-slot").forEach((s) => s.classList.remove("selected"));
            slot.classList.add("selected");
            customerSelectedTime = t;
          });
        }

        if (customerSelectedTime === t && !booked.includes(t)) slot.classList.add("selected");
        container.appendChild(slot);
      });
    }

    function resetBookingForm() {
      const form = byId("customerBookingFormEl");
      if (form) form.reset();
      setMinDate();
      editingBookingId = null;
      customerSelectedTime = null;
      onCustomerServiceChange();
      const btn = byId("customerSubmitBtn");
      if (btn) btn.textContent = "Book Appointment";
    }

    function renderCustomerBookings() {
      const list = byId("customerBookingsList");
      if (!list) return;

      const bookings = loadBookings();
      const mine = bookings
        .filter((b) => b.customerId === currentCustomer.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      if (mine.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>No bookings yet</p></div>';
        return;
      }

      list.innerHTML = "";
      mine.forEach((b) => {
        const item = document.createElement("div");
        item.className = `booking-item ${b.status}`;

        const canEdit = b.status === "pending" || b.status === "confirmed";

        item.innerHTML = `
          <div class="booking-header">
            <div class="booking-info">
              <h3>${(b.service || "Service").charAt(0).toUpperCase() + (b.service || "service").slice(1)}</h3>
              <p><strong>Date:</strong> ${b.date} at ${b.time}</p>
              ${b.procedure ? `<p><strong>Procedure:</strong> ${b.procedure}</p>` : ""}
              <span class="status-badge ${b.status}">${b.status}</span>
            </div>
            <div class="booking-actions">
              ${
                canEdit
                  ? `
                    <button class="btn btn-primary" data-edit="${b.id}">Edit</button>
                    <button class="btn btn-secondary" data-del="${b.id}">Delete</button>
                  `
                  : ""
              }
            </div>
          </div>
        `;

        list.appendChild(item);
      });

      // bind edit/delete
      list.querySelectorAll("[data-edit]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-edit");
          startEdit(id);
        });
      });

      list.querySelectorAll("[data-del]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-del");
          deleteBooking(id);
        });
      });
    }

    function startEdit(id) {
      const bookings = loadBookings();
      const b = bookings.find((x) => x.id === id && x.customerId === currentCustomer.id);
      if (!b) return;

      editingBookingId = b.id;
      customerSelectedTime = b.time;

      // go form
      showBookingForm();

      if (exists("customerServiceSelect")) byId("customerServiceSelect").value = b.service || "";
      onCustomerServiceChange();

      if (exists("customerProcedureSelect")) byId("customerProcedureSelect").value = b.procedure || "";
      if (exists("customerDateInput")) byId("customerDateInput").value = b.date || "";

      renderCustomerTimeSlots();
      const btn = byId("customerSubmitBtn");
      if (btn) btn.textContent = "Update Appointment";
    }

    function deleteBooking(id) {
      if (!confirm("Delete this appointment?")) return;
      const bookings = loadBookings();
      const next = bookings.filter((b) => !(b.id === id && b.customerId === currentCustomer.id));
      saveBookings(next);
      renderCustomerBookings();
      showSuccess("Deleted.", "customerSuccessMessage");
    }

    // Wire form inputs
    setMinDate();
    if (exists("customerServiceSelect")) byId("customerServiceSelect").addEventListener("change", () => {
      onCustomerServiceChange();
      renderCustomerTimeSlots();
    });
    if (exists("customerDateInput")) byId("customerDateInput").addEventListener("change", renderCustomerTimeSlots);

    // Submit booking
    const form = byId("customerBookingFormEl");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!customerSelectedTime) {
          showError("Please select a time slot.", "customerErrorMessage");
          return;
        }

        const bookings = loadBookings();

        const base = {
          service: byId("customerServiceSelect")?.value || "",
          procedure: byId("customerProcedureSelect")?.value || "",
          date: byId("customerDateInput")?.value || "",
          time: customerSelectedTime,
        };

        if (!base.service || !base.date) {
          showError("Please select service and date.", "customerErrorMessage");
          return;
        }

        if (editingBookingId) {
          const existing = bookings.find((b) => b.id === editingBookingId && b.customerId === currentCustomer.id);
          if (!existing) {
            showError("Could not find booking to edit.", "customerErrorMessage");
            return;
          }

          if (isSlotTaken(bookings, base, existing.id)) {
            showError("That time slot is already booked. Choose another.", "customerErrorMessage");
            renderCustomerTimeSlots();
            return;
          }

          const updated = {
            ...existing,
            ...base,
            status: "pending", // resets for admin review
            updatedAt: new Date().toISOString(),
          };

          const next = bookings.map((b) => (b.id === existing.id ? updated : b));
          saveBookings(next);

          showSuccess("Appointment updated. Awaiting admin approval.", "customerSuccessMessage");
          editingBookingId = null;
          customerSelectedTime = null;

          showDashboard();
          return;
        }

        // new booking
        const booking = {
          id: uid(),
          ...base,
          status: "pending",
          createdAt: new Date().toISOString(),
          customerId: currentCustomer.id,
          patientName: currentCustomer.name,
          patientEmail: currentCustomer.email,
          patientPhone: currentCustomer.phone || "",
        };

        if (isSlotTaken(bookings, booking)) {
          showError("That time slot is already booked. Choose another.", "customerErrorMessage");
          renderCustomerTimeSlots();
          return;
        }

        bookings.push(booking);
        saveBookings(bookings);

        await sendBookingConfirmationEmail(booking);

        showSuccess("Booked! Confirmation email sent.", "customerSuccessMessage");
        showDashboard();
      });
    }

    // Default view
    showDashboard();
  }

  // ---------------------------
  // ADMIN page (Dashboard only)
  // ---------------------------
  function initAdminPage() {
    // Guard
    if (!isAdminLoggedIn()) {
      location.href = "./index.html";
      return;
    }

    window.logout = function logout() {
      clearAdminSession();
      location.href = "./index.html";
    };

    let currentTab = "pending"; // pending | confirmed | all

    window.switchTab = function switchTab(tab) {
      currentTab = tab;
      renderBookings();
      updateStats();
      // active state
      document.querySelectorAll(".nav-tab").forEach((btn) => btn.classList.remove("active"));
      if (tab === "pending") document.querySelectorAll(".nav-tab")[0]?.classList.add("active");
      if (tab === "confirmed") document.querySelectorAll(".nav-tab")[1]?.classList.add("active");
      if (tab === "all") document.querySelectorAll(".nav-tab")[2]?.classList.add("active");
    };

    window.updateBookingStatus = function updateBookingStatus(id, status) {
      const bookings = loadBookings();
      const b = bookings.find((x) => x.id === id);
      if (!b) return;

      const updated = { ...b, status, updatedAt: new Date().toISOString() };
      saveBookings(bookings.map((x) => (x.id === id ? updated : x)));

      renderBookings();
      updateStats();
    };

    window.deleteBooking = function deleteBooking(id) {
      if (!confirm("Delete this booking permanently?")) return;
      const bookings = loadBookings();
      saveBookings(bookings.filter((b) => b.id !== id));
      renderBookings();
      updateStats();
    };

    function updateStats() {
      const bookings = loadBookings();
      const customers = loadCustomers();

      const pending = bookings.filter((b) => b.status === "pending").length;
      const approved = bookings.filter((b) => b.status === "confirmed").length;

      if (exists("pendingCount")) byId("pendingCount").textContent = String(pending);
      if (exists("approvedCount")) byId("approvedCount").textContent = String(approved);
      if (exists("totalCount")) byId("totalCount").textContent = String(customers.length);
    }

    function renderBookings() {
      const container = byId("bookingsList");
      if (!container) return;

      const bookings = loadBookings().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const customers = loadCustomers();

      let list = bookings;
      if (currentTab === "pending") list = bookings.filter((b) => b.status === "pending");
      if (currentTab === "confirmed") list = bookings.filter((b) => b.status === "confirmed");

      if (list.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No bookings found</p></div>';
        return;
      }

      container.innerHTML = "";
      list.forEach((b) => {
        const name =
          b.patientName ||
          customers.find((c) => c.id === b.customerId)?.name ||
          "N/A";

        const item = document.createElement("div");
        item.className = `booking-item ${b.status}`;

        item.innerHTML = `
          <div class="booking-header">
            <div class="booking-info">
              <h3>${name}</h3>
              <p><strong>Service:</strong> ${b.service ? b.service.charAt(0).toUpperCase() + b.service.slice(1) : "N/A"}</p>
              ${b.procedure ? `<p><strong>Procedure:</strong> ${b.procedure}</p>` : ""}
              <p><strong>Date:</strong> ${b.date} at ${b.time}</p>
              <p><strong>Contact:</strong> ${b.patientEmail || "N/A"} | ${b.patientPhone || "N/A"}</p>
              <span class="status-badge ${b.status}">${b.status}</span>
            </div>
            <div class="booking-actions">
              ${
                b.status === "pending"
                  ? `
                    <button class="btn btn-success" onclick="updateBookingStatus('${b.id}','confirmed')">Confirm</button>
                    <button class="btn btn-danger" onclick="updateBookingStatus('${b.id}','rejected')">Reject</button>
                  `
                  : ""
              }
              <button class="btn btn-danger" onclick="deleteBooking('${b.id}')">Delete</button>
            </div>
          </div>
        `;

        container.appendChild(item);
      });
    }

    // init
    updateStats();
    renderBookings();
    window.switchTab("pending");
  }

  // ---------------------------
  // Boot
  // ---------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const p = pageName();
    if (p === "index") initIndexPage();
    if (p === "customer") initCustomerPage();
    if (p === "admin") initAdminPage();
  });
})();
