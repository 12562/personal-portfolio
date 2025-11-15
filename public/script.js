// -------------------- General Setup --------------------

// Fill current year
document.getElementById('year').textContent = new Date().getFullYear();

// Smooth scrolling with temporary tabindex for accessibility
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', function(e){
    const target = this.getAttribute('href');
    if(target && target.startsWith('#')){
      e.preventDefault();
      const el = document.querySelector(target);
      if(el){
        el.scrollIntoView({behavior:'smooth', block:'start'});
        el.setAttribute('tabindex','-1');
        el.focus({preventScroll:true});
        el.removeAttribute('tabindex');
      }
    }
  });
});

// Section reveal on scroll
const sections = document.querySelectorAll('section');
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if(entry.isIntersecting) entry.target.classList.add('in-view');
  });
}, { threshold: 0.12 });
sections.forEach(s => observer.observe(s));

// -------------------- Contact Form --------------------

function submitContact(e){
  e.preventDefault();
  const formData = new FormData(document.getElementById("contactForm"));

  fetch("contact.php", { method: "POST", body: formData })
    .then(res => res.text())
    .then(res => {
      if(res.trim() === "success"){
        showFeedback("Message sent successfully!");
        document.getElementById("contactForm").reset();
      } else showFeedback("Error: " + res);
    })
    .catch(() => showFeedback("Error: Could not send message."));
}

function showFeedback(msg){
  document.getElementById('formFeedback').textContent = msg;
}

// -------------------- Hero Animation --------------------
window.addEventListener('load', ()=> {
  document.querySelectorAll('.hero .card, .hero-right, .tagline').forEach((el,i)=>{
    setTimeout(()=> el.classList.add('in-view'), i*120);
  });
});

// -------------------- Header Hide/Show --------------------
let lastScroll = 0;
const nav = document.querySelector("header");
window.addEventListener("scroll", () => {
  const currentScroll = window.pageYOffset;
  if (currentScroll > lastScroll && currentScroll > 80) nav.classList.add("hidden");
  else nav.classList.remove("hidden");
  lastScroll = currentScroll;
});

// -------------------- Firebase Setup --------------------
const firebaseConfig = {
  apiKey: "<your-key>",
  authDomain: "mohit-sharma-portfolio.firebaseapp.com",
  projectId: "mohit-sharma-portfolio",
  appId: "<app-id>"
};
firebase.initializeApp(firebaseConfig);

// Keep the compat functions client available as a fallback, but prefer
// calling the HTTP endpoints exposed by our `generateContent` function.
const functions = firebase.app().functions('us-central1');
let aiChatFn, projectGenFn, resumeAnalyzeFn, searchAIFn;
try {
  aiChatFn = functions.httpsCallable('aiChat');
  projectGenFn = functions.httpsCallable('projectGen');
  resumeAnalyzeFn = functions.httpsCallable('resumeAnalyze');
  searchAIFn = functions.httpsCallable('searchAI');
} catch (e) {
  // If callables are not deployed, we'll fallback to HTTP fetch below.
  console.debug('Callable functions not available; using HTTP endpoints fallback.');
}

function getFunctionsBase() {
  // Priority: meta tag in document head -> localhost emulator -> relative path
  const meta = document.querySelector('meta[name=functions-base]');
  const metaVal = meta?.getAttribute('content')?.trim();
  if (metaVal) return metaVal.replace(/\/$/, '');

  if (window.location.hostname.includes('localhost')) {
    // Default emulator host/port used by Firebase Functions emulator
    return `http://localhost:5001/${firebaseConfig.projectId}/us-central1/generateContent`;
  }

  // In production (hosting), call the public Cloud Functions URL directly so
  // we don't hit a missing rewrite and receive 404. This uses the standard
  // Cloud Functions pattern: https://<region>-<project>.cloudfunctions.net/<function>
  return `https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net/generateContent`.replace(/\/$/, '');
}

const FUNCTIONS_BASE = getFunctionsBase();

// -------------------- Chat Widget --------------------
const chatButton = document.createElement('button');
chatButton.id = "chatButton";
chatButton.textContent = "Ask Mohit";
Object.assign(chatButton.style, {position:'fixed',bottom:'18px',right:'18px',padding:'10px 14px',borderRadius:'8px',zIndex:2000});
document.body.appendChild(chatButton);

const chatBox = document.createElement('div');
chatBox.id = "chatBox";
Object.assign(chatBox.style, {position:'fixed',bottom:'70px',right:'18px',width:'320px',height:'420px',background:'#fff',borderRadius:'8px',padding:'12px',boxShadow:'0 8px 30px rgba(0,0,0,0.08)',overflow:'hidden',display:'none',zIndex:2000});
chatBox.innerHTML = `
  <div id="chatContent" style="height:330px;overflow-y:auto;margin-bottom:8px;"></div>
  <div style="display:flex;gap:6px;">
    <input id="aiInput" placeholder="Ask about projects, skills, resume…" style="flex:1;padding:8px;border-radius:6px;border:1px solid #ddd">
    <button id="aiSend" class="btn">Send</button>
  </div>`;
document.body.appendChild(chatBox);

