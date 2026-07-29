// ReferTrack Client-Side Functionality

document.addEventListener('DOMContentLoaded', () => {
  setupNotifications();
  setupPatientLookup();
});

/**
 * Handle notification drawer toggling and background API polling
 */
function setupNotifications() {
  const bellBtn = document.getElementById('hrefNotifBell');
  const bellBadge = document.getElementById('hrefBellBadge');
  const drawer = document.getElementById('hrefNotifDrawer');
  const notifList = document.getElementById('hrefNotifList');

  if (!bellBtn) return;

  // Toggle drawer view
  bellBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    drawer.style.display = drawer.style.display === 'block' ? 'none' : 'block';
  });

  // Hide drawer on clicking outside
  document.addEventListener('click', () => {
    if (drawer) drawer.style.display = 'none';
  });

  if (drawer) {
    drawer.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // Poll notifications
  async function pollNotifications() {
    try {
      const res = await fetch('/api/references/notifications');
      if (!res.ok) return;
      const data = await res.json();

      if (data.length > 0) {
        bellBadge.style.display = 'block';
        notifList.innerHTML = '';
        
        data.forEach(notif => {
          const item = document.createElement('div');
          item.className = 'href-notif-item';
          item.innerText = notif.message;
          item.addEventListener('click', async () => {
            // Mark read and redirect
            await fetch(`/api/references/notifications/${notif.id}/read`, { method: 'POST' });
            window.location.href = `/references/${notif.reference_id}`;
          });
          notifList.appendChild(item);
        });
      } else {
        bellBadge.style.display = 'none';
        notifList.innerHTML = '<div class="href-notif-empty">No new notifications</div>';
      }
    } catch (err) {
      console.error('Failed to poll notifications:', err);
    }
  }

  pollNotifications();
  setInterval(pollNotifications, 12000); // Poll every 12 seconds
}

/**
 * Handle live patient search in Patient Lookup and Doctor Referral pages
 */
function setupPatientLookup() {
  const searchInput = document.getElementById('hrefPatientSearch');
  const searchBtn = document.getElementById('hrefSearchBtn');
  const resultsTable = document.getElementById('hrefSearchResults');
  const resultsBody = document.getElementById('hrefSearchResultsBody');

  if (!searchInput || !resultsBody) return;

  // Store pre-loaded rows to restore them when search query is cleared
  const originalRows = Array.from(resultsBody.querySelectorAll('tr.patient-row'));

  // Live client-side filter
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase().trim();

    if (!q) {
      resultsBody.innerHTML = '';
      originalRows.forEach(row => {
        row.style.display = '';
        resultsBody.appendChild(row);
      });
      resultsTable.style.display = originalRows.length > 0 ? 'table' : 'none';
      return;
    }

    // Filter rows currently in the table
    const rows = resultsBody.querySelectorAll('tr.patient-row');
    let visibleCount = 0;
    rows.forEach(row => {
      const id = row.getAttribute('data-id') || '';
      const name = row.getAttribute('data-name') || '';
      const contact = row.getAttribute('data-contact') || '';
      const text = `${id} ${name} ${contact}`.toLowerCase();

      if (text.includes(q)) {
        row.style.display = '';
        visibleCount++;
      } else {
        row.style.display = 'none';
      }
    });
  });

  async function performSearch() {
    const q = searchInput.value.trim();
    if (!q) {
      resultsBody.innerHTML = '';
      originalRows.forEach(row => {
        row.style.display = '';
        resultsBody.appendChild(row);
      });
      resultsTable.style.display = originalRows.length > 0 ? 'table' : 'none';
      return;
    }

    try {
      resultsBody.innerHTML = '<tr><td colspan="5" class="text-center">Searching...</td></tr>';
      resultsTable.style.display = 'table';
      
      const res = await fetch(`/api/patients/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('Search failed');
      const patients = await res.json();

      resultsBody.innerHTML = '';
      if (patients.length === 0) {
        resultsBody.innerHTML = '<tr><td colspan="5" class="text-center">No patients found.</td></tr>';
        return;
      }

      patients.forEach(p => {
        const row = document.createElement('tr');
        row.className = 'patient-row';
        row.setAttribute('data-id', p.id);
        row.setAttribute('data-name', p.name.toLowerCase());
        row.setAttribute('data-contact', p.contact_info ? p.contact_info.toLowerCase() : '');
        
        // Format DOB
        const dob = new Date(p.dob).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

        // Check user role from body attribute to render correct action buttons
        const userRole = document.body.getAttribute('data-user-role');

        let actionBtn = '';
        if (userRole === 'doctor') {
          actionBtn = `<a href="/references/create?patientId=${p.id}" class="href-btn href-btn-primary" style="padding: 6px 12px; font-size: 0.8rem;">Refer Patient</a>`;
        } else {
          actionBtn = `<span class="text-muted" style="font-size: 0.85rem;">Registered (ID: ${p.id})</span>`;
        }

        row.innerHTML = `
          <td>${p.id}</td>
          <td><strong>${escapeHtml(p.name)}</strong></td>
          <td>${dob}</td>
          <td>${escapeHtml(p.gender)}</td>
          <td style="text-align: right;">${actionBtn}</td>
        `;
        resultsBody.appendChild(row);
      });
    } catch (err) {
      console.error(err);
      resultsBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error fetching patient records.</td></tr>';
    }
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', performSearch);
  }
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  });
}

/**
 * Handle reference status transitions from detail views (Accept, Reject, Resolve, In Progress)
 */
async function updateReferenceStatus(referenceId, newStatus) {
  if (!confirm(`Are you sure you want to transition the status of this referral to '${newStatus}'?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/references/${referenceId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: newStatus })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to update status.');
      return;
    }

    // Refresh page to view timeline updates
    window.location.reload();
  } catch (err) {
    console.error(err);
    alert('An error occurred while updating status.');
  }
}

/**
 * Utility function to escape HTML to prevent XSS in table generation
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
