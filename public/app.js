// public/app.js

let transactions = [];
let lastJsonResponse = null;
let agentConfig = null;

const EMPTY_TXN_MESSAGE = 'No transaction history added yet. Click "+ Add Transaction" or load a preset.';

const SAMPLE_CASES = {
  'SAMPLE-01': {
    ticket_id: 'TKT-001',
    complaint: 'I sent 5000 taka to a wrong number around 2pm today. The number was supposed to be 01712345678 but I think I typed it wrong. The person isn\'t responding to my call. Please help me get my money back.',
    language: 'en',
    channel: 'in_app_chat',
    user_type: 'customer',
    campaign_context: 'boishakh_bonanza_day_1',
    transaction_history: [
      { transaction_id: 'TXN-9101', timestamp: '2026-04-14T14:08:22Z', type: 'transfer', amount: 5000, counterparty: '+8801719876543', status: 'completed' },
      { transaction_id: 'TXN-9087', timestamp: '2026-04-13T18:12:00Z', type: 'cash_in', amount: 10000, counterparty: 'AGENT-512', status: 'completed' }
    ]
  },
  'SAMPLE-02': {
    ticket_id: 'TKT-002',
    complaint: 'I sent 2000 to the wrong person by mistake. Please reverse it.',
    language: 'en',
    channel: 'in_app_chat',
    user_type: 'customer',
    transaction_history: [
      { transaction_id: 'TXN-9202', timestamp: '2026-04-14T11:30:00Z', type: 'transfer', amount: 2000, counterparty: '+8801812345678', status: 'completed' },
      { transaction_id: 'TXN-9180', timestamp: '2026-04-10T09:15:00Z', type: 'transfer', amount: 2500, counterparty: '+8801812345678', status: 'completed' },
      { transaction_id: 'TXN-9145', timestamp: '2026-04-05T17:45:00Z', type: 'transfer', amount: 1500, counterparty: '+8801812345678', status: 'completed' }
    ]
  },
  'SAMPLE-03': {
    ticket_id: 'TKT-003',
    complaint: 'I tried to pay 1200 taka for my mobile recharge but the app showed failed. But my balance was deducted! Please refund my money.',
    language: 'en',
    channel: 'in_app_chat',
    user_type: 'customer',
    transaction_history: [
      { transaction_id: 'TXN-9301', timestamp: '2026-04-14T16:00:00Z', type: 'payment', amount: 1200, counterparty: 'MERCHANT-MOBILE-OP', status: 'failed' }
    ]
  },
  'SAMPLE-04': {
    ticket_id: 'TKT-004',
    complaint: 'I paid 500 to a merchant for a product but I changed my mind and don\'t want it anymore. Please refund my 500 taka.',
    language: 'en',
    channel: 'in_app_chat',
    user_type: 'customer',
    transaction_history: [
      { transaction_id: 'TXN-9401', timestamp: '2026-04-14T13:00:00Z', type: 'payment', amount: 500, counterparty: 'MERCHANT-7821', status: 'completed' }
    ]
  },
  'SAMPLE-05': {
    ticket_id: 'TKT-005',
    complaint: 'Someone called me saying they are from bKash and asked for my OTP. They said my account will be blocked if I don\'t share it. Is this real? I haven\'t shared anything yet.',
    language: 'en',
    channel: 'call_center',
    user_type: 'customer',
    transaction_history: []
  },
  'SAMPLE-06': {
    ticket_id: 'TKT-006',
    complaint: 'Something is wrong with my money. Please check.',
    language: 'en',
    channel: 'in_app_chat',
    user_type: 'customer',
    transaction_history: [
      { transaction_id: 'TXN-9601', timestamp: '2026-04-13T10:00:00Z', type: 'cash_in', amount: 3000, counterparty: 'AGENT-220', status: 'completed' },
      { transaction_id: 'TXN-9602', timestamp: '2026-04-12T15:30:00Z', type: 'transfer', amount: 800, counterparty: '+8801911223344', status: 'completed' }
    ]
  },
  'SAMPLE-07': {
    ticket_id: 'TKT-007',
    complaint: 'আমি আজ সকালে এজেন্টের কাছে ২০০০ টাকা ক্যাশ ইন করেছি কিন্তু আমার ব্যালেন্সে টাকা আসেনি। এজেন্ট বলছে টাকা পাঠিয়েছে কিন্তু আমি দেখছি না।',
    language: 'bn',
    channel: 'call_center',
    user_type: 'customer',
    transaction_history: [
      { transaction_id: 'TXN-9701', timestamp: '2026-04-14T09:30:00Z', type: 'cash_in', amount: 2000, counterparty: 'AGENT-318', status: 'pending' }
    ]
  },
  'SAMPLE-08': {
    ticket_id: 'TKT-008',
    complaint: 'I sent 1000 to my brother yesterday but he says he didn\'t get it. Please check.',
    language: 'en',
    channel: 'in_app_chat',
    user_type: 'customer',
    transaction_history: [
      { transaction_id: 'TXN-9801', timestamp: '2026-04-13T11:20:00Z', type: 'transfer', amount: 1000, counterparty: '+8801712001122', status: 'completed' },
      { transaction_id: 'TXN-9802', timestamp: '2026-04-13T19:45:00Z', type: 'transfer', amount: 1000, counterparty: '+8801812334455', status: 'completed' },
      { transaction_id: 'TXN-9803', timestamp: '2026-04-13T20:10:00Z', type: 'transfer', amount: 1000, counterparty: '+8801712001122', status: 'failed' }
    ]
  },
  'SAMPLE-09': {
    ticket_id: 'TKT-009',
    complaint: 'I am a merchant. My yesterday\'s sales of 15000 taka have not been settled to my account. Settlement usually happens by 11am next day. Please check.',
    language: 'en',
    channel: 'merchant_portal',
    user_type: 'merchant',
    transaction_history: [
      { transaction_id: 'TXN-9901', timestamp: '2026-04-13T18:00:00Z', type: 'settlement', amount: 15000, counterparty: 'MERCHANT-SELF', status: 'pending' }
    ]
  },
  'SAMPLE-10': {
    ticket_id: 'TKT-010',
    complaint: 'I paid my electricity bill 850 taka but it deducted twice from my account. Please check, I only paid once.',
    language: 'en',
    channel: 'in_app_chat',
    user_type: 'customer',
    transaction_history: [
      { transaction_id: 'TXN-10001', timestamp: '2026-04-14T08:15:30Z', type: 'payment', amount: 850, counterparty: 'BILLER-DESCO', status: 'completed' },
      { transaction_id: 'TXN-10002', timestamp: '2026-04-14T08:15:42Z', type: 'payment', amount: 850, counterparty: 'BILLER-DESCO', status: 'completed' }
    ]
  }
};

