const chat = document.getElementById("chat");
const input = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const currentLlmDisplay = document.getElementById("current-llm");

const addLlmBtn = document.getElementById("add-llm-btn");
const llmModal = document.getElementById("llm-modal");
const closeModalBtn = document.getElementById("close-modal");
const llmList = document.getElementById("llm-list");
const addNewBtn = document.getElementById("add-new-btn");

const chatPage = document.getElementById("chat-page");
const addLlmPage = document.getElementById("add-llm-page");
const modelNameInput = document.getElementById("model-name");
const endpointUrlInput = document.getElementById("endpoint-url");
const apiKeyInput = document.getElementById("api-key");
const saveLlmBtn = document.getElementById("save-llm");
const cancelAddBtn = document.getElementById("cancel-add");

let llms = []; // {model, endpoint, apiKey}
let currentLLM = null; // index in llms
let conversationHistory = [];

// Near the top, after declaring llms and currentLLM
function loadLLMs() {
  const saved = localStorage.getItem('llmCredentials');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      llms = data.llms || [];
      currentLLM = data.current || null;
      updateCurrentDisplay();
      renderLlmList();
    } catch (e) {
      console.error('Failed to load saved LLMs:', e);
    }
  }
}

function saveLLMs() {
  const data = { llms, current: currentLLM };
  localStorage.setItem('llmCredentials', JSON.stringify(data));
}

// Call load on startup
loadLLMs();

// Optional: Clear storage button for security
// Add <button id="clear-storage">Clear Saved Credentials</button> in HTML
document.getElementById('clear-storage').addEventListener('click', () => {
  localStorage.removeItem('llmCredentials');
  llms = [];
  currentLLM = null;
  updateCurrentDisplay();
  renderLlmList();
  alert('Credentials cleared from local storage.');
});

function updateCurrentDisplay() {
if (currentLLM !== null) {
    currentLlmDisplay.textContent = `Chatting with: ${llms[currentLLM].model}`;
} else {
    currentLlmDisplay.textContent = "No LLM selected. Add one to start.";
}
}

function renderLlmList() {
llmList.innerHTML = "";
llms.forEach((llm, index) => {
    const item = document.createElement("div");
    item.classList.add("llm-item");

    const info = document.createElement("div");
    info.classList.add("llm-info");
    const name = document.createElement("div");
    name.classList.add("llm-name");
    name.textContent = llm.model;
    const endpoint = document.createElement("div");
    endpoint.classList.add("llm-endpoint");
    const MAX_VISIBLE = 45; // adjust this number as you prefer

    if (llm.endpoint.length > MAX_VISIBLE + 10) {
        const start = llm.endpoint.substring(0, 22);
        const end = llm.endpoint.substring(llm.endpoint.length - 18);
        endpoint.textContent = start + '...' + end;
        endpoint.title = llm.endpoint; // full url on hover
    } else {
        endpoint.textContent = llm.endpoint;
    }
    info.appendChild(name);
    info.appendChild(endpoint);

    const selectBtn = document.createElement("button");
    selectBtn.textContent = currentLLM === index ? "Selected" : "Select";
    selectBtn.disabled = currentLLM === index;
    selectBtn.onclick = () => {
    currentLLM = index;
    updateCurrentDisplay();
    renderLlmList();
    llmModal.style.display = "none";
    };
    saveLLMs();

    item.appendChild(info);
    item.appendChild(selectBtn);
    llmList.appendChild(item);
});
}

function renderMarkdown(text) {
    // Convert markdown → HTML
    const html = marked.parse(text, {
        breaks: true,           // render new lines as <br>
        gfm: true               // GitHub flavored markdown
    });

    // Create temporary container
    const div = document.createElement('div');
    div.innerHTML = html;

    // Highlight all code blocks
    div.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });

    return div;
}

function addMessage(content, isUser = false) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", isUser ? "user" : "bot");

    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.gap = "0.9rem";
    wrapper.style.alignItems = "flex-start";

    if (!isUser) {
        const avatar = document.createElement("div");
        avatar.classList.add("avatar");
        avatar.textContent = "AI";
        wrapper.appendChild(avatar);
    }

    const contentDiv = document.createElement("div");
    contentDiv.innerHTML = content;
    wrapper.appendChild(contentDiv);

    if (isUser) {
        const avatar = document.createElement("div");
        avatar.classList.add("avatar", "user");
        avatar.textContent = "You";
        wrapper.appendChild(avatar);
        wrapper.style.flexDirection = "row-reverse";
    }

    msgDiv.appendChild(wrapper);
    chat.appendChild(msgDiv);
    chat.scrollTop = chat.scrollHeight;
}

function addLoading() {
const wrapper = document.createElement("div");
wrapper.style.display = "flex";
wrapper.style.gap = "0.9rem";

const avatar = document.createElement("div");
avatar.classList.add("avatar");
avatar.textContent = "AI";
wrapper.appendChild(avatar);

const loading = document.createElement("div");
loading.classList.add("message", "bot", "loading");
loading.textContent = "Thinking";
loading.id = "loading-indicator";
wrapper.appendChild(loading);

chat.appendChild(wrapper);
chat.scrollTop = chat.scrollHeight;
return wrapper;
}

