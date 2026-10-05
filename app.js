// base URL para chamadas à API (mesma lógica de index.html)
const API_BASE = (typeof window !== 'undefined' && window.API_BASE_URL) ? window.API_BASE_URL : ((typeof location !== 'undefined' && location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api');

const pdfInput = document.getElementById("pdfInput");
const uploadStatus = document.getElementById("uploadStatus");

const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const chatBox = document.getElementById("chatBox");

const analysisBtn = document.getElementById("analysisBtn");
const analysisBox = document.getElementById("analysisBox");

/**
 * Upload via FormData + binary streams (não base64)
 * Resolve: long-tasks, memoria allocation, 413 no servidor
 */
async function uploadPDF(file) {
    try {
        uploadStatus.innerText = "Enviando arquivo...";
        
        // Validação básica
        if (!file || file.size === 0) {
            throw new Error('Arquivo vazio');
        }

        const ext = file.name.split(".").pop().toLowerCase();
        if (!['csv', 'pdf'].includes(ext)) {
            throw new Error('Formato inválido (apenas CSV e PDF)');
        }

        // Criar FormData em vez de JSON com base64
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileType', ext === 'csv' ? 'csv' : 'pdf');
        formData.append('familyId', '');

        // Obter token Firebase (se autenticado)
        const token = firebase.auth().currentUser
            ? await firebase.auth().currentUser.getIdToken()
            : null;

        // Enviar sem Content-Type (navegador define multipart/form-data + boundary)
        const res = await fetch(`${API_BASE}/uploadPDF`, {
            method: "POST",
            headers: {
                ...(token && { Authorization: `Bearer ${token}` })
                // NÃO definir Content-Type — FormData o faz automaticamente
            },
            body: formData
        });

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`Erro servidor ${res.status}: ${text}`);
        }

        const data = await res.json();
        if (data.success) {
            uploadStatus.innerText = `Importadas ${data.count} transações`;
        } else {
            uploadStatus.innerText = "Erro ao enviar arquivo";
            console.error('uploadPDF response error', data);
        }
    } catch (err) {
        uploadStatus.innerText = "Erro: " + (err.message || "Falha no upload");
        console.error('uploadPDF failed', err);
    }
}
async function askAI(question) {
    try {
        const token = firebase.auth().currentUser
            ? await firebase.auth().currentUser.getIdToken()
            : null;
        const res = await fetch(`${API_BASE}/askPDF`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token && { Authorization: `Bearer ${token}` })
            },
            body: JSON.stringify({ question, familyId: null })
        });
        const data = await res.json();
        return data.answer || data.analysis || "Sem resposta da IA.";
    } catch (err) {
        console.error(err);
        return "Erro ao consultar a IA.";
    }
}

/**
 * Gerenciamento de histórico de mensagens com limite (evita DOM crescimento indefinido)
 * MAX_MESSAGES = máximo de mensagens no DOM
 * Quando excede, remove as mais antigas (first-in-first-out)
 */
const CHAT_MAX_MESSAGES = 50;
let messageCount = 0;

function addMessage(text) {
    if (!chatBox) return;

    const div = document.createElement("div");
    div.innerText = text;
    div.className = "chat-message";
    
    chatBox.appendChild(div);
    messageCount++;

    // Limpar mensagens antigas se exceder limite
    if (messageCount > CHAT_MAX_MESSAGES) {
        const oldestMessage = chatBox.firstChild;
        if (oldestMessage) {
            oldestMessage.remove();
            messageCount--;
        }
    }

    // Scroll para o final (batch com RAF para evitar micro-jank)
    requestAnimationFrame(() => {
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

async function sendMessage() {

    const question = chatInput.value.trim();

    if (!question) return;

    chatInput.value = "";

    addMessage("Você: " + question);

    const answer = await askAI(question);

    addMessage("IA: " + answer);

}

async function getAnalysis() {
    try {
        analysisBox.innerText = "Gerando análise...";
        const token = firebase.auth().currentUser
            ? await firebase.auth().currentUser.getIdToken()
            : null;
        const res = await fetch(`${API_BASE}/analysis`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` })
            },
            body: JSON.stringify({ familyId: null })
        });
        const data = await res.json();
        if (data && data.summary) {
            analysisBox.innerText =
                `Entradas: ${data.summary.income}\n` +
                `Saídas: ${data.summary.expense}\n` +
                `Saldo: ${data.summary.balance}\n\n` +
                (data.narrative || data.analysis || "");
        } else {
            analysisBox.innerText = data.analysis || data.narrative || "Sem resposta da IA.";
        }
    } catch (err) {
        analysisBox.innerText = "Erro ao gerar análise.";
        console.error(err);
    }
}

pdfInput.addEventListener("change", async (e) => {

    const file = e.target.files[0];

    if (file) {

        await uploadPDF(file);

    }

});

sendBtn.addEventListener("click", sendMessage);

analysisBtn.addEventListener("click", getAnalysis);
