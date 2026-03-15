// base URL para chamadas à API (mesma lógica de index.html)
const API_BASE = (typeof window !== 'undefined' && window.API_BASE_URL) ? window.API_BASE_URL : ((typeof location !== 'undefined' && location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api');

const pdfInput = document.getElementById("pdfInput");
const uploadStatus = document.getElementById("uploadStatus");

const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const chatBox = document.getElementById("chatBox");

const analysisBtn = document.getElementById("analysisBtn");
const analysisBox = document.getElementById("analysisBox");

function fileToBase64(file) {

    return new Promise((resolve, reject) => {

        const reader = new FileReader();

        reader.readAsDataURL(file);

        reader.onload = () => {
            resolve(reader.result.split(",")[1]);
        };

        reader.onerror = error => reject(error);

    });

}

async function uploadPDF(file) {
    try {
        uploadStatus.innerText = "Enviando arquivo...";
        const base64 = await fileToBase64(file).catch(e => { throw new Error('Falha ao ler arquivo: ' + e.message); });
        const token = firebase.auth().currentUser
            ? await firebase.auth().currentUser.getIdToken()
            : null;
        const ext = file.name.split(".").pop().toLowerCase();
        const payload = {
            fileType: ext === 'csv' ? 'csv' : 'pdf',
            familyId: null,
        };
        if (ext === 'csv') payload.csvBase64 = base64;
        else payload.pdfBase64 = base64;

        const res = await fetch(`${API_BASE}/uploadPDF`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token && { Authorization: `Bearer ${token}` })
            },
            body: JSON.stringify(payload)
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
        uploadStatus.innerText = "Erro ao enviar PDF";
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

function addMessage(text) {

    const div = document.createElement("div");

    div.innerText = text;

    chatBox.appendChild(div);

    chatBox.scrollTop = chatBox.scrollHeight;

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