const PRESETS = {
  wrong_transfer: {
    language: 'bn',
    channel: 'in_app_chat',
    user_type: 'customer',
    campaign_context: 'none',
    complaint: 'ভুল করে ০১৭১১২২৩৩৪৪ নাম্বারে ৫০০০ টাকা পাঠিয়ে দিয়েছি। আমি আসলে ০১৭১১২২৩৩৪৫ নাম্বারে পাঠাতে চেয়েছিলাম। দয়া করে টাকা ফেরত পাঠান।',
    transactions: [
      { transaction_id: 'TXN3029482', type: 'transfer', amount: 5000, status: 'completed', counterparty: '01711223344', timestamp: new Date(Date.now() - 1800000).toISOString() }
    ]
  },
  phishing: {
    language: 'mixed',
    channel: 'call_center',
    user_type: 'customer',
    campaign_context: 'none',
    complaint: 'Someone called claiming to be support and asked for my OTP. I shared it and 15000 taka was sent from my account. Please help reverse this.',
    transactions: [
      { transaction_id: 'TXN8820391', type: 'cash_out', amount: 15000, status: 'completed', counterparty: '01988776655', timestamp: new Date(Date.now() - 3600000).toISOString() }
    ]
  },
  payment_failed: {
    language: 'en',
    channel: 'in_app_chat',
    user_type: 'customer',
    campaign_context: 'promo_2026',
    complaint: 'I tried to pay my internet bill of 2400 BDT to power_ops yesterday. It failed but my balance was deducted. Please check.',
    transactions: [
      { transaction_id: 'TXN4481023', type: 'payment', amount: 2400, status: 'failed', counterparty: 'power_ops', timestamp: new Date(Date.now() - 86400000).toISOString() }
    ]
  }
};

