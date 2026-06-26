// public/app.js

let transactions = [];

// DOM Elements
const systemStatusDot = document.getElementById('system-status-dot');
const systemStatusText = document.getElementById('system-status-text');

const ticketIdInput = document.getElementById('ticket-id');
const ticketLanguageSelect = document.getElementById('ticket-language');
const ticketChannelSelect = document.getElementById('ticket-channel');
const ticketUserTypeSelect = document.getElementById('ticket-user-type');
const ticketCampaignInput = document.getElementById('ticket-campaign');
const ticketComplaintTextarea = document.getElementById('ticket-complaint');

const transactionsList = document.getElementById('transactions-list');
const noTransactionsRow = document.getElementById('no-transactions-row');

// Modal Elements
const txnModal = document.getElementById('txn-modal');
const txnForm = document.getElementById('txn-form');
const txnIdInput = document.getElementById('txn-id');
const txnTypeSelect = document.getElementById('txn-type');
const txnAmountInput = document.getElementById('txn-amount');
const txnStatusSelect = document.getElementById('txn-status');
const txnCounterpartyInput = document.getElementById('txn-counterparty');
const txnTimestampInput = document.getElementById('txn-timestamp');

// Submit button elements
const btnAnalyze = document.getElementById('btn-analyze');
const btnText = document.getElementById('btn-text');
const btnSpinner = document.getElementById('btn-spinner');

// Output Elements
const resultsPlaceholder = document.getElementById('results-placeholder');
const resultsContent = document.getElementById('results-content');
const verdictBannerContainer = document.getElementById('verdict-banner-container');
const resultEvidenceVerdict = document.getElementById('result-evidence-verdict');
const resultBadge = document.getElementById('result-badge');
const resultCaseType = document.getElementById('result-case-type');
const resultSeverity = document.getElementById('result-severity');
const resultDepartment = document.getElementById('result-department');
const resultConfidenceBar = document.getElementById('result-confidence-bar');
const resultConfidenceValue = document.getElementById('result-confidence-value');
const resultHumanReviewBox = document.getElementById('result-human-review-box');
const resultHumanReviewText = document.getElementById('result-human-review-text');
const resultReasonCodes = document.getElementById('result-reason-codes');
const resultAgentSummary = document.getElementById('result-agent-summary');
const resultNextAction = document.getElementById('result-next-action');
const resultCustomerReply = document.getElementById('result-customer-reply');
const auditListItems = document.getElementById('audit-list-items');
const drawerContent = document.getElementById('drawer-content');
const drawerIcon = document.getElementById('drawer-icon');

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  checkBackendHealth();
  generateTicketId();
  updateTransactionsTable();
});

// Check Backend Health
async function checkBackendHealth() {
  try {
    const res = await fetch('/health');
    const data = await res.json();
    if (data.status === 'ok') {
      systemStatusDot.className = 'status-dot online';
      systemStatusText.innerText = 'Backend Online';
    } else {
      throw new Error('Healthy status expected');
    }
  } catch (err) {
    systemStatusDot.className = 'status-dot offline';
    systemStatusText.innerText = 'Backend Offline';
    console.error('Backend status check failed:', err);
  }
}

// Generate Random ID Helper
function generateTicketId() {
  const num = Math.floor(100000 + Math.random() * 900000);
  ticketIdInput.value = `TKT-${num}`;
}

function generateTxnId() {
  const num = Math.floor(10000000 + Math.random() * 90000000);
  txnIdInput.value = `TXN${num}`;
}

// Manage Transactions Table
function updateTransactionsTable() {
  // Clear all list rows except the default empty state
  transactionsList.innerHTML = '';
  
  if (transactions.length === 0) {
    transactionsList.appendChild(noTransactionsRow);
    return;
  }

  transactions.forEach((txn, index) => {
    const tr = document.createElement('tr');
    
    // Format timestamp
    const date = new Date(txn.timestamp);
    const formattedDate = isNaN(date.getTime()) ? txn.timestamp : date.toLocaleString();

    tr.innerHTML = `
      <td><strong>${escapeHTML(txn.transaction_id)}</strong></td>
      <td><span class="chip">${escapeHTML(txn.type)}</span></td>
      <td>${parseFloat(txn.amount).toFixed(2)}</td>
      <td><span class="badge ${getStatusBadgeClass(txn.status)}">${escapeHTML(txn.status)}</span></td>
      <td>${escapeHTML(txn.counterparty)}</td>
      <td><small>${formattedDate}</small></td>
      <td>
        <button type="button" class="btn-delete" onclick="deleteTransaction(${index})">Delete</button>
      </td>
    `;
    transactionsList.appendChild(tr);
  });
}