chatButton.onclick = () => chatBox.style.display = chatBox.style.display === 'none' ? 'block' : 'none';
const chatContent = chatBox.querySelector('#chatContent');

function addChatMessage(who, text){
  const msg = document.createElement('div');
  msg.innerHTML = `<strong>${who}:</strong><div style="margin:4px 0 8px 0;">${text}</div>`;
  chatContent.appendChild(msg);
  chatContent.scrollTop = chatContent.scrollHeight;
}

document.getElementById('aiSend').onclick = async () => {
  const input = document.getElementById('aiInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  addChatMessage('You', msg);

  const thinkingMsg = document.createElement('div');
  thinkingMsg.innerHTML = `<strong>Ask Mohit:</strong><div style="margin:4px 0 8px 0;">...thinking...</div>`;
  chatContent.appendChild(thinkingMsg);
  chatContent.scrollTop = chatContent.scrollHeight;

  // Attempt HTTP endpoint first, then fall back to callable if present
  try {
    const url = `${FUNCTIONS_BASE}/chat`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg }),
    });

    if (r.ok) {
      const json = await r.json();
      const reply = json?.response || json?.reply || '(no reply)';
      thinkingMsg.innerHTML = `<strong>Ask Mohit:</strong><div style="margin:4px 0 8px 0;">${reply}</div>`;
      return;
    }

    // If HTTP returned a non-OK status, try callable as fallback
    console.warn('HTTP chat endpoint returned', r.status, r.statusText);
  } catch (err) {
    console.debug('HTTP chat request failed, will try callable:', err);
  }

  // Fallback: callable function (if available)
  if (aiChatFn) {
    try {
      const res = await aiChatFn({ message: msg });
      thinkingMsg.innerHTML = `<strong>Ask Mohit:</strong><div style="margin:4px 0 8px 0;">${res.data?.reply || res.data?.response || '(no reply)'}</div>`;
      return;
    } catch (e) {
      console.error('Callable chat failed:', e);
    }
  }

  thinkingMsg.innerHTML = `<strong>Ask Mohit:</strong><div style="margin:4px 0 8px 0;">Sorry — error contacting AI.</div>`;
};

// -------------------- Project Generator --------------------
document.getElementById('pgGen').onclick = async () => {
  const title = document.getElementById('pgTitle').value;
  const tech = document.getElementById('pgTech').value;
  const details = document.getElementById('pgDetails').value;
  const out = document.getElementById('pgOutput');
  out.textContent = 'Generating...';
  // Try HTTP endpoint then callable fallback
  try {
    const url = `${FUNCTIONS_BASE}/projectGen`;
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: `${title}\n${tech}\n${details}` }) });
    if (r.ok) {
      const json = await r.json();
      out.textContent = json?.response || json?.generated || JSON.stringify(json);
      return;
    }
    console.warn('HTTP projectGen returned', r.status);
  } catch (err) {
    console.debug('HTTP projectGen failed, trying callable:', err);
  }

  if (projectGenFn) {
    try {
      const res = await projectGenFn({ title, tech, details });
      out.textContent = res.data.generated || JSON.stringify(res.data);
      return;
    } catch (err) {
      console.error('Callable projectGen failed:', err);
    }
  }

  out.textContent = 'Error generating description';
};

// -------------------- Resume Analyzer --------------------
document.getElementById('analyzeBtn').onclick = async () => {
  const jobText = document.getElementById('jobText').value;
  const resEl = document.getElementById('analysisResult');
  resEl.textContent = 'Analyzing...';
  try {
    const url = `${FUNCTIONS_BASE}/resumeAnalyze`;
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resumeText: jobText }) });
    if (r.ok) {
      const json = await r.json();
      resEl.textContent = json?.response || json?.analysis || JSON.stringify(json);
      return;
    }
    console.warn('HTTP resumeAnalyze returned', r.status);
  } catch (err) {
    console.debug('HTTP resumeAnalyze failed, trying callable:', err);
  }

  if (resumeAnalyzeFn) {
    try {
      const res = await resumeAnalyzeFn({ jobText });
      resEl.textContent = res.data.analysis || JSON.stringify(res.data);
      return;
    } catch (err) {
      console.error('Callable resumeAnalyze failed:', err);
    }
  }

  resEl.textContent = 'Error analyzing';
};

// -------------------- AI Search --------------------
document.getElementById('aiSearchBtn').onclick = async () => {
  const q = document.getElementById('aiSearchQuery').value;
  const rEl = document.getElementById('searchResult');
  rEl.textContent = 'Searching...';
  try {
    const url = `${FUNCTIONS_BASE}/search`;
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) });
    if (r.ok) {
      const json = await r.json();
      rEl.textContent = json?.response || json?.results || JSON.stringify(json);
      return;
    }
    console.warn('HTTP search returned', r.status);
  } catch (err) {
    console.debug('HTTP search failed, trying callable:', err);
  }

  if (searchAIFn) {
    try {
      const res = await searchAIFn({ query: q });
      rEl.textContent = res.data.results || JSON.stringify(res.data);
      return;
    } catch (err) {
      console.error('Callable search failed:', err);
    }
  }

  rEl.textContent = 'Error searching';
};

