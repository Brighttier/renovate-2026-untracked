/**
 * Widget Generators for Marketplace Services
 * Generates embeddable HTML/JS for Chatbot, Booking, and CRM widgets
 */

import type { ChatbotConfig, BookingConfig, CRMConfig } from '../../../types';

interface WidgetGeneratorOptions {
  siteId: string;
  businessName: string;
  primaryColor: string;
  accentColor?: string;
}

/**
 * Generate the AI Chatbot widget HTML/JS
 */
export function generateChatbotWidget(
  options: WidgetGeneratorOptions,
  config?: Partial<ChatbotConfig['settings']>
): string {
  const {
    siteId,
    businessName,
    primaryColor,
    accentColor = primaryColor,
  } = options;

  const settings = {
    welcomeMessage: config?.welcomeMessage || `Hi! 👋 How can I help you today?`,
    position: config?.position || 'bottom-right',
    collectEmail: config?.collectEmail ?? true,
  };

  const positionClasses = settings.position === 'bottom-right'
    ? 'right-6'
    : 'left-6';

  return `
<!-- RenovateMySite AI Chatbot Widget -->
<div id="rms-chatbot" class="fixed bottom-6 ${positionClasses} z-50" data-site-id="${siteId}">
  <button
    id="rms-chat-toggle"
    onclick="RMSChat.toggle()"
    class="w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform duration-300"
    style="background: linear-gradient(135deg, ${primaryColor}, ${accentColor});"
    aria-label="Open chat"
  >
    <svg id="rms-chat-icon" class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
    </svg>
    <svg id="rms-close-icon" class="w-6 h-6 text-white hidden" fill="currentColor" viewBox="0 0 24 24">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
  </button>

  <div
    id="rms-chat-panel"
    class="hidden absolute bottom-20 ${positionClasses === 'right-6' ? 'right-0' : 'left-0'} w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
    style="max-height: 500px;"
  >
    <!-- Header -->
    <div
      class="p-4 text-white font-semibold flex items-center gap-3"
      style="background: linear-gradient(135deg, ${primaryColor}, ${accentColor});"
    >
      <div class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
        </svg>
      </div>
      <div>
        <div class="font-semibold">${businessName}</div>
        <div class="text-xs opacity-80">Usually replies instantly</div>
      </div>
    </div>

    <!-- Messages -->
    <div id="rms-chat-messages" class="h-64 overflow-y-auto p-4 space-y-3 bg-gray-50">
      <div class="flex gap-2">
        <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style="background: ${primaryColor}20;">
          <svg class="w-4 h-4" style="color: ${primaryColor};" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z"/>
          </svg>
        </div>
        <div class="bg-white rounded-2xl rounded-tl-sm px-4 py-2 shadow-sm max-w-[80%]">
          <p class="text-sm text-gray-700">${settings.welcomeMessage}</p>
        </div>
      </div>
    </div>

    <!-- Quick Replies -->
    <div id="rms-quick-replies" class="px-4 py-2 border-t border-gray-100 flex flex-wrap gap-2">
      <button onclick="RMSChat.send('What services do you offer?')" class="text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors">
        Services
      </button>
      <button onclick="RMSChat.send('What are your hours?')" class="text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors">
        Hours
      </button>
      <button onclick="RMSChat.send('How can I contact you?')" class="text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors">
        Contact
      </button>
    </div>

    <!-- Input -->
    <div class="p-4 border-t border-gray-100 bg-white">
      <form id="rms-chat-form" onsubmit="RMSChat.handleSubmit(event)" class="flex gap-2">
        <input
          type="text"
          id="rms-chat-input"
          placeholder="Type a message..."
          class="flex-1 px-4 py-2.5 rounded-full border border-gray-200 focus:outline-none focus:ring-2 text-sm"
          style="--tw-ring-color: ${primaryColor}40;"
        >
        <button
          type="submit"
          class="w-10 h-10 rounded-full flex items-center justify-center text-white transition-transform hover:scale-105"
          style="background: ${primaryColor};"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </form>
    </div>

    <!-- Powered By -->
    <div class="px-4 py-2 text-center text-xs text-gray-400 bg-gray-50 border-t border-gray-100">
      Powered by <a href="https://renovatemysite.com" target="_blank" class="hover:underline" style="color: ${primaryColor};">RenovateMySite</a>
    </div>
  </div>
</div>

<script>
(function() {
  const RMSChat = {
    siteId: '${siteId}',
    isOpen: false,
    conversationId: null,

    toggle() {
      this.isOpen = !this.isOpen;
      const panel = document.getElementById('rms-chat-panel');
      const chatIcon = document.getElementById('rms-chat-icon');
      const closeIcon = document.getElementById('rms-close-icon');

      if (this.isOpen) {
        panel.classList.remove('hidden');
        chatIcon.classList.add('hidden');
        closeIcon.classList.remove('hidden');
        document.getElementById('rms-chat-input').focus();
      } else {
        panel.classList.add('hidden');
        chatIcon.classList.remove('hidden');
        closeIcon.classList.add('hidden');
      }
    },

    handleSubmit(e) {
      e.preventDefault();
      const input = document.getElementById('rms-chat-input');
      const message = input.value.trim();
      if (message) {
        this.send(message);
        input.value = '';
      }
    },

    send(message) {
      this.addMessage(message, 'user');
      this.showTyping();

      // Send to backend
      fetch('https://us-central1-renovatemysite-app.cloudfunctions.net/chatbot_sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: this.siteId,
          conversationId: this.conversationId,
          message: message
        })
      })
      .then(res => res.json())
      .then(data => {
        this.hideTyping();
        this.conversationId = data.conversationId;
        this.addMessage(data.response, 'ai');
      })
      .catch(() => {
        this.hideTyping();
        this.addMessage('Sorry, I\\'m having trouble connecting. Please try again.', 'ai');
      });
    },

    addMessage(text, role) {
      const container = document.getElementById('rms-chat-messages');
      const div = document.createElement('div');
      div.className = role === 'user' ? 'flex justify-end' : 'flex gap-2';

      if (role === 'user') {
        div.innerHTML = \`
          <div class="bg-[${primaryColor}] text-white rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%]">
            <p class="text-sm">\${text}</p>
          </div>
        \`;
      } else {
        div.innerHTML = \`
          <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style="background: ${primaryColor}20;">
            <svg class="w-4 h-4" style="color: ${primaryColor};" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z"/>
            </svg>
          </div>
          <div class="bg-white rounded-2xl rounded-tl-sm px-4 py-2 shadow-sm max-w-[80%]">
            <p class="text-sm text-gray-700">\${text}</p>
          </div>
        \`;
      }

      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    },

    showTyping() {
      const container = document.getElementById('rms-chat-messages');
      const div = document.createElement('div');
      div.id = 'rms-typing';
      div.className = 'flex gap-2';
      div.innerHTML = \`
        <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style="background: ${primaryColor}20;">
          <svg class="w-4 h-4" style="color: ${primaryColor};" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z"/>
          </svg>
        </div>
        <div class="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
          <div class="flex gap-1">
            <span class="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style="animation-delay: 0ms;"></span>
            <span class="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style="animation-delay: 150ms;"></span>
            <span class="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style="animation-delay: 300ms;"></span>
          </div>
        </div>
      \`;
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    },

    hideTyping() {
      const typing = document.getElementById('rms-typing');
      if (typing) typing.remove();
    }
  };

  window.RMSChat = RMSChat;
})();
</script>
<!-- End RenovateMySite AI Chatbot Widget -->
`;
}

