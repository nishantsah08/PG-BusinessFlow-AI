const apiBaseEl = document.getElementById('apiBase');
const personaSelectEl = document.getElementById('personaSelect');
const fromPhoneEl = document.getElementById('fromPhone');
const messageBodyEl = document.getElementById('messageBody');
const imageInputEl = document.getElementById('imageInput');
const sendBtnEl = document.getElementById('sendBtn');
const refreshBtnEl = document.getElementById('refreshBtn');
const clearBtnEl = document.getElementById('clearBtn');
const statusBoxEl = document.getElementById('statusBox');
const threadListEl = document.getElementById('threadList');
const threadPhoneEl = document.getElementById('threadPhone');

function setStatus(msg, data = null) {
  statusBoxEl.textContent = data ? `${msg}\n${JSON.stringify(data, null, 2)}` : msg;
}

function apiUrl(path) {
  return `${apiBaseEl.value.replace(/\/$/, '')}${path}`;
}

function renderThread(items = []) {
  threadListEl.innerHTML = '';
  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'item';
    empty.textContent = 'No events yet.';
    threadListEl.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const card = document.createElement('div');
    card.className = `item ${item.direction}`;

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${item.direction.toUpperCase()} | ${item.at}`;

    const body = document.createElement('div');
    body.className = 'body';
    body.textContent = item.body || '';

    card.appendChild(meta);
    card.appendChild(body);

    if (item.media) {
      const media = document.createElement('div');
      media.className = 'media';
      media.textContent = `Media: ${JSON.stringify(item.media)}`;
      card.appendChild(media);
    }

    threadListEl.appendChild(card);
  });
}

function extractTextFromPayload(payload, fallback = '') {
  return (
    payload?.data?.body ??
    payload?.data?.text ??
    payload?.data?.message ??
    payload?.data?.inbound_event?.body ??
    payload?.data?.synthetic_payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body ??
    payload?.data?.messages?.[0]?.text?.body ??
    fallback
  );
}

async function uploadImages(files) {
  if (!files || files.length === 0) return [];
  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append('images', file));

  const response = await fetch(apiUrl('/api/upload/images'), {
    method: 'POST',
    body: formData
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || 'Image upload failed');
  }
  return payload?.data?.urls || [];
}

async function refreshThread() {
  const phone = fromPhoneEl.value.trim();
  threadPhoneEl.textContent = phone;

  const response = await fetch(apiUrl(`/api/simulator/whatsapp/thread?phone=${encodeURIComponent(phone)}`));
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || 'Failed to load thread');
  }

  renderThread(payload?.data?.items || []);
}

async function sendInbound() {
  const phone = fromPhoneEl.value.trim();
  const body = messageBodyEl.value.trim();
  if (!phone) {
    setStatus('Phone is required.');
    return;
  }

  sendBtnEl.disabled = true;
  try {
    setStatus('Uploading images...');
    const imageUrls = await uploadImages(imageInputEl.files);

    setStatus('Sending inbound simulator message...');
    const response = await fetch(apiUrl('/api/simulator/whatsapp/send'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: phone, body, image_urls: imageUrls })
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || 'Failed to send simulator message');
    }

    const responseText = extractTextFromPayload(payload, body);
    setStatus(`Inbound sent${responseText ? `: ${responseText}` : ''}`, payload);
    imageInputEl.value = '';
    await refreshThread();
  } catch (error) {
    setStatus(`Error: ${error.message}`);
  } finally {
    sendBtnEl.disabled = false;
  }
}

async function clearThread() {
  const phone = fromPhoneEl.value.trim();
  const response = await fetch(apiUrl(`/api/simulator/whatsapp/thread?phone=${encodeURIComponent(phone)}`), {
    method: 'DELETE'
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || 'Failed to clear thread');
  }
  setStatus('Thread cleared.', payload);
  await refreshThread();
}

personaSelectEl.addEventListener('change', () => {
  fromPhoneEl.value = personaSelectEl.value;
  refreshThread().catch((err) => setStatus(`Error: ${err.message}`));
});

sendBtnEl.addEventListener('click', () => sendInbound());
refreshBtnEl.addEventListener('click', () => refreshThread().catch((err) => setStatus(`Error: ${err.message}`)));
clearBtnEl.addEventListener('click', () => clearThread().catch((err) => setStatus(`Error: ${err.message}`)));

setInterval(() => {
  refreshThread().catch(() => {});
}, 2500);

refreshThread().catch((err) => setStatus(`Error: ${err.message}`));