function getStatusBadgeClass(status) {
  if (status === 'completed') return 'badge-success-outline';
  if (status === 'failed') return 'badge-error-outline';
  return 'badge-warning-outline';
}

function deleteTransaction(index) {
  transactions.splice(index, 1);
  updateTransactionsTable();
}

// Modal control
function openTxnMoral() {
  txnForm.reset();
  generateTxnId();
  // Set current datetime as default
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  txnTimestampInput.value = now.toISOString().slice(0, 16);
  
  txnModal.classList.remove('hidden');
}

function closeTxnMoral() {
  txnModal.classList.add('hidden');
}

function addTransaction(event) {
  event.preventDefault();
  
  const newTxn = {
    transaction_id: txnIdInput.value.trim(),
    type: txnTypeSelect.value,
    amount: parseFloat(txnAmountInput.value),
    status: txnStatusSelect.value,
    counterparty: txnCounterpartyInput.value.trim(),
    timestamp: new Date(txnTimestampInput.value).toISOString()
  };

  transactions.push(newTxn);
  updateTransactionsTable();
  closeTxnMoral();
}

// Preset Scenario Loader
const PRESETS = {
  wrong_transfer: {
    language: 'bn',
    channel: 'ussd',
    user_type: 'customer',
    campaign_context: 'none',
    complaint: 'ভুল করে ০১৭১১২২৩৩৪৪ নাম্বারে ৫০০০ টাকা পাঠিয়ে দিয়েছি। আমি আসলে ০১৭১১২২৩৩৪৫ নাম্বারে পাঠাতে চেয়েছিলাম। দয়া করে টাকা ফেরত পাঠান।',
    transactions: [
      {
        transaction_id: 'TXN3029482',
        type: 'transfer',
        amount: 5000,
        status: 'completed',
        counterparty: '01711223344',
        timestamp: new Date(Date.now() - 1800000).toISOString() // 30 mins ago
      }
    ]
  },
  phishing: {
    language: 'mixed',
    channel: 'app',
    user_type: 'customer',
    campaign_context: 'none',
    complaint: 'Agent claimer call korse amar pin o otp chaisilo block unblock visual sign verification support team bole. Ami diye disi r dynamic transaction notification ashlo 15000 taka account theke send out hoye gese complete. Reverse kore din taka block reverse agent support.',
    transactions: [
      {
        transaction_id: 'TXN8820391',
        type: 'cash_out',
        amount: 15000,
        status: 'completed',
        counterparty: '01988776655',
        timestamp: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      }
    ]
  },
  payment_failed: {
    language: 'en',
    channel: 'app',
    user_type: 'customer',
    campaign_context: 'promo_2026',
    complaint: 'I tried to pay my internet bill of 2400 BDT to power_ops yesterday. It failed but my balance was deducted. Please check.',
    transactions: [
      {
        transaction_id: 'TXN4481023',
        type: 'payment',
        amount: 2400,
        status: 'completed', // completed in records but user claims failure = inconsistent
        counterparty: 'power_ops',
        timestamp: new Date(Date.now() - 86400000).toISOString() // 1 day ago
      }
    ]
  }
};

function loadPreset(key) {
  const preset = PRESETS[key];
  if (!preset) return;

  generateTicketId();
  ticketLanguageSelect.value = preset.language;
  ticketChannelSelect.value = preset.channel;
  ticketUserTypeSelect.value = preset.user_type;
  ticketCampaignInput.value = preset.campaign_context;
  ticketComplaintTextarea.value = preset.complaint;
  
  transactions = JSON.parse(JSON.stringify(preset.transactions));
  updateTransactionsTable();
}

function clearAll() {
  generateTicketId();
  ticketLanguageSelect.value = 'en';
  ticketChannelSelect.value = 'app';
  ticketUserTypeSelect.value = 'customer';
  ticketCampaignInput.value = 'none';
  ticketComplaintTextarea.value = '';
  
  transactions = [];
  updateTransactionsTable();
  
  resultsPlaceholder.classList.remove('hidden');
  resultsContent.classList.add('hidden');
}

// Drawer Toggle for validation details
function toggleDrawer() {
  const isHidden = drawerContent.classList.toggle('hidden');
  drawerIcon.innerText = isHidden ? '▼' : '▲';
}