/**
 * Generate the Booking Calendar widget HTML/JS
 */
export function generateBookingWidget(
  options: WidgetGeneratorOptions,
  config?: Partial<BookingConfig['settings']>
): string {
  const {
    siteId,
    businessName,
    primaryColor,
    accentColor = primaryColor,
  } = options;

  return `
<!-- RenovateMySite Booking Calendar Widget -->
<section id="rms-booking" class="py-20 bg-gray-50" data-site-id="${siteId}">
  <div class="max-w-4xl mx-auto px-4">
    <div class="text-center mb-12">
      <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Book an Appointment</h2>
      <p class="text-gray-600 max-w-xl mx-auto">Schedule a convenient time with ${businessName}. We'll confirm your appointment shortly.</p>
    </div>

    <div class="bg-white rounded-3xl shadow-xl overflow-hidden">
      <!-- Service Selection -->
      <div class="p-6 border-b border-gray-100">
        <h3 class="font-semibold text-gray-900 mb-4">Select a Service</h3>
        <div id="rms-service-list" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <!-- Services will be loaded dynamically -->
          <div class="animate-pulse">
            <div class="h-20 bg-gray-100 rounded-xl"></div>
          </div>
          <div class="animate-pulse">
            <div class="h-20 bg-gray-100 rounded-xl"></div>
          </div>
        </div>
      </div>

      <!-- Calendar -->
      <div class="p-6 border-b border-gray-100">
        <div class="flex items-center justify-between mb-4">
          <button onclick="RMSBooking.prevMonth()" class="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <h3 id="rms-calendar-month" class="font-semibold text-gray-900">Loading...</h3>
          <button onclick="RMSBooking.nextMonth()" class="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

        <!-- Day headers -->
        <div class="grid grid-cols-7 gap-1 mb-2">
          <div class="text-center text-xs font-medium text-gray-500 py-2">Sun</div>
          <div class="text-center text-xs font-medium text-gray-500 py-2">Mon</div>
          <div class="text-center text-xs font-medium text-gray-500 py-2">Tue</div>
          <div class="text-center text-xs font-medium text-gray-500 py-2">Wed</div>
          <div class="text-center text-xs font-medium text-gray-500 py-2">Thu</div>
          <div class="text-center text-xs font-medium text-gray-500 py-2">Fri</div>
          <div class="text-center text-xs font-medium text-gray-500 py-2">Sat</div>
        </div>

        <!-- Calendar grid -->
        <div id="rms-calendar-grid" class="grid grid-cols-7 gap-1">
          <!-- Days will be rendered dynamically -->
        </div>
      </div>

      <!-- Time Slots -->
      <div id="rms-time-section" class="p-6 border-b border-gray-100 hidden">
        <h3 class="font-semibold text-gray-900 mb-4">Available Times for <span id="rms-selected-date"></span></h3>
        <div id="rms-time-slots" class="grid grid-cols-3 sm:grid-cols-4 gap-2">
          <!-- Time slots will be loaded dynamically -->
        </div>
      </div>

      <!-- Booking Form -->
      <div id="rms-booking-form-section" class="p-6 hidden">
        <h3 class="font-semibold text-gray-900 mb-4">Your Information</h3>
        <form id="rms-booking-form" onsubmit="RMSBooking.submit(event)" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" name="name" required class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2" style="--tw-ring-color: ${primaryColor}40;">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" name="email" required class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2" style="--tw-ring-color: ${primaryColor}40;">
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input type="tel" name="phone" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2" style="--tw-ring-color: ${primaryColor}40;">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea name="notes" rows="3" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 resize-none" style="--tw-ring-color: ${primaryColor}40;"></textarea>
          </div>

          <!-- Summary -->
          <div class="bg-gray-50 rounded-xl p-4">
            <h4 class="font-medium text-gray-900 mb-2">Booking Summary</h4>
            <div id="rms-booking-summary" class="text-sm text-gray-600 space-y-1">
              <!-- Summary will be populated -->
            </div>
          </div>

          <button
            type="submit"
            class="w-full py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style="background: linear-gradient(135deg, ${primaryColor}, ${accentColor});"
          >
            Confirm Booking
          </button>
        </form>
      </div>

      <!-- Success Message -->
      <div id="rms-booking-success" class="p-8 text-center hidden">
        <div class="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style="background: ${primaryColor}20;">
          <svg class="w-8 h-8" style="color: ${primaryColor};" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">Booking Confirmed!</h3>
        <p class="text-gray-600 mb-4">We've sent a confirmation to your email.</p>
        <p id="rms-confirmation-code" class="text-sm text-gray-500"></p>
      </div>
    </div>

    <p class="text-center text-xs text-gray-400 mt-4">
      Powered by <a href="https://renovatemysite.com" target="_blank" class="hover:underline" style="color: ${primaryColor};">RenovateMySite</a>
    </p>
  </div>
</section>

<script>
(function() {
  const RMSBooking = {
    siteId: '${siteId}',
    currentDate: new Date(),
    selectedService: null,
    selectedDate: null,
    selectedTime: null,
    services: [],
    availability: {},

    async init() {
      await this.loadServices();
      this.renderCalendar();
    },

    async loadServices() {
      try {
        const res = await fetch(\`https://us-central1-renovatemysite-app.cloudfunctions.net/booking_getServices?siteId=\${this.siteId}\`);
        const data = await res.json();
        this.services = data.services || [];
        this.renderServices();
      } catch (e) {
        console.error('Failed to load services:', e);
        this.services = [
          { id: 'consultation', name: 'Consultation', duration: 30, price: 0 },
          { id: 'service', name: 'Service Appointment', duration: 60, price: null }
        ];
        this.renderServices();
      }
    },

    renderServices() {
      const container = document.getElementById('rms-service-list');
      container.innerHTML = this.services.map(s => \`
        <button
          onclick="RMSBooking.selectService('\${s.id}')"
          class="p-4 rounded-xl border-2 text-left transition-all hover:border-[${primaryColor}] \${this.selectedService === s.id ? 'border-[${primaryColor}] bg-[${primaryColor}]/5' : 'border-gray-200'}"
        >
          <div class="font-medium text-gray-900">\${s.name}</div>
          <div class="text-sm text-gray-500">\${s.duration} min\${s.price ? ' • $' + s.price : ''}</div>
        </button>
      \`).join('');
    },

    selectService(serviceId) {
      this.selectedService = serviceId;
      this.renderServices();
    },

    renderCalendar() {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      document.getElementById('rms-calendar-month').textContent = \`\${monthNames[this.currentDate.getMonth()]} \${this.currentDate.getFullYear()}\`;

      const grid = document.getElementById('rms-calendar-grid');
      const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
      const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let html = '';

      // Empty cells before first day
      for (let i = 0; i < firstDay.getDay(); i++) {
        html += '<div></div>';
      }

      // Days of month
      for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day);
        const isPast = date < today;
        const isSelected = this.selectedDate && date.toDateString() === this.selectedDate.toDateString();

        html += \`
          <button
            onclick="RMSBooking.selectDate(\${date.getTime()})"
            class="aspect-square rounded-lg flex items-center justify-center text-sm transition-all
              \${isPast ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100'}
              \${isSelected ? 'text-white' : ''}"
            style="\${isSelected ? 'background: ${primaryColor};' : ''}"
            \${isPast ? 'disabled' : ''}
          >
            \${day}
          </button>
        \`;
      }

      grid.innerHTML = html;
    },

    prevMonth() {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.renderCalendar();
    },

    nextMonth() {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.renderCalendar();
    },

    async selectDate(timestamp) {
      this.selectedDate = new Date(timestamp);
      this.renderCalendar();

      const dateStr = this.selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      document.getElementById('rms-selected-date').textContent = dateStr;
      document.getElementById('rms-time-section').classList.remove('hidden');

      // Load available time slots
      await this.loadTimeSlots();
    },

    async loadTimeSlots() {
      const container = document.getElementById('rms-time-slots');
      container.innerHTML = '<div class="col-span-full text-center text-gray-500">Loading...</div>';

      try {
        const dateStr = this.selectedDate.toISOString().split('T')[0];
        const res = await fetch(\`https://us-central1-renovatemysite-app.cloudfunctions.net/booking_getAvailability?siteId=\${this.siteId}&date=\${dateStr}\`);
        const data = await res.json();
        this.renderTimeSlots(data.slots || this.getDefaultSlots());
      } catch (e) {
        this.renderTimeSlots(this.getDefaultSlots());
      }
    },

    getDefaultSlots() {
      return ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM'];
    },

    renderTimeSlots(slots) {
      const container = document.getElementById('rms-time-slots');
      container.innerHTML = slots.map(slot => \`
        <button
          onclick="RMSBooking.selectTime('\${slot}')"
          class="py-2 px-3 rounded-lg border text-sm transition-all hover:border-[${primaryColor}] \${this.selectedTime === slot ? 'border-[${primaryColor}] bg-[${primaryColor}] text-white' : 'border-gray-200'}"
        >
          \${slot}
        </button>
      \`).join('');
    },

    selectTime(time) {
      this.selectedTime = time;
      this.renderTimeSlots(this.getDefaultSlots());
      this.showBookingForm();
    },

    showBookingForm() {
      document.getElementById('rms-booking-form-section').classList.remove('hidden');

      const service = this.services.find(s => s.id === this.selectedService) || this.services[0];
      const dateStr = this.selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

      document.getElementById('rms-booking-summary').innerHTML = \`
        <p><strong>Service:</strong> \${service?.name || 'Appointment'}</p>
        <p><strong>Date:</strong> \${dateStr}</p>
        <p><strong>Time:</strong> \${this.selectedTime}</p>
        \${service?.price ? '<p><strong>Price:</strong> $' + service.price + '</p>' : ''}
      \`;
    },

    async submit(e) {
      e.preventDefault();
      const form = e.target;
      const formData = new FormData(form);

      const booking = {
        siteId: this.siteId,
        serviceId: this.selectedService || 'appointment',
        date: this.selectedDate.toISOString().split('T')[0],
        time: this.selectedTime,
        clientName: formData.get('name'),
        clientEmail: formData.get('email'),
        clientPhone: formData.get('phone'),
        notes: formData.get('notes')
      };

      try {
        const res = await fetch('https://us-central1-renovatemysite-app.cloudfunctions.net/booking_createAppointment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(booking)
        });
        const data = await res.json();

        document.getElementById('rms-booking-form-section').classList.add('hidden');
        document.getElementById('rms-time-section').classList.add('hidden');
        document.getElementById('rms-booking-success').classList.remove('hidden');
        document.getElementById('rms-confirmation-code').textContent = 'Confirmation: ' + (data.confirmationCode || 'PENDING');
      } catch (e) {
        alert('Failed to book appointment. Please try again.');
      }
    }
  };

  window.RMSBooking = RMSBooking;
  document.addEventListener('DOMContentLoaded', () => RMSBooking.init());
})();
</script>
<!-- End RenovateMySite Booking Calendar Widget -->
`;
}