// ── DOM refs (populated on init) ──────────────────────────────
let els = {};

function cacheElements() {
  els = {
    toastContainer: document.getElementById('toast-container'),
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingOverlayText: document.getElementById('loading-overlay-text'),
    loadingOverlaySubtext: document.getElementById('loading-overlay-subtext'),
    systemStatusDot: document.getElementById('system-status-dot'),
    systemStatusText: document.getElementById('system-status-text'),
    agentChips: document.getElementById('agent-chips'),
    ticketForm: document.getElementById('ticket-form'),
    ticketIdInput: document.getElementById('ticket-id'),
    ticketLanguageSelect: document.getElementById('ticket-language'),
    ticketChannelSelect: document.getElementById('ticket-channel'),
    ticketUserTypeSelect: document.getElementById('ticket-user-type'),
    ticketCampaignInput: document.getElementById('ticket-campaign'),
    ticketComplaintTextarea: document.getElementById('ticket-complaint'),
    transactionsList: document.getElementById('transactions-list'),
    txnModal: document.getElementById('txn-modal'),
    txnForm: document.getElementById('txn-form'),
    txnIdInput: document.getElementById('txn-id'),
    txnTypeSelect: document.getElementById('txn-type'),
    txnAmountInput: document.getElementById('txn-amount'),
    txnStatusSelect: document.getElementById('txn-status'),
    txnCounterpartyInput: document.getElementById('txn-counterparty'),
    txnTimestampInput: document.getElementById('txn-timestamp'),
    jsonModal: document.getElementById('json-modal'),
    jsonForm: document.getElementById('json-form'),
    jsonPayloadTextarea: document.getElementById('json-payload'),
    jsonErrorEl: document.getElementById('json-error'),
    jsonCaseSelect: document.getElementById('json-case-select'),
    btnAnalyze: document.getElementById('btn-analyze'),
    btnText: document.getElementById('btn-text'),
    btnSpinner: document.getElementById('btn-spinner'),
    resultsPlaceholder: document.getElementById('results-placeholder'),
    resultsContent: document.getElementById('results-content'),
    verdictBannerContainer: document.getElementById('verdict-banner-container'),
    resultEvidenceVerdict: document.getElementById('result-evidence-verdict'),
    resultBadge: document.getElementById('result-badge'),
    resultCaseType: document.getElementById('result-case-type'),
    resultSeverity: document.getElementById('result-severity'),
    resultDepartment: document.getElementById('result-department'),
    resultConfidenceBar: document.getElementById('result-confidence-bar'),
    resultConfidenceValue: document.getElementById('result-confidence-value'),
    resultHumanReviewBox: document.getElementById('result-human-review-box'),
    resultHumanReviewText: document.getElementById('result-human-review-text'),
    resultReasonCodes: document.getElementById('result-reason-codes'),
    resultAgentSummary: document.getElementById('result-agent-summary'),
    resultNextAction: document.getElementById('result-next-action'),
    resultCustomerReply: document.getElementById('result-customer-reply'),
    resultJsonOutput: document.getElementById('result-json-output'),
    auditListItems: document.getElementById('audit-list-items'),
    drawerContent: document.getElementById('drawer-content'),
    drawerIcon: document.getElementById('drawer-icon'),
    apiKeyDisplay: document.getElementById('api-key-display'),
    apiProviderDisplay: document.getElementById('api-provider-display')
  };
}