function removeLoading() {
const loading = document.getElementById("loading-indicator");
if (loading) loading.parentElement.remove();
}

function showChatPage() {
addLlmPage.style.display = "none";
chatPage.style.display = "flex";
}

function showAddLlmPage() {
chatPage.style.display = "none";
addLlmPage.style.display = "flex";
}

// --- Main send logic ---
// async function sendMessage() {
//     const text = input.value.trim();
//     if (!text) return;

//     if (currentLLM === null) {
//         alert("Please add and select an LLM first.");
//         return;
//     }

//     addMessage(text, true);
//     input.value = "";
//     sendBtn.disabled = true;

//     addLoading();

//     const { endpoint, apiKey, model } = llms[currentLLM];

//     try {
//         const res = await fetch(endpoint, {
//         method: "POST",
//         headers: {
//             "Content-Type": "application/json",
//             Authorization: `Bearer ${apiKey}`,
//         },
//         body: JSON.stringify({
//             model: model,
//             messages: [{ role: "user", content: text }],
//         }),
//         });

//         if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

//         const data = await res.json();
//         removeLoading();
//         const response = data.choices[0].message.content;
//         addMessage(response);
//     } catch (err) {
//         removeLoading();
//         addMessage(`Sorry, something went wrong: ${err.message}`);
//     } finally {
//         sendBtn.disabled = false;
//     }
// }

async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    if (currentLLM === null) {
        alert('Please select an LLM first');
        return;
    }

    addMessage(text, true);
    input.value = '';
    sendBtn.disabled = true;

    const { endpoint, apiKey, model } = llms[currentLLM];

    // ── Create a temporary message bubble that we'll stream into ──
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', 'bot');

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.gap = '0.9rem';

    const avatar = document.createElement('div');
    avatar.classList.add('avatar');
    avatar.textContent = 'AI';
    wrapper.appendChild(avatar);

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('markdown-body');
    contentDiv.textContent = ''; 
    wrapper.appendChild(contentDiv);

    messageDiv.appendChild(wrapper);
    chat.appendChild(messageDiv);
    chat.scrollTop = chat.scrollHeight;

    // Prepare messages with context
    const messagesToSend = [
        ...conversationHistory.slice(-4),          // last 10 messages (5 user + 5 assistant)
        { role: "user", content: text }
    ];

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: messagesToSend,
                stream: true                     
            })
        });

        if (!response.ok) {
            console.log(response)
            throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let accumulated = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.trim() === '') continue;
                if (!line.startsWith('data: ')) continue;

                const data = line.slice(6); // remove "data: "

                if (data === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(data);
                    const token = parsed.choices?.[0]?.delta?.content || '';
                    if (token) {
                        accumulated += token;
                        contentDiv.innerHTML = marked.parse(accumulated, { breaks: true, gfm: true });
                        chat.scrollTop = chat.scrollHeight;
                    }
                } catch (e) {
                    // some providers send malformed json or comments
                    console.debug('Skipping parse error:', e);
                }
            }
        }
        hljs.highlightAll();
        // Add user message to history
        conversationHistory.push({ role: "user", content: text });

        // Add assistant's full response
        conversationHistory.push({ role: "assistant", content: accumulated });

    } catch (err) {
        contentDiv.textContent = `Error: ${err.message}`;
        console.error(err);
    } finally {
        sendBtn.disabled = false;
    }
}

// Event listeners
input.addEventListener("input", () => {
sendBtn.disabled = input.value.trim().length === 0;
});

input.addEventListener("keydown", (e) => {
if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
}
});

sendBtn.addEventListener("click", sendMessage);

// LLM Management
addLlmBtn.addEventListener("click", () => {
renderLlmList();
llmModal.style.display = "flex";
});

closeModalBtn.addEventListener("click", () => {
llmModal.style.display = "none";
});

addNewBtn.addEventListener("click", () => {
llmModal.style.display = "none";
chatPage.style.display = "block";
addLlmPage.style.display = "flex";
showAddLlmPage();
});

saveLlmBtn.addEventListener("click", () => {
const model = modelNameInput.value.trim();
const endpoint = endpointUrlInput.value.trim();
const apiKey = apiKeyInput.value.trim();

if (!model || !endpoint || !apiKey) {
    alert("Please fill all fields.");
    return;
}

llms.push({ model, endpoint, apiKey });
saveLLMs();
if (currentLLM === null) currentLLM = llms.length - 1;
updateCurrentDisplay();

modelNameInput.value = "";
endpointUrlInput.value = "";
apiKeyInput.value = "";

addLlmPage.style.display = "none";
chatPage.style.display = "block";
showChatPage();
});

cancelAddBtn.addEventListener("click", () => {
addLlmPage.style.display = "none";
chatPage.style.display = "block";
showChatPage();
});

// Initial setup
updateCurrentDisplay();
setTimeout(() => {
addMessage("Welcome! Add an LLM and start your testing journey. 🚀");
}, 400);

document.getElementById('clear-context').addEventListener('click', () => {
    conversationHistory = [];
    // Optional: clear chat UI too
    chat.innerHTML = '';
    addMessage("Conversation history cleared.", false);
});