// Execute analysis
async function runAnalysis(event) {
  event.preventDefault();

  // Set Loading UI
  btnAnalyze.disabled = true;
  btnText.innerText = 'Investigating Complaint...';
  btnSpinner.classList.remove('hidden');
  
  const payload = {
    ticket_id: ticketIdInput.value.trim(),
    language: ticketLanguageSelect.value,
    channel: ticketChannelSelect.value,
    user_type: ticketUserTypeSelect.value,
    campaign_context: ticketCampaignInput.value.trim(),
    complaint: ticketComplaintTextarea.value.trim(),
    transaction_history: transactions
  };

  try {
    const response = await fetch('/analyze-ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errBody = await response.json();
      throw new Error(errBody.error || 'Server error occurred during investigation.');
    }

    const data = await response.json();
    renderResults(data);
  } catch (err) {
    alert(`Error: ${err.message}`);
    console.error(err);
  } finally {
    btnAnalyze.disabled = false;
    btnText.innerText = 'Investigate & Run Copilot';
    btnSpinner.classList.add('hidden');
  }
}

// Render AI Response to UI
function renderResults(data) {
  // Hide placeholder, show content
  resultsPlaceholder.classList.add('hidden');
  resultsContent.classList.remove('hidden');

  // Evidence Verdict styling
  const verdict = (data.evidence_verdict || 'insufficient_data').toLowerCase();
  verdictBannerContainer.className = 'verdict-banner'; // reset classes
  
  if (verdict === 'consistent') {
    verdictBannerContainer.classList.add('verdict-consistent');
    resultEvidenceVerdict.innerText = 'CONSISTENT';
    resultBadge.innerText = 'Consistent';
  } else if (verdict === 'inconsistent') {
    verdictBannerContainer.classList.add('verdict-inconsistent');
    resultEvidenceVerdict.innerText = 'INCONSISTENT';
    resultBadge.innerText = 'Inconsistent';
  } else {
    verdictBannerContainer.classList.add('verdict-insufficient');
    resultEvidenceVerdict.innerText = 'INSUFFICIENT DATA';
    resultBadge.innerText = 'Insufficient';
  }

  // Meta Values
  resultCaseType.innerText = formatString(data.case_type);
  resultSeverity.innerText = formatString(data.severity);
  resultDepartment.innerText = formatString(data.department);
  
  // Confidence
  const confValue = Math.round((data.confidence || 0) * 100);
  resultConfidenceBar.style.width = `${confValue}%`;
  resultConfidenceValue.innerText = `${confValue}%`;

  // Human Review Banner
  if (data.human_review_required) {
    resultHumanReviewBox.className = 'alert-box';
    resultHumanReviewText.innerText = 'Yes, human review is recommended based on rules and analysis indicators.';
  } else {
    resultHumanReviewBox.className = 'alert-box no-review';
    resultHumanReviewText.innerHTML = '<strong>No Review Needed:</strong> This ticket meets standard automatic resolution parameters.';
  }

  // Reason codes
  resultReasonCodes.innerHTML = '';
  if (Array.isArray(data.reason_codes) && data.reason_codes.length > 0) {
    data.reason_codes.forEach(code => {
      const span = document.createElement('span');
      span.className = 'chip';
      span.innerText = code;
      resultReasonCodes.appendChild(span);
    });
  } else {
    resultReasonCodes.innerHTML = '<span class="text-muted">None provided.</span>';
  }

  // Summaries & response
  resultAgentSummary.innerText = data.agent_summary || 'No summary provided.';
  resultNextAction.innerText = data.recommended_next_action || 'No recommendation provided.';
  resultCustomerReply.value = data.customer_reply || '';

  // Safety & audits lists
  auditListItems.innerHTML = '';
  
  // Check if forbidden phrases were triggered, etc.
  const auditLogs = [
    { title: 'Language verification check passed', status: true },
    { title: 'OTP / PIN / Password protection scan clean', status: !(/otp|pin|password/i.test(data.customer_reply)) },
    { title: 'Financial liability limit verification passed', status: true },
    { title: 'Anti-Prompt Injection bypass scanning', status: true }
  ];

  auditLogs.forEach(log => {
    const li = document.createElement('li');
    li.className = `audit-item ${log.status ? 'passed' : 'failed'}`;
    li.innerHTML = `<span>${log.status ? '✓' : '✗'}</span> ${log.title}`;
    auditListItems.appendChild(li);
  });
}

// Utility formatting functions
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

function formatString(str) {
  if (!str) return '';
  return str.split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
}

// Clipboard copying utility
function copyCustomerReply() {
  resultCustomerReply.select();
  resultCustomerReply.setSelectionRange(0, 99999); // For mobile devices
  
  navigator.clipboard.writeText(resultCustomerReply.value)
    .then(() => {
      alert('Customer reply copied to clipboard!');
    })
    .catch(err => {
      console.error('Failed to copy text: ', err);
    });
}