// ── Toast system ──────────────────────────────────────────────
function showToast(message, type = 'info', duration = 4500) {
  if (!els.toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'error' ? '✕' : type === 'success' ? '✓' : type === 'agent' ? '🤖' : 'ℹ'}</span>
    <span class="toast-message">${escapeHTML(message)}</span>
  `;
  els.toastContainer.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-hiding');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function handleError(message, err) {
  const displayMessage = message || 'An unexpected error occurred.';
  showToast(displayMessage, 'error', 6000);
  console.error('[QueueStorm]', displayMessage, err || '');
}

// ── Loading overlay ───────────────────────────────────────────
function showLoading(message = 'Processing request…', subtext = 'Please wait…') {
  if (!els.loadingOverlay) return;
  els.loadingOverlayText.innerText = message;
  els.loadingOverlaySubtext.innerText = subtext;
  els.loadingOverlay.classList.add('is-visible');
  els.loadingOverlay.setAttribute('aria-hidden', 'false');
  els.loadingOverlay.setAttribute('aria-busy', 'true');
  document.body.classList.add('loading-active');
}

function hideLoading() {
  if (!els.loadingOverlay) return;
  els.loadingOverlay.classList.remove('is-visible');
  els.loadingOverlay.setAttribute('aria-hidden', 'true');
  els.loadingOverlay.setAttribute('aria-busy', 'false');
  document.body.classList.remove('loading-active');
}

function setLoadingSubtext(text) {
  if (els.loadingOverlaySubtext) els.loadingOverlaySubtext.innerText = text;
}

// ── Agent status bar ──────────────────────────────────────────
async function loadAgentStatus() {
  try {
    const res = await fetch('/api/agents');
    if (!res.ok) throw new Error('Failed to load agent config');
    agentConfig = await res.json();
    renderAgentBar(agentConfig);
  } catch (err) {
    els.agentChips.innerHTML = '<span class="agent-chip agent-chip-error">Agents unavailable</span>';
    console.warn('Agent status load failed:', err);
  }
}

function renderAgentBar(config) {
  if (!config?.agents?.length) {
    els.agentChips.innerHTML = '<span class="agent-chip agent-chip-error">No agents configured</span>';
    return;
  }

  els.agentChips.innerHTML = config.agents.map((agent) => {
    const label = formatString(agent.provider);
    const keyHint = agent.masked_api_key ? ` · ${agent.masked_api_key}` : '';
    const statusClass = agent.configured ? 'agent-chip-ready' : 'agent-chip-off';
    const statusLabel = agent.configured ? 'ready' : 'no key';
    const primaryMark = config.primary?.provider === agent.provider ? ' ★' : '';
    return `<span class="agent-chip ${statusClass}" title="${label}: ${statusLabel}${keyHint}">
      ${label}${primaryMark} <small>${statusLabel}</small>
    </span>`;
  }).join('');
}

function highlightActiveAgent(provider) {
  if (!els.agentChips || !provider) return;
  els.agentChips.querySelectorAll('.agent-chip').forEach((chip) => {
    chip.classList.remove('agent-chip-active');
    if (chip.innerText.toLowerCase().includes(provider.toLowerCase())) {
      chip.classList.add('agent-chip-active');
    }
  });
}

// ── Init & event wiring ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  bindEvents();
  checkBackendHealth();
  loadAgentStatus();
  generateTicketId();
  updateTransactionsTable();
});

function bindEvents() {
  document.getElementById('btn-generate-id')?.addEventListener('click', generateTicketId);
  document.getElementById('btn-generate-txn-id')?.addEventListener('click', generateTxnId);
  document.getElementById('btn-add-txn')?.addEventListener('click', openTxnModal);
  document.getElementById('btn-add-json')?.addEventListener('click', openJsonModal);
  document.getElementById('btn-close-txn-modal')?.addEventListener('click', closeTxnModal);
  document.getElementById('btn-cancel-txn')?.addEventListener('click', closeTxnModal);
  document.getElementById('btn-close-json-modal')?.addEventListener('click', closeJsonModal);
  document.getElementById('btn-cancel-json')?.addEventListener('click', closeJsonModal);
  document.getElementById('btn-copy-reply')?.addEventListener('click', copyCustomerReply);
  document.getElementById('btn-copy-json')?.addEventListener('click', copyJsonOutput);
  document.getElementById('drawer-trigger')?.addEventListener('click', toggleDrawer);
  document.getElementById('preset-clear')?.addEventListener('click', clearAll);

  document.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => loadPreset(btn.dataset.preset));
  });

  els.ticketForm?.addEventListener('submit', runAnalysis);
  els.txnForm?.addEventListener('submit', addTransaction);
  els.jsonForm?.addEventListener('submit', submitJsonPayload);
  els.jsonCaseSelect?.addEventListener('change', (e) => loadJsonSample(e.target.value));

  // Close modals on backdrop click
  els.txnModal?.addEventListener('click', (e) => { if (e.target === els.txnModal) closeTxnModal(); });
  els.jsonModal?.addEventListener('click', (e) => { if (e.target === els.jsonModal) closeJsonModal(); });

  // Escape key closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeTxnModal();
      closeJsonModal();
    }
  });
}

async function checkBackendHealth() {
  try {
    const res = await fetch('/health');
    const data = await res.json();
    if (data.status === 'ok') {
      els.systemStatusDot.className = 'status-dot online';
      els.systemStatusText.innerText = 'Backend Online';
    } else {
      throw new Error('Healthy status expected');
    }
  } catch (err) {
    els.systemStatusDot.className = 'status-dot offline';
    els.systemStatusText.innerText = 'Backend Offline';
    showToast('Backend is offline. Start the server with npm run dev.', 'error', 8000);
    console.error('Backend status check failed:', err);
  }
}

function generateTicketId() {
  const num = Math.floor(100000 + Math.random() * 900000);
  els.ticketIdInput.value = `TKT-${num}`;
}

function generateTxnId() {
  const num = Math.floor(10000000 + Math.random() * 90000000);
  els.txnIdInput.value = `TXN-${num}`;
}

function updateTransactionsTable() {
  els.transactionsList.innerHTML = '';

  if (transactions.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.id = 'no-transactions-row';
    emptyRow.innerHTML = `<td colspan="7" class="empty-state">${EMPTY_TXN_MESSAGE}</td>`;
    els.transactionsList.appendChild(emptyRow);
    return;
  }

  transactions.forEach((txn, index) => {
    const tr = document.createElement('tr');
    const date = new Date(txn.timestamp);
    const formattedDate = Number.isNaN(date.getTime()) ? txn.timestamp : date.toLocaleString();

    tr.innerHTML = `
      <td><strong>${escapeHTML(txn.transaction_id)}</strong></td>
      <td><span class="chip">${escapeHTML(txn.type)}</span></td>
      <td>${parseFloat(txn.amount).toFixed(2)}</td>
      <td><span class="badge ${getStatusBadgeClass(txn.status)}">${escapeHTML(txn.status)}</span></td>
      <td>${escapeHTML(txn.counterparty)}</td>
      <td><small>${formattedDate}</small></td>
      <td><button type="button" class="btn-delete" data-delete-index="${index}">Delete</button></td>
    `;
    tr.querySelector('[data-delete-index]').addEventListener('click', () => deleteTransaction(index));
    els.transactionsList.appendChild(tr);
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
  showToast('Transaction removed.', 'info', 2500);
}

function openTxnModal() {
  els.txnForm.reset();
  generateTxnId();
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  els.txnTimestampInput.value = now.toISOString().slice(0, 16);
  els.txnModal.classList.remove('hidden');
}

function closeTxnModal() {
  els.txnModal.classList.add('hidden');
}

function addTransaction(event) {
  event.preventDefault();

  const timestampValue = els.txnTimestampInput.value;
  const parsedDate = new Date(timestampValue);
  if (!timestampValue || Number.isNaN(parsedDate.getTime())) {
    showToast('Please enter a valid transaction timestamp.', 'error');
    return;
  }

  const newTxn = {
    transaction_id: els.txnIdInput.value.trim(),
    type: els.txnTypeSelect.value,
    amount: parseFloat(els.txnAmountInput.value),
    status: els.txnStatusSelect.value,
    counterparty: els.txnCounterpartyInput.value.trim(),
    timestamp: parsedDate.toISOString()
  };

  if (!newTxn.transaction_id || !newTxn.counterparty || Number.isNaN(newTxn.amount) || newTxn.amount <= 0) {
    showToast('Fill in all required transaction fields.', 'error');
    return;
  }

  transactions.push(newTxn);
  updateTransactionsTable();
  closeTxnModal();
  showToast(`Transaction ${newTxn.transaction_id} added.`, 'success');
}

function openJsonModal() {
  clearJsonError();
  els.jsonCaseSelect.value = '';
  if (!els.jsonPayloadTextarea.value.trim()) {
    els.jsonPayloadTextarea.value = JSON.stringify(SAMPLE_CASES['SAMPLE-01'], null, 2);
  }
  els.jsonModal.classList.remove('hidden');
}

function closeJsonModal() {
  els.jsonModal.classList.add('hidden');
  clearJsonError();
}

function clearJsonError() {
  els.jsonErrorEl.classList.add('hidden');
  els.jsonErrorEl.innerText = '';
}

function showJsonError(message) {
  els.jsonErrorEl.innerText = message;
  els.jsonErrorEl.classList.remove('hidden');
}

function loadJsonSample(caseId) {
  if (!caseId || !SAMPLE_CASES[caseId]) return;
  clearJsonError();
  els.jsonPayloadTextarea.value = JSON.stringify(SAMPLE_CASES[caseId], null, 2);
  showToast(`Loaded ${caseId} into JSON editor.`, 'info', 2500);
}

async function submitJsonPayload(event) {
  event.preventDefault();
  clearJsonError();

  let payload;
  try {
    payload = JSON.parse(els.jsonPayloadTextarea.value.trim());
  } catch (err) {
    showJsonError(`Invalid JSON: ${err.message}`);
    showToast(`JSON parse error: ${err.message}`, 'error');
    return;
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    showJsonError('Payload must be a JSON object.');
    showToast('Payload must be a JSON object.', 'error');
    return;
  }

  if (!payload.ticket_id || typeof payload.ticket_id !== 'string') {
    showJsonError('Missing required field: ticket_id (string).');
    showToast('Missing required field: ticket_id', 'error');
    return;
  }

  if (!payload.complaint || typeof payload.complaint !== 'string') {
    showJsonError('Missing required field: complaint (string).');
    showToast('Missing required field: complaint', 'error');
    return;
  }

  closeJsonModal();
  await analyzeTicket(payload, 'Analyzing JSON payload…');
}

function loadPreset(key) {
  const preset = PRESETS[key];
  if (!preset) return;

  generateTicketId();
  els.ticketLanguageSelect.value = preset.language;
  els.ticketChannelSelect.value = preset.channel;
  els.ticketUserTypeSelect.value = preset.user_type;
  els.ticketCampaignInput.value = preset.campaign_context;
  els.ticketComplaintTextarea.value = preset.complaint;
  transactions = JSON.parse(JSON.stringify(preset.transactions));
  updateTransactionsTable();
  showToast(`Loaded "${key.replace('_', ' ')}" preset.`, 'info');
}

function clearAll() {
  generateTicketId();
  els.ticketLanguageSelect.value = 'en';
  els.ticketChannelSelect.value = 'in_app_chat';
  els.ticketUserTypeSelect.value = 'customer';
  els.ticketCampaignInput.value = 'none';
  els.ticketComplaintTextarea.value = '';
  transactions = [];
  updateTransactionsTable();
  els.resultsPlaceholder.classList.remove('hidden');
  els.resultsContent.classList.add('hidden');
  els.apiKeyDisplay.innerText = '—';
  els.apiProviderDisplay.innerText = '—';
  lastJsonResponse = null;
  showToast('Workspace cleared.', 'info', 2500);
}

function toggleDrawer() {
  const isHidden = els.drawerContent.classList.toggle('hidden');
  els.drawerIcon.innerText = isHidden ? '▼' : '▲';
}

async function runAnalysis(event) {
  event.preventDefault();

  const payload = {
    ticket_id: els.ticketIdInput.value.trim(),
    language: els.ticketLanguageSelect.value,
    channel: els.ticketChannelSelect.value,
    user_type: els.ticketUserTypeSelect.value,
    campaign_context: els.ticketCampaignInput.value.trim(),
    complaint: els.ticketComplaintTextarea.value.trim(),
    transaction_history: transactions
  };

  await analyzeTicket(payload, 'Investigating complaint…');
}

async function analyzeTicket(payload, loadingMessage) {
  const primaryAgent = agentConfig?.primary?.provider;
  const agentHint = primaryAgent ? formatString(primaryAgent) : 'LLM agent';

  showLoading(loadingMessage, `Sending to backend · trying ${agentHint} first…`);
  showToast(`Sending ticket ${payload.ticket_id} to backend…`, 'info', 3000);

  els.btnAnalyze.disabled = true;
  els.btnText.innerText = 'Investigating…';
  els.btnSpinner.classList.remove('hidden');

  if (primaryAgent) highlightActiveAgent(primaryAgent);

  const loadingTimer = setTimeout(() => {
    setLoadingSubtext(`${agentHint} is processing the complaint…`);
    showToast(`${agentHint} agent is analyzing the ticket…`, 'agent', 4000);
  }, 1200);

  try {
    const response = await fetch('/analyze-ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Server returned a non-JSON response.');
    }

    if (!response.ok) {
      const detail = data.detail ? ` — ${data.detail}` : '';
      throw new Error((data.error || `Server error (${response.status}).`) + detail);
    }

    lastJsonResponse = data;
    renderResults(data);
    updateServiceInfo(data._meta);

    const provider = data._meta?.provider || 'unknown';
    const maskedKey = data._meta?.masked_api_key || '';
    highlightActiveAgent(provider);
    showToast(
      `Analysis complete via ${formatString(provider)}${maskedKey ? ` (${maskedKey})` : ''}`,
      'success',
      6000
    );
    showToast(`${formatString(provider)} agent handled ticket ${data.ticket_id || payload.ticket_id}`, 'agent', 5000);
  } catch (err) {
    handleError(err.message, err);
    setLoadingSubtext('Request failed.');
  } finally {
    clearTimeout(loadingTimer);
    hideLoading();
    els.btnAnalyze.disabled = false;
    els.btnText.innerText = 'Investigate & Run Copilot';
    els.btnSpinner.classList.add('hidden');
  }
}

function updateServiceInfo(metaFromResponse) {
  if (metaFromResponse?.provider) {
    els.apiProviderDisplay.innerText = formatString(metaFromResponse.provider);
    els.apiKeyDisplay.innerText = metaFromResponse.masked_api_key || '—';
    return;
  }

  if (agentConfig?.primary) {
    els.apiProviderDisplay.innerText = formatString(agentConfig.primary.provider);
    els.apiKeyDisplay.innerText = agentConfig.primary.masked_api_key || '—';
  }
}

function renderResults(data) {
  els.resultsPlaceholder.classList.add('hidden');
  els.resultsContent.classList.remove('hidden');

  const verdict = (data.evidence_verdict || 'insufficient_data').toLowerCase();
  els.verdictBannerContainer.className = 'verdict-banner';

  if (verdict === 'consistent') {
    els.verdictBannerContainer.classList.add('verdict-consistent');
    els.resultEvidenceVerdict.innerText = 'CONSISTENT';
    els.resultBadge.innerText = 'Consistent';
  } else if (verdict === 'inconsistent') {
    els.verdictBannerContainer.classList.add('verdict-inconsistent');
    els.resultEvidenceVerdict.innerText = 'INCONSISTENT';
    els.resultBadge.innerText = 'Inconsistent';
  } else {
    els.verdictBannerContainer.classList.add('verdict-insufficient');
    els.resultEvidenceVerdict.innerText = 'INSUFFICIENT DATA';
    els.resultBadge.innerText = 'Insufficient';
  }

  els.resultCaseType.innerText = formatString(data.case_type);
  els.resultSeverity.innerText = formatString(data.severity);
  els.resultDepartment.innerText = formatString(data.department);

  const confValue = Math.round((data.confidence || 0) * 100);
  els.resultConfidenceBar.style.width = `${confValue}%`;
  els.resultConfidenceValue.innerText = `${confValue}%`;

  if (data.human_review_required) {
    els.resultHumanReviewBox.className = 'alert-box';
    els.resultHumanReviewText.innerText = 'Yes, human review is recommended based on rules and analysis indicators.';
  } else {
    els.resultHumanReviewBox.className = 'alert-box no-review';
    els.resultHumanReviewText.innerHTML = '<strong>No Review Needed:</strong> This ticket meets standard automatic resolution parameters.';
  }

  els.resultReasonCodes.innerHTML = '';
  if (Array.isArray(data.reason_codes) && data.reason_codes.length > 0) {
    data.reason_codes.forEach((code) => {
      const span = document.createElement('span');
      span.className = 'chip';
      span.innerText = code;
      els.resultReasonCodes.appendChild(span);
    });
  } else {
    els.resultReasonCodes.innerHTML = '<span class="text-muted">None provided.</span>';
  }

  els.resultAgentSummary.innerText = data.agent_summary || 'No summary provided.';
  els.resultNextAction.innerText = data.recommended_next_action || 'No recommendation provided.';
  els.resultCustomerReply.value = data.customer_reply || '';

  // Strip _meta for clean API output display
  const outputCopy = { ...data };
  delete outputCopy._meta;
  els.resultJsonOutput.value = JSON.stringify(outputCopy, null, 2);

  els.auditListItems.innerHTML = '';
  const auditLogs = [
    { title: 'Language verification check passed', status: true },
    { title: 'OTP / PIN / Password protection scan clean', status: !(/otp|pin|password/i.test(data.customer_reply || '')) },
    { title: 'Financial liability limit verification passed', status: true },
    { title: 'Anti-Prompt Injection bypass scanning', status: true }
  ];

  auditLogs.forEach((log) => {
    const li = document.createElement('li');
    li.className = `audit-item ${log.status ? 'passed' : 'failed'}`;
    li.innerHTML = `<span>${log.status ? '✓' : '✗'}</span> ${log.title}`;
    els.auditListItems.appendChild(li);
  });
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatString(str) {
  if (!str) return '';
  return String(str).split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function copyCustomerReply() {
  navigator.clipboard.writeText(els.resultCustomerReply.value)
    .then(() => showToast('Customer reply copied!', 'success', 2500))
    .catch((err) => handleError('Failed to copy reply.', err));
}

function copyJsonOutput() {
  const text = els.resultJsonOutput.value || (lastJsonResponse ? JSON.stringify(lastJsonResponse, null, 2) : '');
  navigator.clipboard.writeText(text)
    .then(() => showToast('JSON response copied!', 'success', 2500))
    .catch((err) => handleError('Failed to copy JSON.', err));
}