/**
 * Generate the CRM/Lead Dashboard widget (contact form + footer link)
 */
export function generateCRMWidget(
  options: WidgetGeneratorOptions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _config?: Partial<CRMConfig['settings']>
): string {
  const {
    siteId,
    primaryColor,
    accentColor = primaryColor,
  } = options;

  return `
<!-- RenovateMySite CRM Contact Form Widget -->
<section id="rms-contact" class="py-20 bg-white" data-site-id="${siteId}">
  <div class="max-w-4xl mx-auto px-4">
    <div class="text-center mb-12">
      <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Get in Touch</h2>
      <p class="text-gray-600 max-w-xl mx-auto">Have a question or ready to get started? Fill out the form below and we'll get back to you shortly.</p>
    </div>

    <div class="bg-gray-50 rounded-3xl p-8 md:p-12">
      <form id="rms-contact-form" onsubmit="RMSContact.submit(event)" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
            <input
              type="text"
              name="name"
              required
              class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 transition-all"
              style="--tw-ring-color: ${primaryColor}40;"
              placeholder="John Doe"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Email *</label>
            <input
              type="email"
              name="email"
              required
              class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 transition-all"
              style="--tw-ring-color: ${primaryColor}40;"
              placeholder="john@example.com"
            >
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Phone</label>
            <input
              type="tel"
              name="phone"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 transition-all"
              style="--tw-ring-color: ${primaryColor}40;"
              placeholder="(555) 123-4567"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Subject</label>
            <select
              name="subject"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 transition-all bg-white"
              style="--tw-ring-color: ${primaryColor}40;"
            >
              <option value="general">General Inquiry</option>
              <option value="quote">Request a Quote</option>
              <option value="support">Support</option>
              <option value="partnership">Partnership</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Message *</label>
          <textarea
            name="message"
            required
            rows="5"
            class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 transition-all resize-none"
            style="--tw-ring-color: ${primaryColor}40;"
            placeholder="Tell us how we can help..."
          ></textarea>
        </div>

        <div class="flex items-center gap-2">
          <input type="checkbox" id="rms-privacy" name="privacy" required class="w-4 h-4 rounded" style="accent-color: ${primaryColor};">
          <label for="rms-privacy" class="text-sm text-gray-600">
            I agree to the <a href="/privacy" class="underline hover:no-underline" style="color: ${primaryColor};">privacy policy</a>
          </label>
        </div>

        <button
          type="submit"
          id="rms-submit-btn"
          class="w-full py-4 rounded-xl font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
          style="background: linear-gradient(135deg, ${primaryColor}, ${accentColor});"
        >
          Send Message
        </button>
      </form>

      <!-- Success Message -->
      <div id="rms-contact-success" class="text-center py-8 hidden">
        <div class="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style="background: ${primaryColor}20;">
          <svg class="w-8 h-8" style="color: ${primaryColor};" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">Message Sent!</h3>
        <p class="text-gray-600">Thank you for reaching out. We'll get back to you within 24 hours.</p>
      </div>
    </div>

    <p class="text-center text-xs text-gray-400 mt-4">
      Powered by <a href="https://renovatemysite.com" target="_blank" class="hover:underline" style="color: ${primaryColor};">RenovateMySite</a>
    </p>
  </div>
</section>

<script>
(function() {
  const RMSContact = {
    siteId: '${siteId}',

    async submit(e) {
      e.preventDefault();
      const form = e.target;
      const btn = document.getElementById('rms-submit-btn');
      const formData = new FormData(form);

      btn.disabled = true;
      btn.textContent = 'Sending...';

      const submission = {
        siteId: this.siteId,
        formId: 'contact',
        data: {
          name: formData.get('name'),
          email: formData.get('email'),
          phone: formData.get('phone'),
          subject: formData.get('subject'),
          message: formData.get('message')
        },
        source: {
          pageUrl: window.location.href,
          referrer: document.referrer,
          timestamp: new Date().toISOString()
        }
      };

      try {
        await fetch('https://us-central1-renovatemysite-app.cloudfunctions.net/crm_submitForm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submission)
        });

        form.classList.add('hidden');
        document.getElementById('rms-contact-success').classList.remove('hidden');
      } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Send Message';
        alert('Failed to send message. Please try again.');
      }
    }
  };

  window.RMSContact = RMSContact;
})();
</script>
<!-- End RenovateMySite CRM Contact Form Widget -->
`;
}

/**
 * Inject widget code into existing HTML
 */
export function injectWidgetIntoHtml(
  html: string,
  widgetCode: string,
  serviceId: 'chatbot' | 'booking' | 'simple-crm'
): string {
  switch (serviceId) {
    case 'chatbot':
      // Inject chatbot before </body> - it's a fixed floating element
      if (html.includes('</body>')) {
        return html.replace('</body>', `${widgetCode}\n</body>`);
      }
      return html + widgetCode;

    case 'booking':
      // Try to inject booking section after CTA or before footer
      const ctaRegex = /<section[^>]*id=["']?cta["']?[^>]*>[\s\S]*?<\/section>/i;
      const ctaMatch = html.match(ctaRegex);
      if (ctaMatch) {
        return html.replace(ctaMatch[0], `${ctaMatch[0]}\n${widgetCode}`);
      }

      // Try before footer
      if (html.includes('<footer')) {
        return html.replace(/<footer/i, `${widgetCode}\n<footer`);
      }

      // Fallback: before </body>
      if (html.includes('</body>')) {
        return html.replace('</body>', `${widgetCode}\n</body>`);
      }
      return html + widgetCode;

    case 'simple-crm':
      // Try to inject contact form after about section or before footer
      const aboutRegex = /<section[^>]*id=["']?about["']?[^>]*>[\s\S]*?<\/section>/i;
      const aboutMatch = html.match(aboutRegex);
      if (aboutMatch) {
        return html.replace(aboutMatch[0], `${aboutMatch[0]}\n${widgetCode}`);
      }

      // Try before footer
      if (html.includes('<footer')) {
        return html.replace(/<footer/i, `${widgetCode}\n<footer`);
      }

      // Fallback: before </body>
      if (html.includes('</body>')) {
        return html.replace('</body>', `${widgetCode}\n</body>`);
      }
      return html + widgetCode;

    default:
      return html;
  }
}

/**
 * Remove widget from HTML (for cancellation)
 */
export function removeWidgetFromHtml(
  html: string,
  serviceId: 'chatbot' | 'booking' | 'simple-crm'
): string {
  switch (serviceId) {
    case 'chatbot':
      // Remove chatbot widget
      const chatbotRegex = /<!-- RenovateMySite AI Chatbot Widget -->[\s\S]*?<!-- End RenovateMySite AI Chatbot Widget -->/g;
      return html.replace(chatbotRegex, '');

    case 'booking':
      // Remove booking widget
      const bookingRegex = /<!-- RenovateMySite Booking Calendar Widget -->[\s\S]*?<!-- End RenovateMySite Booking Calendar Widget -->/g;
      return html.replace(bookingRegex, '');

    case 'simple-crm':
      // Remove CRM widget
      const crmRegex = /<!-- RenovateMySite CRM Contact Form Widget -->[\s\S]*?<!-- End RenovateMySite CRM Contact Form Widget -->/g;
      return html.replace(crmRegex, '');

    default:
      return html;
  }
}
